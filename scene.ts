// scene.ts — the picture itself: a colossal blue whale breaches out of a
// night ocean and arcs diagonally up toward a giant golden ringed planet
// hanging low in the sky, its spout streaming light toward the ring,
// while a tiny city below cheers with searchlights and confetti under
// aurora ribbons and stars. No text, no copied assets: every pixel is
// drawn here from palette colours and geometry.

import {
  AURORA_GREEN,
  AURORA_PINK,
  AURORA_TEAL,
  BEACON_CYAN,
  BEACON_GOLD,
  BEACON_WHITE,
  CITY_SILHOUETTE,
  CONFETTI,
  FOAM,
  PLANET_BAND,
  PLANET_HIGH,
  PLANET_MID,
  PLANET_OUTER,
  RING_BACK,
  RING_EDGE,
  RING_FRONT,
  SEA_DEEP,
  SEA_TOP,
  SKY_LOW,
  SKY_MID,
  SKY_TOP,
  SPOUT_CORE,
  SPOUT_HALO,
  STAR_COOL,
  STAR_WARM,
  STAR_WHITE,
  WAVE_LINE,
  WHALE_BELLY,
  WHALE_DARK,
  WHALE_EYE,
  WHALE_MID,
  WHALE_TOP,
  WINDOW_COOL,
  WINDOW_WARM,
  type RGB,
} from "./palette.ts";
import { Canvas, rng } from "./canvas.ts";

// --- whale path: a quadratic Bezier from tail to head -----------------
const TAIL: [number, number] = [150, 905];
const CTRL: [number, number] = [300, 720];
const HEAD: [number, number] = [585, 440];

function whalePoint(t: number): [number, number] {
  const u = 1 - t;
  return [
    u * u * TAIL[0] + 2 * u * t * CTRL[0] + t * t * HEAD[0],
    u * u * TAIL[1] + 2 * u * t * CTRL[1] + t * t * HEAD[1],
  ];
}

