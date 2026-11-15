// raster.ts — a tiny deterministic software rasterizer.
// Canvas holds an RGBA buffer; all drawing blends with a source-over alpha.
// No randomness here except through the caller-supplied PRNG.

import type { RGB } from "./palette.ts";

export class Canvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
    // Start fully opaque black; every painter covers the whole frame.
    for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255;
  }

  setPixel(x: number, y: number, c: RGB, alpha = 1): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const o = (iy * this.w + ix) * 4;
    if (alpha >= 1) {
      this.data[o] = c[0];
      this.data[o + 1] = c[1];
      this.data[o + 2] = c[2];
      this.data[o + 3] = 255;
      return;
    }
    const a = Math.max(0, Math.min(1, alpha));
    this.data[o] = Math.round(this.data[o] * (1 - a) + c[0] * a);
    this.data[o + 1] = Math.round(this.data[o + 1] * (1 - a) + c[1] * a);
    this.data[o + 2] = Math.round(this.data[o + 2] * (1 - a) + c[2] * a);
  }

  fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB, alpha = 1): void {
    const xa = Math.max(0, Math.floor(x0));
    const xb = Math.min(this.w - 1, Math.ceil(x1));
    const ya = Math.max(0, Math.floor(y0));
    const yb = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) this.setPixel(x, y, c, alpha);
    }
  }

  // Vertical gradient over a rectangle, interpolating between colour stops.
  vgrad(x0: number, y0: number, x1: number, y1: number, stops: [number, RGB][]): void {
    const ya = Math.max(0, Math.floor(y0));
    const yb = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = ya; y <= yb; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      let c: RGB = stops[stops.length - 1][1];
      for (let s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s][0] && t <= stops[s + 1][0]) {
          const lt = (t - stops[s][0]) / Math.max(1e-6, stops[s + 1][0] - stops[s][0]);
          const a = stops[s][1];
          const b = stops[s + 1][1];
          c = [
            Math.round(a[0] + (b[0] - a[0]) * lt),
            Math.round(a[1] + (b[1] - a[1]) * lt),
            Math.round(a[2] + (b[2] - a[2]) * lt),
          ];
          break;
        }
      }
      this.fillRect(x0, y, x1, y, c);
    }
  }

  // Soft radial glow: concentric circles with falling alpha.
  glow(cx: number, cy: number, r: number, c: RGB, peak = 0.55, steps = 24): void {
    for (let i = steps; i >= 1; i--) {
      const rr = (r * i) / steps;
      const a = peak * (1 - i / steps) * (1 - i / steps);
      this.circle(cx, cy, rr, c, a);
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB, alpha = 1): void {
    if (r <= 0) return;
    const xa = Math.max(0, Math.floor(cx - r));
    const xb = Math.min(this.w - 1, Math.ceil(cx + r));
    const ya = Math.max(0, Math.floor(cy - r));
    const yb = Math.min(this.h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.setPixel(x, y, c, alpha);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, alpha = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const xa = Math.max(0, Math.floor(cx - rx));
    const xb = Math.min(this.w - 1, Math.ceil(cx + rx));
    const ya = Math.max(0, Math.floor(cy - ry));
    const yb = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.setPixel(x, y, c, alpha);
      }
    }
  }

  // Scanline fill of a simple polygon (even-odd).
  polyFill(pts: [number, number][], c: RGB, alpha = 1): void {
    if (pts.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, yA] = pts[i];
        const [x1, yB] = pts[(i + 1) % pts.length];
        if ((yA <= yc && yB > yc) || (yB <= yc && yA > yc)) {
          xs.push(x0 + ((yc - yA) * (x1 - x0)) / (yB - yA));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.floor(xs[k]));
        const xb = Math.min(this.w - 1, Math.ceil(xs[k + 1]));
        for (let x = xa; x <= xb; x++) this.setPixel(x, y, c, alpha);
      }
    }
  }

  // Thick line drawn as a quad (butt caps) — used for rays, motion streaks.
  line(x0: number, y0: number, x1: number, y1: number, width: number, c: RGB, alpha = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      this.circle(x0, y0, width / 2, c, alpha);
      return;
    }
    const nx = (-dy / len) * (width / 2);
    const ny = (dx / len) * (width / 2);
    this.polyFill(
      [
        [x0 + nx, y0 + ny],
        [x1 + nx, y1 + ny],
        [x1 - nx, y1 - ny],
        [x0 - nx, y0 - ny],
      ],
      c,
      alpha,
    );
  }

  // Closed smooth shape through control points (Catmull-Rom spline).
  splineFill(pts: [number, number][], c: RGB, alpha = 1, samplesPerSeg = 24): void {
    const n = pts.length;
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      for (let s = 0; s < samplesPerSeg; s++) {
        const t = s / samplesPerSeg;
        const t2 = t * t;
        const t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    this.polyFill(out, c, alpha);
  }

  // Four-point sparkle star.
  star(cx: number, cy: number, r: number, c: RGB, alpha = 1): void {
    const w = Math.max(1, r * 0.16);
    this.line(cx - r, cy, cx + r, cy, w, c, alpha);
    this.line(cx, cy - r, cx, cy + r, w, c, alpha);
    this.circle(cx, cy, r * 0.22, c, alpha);
  }

  // Darken/lighten edges: a soft vignette for focus.
  vignette(strength = 0.22): void {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < this.h; y += 2) {
      for (let x = 0; x < this.w; x += 2) {
        const d = Math.hypot(x - cx, y - cy) / maxD;
        const a = strength * Math.max(0, d - 0.55) * 2;
        if (a > 0.01) {
          this.setPixel(x, y, [0, 0, 0], Math.min(0.5, a));
          this.setPixel(x + 1, y, [0, 0, 0], Math.min(0.5, a));
          this.setPixel(x, y + 1, [0, 0, 0], Math.min(0.5, a));
          this.setPixel(x + 1, y + 1, [0, 0, 0], Math.min(0.5, a));
        }
      }
    }
  }
}
