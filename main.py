#!/usr/bin/env python3
"""The Leap - a whale breaching toward a golden-ringed planet.

Procedural image generator for make.fun's ai-excited-01 bounty.
Python 3, standard library only. Renders one deterministic 1024x1024 PNG
to $MAKEFUN_OUTPUT_DIR/entry.png (or /output/entry.png when unset).

The scene is painted in layers on a 2x supersampled framebuffer and then
box-downscaled, which anti-aliases every silhouette. All randomness comes
from one fixed seed driving the small PRNG below, so every run produces
byte-identical output.
"""

import math
import os
import struct
import zlib

# ---------------------------------------------------------------- PRNG

SEED = 20261116


class Rng:
    """xorshift64* - tiny, fast, fully deterministic."""

    def __init__(self, seed):
        self.state = (seed * 0x9E3779B97F4A7C15 + 0x2545F4914F6CDD1D) & 0xFFFFFFFFFFFFFFFF
        if self.state == 0:
            self.state = 0x123456789ABCDEF

    def next_u64(self):
        x = self.state
        x ^= (x >> 12) & 0xFFFFFFFFFFFFFFFF
        x ^= (x << 25) & 0xFFFFFFFFFFFFFFFF
        x ^= (x >> 27) & 0xFFFFFFFFFFFFFFFF
        self.state = x
        return (x * 0x2545F4914F6CDD1D) & 0xFFFFFFFFFFFFFFFF

    def random(self):
        return (self.next_u64() >> 11) / float(1 << 53)

    def uniform(self, a, b):
        return a + (b - a) * self.random()

    def randint(self, a, b):
        return a + int(self.random() * (b - a + 1))


# ---------------------------------------------------------------- canvas

SS = 2                      # supersample factor
W = 1024 * SS               # working width
H = 1024 * SS               # working height
OUT = 1024                  # final size

buf = bytearray(W * H * 3)


def clamp255(v):
    if v < 0:
        return 0
    if v > 255:
        return 255
    return int(v)


def set_px(x, y, r, g, b):
    if 0 <= x < W and 0 <= y < H:
        i = (y * W + x) * 3
        buf[i] = r
        buf[i + 1] = g
        buf[i + 2] = b


def blend_px(x, y, r, g, b, a):
    """Alpha-blend a colour over the current pixel (a in 0..1)."""
    if 0 <= x < W and 0 <= y < H and a > 0.0:
        i = (y * W + x) * 3
        ia = 1.0 - a
        buf[i] = clamp255(buf[i] * ia + r * a)
        buf[i + 1] = clamp255(buf[i + 1] * ia + g * a)
        buf[i + 2] = clamp255(buf[i + 2] * ia + b * a)


def add_px(x, y, r, g, b, a):
    """Additive glow contribution."""
    if 0 <= x < W and 0 <= y < H and a > 0.0:
        i = (y * W + x) * 3
        buf[i] = clamp255(buf[i] + r * a)
        buf[i + 1] = clamp255(buf[i + 1] + g * a)
        buf[i + 2] = clamp255(buf[i + 2] + b * a)


def fill_rect(x0, y0, x1, y1, color):
    r, g, b = color
    row = bytes((r, g, b)) * (x1 - x0)
    for y in range(y0, y1):
        i = (y * W + x0) * 3
        buf[i:i + len(row)] = row


def splat(cx, cy, radius, color, strength, additive=False):
    """Soft round splat with quadratic falloff."""
    r, g, b = color
    x0 = max(0, int(cx - radius))
    x1 = min(W - 1, int(cx + radius))
    y0 = max(0, int(cy - radius))
    y1 = min(H - 1, int(cy + radius))
    r2 = float(radius * radius)
    put = add_px if additive else blend_px
    for y in range(y0, y1 + 1):
        dy = y - cy
        for x in range(x0, x1 + 1):
            dx = x - cx
            d2 = dx * dx + dy * dy
            if d2 < r2:
                f = 1.0 - d2 / r2
                put(x, y, r, g, b, strength * f * f)


