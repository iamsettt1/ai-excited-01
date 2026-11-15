// scene.ts — draws the one image: "The Whale That Swallowed the Sky".
// A colossal whale breaches out of the ocean, arcing up toward a golden
// ringed planet, while a tiny city below cheers with searchlights and
// confetti. Surprise is the scale: the whale is bigger than the city,
// the planet hangs close enough to touch, and the whole frame leans
// diagonally toward one thrilling moment — the whale about to kiss the ring.

import { Canvas } from "./raster.ts";
import { PALETTE as P, lerp, mulberry32, type RGB } from "./palette.ts";

const W = 1024;
const H = 1024;
const HORIZON = 700;

function drawStars(cv: Canvas, rnd: () => number): void {
  for (let i = 0; i < 220; i++) {
    const x = rnd() * W;
    const y = rnd() * 560;
    const r = 0.6 + rnd() * 1.6;
    const a = 0.35 + rnd() * 0.65;
    if (rnd() < 0.12) {
      cv.star(x, y, 4 + rnd() * 7, P.starWhite, a * 0.9);
    } else {
      cv.circle(x, y, r, P.starWhite, a);
    }
  }
}

function drawAurora(cv: Canvas): void {
  // Three translucent ribbons rippling across the upper sky.
  const ribbons: { y: number; amp: number; c: RGB; a: number }[] = [
    { y: 150, amp: 46, c: P.auroraGreen, a: 0.16 },
    { y: 235, amp: 60, c: P.auroraTeal, a: 0.14 },
    { y: 320, amp: 52, c: P.auroraPink, a: 0.12 },
  ];
  for (const rb of ribbons) {
    const top: [number, number][] = [];
    const bot: [number, number][] = [];
    for (let x = -40; x <= W + 40; x += 32) {
      const wave = Math.sin((x / W) * Math.PI * 2.2 + rb.y) * rb.amp;
      top.push([x, rb.y + wave - 26]);
      bot.push([x, rb.y + wave + 26]);
    }
    cv.splineFill([...top, ...bot.reverse()], rb.c, rb.a, 8);
  }
}

function ellipseArc(
  cv: Canvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  width: number,
  c: RGB,
  alpha: number,
): void {
  const steps = 64;
  let px = cx + rx * Math.cos(a0);
  let py = cy + ry * Math.sin(a0);
  for (let i = 1; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    const x = cx + rx * Math.cos(t);
    const y = cy + ry * Math.sin(t);
    cv.line(px, py, x, y, width, c, alpha);
    px = x;
    py = y;
  }
}

function drawPlanet(cv: Canvas): void {
  const cx = 762;
  const cy = 205;
  const r = 148;
  // Back half of the ring, behind the planet.
  ellipseArc(cv, cx, cy, 252, 62, Math.PI, Math.PI * 2, 13, P.ringPale, 0.95);
  ellipseArc(cv, cx, cy, 252, 62, Math.PI, Math.PI * 2, 5, P.planetAmber, 0.5);

  // Banded disc: horizontal stripes clipped to the circle.
  const bands: [number, RGB][] = [
    [0.0, P.planetGold],
    [0.16, P.planetAmber],
    [0.3, P.planetGold],
    [0.44, P.planetShadow],
    [0.56, P.planetAmber],
    [0.7, P.planetGold],
    [0.84, P.planetShadow],
    [1.0, P.planetGold],
  ];
  for (let y = cy - r; y <= cy + r; y++) {
    const dy = y - cy;
    const hw = Math.sqrt(Math.max(0, r * r - dy * dy));
    const t = (y - (cy - r)) / (2 * r);
    let c = bands[0][1];
    for (let b = 0; b < bands.length - 1; b++) {
      if (t >= bands[b][0] && t <= bands[b + 1][0]) {
        c = lerp(bands[b][1], bands[b + 1][1], (t - bands[b][0]) / (bands[b + 1][0] - bands[b][0]));
        break;
      }
    }
    // Shade the lower-right limb so the disc reads as a sphere.
    const shade = Math.max(0, (y - cy) / r) * 0.35;
    const shaded: RGB = [
      Math.round(c[0] * (1 - shade)),
      Math.round(c[1] * (1 - shade)),
      Math.round(c[2] * (1 - shade)),
    ];
    cv.fillRect(cx - hw, y, cx + hw, y, shaded);
  }
  // Terminator glow on the upper-left limb.
  cv.glow(cx - 60, cy - 70, 90, P.planetGold, 0.35);

  // Front half of the ring, crossing in front of the planet.
  ellipseArc(cv, cx, cy, 252, 62, 0, Math.PI, 13, P.ringPale, 0.95);
  ellipseArc(cv, cx, cy, 252, 62, 0, Math.PI, 5, P.planetAmber, 0.5);
  // A thin second ring for depth.
  ellipseArc(cv, cx, cy, 282, 74, 0, Math.PI, 4, P.ringPale, 0.55);
  ellipseArc(cv, cx, cy, 282, 74, Math.PI, Math.PI * 2, 4, P.ringPale, 0.4);
}