function whaleTangent(t: number): [number, number] {
  const dx = 2 * (1 - t) * (CTRL[0] - TAIL[0]) + 2 * t * (HEAD[0] - CTRL[0]);
  const dy = 2 * (1 - t) * (CTRL[1] - TAIL[1]) + 2 * t * (HEAD[1] - CTRL[1]);
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

// Body radius along the path: thin tail, plump middle, rounded head.
const RADIUS_KEYS: [number, number][] = [
  [0, 14],
  [0.15, 34],
  [0.35, 78],
  [0.55, 96],
  [0.75, 88],
  [0.9, 66],
  [1, 48],
];

function whaleRadius(t: number): number {
  for (let i = 0; i + 1 < RADIUS_KEYS.length; i++) {
    const [t0, r0] = RADIUS_KEYS[i];
    const [t1, r1] = RADIUS_KEYS[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return r0 + (r1 - r0) * f;
    }
  }
  return RADIUS_KEYS[RADIUS_KEYS.length - 1][1];
}

function drawSky(c: Canvas): void {
  c.vgrad(0, 0, 1024, 420, SKY_TOP, SKY_MID);
  c.vgrad(0, 420, 1024, 240, SKY_MID, SKY_LOW);
}

function drawStars(c: Canvas): void {
  const next = rng(20261116);
  const colours: RGB[] = [STAR_WHITE, STAR_WARM, STAR_COOL];
  for (let i = 0; i < 240; i++) {
    const x = next() * 1024;
    const y = next() * 620;
    const r = 0.8 + next() * 1.6;
    const a = 0.35 + next() * 0.65;
    c.disc(x, y, r, colours[Math.floor(next() * colours.length)], a);
  }
  // A dozen bright stars with a soft halo.
  for (let i = 0; i < 12; i++) {
    const x = 40 + next() * 944;
    const y = 30 + next() * 420;
    c.glow(x, y, 9, STAR_WHITE, 0.5);
    c.disc(x, y, 2.2, STAR_WHITE, 0.95);
  }
}

function drawAurora(c: Canvas): void {
  // Wide, slow, faint ribbons: one gentle sine each, so they read as
  // sky light rather than neon snakes.
  const bands: { base: number; amp: number; wave: number; phase: number; colour: RGB }[] = [
    { base: 95, amp: 26, wave: 560, phase: 0.0, colour: AURORA_GREEN },
    { base: 155, amp: 30, wave: 640, phase: 1.7, colour: AURORA_TEAL },
    { base: 210, amp: 24, wave: 520, phase: 3.4, colour: AURORA_PINK },
  ];
  for (const band of bands) {
    const pts: [number, number][] = [];
    for (let x = -40; x <= 1064; x += 40) {
      const y = band.base + band.amp * Math.sin((x / band.wave) * Math.PI * 2 + band.phase);
      pts.push([x, y]);
    }
    c.curve(pts, 44, band.colour, 0.07);
    c.curve(pts, 16, band.colour, 0.1);
  }
}

function drawPlanet(c: Canvas): void {
  const cx = 712;
  const cy = 215;
  const r = 148;
  const rot = -0.3;
  c.glow(cx, cy, 300, PLANET_MID, 0.3);
  // Far half of the ring, behind the disc (the upper arc).
  c.ellipseStroke(cx, cy, 272, 66, rot, 26, RING_BACK, 0.95, Math.PI, Math.PI * 2);
  // The disc: rim, body, then a bright highlight offset up-left.
  c.disc(cx, cy, r, PLANET_OUTER, 1);
  c.disc(cx, cy, r - 6, PLANET_MID, 1);
  // Surface bands, kept inside the disc as thin ellipses.
  c.ellipse(cx, cy - 42, 128, 9, PLANET_BAND, 0.45, -0.12);
  c.ellipse(cx, cy + 2, 136, 10, PLANET_BAND, 0.4, -0.12);
  c.ellipse(cx, cy + 46, 122, 9, PLANET_BAND, 0.45, -0.12);
  c.disc(cx - 42, cy - 40, 70, PLANET_HIGH, 0.85);
  c.disc(cx - 54, cy - 52, 34, [255, 244, 200], 0.9);
  // Near half of the ring, in front of the disc (the lower arc).
  c.ellipseStroke(cx, cy, 272, 66, rot, 26, RING_FRONT, 0.98, 0, Math.PI);
  c.ellipseStroke(cx, cy, 276, 68, rot, 7, RING_EDGE, 0.8, 0, Math.PI);
}

function drawWhale(c: Canvas): void {
  // The tail stays below the waterline, so the body starts at the sea:
  // the whale reads as bursting out of the water at the foam below.
  // Body: mid-blue discs along the Bezier, then a dark back stripe and a
  // pale belly, each offset far enough along the curve's normals to peek
  // out past the body's edge as a crescent (a stripe drawn first and
  // fully inside the body would be invisible).
  const inner: [number, number] = [0.7, -0.7]; // toward the sky (top-right)
  const steps = 90;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [x, y] = whalePoint(t);
      const [tx, ty] = whaleTangent(t);
      // Unit normals: n1 = (-ty, tx); pick the sky-side one by dot product.
      const n1: [number, number] = [-ty, tx];
      const dot = n1[0] * inner[0] + n1[1] * inner[1];
      const sky: [number, number] = dot >= 0 ? n1 : [-n1[0], -n1[1]];
      const sea: [number, number] = [-sky[0], -sky[1]];
      const r = whaleRadius(t);
      if (pass === 0) {
        c.disc(x, y, r, WHALE_MID, 1);
      } else if (pass === 1) {
        c.disc(x + sky[0] * r * 0.8, y + sky[1] * r * 0.8, r * 0.24, WHALE_TOP, 1);
      } else {
        c.disc(x + sea[0] * r * 0.8, y + sea[1] * r * 0.8, r * 0.24, WHALE_BELLY, 0.95);
      }
    }
  }

  // No dorsal fin: on this arc the back edge's normal is near-parallel
  // to the body, so a fin rooted there reads as a stray triangle in the
  // foam. The whale reads cleanly without one.

  // Pectoral fin sweeping down from the belly.
  const [px, py] = whalePoint(0.75);
  c.ellipse(px - 8, py + 62, 78, 20, WHALE_DARK, 1, 0.85);

  // Eye with a glint, mouth curve, blowhole.
  c.disc(556, 466, 7, WHALE_EYE, 1);
  c.disc(558, 464, 2.5, [255, 255, 255], 0.95);
  c.curve(
    [
      [545, 502],
      [568, 514],
      [592, 492],
    ],
    4,
    WHALE_DARK,
    0.7,
  );
  c.line(512, 440, 530, 434, 4, WHALE_DARK, 0.7);

  // Spout: light streaming from the blowhole up to the planet's ring.
  const spoutFrom: [number, number] = [528, 438];
  const spoutEnds: [number, number][] = [
    [660, 300],
    [690, 270],
    [720, 250],
    [745, 285],
    [770, 320],
    [640, 330],
  ];
  c.glow(spoutFrom[0], spoutFrom[1], 60, SPOUT_HALO, 0.5);
  for (const [ex, ey] of spoutEnds) {
    const mid: [number, number] = [(spoutFrom[0] + ex) / 2 - 30, (spoutFrom[1] + ey) / 2 - 40];
    c.curve([spoutFrom, mid, [ex, ey]], 12, SPOUT_HALO, 0.18);
    c.curve([spoutFrom, mid, [ex, ey]], 4, SPOUT_CORE, 0.9);
  }
  // Droplets riding the spout.
  const next = rng(77);
  for (let i = 0; i < 30; i++) {
    const end = spoutEnds[Math.floor(next() * spoutEnds.length)];
    const t = 0.25 + next() * 0.7;
    const x = spoutFrom[0] + (end[0] - spoutFrom[0]) * t + (next() - 0.5) * 46;
    const y = spoutFrom[1] + (end[1] - spoutFrom[1]) * t - 30 * t + (next() - 0.5) * 30;
    c.disc(x, y, 1.5 + next() * 3.5, SPOUT_CORE, 0.9);
  }
  // Burst of light where the spout meets the ring.
  c.glow(712, 300, 90, [255, 220, 130], 0.35);
}