def fill_polygon(points, color_fn):
    """Scanline polygon fill. color_fn(x, y) -> (r, g, b)."""
    ys = [p[1] for p in points]
    y0 = max(0, int(min(ys)))
    y1 = min(H - 1, int(max(ys)) + 1)
    n = len(points)
    edges = []
    for i in range(n):
        xa, ya = points[i]
        xb, yb = points[(i + 1) % n]
        if ya != yb:
            edges.append((xa, ya, xb, yb))
    for y in range(y0, y1 + 1):
        yc = y + 0.5
        xs = []
        for xa, ya, xb, yb in edges:
            if (ya <= yc < yb) or (yb <= yc < ya):
                xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            xa = max(0, int(xs[k]))
            xb = min(W - 1, int(xs[k + 1]))
            for x in range(xa, xb + 1):
                set_px(x, y, *color_fn(x, y))


def stroke(points, radius, color, alpha, additive=False):
    """Thick polyline drawn as a chain of splats."""
    put = add_px if additive else blend_px
    r, g, b = color
    for i in range(len(points) - 1):
        ax, ay = points[i]
        bx, by = points[i + 1]
        steps = max(1, int(max(abs(bx - ax), abs(by - ay)) / max(1.0, radius * 0.6)))
        for s in range(steps + 1):
            t = s / steps
            cx = ax + (bx - ax) * t
            cy = ay + (by - ay) * t
            x0 = max(0, int(cx - radius))
            x1 = min(W - 1, int(cx + radius))
            y0 = max(0, int(cy - radius))
            y1 = min(H - 1, int(cy + radius))
            r2 = float(radius * radius)
            for y in range(y0, y1 + 1):
                dy = y - cy
                for x in range(x0, x1 + 1):
                    dx = x - cx
                    d2 = dx * dx + dy * dy
                    if d2 < r2:
                        f = 1.0 - d2 / r2
                        put(x, y, r, g, b, alpha * f)


# ---------------------------------------------------------------- sky

def paint_sky():
    top = (8, 7, 34)
    mid = (26, 16, 66)
    low = (44, 24, 92)
    horizon = int(H * 0.80)
    for y in range(H):
        if y < horizon:
            t = y / horizon
            if t < 0.55:
                u = t / 0.55
                c = tuple(top[i] + (mid[i] - top[i]) * u for i in range(3))
            else:
                u = (t - 0.55) / 0.45
                c = tuple(mid[i] + (low[i] - mid[i]) * u for i in range(3))
        else:
            c = low
        row = bytes(clamp255(v) for v in c) * W
        i = y * W * 3
        buf[i:i + len(row)] = row


def paint_nebula(rng):
    blobs = [
        (0.22, 0.20, 300, (64, 30, 110)),
        (0.55, 0.12, 260, (30, 60, 110)),
        (0.30, 0.48, 340, (70, 36, 96)),
        (0.85, 0.55, 240, (52, 30, 92)),
        (0.62, 0.38, 200, (24, 70, 96)),
    ]
    for fx, fy, rad, col in blobs:
        splat(fx * W + rng.uniform(-20, 20), fy * H + rng.uniform(-20, 20),
              rad * SS, col, 0.16, additive=True)


def paint_stars(rng):
    for _ in range(650):
        x = rng.random() * W
        y = (rng.random() ** 1.4) * H * 0.86
        bright = rng.random()
        size = 1.0 + bright * 2.2
        if rng.random() < 0.22:
            col = (255, 226, 160)      # pale gold
        else:
            col = (235, 240, 255)      # white-blue
        splat(x, y, size * SS * 0.7, col, 0.35 + 0.6 * bright)
        if bright > 0.93:
            splat(x, y, size * SS * 2.0, col, 0.12, additive=True)


# ---------------------------------------------------------------- planet

PLANET_C = (1500.0, 545.0)   # centre, working coords
PLANET_R = 345.0


