// main.ts — entrypoint. Draws the scene and writes exactly one image:
// /output/entry.png in the sandbox (MAKEFUN_OUTPUT_DIR overrides the
// directory for local runs). Standard library only, no network, and the
// drawing is fully deterministic, so two runs write identical bytes.

import { mkdirSync, writeFileSync } from "node:fs";
import { drawScene } from "./scene.ts";
import { encodePng } from "./png.ts";

const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const OUT_FILE = `${OUT_DIR}/entry.png`;

// The competition gate: a whole PNG or JPEG, at most 1 MiB and at most
// 1024 by 1024 pixels. Check our own output against it and fail loudly
// instead of writing an entry the gate would refuse.
const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

const canvas = drawScene();
if (canvas.w > MAX_SIDE || canvas.h > MAX_SIDE) {
  throw new Error(`image is ${canvas.w}x${canvas.h}, over the ${MAX_SIDE}x${MAX_SIDE} cap`);
}
const png = encodePng(canvas.w, canvas.h, canvas.data);
if (png.length > MAX_BYTES) {
  throw new Error(`PNG is ${png.length} bytes, over the ${MAX_BYTES} byte cap`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, png);

console.log(`wrote ${OUT_FILE}: ${canvas.w}x${canvas.h}, ${png.length} bytes`);