function drawOcean(cv: Canvas, rnd: () => number): void {
  cv.vgrad(0, HORIZON, W, H, [
    [0, P.oceanTop],
    [0.35, P.oceanDeep],
    [1, [2, 12, 30]],
  ]);
  // Rolling swell lines, brighter near the horizon.
  for (let i = 0; i < 9; i++) {
    const y = HORIZON + 26 + i * 34;
    const amp = 8 + rnd() * 10;
    const pts: [number, number][] = [];
    for (let x = -20; x <= W + 20; x += 24) {
      pts.push([x, y + Math.sin((x / W) * Math.PI * 3 + i * 1.7) * amp]);
    }
    for (let s = 0; s < pts.length - 1; s++) {
      cv.line(pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1], 3, P.splash, 0.1 + 0.06 * (1 - i / 9));
    }
  }
}

function drawCity(cv: Canvas, rnd: () => number): void {
  // Tiny dark skyline along the horizon, warm windows, searchlights.
  let x = 24;
  while (x < W - 30) {
    const bw = 26 + rnd() * 42;
    const bh = 22 + rnd() * 62;
    cv.fillRect(x, HORIZON - bh, x + bw, HORIZON, P.cityDark);
    // Rooftop antenna on some towers.
    if (rnd() < 0.4) cv.line(x + bw / 2, HORIZON - bh, x + bw / 2, HORIZON - bh - 16, 2, P.cityDark, 1);
    // Lit windows.
    const cols = Math.max(1, Math.floor(bw / 12));
    const rows = Math.max(1, Math.floor(bh / 16));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if (rnd() < 0.55) {
          const wx = x + 5 + cx * 12;
          const wy = HORIZON - bh + 6 + cy * 16;
          cv.fillRect(wx, wy, wx + 4, wy + 6, rnd() < 0.75 ? P.windowWarm : P.windowCool, 0.95);
        }
      }
    }
    x += bw + 4 + rnd() * 10;
  }
  // Searchlight beams leaning up toward the whale.
  const beams: [number, number, number][] = [
    [140, -70, 0.13],
    [330, -40, 0.11],
    [880, 55, 0.13],
    [700, 30, 0.1],
  ];
  for (const [bx, tilt, a] of beams) {
    const topX = bx + tilt;
    cv.polyFill(
      [
        [bx - 7, HORIZON],
        [bx + 7, HORIZON],
        [topX + 34, 150],
        [topX - 34, 150],
      ],
      P.windowWarm,
      a,
    );
  }
  // Confetti bursting above the rooftops.
  const confetti: RGB[] = [P.windowWarm, P.auroraPink, P.auroraGreen, P.auroraTeal, P.planetGold];
  for (let i = 0; i < 150; i++) {
    const cx = rnd() * W;
    const cy = HORIZON - 30 - rnd() * 180;
    const c = confetti[Math.floor(rnd() * confetti.length)];
    cv.fillRect(cx, cy, cx + 3 + rnd() * 3, cy + 2 + rnd() * 3, c, 0.9);
  }
}

