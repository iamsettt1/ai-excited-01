#!/usr/bin/env python3
"""The Leap - a colossal whale breaching toward a golden-ringed planet.

Procedural image generator for make.fun competition ai-excited-01.
Python 3, standard library only, fully deterministic (one fixed seed).
Writes a 1024x1024 PNG named entry.png into $MAKEFUN_OUTPUT_DIR
(or /output when the variable is unset).
"""

import math
import os
import struct
import zlib
import binascii

W = 1024
H = 1024
SEED = 20261116


# --------------------------------------------------------------------------
# Deterministic PRNG (splitmix64) - no clock, no environment, no hash order.
# --------------------------------------------------------------------------
class Rng:
    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFFFFFFFFFF

    def next_u64(self):
        self.state = (self.state + 0x9E3779B97F4A7C15) & 0xFFFFFFFFFFFFFFFF
        z = self.state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & 0xFFFFFFFFFFFFFFFF
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & 0xFFFFFFFFFFFFFFFF
        return z ^ (z >> 31)

    def random(self):
        return (self.next_u64() >> 11) / float(1 << 53)

    def uniform(self, a, b):
        return a + (b - a) * self.random()


def ihash(x, y):
    """Deterministic integer hash noise in [0, 1)."""
    n = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / float(1 << 24)


def clamp(v, a=0.0, b=1.0):
    if v < a:
        return a
    if v > b:
        return b
    return v


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(a, b, x):
    t = clamp((x - a) / (b - a))
    return t * t * (3.0 - 2.0 * t)


# --------------------------------------------------------------------------
# Frame buffer helpers (RGB bytearray).
# --------------------------------------------------------------------------
buf = bytearray(W * H * 3)


def set_px(x, y, r, g, b):
    i = (y * W + x) * 3
    buf[i] = int(clamp(r, 0, 255))
    buf[i + 1] = int(clamp(g, 0, 255))
    buf[i + 2] = int(clamp(b, 0, 255))


def add_px(x, y, r, g, b, amt):
    i = (y * W + x) * 3
    buf[i] = int(clamp(buf[i] + r * amt, 0, 255))
    buf[i + 1] = int(clamp(buf[i + 1] + g * amt, 0, 255))
    buf[i + 2] = int(clamp(buf[i + 2] + b * amt, 0, 255))


def blend_px(x, y, r, g, b, a):
    i = (y * W + x) * 3
    ia = 1.0 - a
    buf[i] = int(clamp(buf[i] * ia + r * a, 0, 255))
    buf[i + 1] = int(clamp(buf[i + 1] * ia + g * a, 0, 255))
    buf[i + 2] = int(clamp(buf[i + 2] * ia + b * a, 0, 255))


def disc(cx, cy, rad, r, g, b, alpha=1.0, soft=1.5):
    """Filled anti-aliased disc centred at (cx, cy)."""
    x0 = max(0, int(cx - rad - 2))
    x1 = min(W - 1, int(cx + rad + 2))
    y0 = max(0, int(cy - rad - 2))
    y1 = min(H - 1, int(cy + rad + 2))
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            d = math.hypot(x - cx, y - cy)
            a = clamp((rad - d) / soft + 0.5) * alpha
            if a > 0.0:
                blend_px(x, y, r, g, b, a)


def glow(cx, cy, rad, r, g, b, strength):
    """Soft radial light falloff added over a bounding box."""
    x0 = max(0, int(cx - rad))
    x1 = min(W - 1, int(cx + rad))
    y0 = max(0, int(cy - rad))
    y1 = min(H - 1, int(cy + rad))
    inv = 1.0 / (rad * rad)
    for y in range(y0, y1 + 1):
        dy = y - cy
        for x in range(x0, x1 + 1):
            dx = x - cx
            d2 = dx * dx + dy * dy
            if d2 < rad * rad:
                f = 1.0 - d2 * inv
                add_px(x, y, r, g, b, strength * f * f)


