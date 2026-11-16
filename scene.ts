// scene.ts — the whole picture, drawn procedurally: a whale breaching out of a
// glowing night ocean toward a giant golden ringed planet in a starry sky.
// Colours are bold and warm against deep blue; the whale's arc is the focal moment.

import { Img, mulberry32, rgb, mix, clamp, type RGB } from "./pixels.ts";

const W = 1024;
const H = 1024;
const WATERLINE = 660;

const DEEP_SKY: RGB = rgb(7, 11, 40);
const VIOLET: RGB = rgb(43, 26, 99);
const MAGENTA: RGB = rgb(122, 45, 126);
const CORAL: RGB = rgb(232, 93, 117);
const GOLD: RGB = rgb(255, 201, 92);
const GOLD_DEEP: RGB = rgb(198, 122, 32);
const GOLD_PALE: RGB = rgb(255, 233, 168);
const SEA_TOP: RGB = rgb(46, 230, 200);
const SEA_MID: RGB = rgb(10, 127, 138);
const SEA_DEEP: RGB = rgb(4, 40, 63);
const WHALE_BACK: RGB = rgb(32, 80, 143);
const WHALE_SIDE: RGB = rgb(47, 127, 196);
const BELLY: RGB = rgb(207, 238, 247);
const FOAM: RGB = rgb(235, 252, 250);
const WHITE: RGB = rgb(255, 255, 255);

function drawSky(img: Img, rnd: () => number): void {
  img.vgrad(0, WATERLINE, [
    [0, DEEP_SKY],
    [0.45, VIOLET],
    [0.62, MAGENTA],
    [1, CORAL],
  ]);

  // Soft out-of-focus lights drifting in the sky, for depth.
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W;
    const y = rnd() * 560;
    const r = 8 + rnd() * 20;
    const c = [GOLD, SEA_TOP, CORAL, rgb(150, 120, 255)][i % 4]!;
    img.glow(x, y, r, c, 0.1 + rnd() * 0.1);
  }

  // Stars: dense, varied, only above the waterline.
  for (let i = 0; i < 380; i++) {
    const x = rnd() * W;
    const y = rnd() * 620;
    const b = 0.35 + rnd() * 0.65;
    const s = rnd();
    const c: RGB = s < 0.7 ? rgb(255, 255, 255) : s < 0.85 ? GOLD_PALE : rgb(170, 220, 255);
    const r = rnd() < 0.12 ? 2.2 : 1.1;
    img.disc(x, y, r, c, b);
    if (rnd() < 0.06) {
      // A few four-point sparkles.
      img.line(x - 7, y, x + 7, y, 1.4, c, b * 0.8);
      img.line(x, y - 7, x, y + 7, 1.4, c, b * 0.8);
    }
  }

  // Two shooting stars, bright heads with fading trails.
  const shots: Array<[number, number, number]> = [
    [180, 120, 150],
    [880, 90, 120],
  ];
  for (const [sx, sy, len] of shots) {
    for (let i = 0; i < len; i += 6) {
      const t = i / len;
      img.disc(sx + i, sy + i * 0.45, 2.2 * (1 - t) + 0.6, WHITE, 0.9 * (1 - t));
    }
    img.glow(sx, sy, 14, WHITE, 0.7);
  }
}