function drawSea(c: Canvas): void {
  c.vgrad(0, 660, 1024, 364, SEA_TOP, SEA_DEEP);
  // A warm glow on the horizon where the sky meets the sea.
  c.glow(512, 660, 420, [255, 150, 80], 0.12);
  // Long wave strokes, fading as they sink.
  const next = rng(4242);
  for (let row = 0; row < 4; row++) {
    const yBase = 705 + row * 72;
    const pts: [number, number][] = [];
    for (let x = -20; x <= 1044; x += 36) {
      pts.push([x, yBase + 8 * Math.sin(x / 130 + row * 1.3)]);
    }
    c.curve(pts, 3, WAVE_LINE, 0.5 - row * 0.08);
  }
  // A few glints where the planet's light touches the water.
  for (let i = 0; i < 14; i++) {
    const x = 560 + next() * 360;
    const y = 690 + next() * 130;
    c.ellipse(x, y, 12 + next() * 22, 3, [255, 200, 110], 0.28);
  }
}

function drawSplash(c: Canvas): void {
  // The breach: one foam ring where the whale leaves the water, plus
  // chaotic spray instead of a second tidy ring.
  const [bx, by] = whalePoint(0.6);
  c.ellipseStroke(bx, by + 6, 122, 26, 0, 15, FOAM, 0.65);
  const next = rng(99);
  for (let i = 0; i < 64; i++) {
    const x = bx - 140 + next() * 280;
    const y = by - 60 + next() * 90;
    c.disc(x, y, 1.5 + next() * 5, next() < 0.6 ? FOAM : SPOUT_CORE, 0.85);
  }
  for (let i = 0; i < 14; i++) {
    const x = bx - 120 + next() * 240;
    c.disc(x, by - 65 - next() * 60, 2 + next() * 3, FOAM, 0.9);
  }
}

