// palette.ts — colour definitions and helpers for the ai-excited-01 scene.
// All colours are hand-picked for a high-energy night scene: deep indigo sky,
// magenta horizon, a golden ringed planet, teal aurora and a blue whale.

export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return lerp(a, b, t);
}

export const PALETTE = {
  skyTop: hex("#070b2e"),
  skyMid: hex("#1b1450"),
  skyLow: hex("#57206e"),
  horizon: hex("#ff7a3d"),
  oceanDeep: hex("#06283f"),
  oceanTop: hex("#0e4d6b"),
  foam: hex("#cfefff"),
  planetGold: hex("#ffc44d"),
  planetAmber: hex("#ff8a2a"),
  planetShadow: hex("#b3541e"),
  ringPale: hex("#ffe9b0"),
  auroraGreen: hex("#2affc4"),
  auroraTeal: hex("#19b8ff"),
  auroraPink: hex("#ff4fd8"),
  whaleBack: hex("#22448f"),
  whaleMid: hex("#3f74d6"),
  whaleBelly: hex("#9cc8ff"),
  whaleGlow: hex("#7fd4ff"),
  cityDark: hex("#0a0a22"),
  windowWarm: hex("#ffd76a"),
  windowCool: hex("#8fe8ff"),
  starWhite: hex("#ffffff"),
  splash: hex("#bfeaff"),
} as const;

// Deterministic PRNG (mulberry32) so the two sandbox runs are byte-identical.
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