function drawPlanet(img: Img): void {
  const cx = 700;
  const cy = 235;
  const r = 180;

  // Halo first, so the planet sits inside its own light.
  img.glow(cx, cy, 320, GOLD, 0.5);
  img.glow(cx, cy, 210, GOLD_PALE, 0.55);

  // Back half of the ring (the part that passes behind the planet).
  const tilt = -0.28; // radians, ring tilted up to the right
  const rx = 330;
  const ry = 74;
  const ringPoint = (deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    const px = rx * Math.cos(a);
    const py = ry * Math.sin(a);
    return [
      cx + px * Math.cos(tilt) - py * Math.sin(tilt),
      cy + px * Math.sin(tilt) + py * Math.cos(tilt),
    ];
  };
  for (let d = 180; d <= 360; d += 2) {
    const [x, y] = ringPoint(d);
    img.disc(x, y, 13, GOLD, 0.5);
  }
  for (let d = 180; d <= 360; d += 2) {
    const [x, y] = ringPoint(d);
    img.disc(x, y, 4, GOLD_PALE, 0.55);
  }

  // The planet itself: gold gradient, darker bands, bright upper-left face.
  for (let y = cy - r; y <= cy + r; y++) {
    const dy = (y - cy) / r;
    const half = r * Math.sqrt(Math.max(0, 1 - dy * dy));
    const t = (y - (cy - r)) / (2 * r);
    const base = mix(GOLD_PALE, GOLD_DEEP, clamp(t * 1.15, 0, 1));
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      img.set(x, y, base);
    }
  }
  // Horizontal bands, clipped to the disc by their chord width.
  const bands: Array<[number, RGB, number]> = [
    [-120, GOLD_DEEP, 0.3],
    [-70, GOLD, 0.35],
    [-18, GOLD_DEEP, 0.28],
    [38, GOLD_PALE, 0.3],
    [95, GOLD_DEEP, 0.32],
    [140, GOLD, 0.3],
  ];
  for (const [dy, c, a] of bands) {
    const half = r * Math.sqrt(Math.max(0, 1 - (dy / r) ** 2));
    img.ellipse(cx, cy + dy, half, 8, c, a);
  }
  // Sunlit rim on the upper-left edge.
  for (let d = 195; d <= 330; d += 2) {
    const a = (d * Math.PI) / 180;
    img.disc(cx + (r - 3) * Math.cos(a), cy + (r - 3) * Math.sin(a), 5, GOLD_PALE, 0.85);
  }
  // A small crater-like dimple for character, upper right.
  img.ellipse(cx + 78, cy - 66, 26, 15, GOLD_DEEP, 0.25);
  img.ellipse(cx - 96, cy + 84, 18, 10, GOLD_DEEP, 0.22);

  // Front half of the ring, crossing in front of the planet's lower edge.
  for (let d = 0; d <= 180; d += 2) {
    const [x, y] = ringPoint(d);
    img.disc(x, y, 13, GOLD, 0.62);
  }
  for (let d = 0; d <= 180; d += 2) {
    const [x, y] = ringPoint(d);
    img.disc(x, y, 4, rgb(255, 244, 200), 0.7);
  }
  // Thin outer ring, fainter.
  for (let d = 0; d <= 360; d += 2) {
    const a = (d * Math.PI) / 180;
    const px = (rx + 30) * Math.cos(a);
    const py = (ry + 12) * Math.sin(a);
    const x = cx + px * Math.cos(tilt) - py * Math.sin(tilt);
    const y = cy + px * Math.sin(tilt) + py * Math.cos(tilt);
    img.disc(x, y, 2.5, GOLD_PALE, 0.35);
  }
}

function drawOcean(img: Img, rnd: () => number): void {
  img.vgrad(WATERLINE, H, [
    [0, SEA_TOP],
    [0.25, SEA_MID],
    [1, SEA_DEEP],
  ]);

  // Rolling wave layers, each a sine band with a foam crest.
  for (let k = 0; k < 3; k++) {
    const yBase = WATERLINE + 46 + k * 92;
    const amp = 16 - k * 3;
    const pts: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 16) {
      pts.push([x, yBase + amp * Math.sin(x * 0.011 + k * 1.9)]);
    }
    pts.push([W, H]);
    pts.push([0, H]);
    img.poly(pts, k === 0 ? SEA_MID : SEA_DEEP, k === 0 ? 0.35 : 0.45);
    // Foam crest along the top edge of the wave (overlapping discs = solid line).
    for (let x = 0; x <= W; x += 6) {
      const y = yBase + amp * Math.sin(x * 0.011 + k * 1.9);
      img.disc(x, y, 4, FOAM, 0.35 + 0.2 * Math.sin(x * 0.05 + k));
    }
  }

  // Glowing surface line where the sky meets the sea.
  img.line(0, WATERLINE, W, WATERLINE, 5, rgb(140, 255, 230), 0.8);
  img.line(0, WATERLINE + 4, W, WATERLINE + 4, 2, WHITE, 0.5);

  // A few glints scattered on the water.
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W;
    const y = WATERLINE + 20 + rnd() * (H - WATERLINE - 40);
    img.disc(x, y, 1.5 + rnd() * 2, rgb(190, 255, 240), 0.25 + rnd() * 0.3);
  }
}