def planet_color(x, y):
    cx, cy = PLANET_C
    dy = (y - cy) / PLANET_R
    dx = (x - cx) / PLANET_R
    # horizontal amber bands
    band = math.sin(dy * 9.0 + math.sin(dy * 3.0) * 1.2)
    band2 = math.sin(dy * 23.0 + 1.7)
    base = (
        234 + 24 * band + 7 * band2,
        166 + 34 * band + 9 * band2,
        80 + 36 * band + 7 * band2,
    )
    # limb shading: light from upper right, shadow lower left
    shade = 0.62 + 0.38 * max(-1.0, min(1.0, (dx * 0.7 - dy * 0.5 + 0.55)))
    # soften the disc edge into the dark
    edge = max(0.0, min(1.0, (1.0 - math.sqrt(dx * dx + dy * dy)) * 6.0))
    return tuple(clamp255(c * shade * (0.25 + 0.75 * edge)) for c in base)


def paint_planet():
    cx, cy = PLANET_C
    r = PLANET_R
    # soft halo first
    splat(cx, cy, r * 1.55, (255, 176, 66), 0.20, additive=True)
    splat(cx, cy, r * 1.2, (255, 196, 92), 0.16, additive=True)
    # disc, scanline by scanline
    y0 = int(cy - r)
    y1 = int(cy + r)
    for y in range(y0, y1 + 1):
        dy = y - cy
        half = math.sqrt(max(0.0, r * r - dy * dy))
        for x in range(int(cx - half), int(cx + half) + 1):
            set_px(x, y, *planet_color(x, y))


RING_TILT = math.radians(-17.0)
RING_RX = 565.0
RING_RY = 148.0


def ring_point(theta):
    cx, cy = PLANET_C
    ex = RING_RX * math.cos(theta)
    ey = RING_RY * math.sin(theta)
    ca = math.cos(RING_TILT)
    sa = math.sin(RING_TILT)
    return (cx + ex * ca - ey * sa, cy + ex * sa + ey * ca)


def paint_ring(front):
    """Draw one half of the tilted ring. front=False draws the far side
    (behind the planet), front=True the near side crossing the disc."""
    steps = 340
    pts = []
    for i in range(steps + 1):
        t = i / steps
        if front:
            theta = math.pi * t            # lower half in ellipse space
        else:
            theta = math.pi + math.pi * t  # upper half
        pts.append(ring_point(theta))
    # wide faint glow pass, then the bright band with a darker core line
    stroke(pts, 26, (255, 190, 90), 0.10, additive=True)
    stroke(pts, 15, (255, 214, 130), 0.85)
    stroke(pts, 6, (255, 240, 200), 0.95)
    stroke(pts, 2.5, (214, 150, 70), 0.55)


# ---------------------------------------------------------------- sea

SEA_Y = int(H * 0.80)


def paint_sea(rng):
    deep = (10, 16, 52)
    mid = (18, 34, 88)
    for y in range(SEA_Y, H):
        t = (y - SEA_Y) / (H - SEA_Y)
        c = tuple(deep[i] + (mid[i] - deep[i]) * t for i in range(3))
        row = bytes(clamp255(v) for v in c) * W
        i = y * W * 3
        buf[i:i + len(row)] = row
    # moon-path style glints under the planet
    for _ in range(420):
        x = W * 0.73 + rng.uniform(-260, 260) * (0.4 + rng.random())
        y = SEA_Y + rng.random() * (H - SEA_Y)
        w = rng.uniform(6, 42)
        a = rng.uniform(0.05, 0.30) * (1.0 - (y - SEA_Y) / (H - SEA_Y) * 0.6)
        stroke([(x - w, y), (x + w, y)], 2.2, (255, 205, 120), a, additive=True)
    # wave crest foam: dotted bright lines riding slow swells
    for k in range(9):
        base_y = SEA_Y + 26 + k * 24
        pts = []
        for x in range(0, W, 16):
            yy = base_y + math.sin(x * 0.006 + k * 1.9) * 7 + math.sin(x * 0.021 + k) * 3
            pts.append((float(x), yy))
        for (x, y) in pts:
            if rng.random() < 0.55:
                splat(x + rng.uniform(-5, 5), y + rng.uniform(-2, 2),
                      rng.uniform(2.5, 6.5), (210, 240, 255),
                      rng.uniform(0.15, 0.5))