# --------------------------------------------------------------------------
# Sky: indigo-to-violet gradient, nebula wash, stars.
# --------------------------------------------------------------------------
def paint_sky():
    top = (7, 9, 34)
    mid = (24, 16, 62)
    low = (44, 24, 84)
    # Nebula blobs: (cx, cy, radius, r, g, b)
    blobs = [
        (235, 215, 330, 70, 60, 150),
        (830, 610, 300, 30, 110, 130),
        (505, 105, 260, 120, 55, 130),
        (120, 700, 260, 40, 60, 140),
    ]
    for y in range(H):
        t = y / (H - 1)
        if t < 0.55:
            k = t / 0.55
            r = lerp(top[0], mid[0], k)
            g = lerp(top[1], mid[1], k)
            b = lerp(top[2], mid[2], k)
        else:
            k = (t - 0.55) / 0.45
            r = lerp(mid[0], low[0], k)
            g = lerp(mid[1], low[1], k)
            b = lerp(mid[2], low[2], k)
        for x in range(W):
            nr = ng = nb = 0.0
            for (cx, cy, rad, cr, cg, cb) in blobs:
                dx = x - cx
                dy = y - cy
                d2 = dx * dx + dy * dy
                rr = rad * rad
                if d2 < rr:
                    f = 1.0 - d2 / rr
                    f = f * f * 0.16
                    nr += cr * f
                    ng += cg * f
                    nb += cb * f
            set_px(x, y, r + nr, g + ng, b + nb)


def paint_stars(rng):
    for _ in range(430):
        x = rng.uniform(0, W - 1)
        y = rng.uniform(0, 900)
        bright = rng.random()
        rad = 0.8 + bright * bright * 1.6
        warm = rng.random()
        r = lerp(210, 255, warm)
        g = lerp(220, 235, warm)
        b = lerp(255, 190, warm)
        a = 0.35 + 0.65 * bright
        disc(x, y, rad, r, g, b, alpha=a, soft=1.2)
        if bright > 0.93:  # a few sparkle crosses
            for (ox, oy) in ((3, 0), (-3, 0), (0, 3), (0, -3)):
                disc(x + ox, y + oy, 0.8, r, g, b, alpha=a * 0.5, soft=1.0)


# --------------------------------------------------------------------------
# Planet and ring.
# --------------------------------------------------------------------------
PCX, PCY, PRAD = 738, 262, 176
RING_A, RING_B = 292, 80
RING_TILT = -0.30  # radians
BANDS = [
    (255, 228, 158),
    (247, 196, 96),
    (255, 240, 198),
    (224, 138, 52),
    (250, 205, 110),
    (198, 104, 40),
    (255, 222, 150),
    (238, 168, 74),
    (214, 122, 46),
    (252, 214, 138),
]


def ring_field(x, y):
    """Return (norm, ey) for the tilted ring ellipse."""
    dx = x - PCX
    dy = y - PCY
    c = math.cos(RING_TILT)
    s = math.sin(RING_TILT)
    ex = dx * c + dy * s
    ey = -dx * s + dy * c
    norm = math.hypot(ex / RING_A, ey / RING_B)
    return norm, ey


def paint_ring(behind):
    x0 = int(PCX - RING_A - 30)
    x1 = int(PCX + RING_A + 30)
    y0 = int(PCY - RING_A * 0.45 - 30)
    y1 = int(PCY + RING_A * 0.45 + 30)
    for y in range(max(0, y0), min(H - 1, y1) + 1):
        for x in range(max(0, x0), min(W - 1, x1) + 1):
            norm, ey = ring_field(x, y)
            if norm < 0.80 or norm > 1.22:
                continue
            if behind and ey >= 0:
                continue
            if not behind and ey < 0:
                continue
            # Band coverage with soft inner/outer edges.
            cov = smoothstep(0.80, 0.88, norm) * (1.0 - smoothstep(1.13, 1.22, norm))
            if cov <= 0.0:
                continue
            # Brightness varies along the band: gaps and streaks.
            streak = 0.82 + 0.18 * math.sin(norm * 46.0 + math.sin(x * 0.013) * 2.0)
            shade = 0.72 + 0.38 * clamp((norm - 0.80) / 0.42)
            if behind:
                # Dimmer overall, with the planet's soft shadow falling
                # across the far ring on the side away from the light.
                shade *= 0.82
                shade *= 0.78 + 0.22 * clamp((x - (PCX - 280)) / 220.0)
            r = 252 * streak * shade
            g = 203 * streak * shade
            b = 112 * streak * shade
            blend_px(x, y, r, g, b, cov * 0.96)