/** Sample a quadratic spine: points, unit normals (pointing down-left), widths. */
function spineSamples(): Array<{ x: number; y: number; nx: number; ny: number; w: number }> {
  const p0: [number, number] = [392, 724];
  const p1: [number, number] = [462, 540];
  const p2: [number, number] = [668, 352];
  const out: Array<{ x: number; y: number; nx: number; ny: number; w: number }> = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = Img.quad(p0, p1, p2, t);
    // Derivative of the quadratic, for the normal.
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const len = Math.hypot(dx, dy) || 1;
    // Normal (-dy, dx): choose the sign that points downward (belly side).
    let nx = -dy / len;
    let ny = dx / len;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const width = 46 + 56 * Math.sin(Math.PI * (0.12 + 0.88 * t)) ** 0.8;
    out.push({ x, y, nx, ny, w: width });
  }
  return out;
}

function drawWhale(img: Img, rnd: () => number): void {
  const s = spineSamples();
  const head = s[s.length - 1]!;
  const tail = s[0]!;

  // Glow where the whale leaves the water, and a light shaft up to the planet.
  img.glow(430, 690, 260, rgb(120, 240, 220), 0.45);
  img.glow(560, 480, 200, GOLD_PALE, 0.22);

  // Tail flukes: two swept fins behind the tail stock.
  const tx = tail.x;
  const ty = tail.y;
  img.poly(
    [
      [tx, ty],
      [tx - 118, ty + 66],
      [tx - 132, ty + 22],
      [tx - 30, ty - 26],
    ],
    WHALE_BACK,
  );
  img.poly(
    [
      [tx, ty],
      [tx - 96, ty - 92],
      [tx - 128, ty - 58],
      [tx - 26, ty + 18],
    ],
    WHALE_SIDE,
  );

  // Body: a tapered band along the spine.
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (const p of s) {
    left.push([p.x - p.nx * p.w * 0.5, p.y - p.ny * p.w * 0.5]);
    right.push([p.x + p.nx * p.w * 0.5, p.y + p.ny * p.w * 0.5]);
  }
  img.poly([...left, ...right.reverse()], WHALE_BACK);
  // Lighter flank stripe along the upper side.
  const flankTop: Array<[number, number]> = [];
  const flankBottom: Array<[number, number]> = [];
  for (const p of s) {
    flankTop.push([p.x - p.nx * p.w * 0.52, p.y - p.ny * p.w * 0.52]);
    flankBottom.push([p.x - p.nx * p.w * 0.1, p.y - p.ny * p.w * 0.1]);
  }
  img.poly([...flankTop, ...flankBottom.reverse()], WHALE_SIDE, 0.85);
  // Pale belly on the underside.
  const bellyTop: Array<[number, number]> = [];
  const bellyBottom: Array<[number, number]> = [];
  for (const p of s) {
    bellyTop.push([p.x + p.nx * p.w * 0.08, p.y + p.ny * p.w * 0.08]);
    bellyBottom.push([p.x + p.nx * p.w * 0.5, p.y + p.ny * p.w * 0.5]);
  }
  img.poly([...bellyTop, ...bellyBottom.reverse()], BELLY, 0.95);
  // Throat grooves: three short arcs across the belly near the head.
  for (let g = 0; g < 3; g++) {
    const p = s[30 + g * 2]!;
    img.line(
      p.x + p.nx * p.w * 0.12 - p.nx * 0,
      p.y + p.ny * p.w * 0.12,
      p.x + p.nx * p.w * 0.48,
      p.y + p.ny * p.w * 0.48,
      3,
      rgb(150, 190, 210),
      0.7,
    );
  }

  // Pectoral fin sweeping back down-left.
  const mid = s[22]!;
  img.poly(
    [
      [mid.x + mid.nx * mid.w * 0.3, mid.y + mid.ny * mid.w * 0.3],
      [mid.x - 30, mid.y + 150],
      [mid.x + 42, mid.y + 128],
      [mid.x + mid.nx * mid.w * 0.45, mid.y + mid.ny * mid.w * 0.45],
    ],
    WHALE_BACK,
  );

  // Eye: dark bead with a bright glint, looking up at the planet.
  const eyeX = head.x - 14;
  const eyeY = head.y - 20;
  img.disc(eyeX, eyeY, 9, rgb(8, 12, 28));
  img.disc(eyeX - 3, eyeY - 3, 3.5, WHITE);
  // Joyful open smile.
  img.curve([head.x - 34, head.y + 6], [head.x - 6, head.y + 26], [head.x + 30, head.y + 2], 6, rgb(10, 20, 44), 0.9);

  // Spout: a fan of bright droplets streaming from the blowhole toward the ring.
  const bx = head.x - 26;
  const by = head.y - 34;
  img.glow(bx, by - 40, 70, rgb(200, 245, 255), 0.6);
  for (let jet = 0; jet < 3; jet++) {
    const spread = [-28, 0, 28][jet]!;
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      const x = bx + spread * t + 8 * Math.sin(t * 9 + jet);
      const y = by - 130 * t - 20 * t * t;
      img.disc(x, y, 5.5 * (1 - t) + 1.5, FOAM, 0.95 * (1 - t * 0.6));
    }
  }

  // Speed lines trailing behind the whale, for momentum.
  const trails: Array<[[number, number], [number, number], [number, number]]> = [
    [[330, 760], [250, 700], [180, 640]],
    [[360, 800], [270, 760], [200, 720]],
    [[300, 700], [230, 620], [170, 540]],
  ];
  for (const [a, b, c] of trails) img.curve(a, b, c, 5, WHITE, 0.45);

  // Spray droplets flung around the breach.
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 30 + rnd() * 190;
    const x = 430 + Math.cos(a) * d * 1.1;
    const y = 660 + Math.sin(a) * d * 0.55 - rnd() * 60;
    img.disc(x, y, 1.5 + rnd() * 4, i % 3 === 0 ? GOLD_PALE : FOAM, 0.5 + rnd() * 0.45);
  }
}

