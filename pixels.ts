// pixels.ts — a tiny RGBA pixel buffer plus the drawing primitives the scene needs.
// Everything is deterministic: no time, no Math.random, only a fixed-seed PRNG.

export type RGB = [number, number, number];

export function rgb(r: number, g: number, b: number): RGB {
  return [r, g, b];
}

/** Deterministic PRNG (mulberry32). Same seed => same sequence on every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Linear interpolation between two colours. */
export function mix(c0: RGB, c1: RGB, t: number): RGB {
  return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
}

export class Img {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array; // RGBA, row-major

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }

  /** Alpha-composite a colour over the pixel at (x, y). a in 0..1. */
  set(x: number, y: number, c: RGB, a = 1): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 4;
    if (a >= 1) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
      return;
    }
    const inv = 1 - a;
    this.data[i] = Math.round(c[0] * a + this.data[i] * inv);
    this.data[i + 1] = Math.round(c[1] * a + this.data[i + 1] * inv);
    this.data[i + 2] = Math.round(c[2] * a + this.data[i + 2] * inv);
    this.data[i + 3] = 255;
  }

  /** Fill a rectangle with a solid colour. */
  fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1): void {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++) {
        this.set(x, y, c, a);
      }
    }
  }

  /** Vertical gradient band: colour stops are [position 0..1, colour]. */
  vgrad(y0: number, y1: number, stops: Array<[number, RGB]>): void {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      const t = (y - y0) / (y1 - y0);
      let c = stops[stops.length - 1]![1];
      for (let s = 0; s < stops.length - 1; s++) {
        const [t0, c0] = stops[s]!;
        const [t1, c1] = stops[s + 1]!;
        if (t >= t0 && t <= t1) {
          c = mix(c0, c1, t1 === t0 ? 0 : (t - t0) / (t1 - t0));
          break;
        }
      }
      for (let x = 0; x < this.w; x++) this.set(x, y, c);
    }
  }

  /** Filled circle. */
  disc(cx: number, cy: number, r: number, c: RGB, a = 1): void {
    const r2 = r * r;
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const dx = Math.sqrt(Math.max(0, r2 - dy * dy));
      for (let x = Math.max(0, Math.floor(cx - dx)); x <= Math.min(this.w - 1, Math.ceil(cx + dx)); x++) {
        this.set(x, y, c, a);
      }
    }
  }

  /** Filled ellipse. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
    const y0 = Math.max(0, Math.floor(cy - ry));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let y = y0; y <= y1; y++) {
      const t = (y - cy) / ry;
      const dx = rx * Math.sqrt(Math.max(0, 1 - t * t));
      for (let x = Math.max(0, Math.floor(cx - dx)); x <= Math.min(this.w - 1, Math.ceil(cx + dx)); x++) {
        this.set(x, y, c, a);
      }
    }
  }

  /** Soft radial glow: colour fades from `peak` alpha at the centre to 0 at radius r. */
  glow(cx: number, cy: number, r: number, c: RGB, peak = 0.8): void {
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        const fall = (1 - d) * (1 - d);
        this.set(x, y, c, peak * fall);
      }
    }
  }

  /** Filled polygon (scanline, even-odd). Points are [x, y]. */
  poly(pts: Array<[number, number]>, c: RGB, a = 1): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i]!;
        const [x1, y1] = pts[(i + 1) % pts.length]!;
        if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.max(0, Math.floor(xs[k]!)); x <= Math.min(this.w - 1, Math.ceil(xs[k + 1]!)); x++) {
          this.set(x, y, c, a);
        }
      }
    }
  }

  /** Thick line drawn as a chain of discs. */
  line(x0: number, y0: number, x1: number, y1: number, width: number, c: RGB, a = 1): void {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, width / 3)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.disc(lerp(x0, x1, t), lerp(y0, y1, t), width / 2, c, a);
    }
  }

  /** Quadratic Bezier point. */
  static quad(p0: [number, number], p1: [number, number], p2: [number, number], t: number): [number, number] {
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ];
  }

  /** Thick quadratic curve (a chain of discs along the curve). */
  curve(p0: [number, number], p1: [number, number], p2: [number, number], width: number, c: RGB, a = 1): void {
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const [x, y] = Img.quad(p0, p1, p2, i / steps);
      this.disc(x, y, width / 2, c, a);
    }
  }

  /** Darken the corners slightly so the centre pops (vignette). */
  vignette(strength = 0.22): void {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = Math.hypot(x - cx, y - cy) / maxD;
        if (d > 0.55) {
          const a = strength * ((d - 0.55) / 0.45) ** 2;
          this.set(x, y, [0, 0, 8], a);
        }
      }
    }
  }
}