function drawWhale(cv: Canvas): void {
  // Body outline, tail at lower-left in the spray, head up-right by the planet.
  const body: [number, number][] = [
    [238, 826], // tail notch
    [180, 856], // upper fluke tip, spread wide so the tail reads
    [252, 884], // fluke inner
    [286, 838], // tail stock top
    [330, 760],
    [420, 640],
    [520, 520],
    [620, 420],
    [688, 348], // head top
    [742, 322], // snout
    [758, 352], // snout tip
    [736, 402], // jaw
    [672, 470],
    [580, 580],
    [480, 690],
    [380, 792],
    [318, 852], // tail stock bottom
    [268, 884], // lower fluke inner
    [196, 916], // lower fluke tip, spread wide so the tail reads
  ];
  // Back gradient is faked with layered fills: deep back, then mid, then belly.
  cv.splineFill(body, P.whaleBack, 1);
  // Mid-body sheen, same outline shrunk toward the spine.
  const mid: [number, number][] = body.map(([x, y]) => {
    const t = (x - 200) / 560;
    return [x + 26 - t * 10, y + 30] as [number, number];
  });
  cv.splineFill(mid, P.whaleMid, 0.85);
  // Pale belly patch along the lower edge.
  const belly: [number, number][] = [
    [330, 800],
    [420, 700],
    [520, 600],
    [620, 500],
    [700, 420],
    [724, 392],
    [690, 440],
    [600, 540],
    [500, 650],
    [400, 760],
    [350, 812],
  ];
  cv.splineFill(belly, P.whaleBelly, 0.9);
  // Throat grooves: three curved lines on the belly.
  for (let g = 0; g < 3; g++) {
    const off = g * 16;
    cv.line(430 + off, 690 - off * 0.4, 640 + off, 470 - off * 0.4, 3, P.whaleBack, 0.35);
  }
  // Pectoral fin, swept back and slim so it reads as a fin, not a blotch.
  cv.splineFill(
    [
      [505, 588],
      [575, 648],
      [548, 706],
      [492, 668],
      [488, 618],
    ],
    P.whaleBack,
    1,
  );
  // Eye: bright, looking up at the planet.
  cv.circle(700, 372, 11, [255, 255, 255], 1);
  cv.circle(703, 370, 6, [8, 10, 30], 1);
  cv.circle(705, 368, 2, [255, 255, 255], 1);
  // Smile line along the jaw.
  cv.line(700, 396, 742, 372, 3, P.whaleBack, 0.7);
  // Blowhole spout: a fountain of light arcing toward the planet.
  cv.glow(700, 320, 60, P.whaleGlow, 0.5);
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const sx = 700 + t * 46 - t * t * 30;
    const sy = 322 - t * 120 - Math.sin(t * Math.PI) * 18;
    cv.circle(sx, sy, 7 - t * 4, P.splash, 0.85 - t * 0.4);
  }
  // Motion streaks trailing the body — speed lines.
  const streaks: [number, number, number, number][] = [
    [300, 700, 180, 790],
    [380, 600, 250, 700],
    [470, 500, 350, 610],
    [560, 400, 450, 510],
    [640, 330, 540, 430],
  ];
  for (const [x0, y0, x1, y1] of streaks) {
    cv.line(x0, y0, x1, y1, 5, P.whaleGlow, 0.28);
  }
}

function drawSplash(cv: Canvas, rnd: () => number): void {
  // Exploding spray where the tail leaves the water.
  const cx = 268;
  const cy = 852;
  cv.glow(cx, cy, 130, P.splash, 0.4);
  for (let i = 0; i < 46; i++) {
    const ang = Math.PI + rnd() * Math.PI; // upward fan
    const dist = 20 + rnd() * 150;
    const dx = cx + Math.cos(ang) * dist * 1.4;
    const dy = cy + Math.sin(ang) * dist * 0.85 - rnd() * 30;
    const r = 2 + rnd() * 7;
    cv.circle(dx, dy, r, rnd() < 0.7 ? P.splash : P.foam, 0.75 + rnd() * 0.25);
  }
  // Foam ring on the water surface around the tail.
  for (let i = 0; i < 26; i++) {
    const x = 150 + rnd() * 260;
    const y = HORIZON + 6 + rnd() * 26;
    cv.ellipse(x, y, 8 + rnd() * 22, 3 + rnd() * 5, P.foam, 0.5 + rnd() * 0.3);
  }
  // Big arcing spray sheets on both sides of the tail.
  ellipseArc(cv, cx - 40, cy - 10, 120, 70, Math.PI * 0.9, Math.PI * 1.7, 9, P.splash, 0.6);
  ellipseArc(cv, cx + 60, cy - 6, 110, 64, Math.PI * 1.3, Math.PI * 1.95, 8, P.foam, 0.55);
}

export function drawScene(): Canvas {
  const cv = new Canvas(W, H);
  const rnd = mulberry32(20261116);

  // Sky: deep indigo at the top, magenta low, warm glow at the horizon.
  cv.vgrad(0, 0, W, HORIZON, [
    [0, P.skyTop],
    [0.45, P.skyMid],
    [0.78, P.skyLow],
    [1, P.horizon],
  ]);
  drawStars(cv, rnd);
  drawAurora(cv);
  cv.glow(762, 205, 260, P.planetGold, 0.22);
  drawPlanet(cv);
  drawOcean(cv, rnd);
  drawCity(cv, rnd);
  drawSplash(cv, rnd);
  drawWhale(cv);
  // Final kiss of light where the snout nearly touches the ring.
  cv.glow(745, 330, 70, P.windowWarm, 0.5);
  cv.star(748, 322, 16, P.starWhite, 0.95);
  cv.vignette(0.2);
  return cv;
}
