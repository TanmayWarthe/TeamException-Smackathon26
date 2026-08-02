// scripts/generate-icons.mjs
// Generates simple CTIP shield icons as PNG files using canvas.
// Run: node scripts/generate-icons.mjs
// Requires no dependencies — uses an inline minimal PNG encoder.

import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Minimal PNG creator for simple solid-color icons with a shield shape
// This creates a basic icon — replace with proper designed icons for production.

function createPNG(size) {
  // Create raw RGBA pixel data
  const pixels = new Uint8Array(size * size * 4);

  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Shield shape approximation
      const nx = (x - cx) / (size / 2);
      const ny = (y - cy) / (size / 2);

      // Shield: top is flat, sides curve in, bottom comes to a point
      const topY = -0.8;
      const isInShield =
        ny >= topY &&
        ny <= 0.9 &&
        Math.abs(nx) <= (ny < 0 ? 0.7 : 0.7 - (ny * 0.7));

      if (isInShield) {
        // Cyan accent: #22d3ee
        pixels[idx] = 0x22;     // R
        pixels[idx + 1] = 0xd3; // G
        pixels[idx + 2] = 0xee; // B
        pixels[idx + 3] = 255;  // A
      } else {
        // Transparent
        pixels[idx + 3] = 0;
      }
    }
  }

  return encodePNG(size, size, pixels);
}

// Minimal PNG encoder (uncompressed)
function encodePNG(width, height, rgba) {
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }

  function adler32(buf) {
    let a = 1, b = 0;
    for (let i = 0; i < buf.length; i++) {
      a = (a + buf[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = new TextEncoder().encode(type);
    const len = data.length;
    const buf = new Uint8Array(4 + 4 + len + 4);
    buf[0] = (len >> 24) & 0xff;
    buf[1] = (len >> 16) & 0xff;
    buf[2] = (len >> 8) & 0xff;
    buf[3] = len & 0xff;
    buf.set(typeBytes, 4);
    buf.set(data, 8);
    const crcData = new Uint8Array(4 + len);
    crcData.set(typeBytes, 0);
    crcData.set(data, 4);
    const crc = crc32(crcData);
    buf[8 + len] = (crc >> 24) & 0xff;
    buf[8 + len + 1] = (crc >> 16) & 0xff;
    buf[8 + len + 2] = (crc >> 8) & 0xff;
    buf[8 + len + 3] = crc & 0xff;
    return buf;
  }

  // IHDR
  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >> 24) & 0xff; ihdr[1] = (width >> 16) & 0xff;
  ihdr[2] = (width >> 8) & 0xff;  ihdr[3] = width & 0xff;
  ihdr[4] = (height >> 24) & 0xff; ihdr[5] = (height >> 16) & 0xff;
  ihdr[6] = (height >> 8) & 0xff;  ihdr[7] = height & 0xff;
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data with filter byte (0 = None) per row
  const rawLen = height * (1 + width * 4);
  const raw = new Uint8Array(rawLen);
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      raw[dstIdx] = rgba[srcIdx];
      raw[dstIdx + 1] = rgba[srcIdx + 1];
      raw[dstIdx + 2] = rgba[srcIdx + 2];
      raw[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }

  // Deflate (store only, no compression — simple but larger)
  const blocks = [];
  let offset = 0;
  while (offset < raw.length) {
    const remaining = raw.length - offset;
    const blockSize = Math.min(remaining, 65535);
    const isLast = (offset + blockSize >= raw.length) ? 1 : 0;
    const block = new Uint8Array(5 + blockSize);
    block[0] = isLast;
    block[1] = blockSize & 0xff;
    block[2] = (blockSize >> 8) & 0xff;
    block[3] = (~blockSize) & 0xff;
    block[4] = ((~blockSize) >> 8) & 0xff;
    block.set(raw.subarray(offset, offset + blockSize), 5);
    blocks.push(block);
    offset += blockSize;
  }

  const totalDeflateLen = blocks.reduce((s, b) => s + b.length, 0);
  const deflated = new Uint8Array(2 + totalDeflateLen + 4);
  deflated[0] = 0x78; deflated[1] = 0x01; // zlib header
  let pos = 2;
  for (const block of blocks) {
    deflated.set(block, pos);
    pos += block.length;
  }
  const adler = adler32(raw);
  deflated[pos] = (adler >> 24) & 0xff;
  deflated[pos + 1] = (adler >> 16) & 0xff;
  deflated[pos + 2] = (adler >> 8) & 0xff;
  deflated[pos + 3] = adler & 0xff;

  // Assemble PNG
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', deflated);
  const iendChunk = chunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let p = 0;
  png.set(signature, p); p += signature.length;
  png.set(ihdrChunk, p); p += ihdrChunk.length;
  png.set(idatChunk, p); p += idatChunk.length;
  png.set(iendChunk, p);

  return png;
}

// ── Generate icons ───────────────────────────────────────────
const assetsDir = 'assets';
if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

[16, 48, 128].forEach((size) => {
  const png = createPNG(size);
  const path = `${assetsDir}/icon-${size}.png`;
  writeFileSync(path, png);
  console.log(`✅ Generated ${path} (${png.length} bytes)`);
});

console.log('\nDone! Icons saved to assets/');