function drawCity(c: Canvas): void {
  const next = rng(2026);
  let x = 0;
  while (x < 1024) {
    const w = 34 + Math.floor(next() * 58);
    const h = 34 + Math.floor(next() * 78);
    const top = 1024 - h;
    c.rect(x, top, w, h, CITY_SILHOUETTE, 1);
    // Lit windows: a sparse warm/cool grid.
    for (let wy = top + 8; wy < 1012; wy += 13) {
      for (let wx = x + 6; wx < x + w - 6; wx += 11) {
        if (next() < 0.34) {
          c.rect(wx, wy, 4, 6, next() < 0.75 ? WINDOW_WARM : WINDOW_COOL, 0.95);
        }
      }
    }
    // Rooftop antenna on the taller blocks.
    if (h > 82) {
      c.line(x + w / 2, top, x + w / 2, top - 16, 2, CITY_SILHOUETTE, 1);
      c.disc(x + w / 2, top - 18, 2.5, [255, 70, 70], 0.95);
    }
    x += w + Math.floor(next() * 8);
  }
}

function drawSearchlights(c: Canvas): void {
  const bases: [number, number, RGB][] = [
    [180, 948, BEACON_WHITE],
    [520, 936, BEACON_GOLD],
    [860, 952, BEACON_CYAN],
  ];
  const aims: [number, number][] = [
    [420, 420],
    [585, 430],
    [700, 330],
  ];
  for (let i = 0; i < bases.length; i++) {
    const [bx, by, colour] = bases[i];
    const [ax, ay] = aims[i];
    // A soft translucent cone from the rooftop toward the whale.
    const dx = ax - bx;
    const dy = ay - by;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const spread = 46;
    c.poly(
      [
        [bx, by],
        [ax + nx * spread, ay + ny * spread],
        [ax - nx * spread, ay - ny * spread],
      ],
      colour,
      0.1,
    );
    c.line(bx, by, ax, ay, 5, colour, 0.22);
    c.glow(bx, by, 26, colour, 0.6);
  }
}

function drawConfetti(c: Canvas): void {
  const next = rng(5150);
  for (let i = 0; i < 150; i++) {
    const x = 40 + next() * 944;
    const y = 470 + next() * 450;
    const s = 3 + next() * 4;
    const colour = CONFETTI[Math.floor(next() * CONFETTI.length)];
    if (next() < 0.5) {
      c.rect(x, y, s, s * 0.6, colour, 0.9);
    } else {
      c.disc(x, y, s / 2, colour, 0.9);
    }
  }
  // A denser burst of confetti right under the whale's head, where the
  // crowd is cheering loudest.
  for (let i = 0; i < 40; i++) {
    const x = 430 + next() * 260;
    const y = 520 + next() * 180;
    const s = 3 + next() * 5;
    c.disc(x, y, s / 2, CONFETTI[Math.floor(next() * CONFETTI.length)], 0.95);
  }
}

/** Draw the whole scene onto a fresh canvas and return it. */
export function drawScene(): Canvas {
  const c = new Canvas();
  drawSky(c);
  drawStars(c);
  drawAurora(c);
  drawPlanet(c);
  drawWhale(c);
  // The opaque sea covers the whale below the waterline, so only the
  // breaching arc shows — the foam at the crossing sells the emergence.
  drawSea(c);
  drawSplash(c);
  drawCity(c);
  drawSearchlights(c);
  drawConfetti(c);
  return c;
}
