/**
 * Generates 192×192 and 512×512 PNG icons for the PWA manifest.
 * Run once: node scripts/generate-icons.mjs
 *
 * Uses only Node.js built-ins (no extra npm package).
 * Produces a minimal valid PNG: navy background + centred white circle.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';

function crc32(buf) {
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function uint32BE(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n);
  return b;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBytes, data]));
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc)]);
}

function makePNG(size, drawFn) {
  // 1. Allocate RGBA pixel buffer
  const pixels = new Uint8Array(size * size * 4);
  drawFn(pixels, size);

  // 2. Build raw filter-byte rows (filter 0 = None)
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4);
    row[0] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      row[1 + x * 4 + 0] = pixels[src + 0]; // R
      row[1 + x * 4 + 1] = pixels[src + 1]; // G
      row[1 + x * 4 + 2] = pixels[src + 2]; // B
      row[1 + x * 4 + 3] = pixels[src + 3]; // A
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(raw, { level: 6 });

  // 3. Build IHDR chunk (width, height, bitdepth=8, colortype=6=RGBA)
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // compression, filter, interlace

  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const IHDR = pngChunk('IHDR', ihdr);
  const IDAT = pngChunk('IDAT', compressed);
  const IEND = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, IHDR, IDAT, IEND]);
}

// ─── Icon design ─────────────────────────────────────────────────────────────

function drawIcon(pixels, size) {
  const bg    = [30, 58, 95, 255];   // #1e3a5f (navy)
  const ring  = [147, 197, 253, 255]; // #93c5fd (light blue)
  const inner = [30, 58, 95, 255];   // same navy — creates a ring effect
  const gold  = [251, 191, 36, 255]; // #fbbf24 (amber)
  const cx = size / 2;
  const cy = size / 2;
  const outerR  = size * 0.42;
  const innerR  = size * 0.33;
  const trophyW = size * 0.26;
  const trophyH = size * 0.28;
  const trophyY = cy - size * 0.10;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);

      let color;
      if (r <= innerR) {
        // Simplified trophy shape: rounded rectangle in the circle
        const tx = Math.abs(dx), ty = y - trophyY;
        const inBody  = tx < trophyW / 2 && ty > -trophyH / 2 && ty < trophyH * 0.55;
        const inBase  = tx < trophyW * 0.55 && ty >= trophyH * 0.45 && ty < trophyH * 0.65;
        const inStem  = tx < trophyW * 0.14 && ty >= trophyH * 0.55 && ty < trophyH * 0.75;
        const inFoot  = tx < trophyW * 0.4 && ty >= trophyH * 0.72 && ty < trophyH * 0.85;
        color = (inBody || inBase || inStem || inFoot) ? gold : inner;
      } else if (r <= outerR) {
        color = ring;
      } else {
        color = bg;
      }

      pixels[idx + 0] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }
}

// ─── Generate files ───────────────────────────────────────────────────────────

mkdirSync('public/icons', { recursive: true });

for (const size of [192, 512]) {
  const png = makePNG(size, drawIcon);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`✓ public/icons/icon-${size}.png (${png.length} bytes)`);
}

console.log('\nDone! Icons written to public/icons/');
