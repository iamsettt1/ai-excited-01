// canvas.ts — a deterministic 1024x1024 RGB drawing surface.
// Every primitive blends with an alpha in [0, 1]; nothing here reads
// the clock or unseeded randomness, so two runs draw identical bytes.

import type { RGB } from "./palette.ts";

export const W = 1024;
export const H = 1024;

/** Deterministic PRNG (mulberry32). One stream per scene, fixed seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

export class Canvas {
  readonly w = W;
  readonly h = H;
  readonly data = new Uint8Array(W * H * 3);

  /** Blend one pixel toward colour c with opacity a (0..1). */
  px(x: number, y: number, c: RGB, a = 1): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || xi >= W || yi < 0 || yi >= H || a <= 0) return;
    const i = (yi * W + xi) * 3;
    if (a >= 1) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
    } else {
      this.data[i] = Math.round(this.data[i] * (1 - a) + c[0] * a);
      this.data[i + 1] = Math.round(this.data[i + 1] * (1 - a) + c[1] * a);
      this.data[i + 2] = Math.round(this.data[i + 2] * (1 - a) + c[2] * a);
    }
  }

  /** Solid rectangle. */
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(W, Math.round(x + w));
    const y1 = Math.min(H, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        this.px(xx, yy, c, a);
      }
    }
  }

  /** Vertical gradient over a rectangle, top colour to bottom colour. */
  vgrad(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(W, Math.round(x + w));
    const y1 = Math.min(H, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      const t = h <= 1 ? 0 : (yy - y) / (h - 1);
      const c = mix(top, bottom, Math.max(0, Math.min(1, t)));
      for (let xx = x0; xx < x1; xx++) {
        this.px(xx, yy, c, 1);
      }
    }
  }

  /** Filled disc. */
  disc(cx: number, cy: number, r: number, c: RGB, a = 1): void {
    if (r <= 0) return;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(H - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx;
        const dy = yy - cy;
        if (dx * dx + dy * dy <= r2) this.px(xx, yy, c, a);
      }
    }
  }

  /** Filled ellipse, optionally rotated by angle radians. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1, rot = 0): void {
    if (rx <= 0 || ry <= 0) return;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const rad = Math.max(rx, ry);
    const x0 = Math.max(0, Math.floor(cx - rad));
    const x1 = Math.min(W - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad));
    const y1 = Math.min(H - 1, Math.ceil(cy + rad));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx;
        const dy = yy - cy;
        // Rotate the test point back into the ellipse's own frame.
        const u = (dx * cos + dy * sin) / rx;
        const v = (-dx * sin + dy * cos) / ry;
        if (u * u + v * v <= 1) this.px(xx, yy, c, a);
      }
    }
  }

  /** Radial glow: colour fading smoothly to transparent at radius r. */
  glow(cx: number, cy: number, r: number, c: RGB, a: number): void {
    if (r <= 0 || a <= 0) return;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const d = Math.hypot(xx - cx, yy - cy) / r;
        if (d >= 1) continue;
        const fall = (1 - d) * (1 - d);
        this.px(xx, yy, c, a * fall);
      }
    }
  }

  /** Thick line: discs stamped along the segment. */
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 1): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len / Math.max(1, w * 0.4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(lerp(x0, x1, t), lerp(y0, y1, t), w / 2, c, a);
    }
  }

  /** A smooth curve through points (Catmull-Rom), drawn as a thick line. */
  curve(points: [number, number][], w: number, c: RGB, a = 1): void {
    if (points.length < 2) return;
    const pts: [number, number][] = [points[0], ...points, points[points.length - 1]];
    for (let s = 0; s < pts.length - 3; s++) {
      const p0 = pts[s];
      const p1 = pts[s + 1];
      const p2 = pts[s + 2];
      const p3 = pts[s + 3];
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const steps = Math.max(2, Math.ceil(segLen / 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const x =
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y =
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        this.disc(x, y, w / 2, c, a);
      }
    }
  }

  /** Stroke along an ellipse's rim (optionally only angles t0..t1), rotated. */
  ellipseStroke(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rot: number,
    w: number,
    c: RGB,
    a: number,
    t0 = 0,
    t1 = Math.PI * 2,
  ): void {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const steps = Math.max(8, Math.ceil((perim * ((t1 - t0) / (Math.PI * 2))) / 2));
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      const ex = rx * Math.cos(t);
      const ey = ry * Math.sin(t);
      const x = cx + ex * cos - ey * sin;
      const y = cy + ex * sin + ey * cos;
      this.disc(x, y, w / 2, c, a);
    }
  }

  /** Filled polygon (scanline fill, even-odd). */
  poly(points: [number, number][], c: RGB, a = 1): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.max(0, Math.ceil(minY)); y <= Math.min(H - 1, Math.floor(maxY)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k]));
        const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
        for (let x = x0; x <= x1; x++) this.px(x, y, c, a);
      }
    }
  }
}
