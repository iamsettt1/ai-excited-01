// palette.ts — every colour the scene uses, in one place.
// All colours are [r, g, b] triples, 0-255. No image assets are used;
// the whole picture is drawn from these values plus geometry.

export type RGB = [number, number, number];

export const SKY_TOP: RGB = [8, 12, 42]; // deep indigo, top of frame
export const SKY_MID: RGB = [24, 38, 92]; // violet-blue, middle sky
export const SKY_LOW: RGB = [58, 64, 138]; // horizon band above the sea
export const SEA_TOP: RGB = [16, 52, 96]; // sea surface at the horizon
export const SEA_DEEP: RGB = [4, 18, 44]; // sea at the bottom of frame

export const PLANET_OUTER: RGB = [214, 138, 20]; // ringed planet rim
export const PLANET_MID: RGB = [247, 183, 51]; // planet body
export const PLANET_HIGH: RGB = [255, 226, 138]; // planet highlight
export const PLANET_BAND: RGB = [196, 120, 16]; // planet surface bands
export const RING_BACK: RGB = [226, 164, 48]; // ring, far side (behind disc)
export const RING_FRONT: RGB = [255, 214, 110]; // ring, near side
export const RING_EDGE: RGB = [255, 240, 180]; // ring highlight edge

export const WHALE_TOP: RGB = [38, 84, 158]; // whale back, deep blue
export const WHALE_MID: RGB = [58, 118, 196]; // whale flank
export const WHALE_BELLY: RGB = [168, 205, 240]; // whale belly, pale blue
export const WHALE_DARK: RGB = [22, 52, 104]; // fins, flukes, outline shade
export const WHALE_EYE: RGB = [6, 10, 26];

export const AURORA_GREEN: RGB = [64, 255, 150];
export const AURORA_TEAL: RGB = [46, 212, 255];
export const AURORA_PINK: RGB = [255, 93, 162];

export const SPOUT_CORE: RGB = [190, 235, 255]; // spout light, bright core
export const SPOUT_HALO: RGB = [120, 190, 255]; // spout light, halo
export const FOAM: RGB = [235, 246, 255]; // splash foam white
export const WAVE_LINE: RGB = [86, 158, 214]; // sea wave highlights

export const CITY_SILHOUETTE: RGB = [10, 14, 38];
export const WINDOW_WARM: RGB = [255, 196, 92];
export const WINDOW_COOL: RGB = [150, 220, 255];
export const BEACON_WHITE: RGB = [255, 248, 220];
export const BEACON_GOLD: RGB = [255, 205, 90];
export const BEACON_CYAN: RGB = [110, 230, 255];

export const CONFETTI: RGB[] = [
  [255, 84, 120], // hot pink
  [255, 196, 0], // gold
  [64, 255, 150], // mint
  [80, 180, 255], // sky blue
  [255, 122, 61], // orange
  [196, 120, 255], // violet
  [255, 255, 255], // white
];

export const STAR_WHITE: RGB = [255, 255, 255];
export const STAR_WARM: RGB = [255, 226, 160];
export const STAR_COOL: RGB = [170, 210, 255];
