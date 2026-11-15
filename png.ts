// png.ts — a minimal whole-PNG encoder, standard library only.
// Takes a width, a height and an RGB byte buffer (3 bytes per pixel,
// row-major, top to bottom) and returns a complete PNG: signature,
// IHDR, one IDAT (zlib-deflated scanlines, filter 0) and IEND, each
// chunk carrying its own CRC32. Output is fully deterministic.

import { deflateSync } from "node:zlib";

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  const crcInput = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  out.writeUInt32BE(crc32(crcInput), 8 + data.length);
  return out;
}

export function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  if (rgb.length !== width * height * 3) {
    throw new Error(`rgb buffer is ${rgb.length} bytes, expected ${width * height * 3}`);
  }
  // One filter byte (0 = none) per scanline, then the raw RGB row.
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