# ---------------------------------------------------------------- whale

# spine: cubic bezier from the tail in the water to the head by the planet
SPINE_P = ((268.0, 1708.0), (330.0, 1080.0), (760.0, 700.0), (1308.0, 618.0))


def bezier(t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = SPINE_P
    u = 1.0 - t
    x = u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3
    y = u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3
    return (x, y)


def bezier_tangent(t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = SPINE_P
    u = 1.0 - t
    x = 3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2)
    y = 3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2)
    return (x, y)


def half_width(t):
    """Body half-thickness along the spine: slim peduncle, deep mid-body,
    and a long rounded taper so the snout closes to a soft point."""
    if t < 0.06:
        return 16.0 + t / 0.06 * 46.0
    body = math.sin(math.pi * (0.08 + 0.84 * t)) ** 0.75
    w = 26.0 + 122.0 * body
    if t > 0.84:
        u = (t - 0.84) / 0.16
        w *= 1.0 - u * u * 0.82
    return w


def spine_frame(steps=72):
    frame = []
    for i in range(steps + 1):
        t = i / steps
        x, y = bezier(t)
        tx, ty = bezier_tangent(t)
        ln = math.hypot(tx, ty) or 1.0
        nx, ny = -ty / ln, tx / ln     # normal; points to the belly side
        frame.append((t, x, y, nx, ny, half_width(t)))
    return frame


def whale_body_color(x, y):
    # gentle vertical shading in luminous teal-blue
    t = y / H
    base = (34 + 26 * t, 108 + 30 * t, 148 + 34 * t)
    return tuple(clamp255(c) for c in base)