def paint_planet():
    x0 = int(PCX - PRAD - 2)
    x1 = int(PCX + PRAD + 2)
    y0 = int(PCY - PRAD - 2)
    y1 = int(PCY + PRAD + 2)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = x - PCX
            dy = y - PCY
            d2 = dx * dx + dy * dy
            if d2 > (PRAD + 1.5) * (PRAD + 1.5):
                continue
            d = math.sqrt(d2)
            cov = clamp((PRAD - d) / 1.5 + 0.5)
            if cov <= 0.0:
                continue
            nx = dx / PRAD
            ny = dy / PRAD
            nz = math.sqrt(max(0.0, 1.0 - nx * nx - ny * ny))
            # Horizontal bands with a gentle wobble.
            band_t = 0.5 + 0.5 * ny + 0.045 * math.sin(nx * 5.2 + ny * 2.0)
            bi = int(clamp(band_t, 0.0, 0.999) * len(BANDS))
            br, bg, bb = BANDS[bi]
            # Band edge softening.
            frac = clamp(band_t, 0.0, 0.999) * len(BANDS) - bi
            if frac > 0.86 and bi + 1 < len(BANDS):
                k = (frac - 0.86) / 0.14
                nr, ng, nb = BANDS[bi + 1]
                br = lerp(br, nr, k)
                bg = lerp(bg, ng, k)
                bb = lerp(bb, nb, k)
            # Sphere shading: light from upper right, limb darkening.
            light = clamp(0.30 + 0.85 * (nx * 0.52 - ny * 0.48 + nz * 0.62))
            shade = 0.42 + 0.62 * light
            # A darker storm oval low on the disc.
            sx = (nx - 0.28) / 0.30
            sy = (ny - 0.30) / 0.13
            storm = math.exp(-(sx * sx + sy * sy))
            br = lerp(br, 176, storm * 0.45)
            bg = lerp(bg, 92, storm * 0.45)
            bb = lerp(bb, 40, storm * 0.45)
            blend_px(x, y, br * shade, bg * shade, bb * shade, cov)


# --------------------------------------------------------------------------
# Sea.
# --------------------------------------------------------------------------
def sea_surface(x):
    return 842.0 + 9.0 * math.sin(x * 0.011 + 1.7) + 5.0 * math.sin(x * 0.027 + 0.4)


