// main.ts — ai-excited-01 entry (Node 22, standard library only).
//
// Draws "The Leap": a whale breaching out of a glowing night ocean toward a
// giant golden ringed planet, and writes the single image to entry.png.
// Deterministic: same pixels, same bytes, on every run. No network.
//
// Local run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { renderScene } from "./scene.ts";
import { encodePNG } from "./png.ts";

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });

const png = encodePNG(renderScene());
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, png);

// Self-check the file we just wrote: whole PNG, 1024x1024, under the 1 MiB cap.
const back = readFileSync(outPath);
const isPng = back.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
const width = back.readUInt32BE(16);
const height = back.readUInt32BE(20);
if (!isPng || width !== 1024 || height !== 1024 || back.length > 1048576) {
  throw new Error(`entry.png failed self-check: png=${isPng} ${width}x${height} ${back.length} bytes`);
}
const sha = createHash("sha256").update(back).digest("hex");
console.log(`wrote entry.png: ${back.length} bytes, 1024x1024, sha256 ${sha}`);