def paint_whale(frame):
    upper = [(x - nx * w, y - ny * w) for (t, x, y, nx, ny, w) in frame]
    lower = [(x + nx * w, y + ny * w) for (t, x, y, nx, ny, w) in frame]
    outline = upper + lower[::-1]
    fill_polygon(outline, whale_body_color)

    # pale belly: the lower strip of the body, feathered in and out at
    # both ends so it never ends in a hard straight cut
    belly_top = []
    belly_bot = []
    for (t, x, y, nx, ny, w) in frame:
        if 0.16 <= t <= 0.97:
            e = min(1.0, (t - 0.16) / 0.12, (0.97 - t) / 0.09)
            top_f = 0.97 - (0.97 - 0.18) * e
            belly_top.append((x + nx * w * top_f, y + ny * w * top_f))
            belly_bot.append((x + nx * w * 0.97, y + ny * w * 0.97))
    fill_polygon(belly_top + belly_bot[::-1],
                 lambda x, y: (196, 226, 232))

    # throat grooves: a few soft lines under the head
    for k in range(4):
        pts = []
        for (t, x, y, nx, ny, w) in frame:
            if 0.74 <= t <= 0.96:
                f = 0.30 + k * 0.15
                pts.append((x + nx * w * f, y + ny * w * f))
        stroke(pts, 2.0, (150, 190, 205), 0.35)

    # pectoral fin: a slim blade swept back along the lower mid-body,
    # its base following the belly outline between two spine stations
    nf = len(frame) - 1
    _, ax, ay, anx, any_, aw = frame[int(0.55 * nf)]
    _, bx, by, bnx, bny, bw = frame[int(0.67 * nf)]
    ttx, tty = bezier_tangent(0.61)
    tln = math.hypot(ttx, tty) or 1.0
    ttx, tty = ttx / tln, tty / tln
    mx, my = bezier(0.61)
    mnx, mny = -tty, ttx
    tip = (mx + mnx * 205 - ttx * 150, my + mny * 205 - tty * 150)
    fin = [
        (ax + anx * aw * 0.92, ay + any_ * aw * 0.92),
        (bx + bnx * bw * 0.92, by + bny * bw * 0.92),
        tip,
    ]
    fill_polygon(fin, lambda x, y: (30, 96, 138))

    # tail flukes at the peduncle, still kicking the surface
    t0, x0, y0, nx0, ny0, w0 = frame[0]
    tx, ty = bezier_tangent(0.0)
    ln = math.hypot(tx, ty) or 1.0
    tx, ty = tx / ln, ty / ln
    base = (x0 - tx * 26, y0 - ty * 26)
    left = (base[0] - nx0 * 148 - tx * 96, base[1] - ny0 * 148 - ty * 96)
    right = (base[0] + nx0 * 144 - tx * 88, base[1] + ny0 * 144 - ty * 88)
    notch = (base[0] - tx * 66, base[1] - ty * 66)
    fill_polygon([base, left, notch], lambda x, y: (28, 94, 132))
    fill_polygon([base, notch, right], lambda x, y: (28, 94, 132))

    # gold rim light along the sunward (upper) edge
    rim = [(x - nx * w * 1.0, y - ny * w * 1.0) for (t, x, y, nx, ny, w) in frame if t >= 0.05]
    stroke(rim, 13, (255, 176, 80), 0.16, additive=True)
    stroke(rim, 6, (255, 196, 96), 0.55)
    stroke(rim, 2.6, (255, 228, 160), 0.85)

    # eye: dark bead with a glint, just above the mouth line
    et, ex, ey, enx, eny, ew = frame[int(0.90 * (len(frame) - 1))]
    eye = (ex + enx * ew * 0.42, ey + eny * ew * 0.42)
    splat(eye[0], eye[1], 13, (6, 12, 24), 0.95)
    splat(eye[0] + 4, eye[1] - 4, 4.5, (255, 250, 235), 0.95)

    # mouth: a gentle open curve from the snout sweeping back and down
    mouth = []
    for i in range(25):
        u = i / 24
        t = 0.865 + u * 0.13
        x, y = bezier(t)
        tx2, ty2 = bezier_tangent(t)
        ln2 = math.hypot(tx2, ty2) or 1.0
        nx2, ny2 = -ty2 / ln2, tx2 / ln2
        w2 = half_width(t)
        drop = math.sin(u * math.pi) * 16.0
        mouth.append((x + nx2 * w2 * 0.86, y + ny2 * w2 * 0.86 + drop))
    stroke(mouth, 3.4, (10, 26, 44), 0.8)


def paint_submerge():
    """Fade whatever is below the waterline into the sea, left side only:
    the tail reads as still in the water, not pasted on top of it."""
    deep = (10, 16, 52)
    mid = (18, 34, 88)
    x_max = 920
    for y in range(SEA_Y, H):
        t = (y - SEA_Y) / (H - SEA_Y)
        a = 0.45 + 0.48 * t
        ia = 1.0 - a
        cr = deep[0] + (mid[0] - deep[0]) * t
        cg = deep[1] + (mid[1] - deep[1]) * t
        cb = deep[2] + (mid[2] - deep[2]) * t
        base = y * W * 3
        for x in range(x_max):
            i = base + x * 3
            buf[i] = clamp255(buf[i] * ia + cr * a)
            buf[i + 1] = clamp255(buf[i + 1] * ia + cg * a)
            buf[i + 2] = clamp255(buf[i + 2] * ia + cb * a)


# ---------------------------------------------------------------- spray