function drawSplash(img: Img, rnd: () => number): void {
  // Foam crown where the whale tore out of the water.
  const cx = 415;
  const cy = 672;
  for (const [r, a] of [
    [58, 0.9],
    [92, 0.7],
    [128, 0.5],
  ] as Array<[number, number]>) {
    for (let d = 200; d <= 340; d += 3) {
      const ang = (d * Math.PI) / 180;
      img.disc(cx + r * Math.cos(ang), cy + r * Math.sin(ang) * 0.55, 7, FOAM, a);
    }
  }
  // Chunky foam blobs at the waterline.
  for (let i = 0; i < 26; i++) {
    const x = cx - 150 + rnd() * 300;
    const y = cy - 14 + rnd() * 26;
    img.disc(x, y, 8 + rnd() * 16, FOAM, 0.55 + rnd() * 0.4);
  }
  for (let i = 0; i < 40; i++) {
    const x = cx - 170 + rnd() * 340;
    const y = cy - 70 + rnd() * 50;
    img.disc(x, y, 2 + rnd() * 4, FOAM, 0.6 + rnd() * 0.35);
  }
}

/** Render the full 1024x1024 scene. Fully deterministic. */
export function renderScene(): Img {
  const img = new Img(W, H);
  const rnd = mulberry32(20261115);
  drawSky(img, rnd);
  drawPlanet(img);
  drawOcean(img, rnd);
  drawWhale(img, rnd);
  drawSplash(img, rnd);
  img.vignette(0.18);
  return img;
}
