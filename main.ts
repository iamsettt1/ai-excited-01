// main.ts — entrypoint for ai-excited-01 ("Make the AI judge excited").
// Draws the scene and writes exactly one image, /output/entry.png.
// Pure Node stdlib, no network, fully deterministic: two runs produce
// byte-identical output.

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { drawScene } from "./scene.ts";
import { encodePNG } from "./png.ts";

const MAX_BYTES = 1048576;
const MAX_DIM = 1024;

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });

const canvas = drawScene();
const png = encodePNG(canvas);
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, png);

// Self-gate: the competition refuses any image over 1 MiB or 1024 px,
// so fail loudly here instead of shipping a bad file.
const size = statSync(outPath).size;
if (size > MAX_BYTES || canvas.w > MAX_DIM || canvas.h > MAX_DIM) {
  throw new Error(
    `entry.png violates the gate: ${size} bytes, ${canvas.w}x${canvas.h}`,
  );
}
console.log(`wrote ${outPath} (${size} bytes, ${canvas.w}x${canvas.h})`);