def paint_splash(rng, frame):
    # crown of spray where the tail leaves the water
    cx, cy = 300.0, float(SEA_Y + 26)
    for _ in range(240):
        ang = rng.uniform(-math.pi * 0.92, -math.pi * 0.08)
        dist = rng.uniform(20, 300) * (0.5 + rng.random() * 0.8)
        x = cx + math.cos(ang) * dist * 0.95
        y = cy + math.sin(ang) * dist * 0.8 + dist * dist * 0.00055
        splat(x, y, rng.uniform(2.5, 9.0), (225, 246, 255),
              rng.uniform(0.25, 0.8))
    # foam churn at the base
    for _ in range(160):
        x = cx + rng.uniform(-260, 260)
        y = cy + rng.uniform(-14, 60)
        splat(x, y, rng.uniform(3, 11), (235, 250, 255), rng.uniform(0.2, 0.6))

    # glowing droplets shed off the belly and trailing edge, arcing
    # along the leap's path toward the planet
    for i in range(340):
        t = rng.uniform(0.03, 1.06)
        tc = min(t, 1.0)
        x, y = bezier(tc)
        tx, ty = bezier_tangent(tc)
        ln = math.hypot(tx, ty) or 1.0
        tx, ty = tx / ln, ty / ln
        nx, ny = -ty, tx
        shed = half_width(tc) * rng.uniform(0.55, 1.25)
        lag = rng.uniform(0, 110)
        x += nx * shed - tx * lag
        y += ny * shed - ty * lag
        if t > 1.0:
            x += tx * (t - 1.0) * 620
            y += ty * (t - 1.0) * 620
        x += rng.uniform(-22, 22)
        y += rng.uniform(-16, 26)
        size = rng.uniform(2.0, 7.5) * (1.15 - t * 0.55)
        a = rng.uniform(0.18, 0.6)
        splat(x, y, size, (170, 240, 255), a, additive=True)
        if rng.random() < 0.3:
            splat(x, y, size * 0.45, (255, 255, 255), a)


# ---------------------------------------------------------------- PNG out

def downscale():
    out = bytearray(OUT * OUT * 3)
    for oy in range(OUT):
        for ox in range(OUT):
            r = g = b = 0
            base = ((oy * SS) * W + ox * SS) * 3
            for dy in range(SS):
                i = base + dy * W * 3
                r += buf[i] + buf[i + 3]
                g += buf[i + 1] + buf[i + 4]
                b += buf[i + 2] + buf[i + 5]
            j = (oy * OUT + ox) * 3
            n = SS * SS
            out[j] = r // n
            out[j + 1] = g // n
            out[j + 2] = b // n
    return out


def encode_png(pixels):
    raw = bytearray()
    stride = OUT * 3
    prev = bytearray(stride)
    for y in range(OUT):
        row = pixels[y * stride:(y + 1) * stride]
        # choose between Sub and Up by summed absolute filtered bytes
        sub = bytearray(stride)
        up = bytearray(stride)
        ssum = 0
        usum = 0
        for i in range(stride):
            left = row[i - 3] if i >= 3 else 0
            sv = (row[i] - left) & 0xFF
            uv = (row[i] - prev[i]) & 0xFF
            sub[i] = sv
            up[i] = uv
            ssum += sv if sv < 128 else 256 - sv
            usum += uv if uv < 128 else 256 - uv
        if ssum <= usum:
            raw.append(1)
            raw += sub
        else:
            raw.append(2)
            raw += up
        prev = bytearray(row)

    def chunk(kind, data):
        c = struct.pack(">I", len(data)) + kind + data
        return c + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", OUT, OUT, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", ihdr)
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    return png


def main():
    rng = Rng(SEED)
    paint_sky()
    paint_nebula(rng)
    paint_stars(rng)
    paint_ring(front=False)     # far side of the ring, behind the disc
    paint_planet()
    paint_ring(front=True)      # near side crosses the planet's lower edge
    paint_sea(rng)
    frame = spine_frame()
    paint_whale(frame)
    paint_submerge()
    paint_splash(rng, frame)

    png = encode_png(downscale())
    out_dir = os.environ.get("MAKEFUN_OUTPUT_DIR") or "/output"
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "entry.png")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, len(png), "bytes")


if __name__ == "__main__":
    main()