def paint_sea():
    for y in range(800, H):
        for x in range(W):
            surf = sea_surface(x)
            depth = y - surf
            if depth < -3.0:
                continue
            cov = clamp(depth / 3.0 + 0.5)
            t = clamp((y - 838) / 186.0)
            r = lerp(16, 7, t)
            g = lerp(24, 10, t)
            b = lerp(58, 30, t)
            # Long swell shading bands moving down the frame.
            swell = 0.5 + 0.5 * math.sin(y * 0.11 + math.sin(x * 0.012) * 2.4 + x * 0.004)
            r += swell * 7
            g += swell * 11
            b += swell * 20
            # Golden reflection column under the planet.
            rx = abs(x - (PCX + 18 * math.sin(y * 0.05)))
            if rx < 150:
                shim = ihash(x // 3, y // 2)
                if shim > 0.62:
                    f = (1.0 - rx / 150.0) * (shim - 0.62) * 1.1 * clamp(depth / 60.0)
                    r += 200 * f
                    g += 140 * f
                    b += 45 * f
            # Foam right at the crest line.
            if depth < 3.2:
                foam = clamp(1.0 - depth / 3.2) * (0.55 + 0.45 * ihash(x // 2, 7))
                r = lerp(r, 225, foam)
                g = lerp(g, 244, foam)
                b = lerp(b, 248, foam)
            blend_px(x, y, r, g, b, cov)


def paint_wave_foam():
    # Secondary foam crest lines lower in the sea.
    for (off, amp, phase) in ((46, 5, 0.9), (96, 7, 2.3), (152, 8, 4.1)):
        for x in range(W):
            cy = 842 + off + amp * math.sin(x * 0.013 + phase) + 4 * math.sin(x * 0.031 + phase * 2.0)
            for dy in (-1, 0, 1):
                y = int(cy) + dy
                if 0 <= y < H:
                    n = ihash(x // 2, off)
                    if n > 0.52:
                        a = (0.30 - abs(dy) * 0.10) * (n - 0.52) * 1.5
                        blend_px(x, y, 205, 238, 245, clamp(a, 0.0, 0.38))


# --------------------------------------------------------------------------
# Whale: body as a distance field around a curved, tapered spine.
# --------------------------------------------------------------------------
SPINE_KEYS = [  # (t, radius)
    (0.00, 9.0),
    (0.16, 40.0),
    (0.40, 84.0),
    (0.64, 97.0),
    (0.84, 84.0),
    (1.00, 57.0),
]


def spine_radius(t):
    for i in range(len(SPINE_KEYS) - 1):
        t0, r0 = SPINE_KEYS[i]
        t1, r1 = SPINE_KEYS[i + 1]
        if t0 <= t <= t1:
            k = (t - t0) / (t1 - t0)
            k = k * k * (3.0 - 2.0 * k)
            return lerp(r0, r1, k)
    return SPINE_KEYS[-1][1]


def spine_point(t):
    # Cubic Bezier: tail in the water (lower-left) to head aimed at planet.
    p0 = (198.0, 782.0)
    p1 = (292.0, 592.0)
    p2 = (428.0, 428.0)
    p3 = (628.0, 338.0)
    mt = 1.0 - t
    x = (mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0]
         + 3 * mt * t * t * p2[0] + t ** 3 * p3[0])
    y = (mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1]
         + 3 * mt * t * t * p2[1] + t ** 3 * p3[1])
    return x, y


SPINE_SAMPLES = []
for _i in range(25):
    _t = _i / 24.0
    SPINE_SAMPLES.append((_t, spine_point(_t), spine_radius(_t)))

# A finer sampling of the same spine for the body pass: with too few
# segments the distance field shows scalloped seams along the belly.
SPINE_FINE = []
for _i in range(57):
    _t = _i / 56.0
    SPINE_FINE.append((_t, spine_point(_t), spine_radius(_t)))


def whale_field(x, y, samples=SPINE_SAMPLES):
    """Return (signed distance, t at closest point, lateral offset vector)."""
    best = 1e18
    bt = 0.0
    bx = by = 0.0
    for i in range(len(samples) - 1):
        t0, (ax, ay), r0 = samples[i]
        t1, (bx2, by2), r1 = samples[i + 1]
        vx = bx2 - ax
        vy = by2 - ay
        wx = x - ax
        wy = y - ay
        seg2 = vx * vx + vy * vy
        u = clamp((wx * vx + wy * vy) / seg2, 0.0, 1.0)
        px = ax + vx * u
        py = ay + vy * u
        d = math.hypot(x - px, y - py) - lerp(r0, r1, u)
        if d < best:
            best = d
            bt = lerp(t0, t1, u)
            bx = x - px
            by = y - py
    return best, bt, bx, by


def paint_whale():
    x0, y0, x1, y1 = 90, 215, 760, 905
    sunx, suny = 0.55, -0.83  # toward the planet
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            d, t, ox, oy = whale_field(x, y, SPINE_FINE)
            if d > 2.0:
                continue
            cov = clamp(-d / 1.6 + 0.5)
            if cov <= 0.0:
                continue
            om = math.hypot(ox, oy)
            if om < 1e-6:
                sun = 0.0
                lat = 0.0
            else:
                sun = (ox * sunx + oy * suny) / om  # 1 = planet side
                lat = clamp(om / max(1.0, spine_radius(t)))
            # Base body: luminous teal back, pale belly.
            belly = clamp(-sun * 1.15 + 0.12)
            r = lerp(46, 208, belly)
            g = lerp(148, 236, belly)
            b = lerp(178, 240, belly)
            # Lengthwise shading: head a touch brighter, tail deeper.
            shade = 0.82 + 0.26 * t
            r *= shade
            g *= shade
            b *= shade
            # Very subtle flank shading, kept faint so the body reads
            # as one smooth form rather than a ribbed tube.
            band = 0.985 + 0.015 * math.sin(t * 20.0 + lat * 3.0)
            r *= band
            g *= band
            b *= band
            # Throat pleats: fine curved grooves fanning over the pale
            # throat just behind the head, a hallmark of a rorqual whale.
            if 0.60 < t < 0.985 and sun < -0.18:
                pleat = math.sin((t - 0.60) * 95.0 + lat * 4.5)
                if pleat > 0.78:
                    pk = (pleat - 0.78) / 0.22 * clamp(-sun) * 0.13
                    r *= (1.0 - pk)
                    g *= (1.0 - pk)
                    b *= (1.0 - pk)
            # Gold rim light hugging the planet-facing edge.
            rim = clamp((d + 15.0) / 15.0) * clamp((sun - 0.15) / 0.6)
            if rim > 0.0:
                r = lerp(r, 255, rim * 0.85)
                g = lerp(g, 196, rim * 0.85)
                b = lerp(b, 92, rim * 0.85)
            blend_px(x, y, r, g, b, cov)


def paint_rim_glow():
    """Golden halo hugging the whale's planet-facing silhouette."""
    x0, y0, x1, y1 = 90, 205, 770, 905
    sunx, suny = 0.55, -0.83
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            d, t, ox, oy = whale_field(x, y)
            if d <= 0.0 or d > 13.0:
                continue
            om = math.hypot(ox, oy)
            if om < 1e-6:
                continue
            sun = (ox * sunx + oy * suny) / om
            if sun < 0.1:
                continue
            f = (1.0 - d / 13.0) ** 2 * clamp((sun - 0.1) / 0.7)
            add_px(x, y, 255, 190, 85, f * 0.38)


def poly_dist(x, y, poly):
    """Distance to a polygon and an inside test (even-odd)."""
    dmin = 1e18
    inside = False
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        vx = bx - ax
        vy = by - ay
        wx = x - ax
        wy = y - ay
        seg2 = vx * vx + vy * vy
        u = clamp((wx * vx + wy * vy) / seg2, 0.0, 1.0) if seg2 > 0 else 0.0
        dd = math.hypot(wx - vx * u, wy - vy * u)
        if dd < dmin:
            dmin = dd
        if (ay > y) != (by > y):
            xin = ax + (y - ay) / (by - ay) * (bx - ax)
            if x < xin:
                inside = not inside
    return (-dmin if inside else dmin)


def paint_poly(poly, r, g, b, shade_top=1.0, shade_bot=0.8):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    x0 = max(0, int(min(xs)) - 3)
    x1 = min(W - 1, int(max(xs)) + 3)
    y0 = max(0, int(min(ys)) - 3)
    y1 = min(H - 1, int(max(ys)) + 3)
    ymin, ymax = min(ys), max(ys)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            d = poly_dist(x, y, poly)
            if d > 2.0:
                continue
            cov = clamp(-d / 1.6 + 0.5)
            if cov <= 0.0:
                continue
            k = (y - ymin) / max(1.0, ymax - ymin)
            s = lerp(shade_top, shade_bot, k)
            blend_px(x, y, r * s, g * s, b * s, cov)


def paint_tail_and_fin():
    tx, ty = spine_point(0.0)
    # Tail flukes: two swept shapes fanning from the tail stock.
    upper = [(tx + 6, ty - 4), (tx - 74, ty - 62), (tx - 30, ty + 2), (tx - 66, ty + 30)]
    lower = [(tx + 6, ty + 6), (tx - 58, ty + 74), (tx - 18, ty + 16), (tx + 2, ty + 44)]
    paint_poly(upper, 52, 156, 184, 1.05, 0.85)
    paint_poly(lower, 44, 138, 168, 0.95, 0.75)
    # Pectoral fin below the belly, mid-body.
    fx, fy = spine_point(0.70)
    fin = [(fx - 6, fy + 52), (fx + 58, fy + 118), (fx + 74, fy + 112), (fx + 26, fy + 44)]
    paint_poly(fin, 40, 132, 164, 0.95, 0.7)


def paint_face():
    hx, hy = spine_point(0.965)
    # Eye: dark bead with a bright catchlight, on the planet-facing flank.
    ex, ey = hx - 6, hy - 14
    disc(ex, ey, 7.5, 10, 22, 30, alpha=1.0, soft=1.2)
    disc(ex + 2.4, ey - 2.4, 2.4, 255, 255, 255, alpha=0.95, soft=1.0)
    # Mouth: a short curve under the nose, drooping at the front so
    # the jaw reads as slightly open at the peak of the leap.
    nose_x, nose_y = spine_point(1.0)
    pts = []
    for i in range(13):
        u = i / 12.0
        mx = lerp(nose_x + 30, nose_x - 50, u)
        my = lerp(nose_y + 38, nose_y + 42, u) + (1.0 - u) * (1.0 - u) * 9.0
        pts.append((mx, my))
    for i in range(len(pts) - 1):
        ax, ay = pts[i]
        bx, by = pts[i + 1]
        steps = 7
        for s in range(steps):
            u = s / steps
            disc(lerp(ax, bx, u), lerp(ay, by, u), 2.6, 12, 40, 52, alpha=0.85, soft=1.1)


# --------------------------------------------------------------------------
# Splash, spray fan and the glowing droplet trail.
# --------------------------------------------------------------------------
def paint_splash(rng):
    sx, sy = 212, 838
    # Foam pool where the tail leaves the water.
    for _ in range(120):
        a = rng.uniform(0, math.tau)
        rr = rng.random() ** 0.5
        x = sx + math.cos(a) * rr * 95
        y = sy + math.sin(a) * rr * 20 + 6
        rad = rng.uniform(2.0, 7.5) * (1.0 - rr * 0.5)
        disc(x, y, rad, 232, 248, 250, alpha=0.75, soft=1.6)
    # Splash crown spikes: irregular heights, widths and lean, so the
    # crown reads as bursting water rather than a fence.
    for i in range(8):
        u = i / 7.0
        bx = sx - 72 + u * 148 + rng.uniform(-6, 6)
        wid = rng.uniform(6.0, 14.0)
        hgt = (20 + 40 * math.sin(u * math.pi)) * rng.uniform(0.7, 1.25)
        spike = [(bx - wid, sy + 5), (bx + wid, sy + 5),
                 (bx + rng.uniform(-7, 7), sy - hgt)]
        paint_poly(spike, 238, 250, 252, 1.0, 0.92)
    # Fan of spray droplets kicked up by the flukes.
    for _ in range(130):
        a = rng.uniform(-2.5, -0.5)
        v = rng.uniform(30, 165)
        x = sx + math.cos(a) * v * 0.9 + rng.uniform(-4, 4)
        y = sy + math.sin(a) * v + rng.uniform(-4, 4)
        rad = rng.uniform(1.2, 4.2)
        disc(x, y, rad, 225, 246, 250, alpha=0.8, soft=1.3)


def paint_trail(rng):
    # Droplets shed along the leap, arcing on toward the planet.
    for i in range(150):
        u = i / 149.0
        if u < 0.72:
            t = u / 0.72
            bx, by = spine_point(t)
            off = spine_radius(t) + 16 + 26 * math.sin(t * 9.0)
            x = bx - off * 0.45 + rng.uniform(-7, 7)
            y = by + off * 0.62 + rng.uniform(-7, 7)
        else:
            k = (u - 0.72) / 0.28
            hx, hy = spine_point(1.0)
            x = lerp(hx + 40, PCX - PRAD - 26, k) + rng.uniform(-9, 9)
            y = lerp(hy - 6, PCY + 66, k) + 20 * math.sin(k * math.pi) + rng.uniform(-9, 9)
        rad = rng.uniform(1.1, 3.6) * (1.0 - u * 0.35)
        gold = rng.random() < 0.4
        if gold:
            disc(x, y, rad * 2.6, 255, 196, 92, alpha=0.16, soft=rad)
            disc(x, y, rad, 255, 214, 130, alpha=0.9, soft=1.2)
        else:
            disc(x, y, rad * 2.6, 90, 220, 235, alpha=0.16, soft=rad)
            disc(x, y, rad, 190, 245, 250, alpha=0.9, soft=1.2)


def paint_shed_water(rng):
    # Sheets of water streaming off the belly and back, falling behind
    # the arc of the leap: short vertical streaks of bright droplets.
    for _ in range(210):
        t = rng.uniform(0.06, 0.92)
        bx, by = spine_point(t)
        off = spine_radius(t) * rng.uniform(0.55, 1.0)
        x = bx - off * 0.52 + rng.uniform(-5, 5)
        y = by + off * 0.78
        fall = rng.uniform(8, 64) * (1.05 - t * 0.5)
        steps = max(2, int(fall / 7))
        for s in range(steps):
            k = s / steps
            disc(x + k * 3.0, y + k * fall, rng.uniform(1.0, 2.6),
                 200, 240, 248, alpha=0.55 * (1.0 - k * 0.6), soft=1.2)


def paint_vignette():
    cx, cy = W / 2.0, H / 2.0
    maxd2 = cx * cx + cy * cy
    for y in range(H):
        dy2 = (y - cy) * (y - cy)
        for x in range(W):
            d2 = (x - cx) * (x - cx) + dy2
            f = 1.0 - 0.20 * smoothstep(0.25, 1.0, d2 / maxd2)
            i = (y * W + x) * 3
            buf[i] = int(buf[i] * f)
            buf[i + 1] = int(buf[i + 1] * f)
            buf[i + 2] = int(buf[i + 2] * f)


# --------------------------------------------------------------------------
# PNG encoding (zlib streams, Sub filter, proper chunk checksums).
# --------------------------------------------------------------------------
def write_png(path):
    raw = bytearray()
    stride = W * 3
    for y in range(H):
        raw.append(1)  # Sub filter
        row = buf[y * stride:(y + 1) * stride]
        filt = bytearray(stride)
        for i in range(stride):
            left = row[i - 3] if i >= 3 else 0
            filt[i] = (row[i] - left) & 0xFF
        raw.extend(filt)
    comp = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", binascii.crc32(tag + data) & 0xFFFFFFFF)
        return c

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", comp)
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)
    return len(png)


def main():
    rng = Rng(SEED)
    paint_sky()
    paint_stars(rng)
    glow(PCX, PCY, PRAD * 2.1, 255, 178, 80, 0.16)
    paint_ring(behind=True)
    paint_planet()
    paint_ring(behind=False)
    paint_sea()
    paint_wave_foam()
    paint_tail_and_fin()
    paint_whale()
    paint_rim_glow()
    paint_face()
    paint_splash(rng)
    paint_shed_water(rng)
    paint_trail(rng)
    paint_vignette()
    outdir = os.environ.get("MAKEFUN_OUTPUT_DIR") or "/output"
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, "entry.png")
    size = write_png(path)
    print("wrote %s (%d bytes)" % (path, size))


if __name__ == "__main__":
    main()
