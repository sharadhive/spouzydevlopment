const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8, width, height;
  const idatChunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
    else if (type === 'IEND') break;
    offset += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const rows = [];
  let dOffset = 0, prevRow = Buffer.alloc(stride, 0);
  for (let y = 0; y < height; y++) {
    const filter = decompressed[dOffset++];
    const currentRow = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const raw = decompressed[dOffset++];
      const left = x >= 4 ? currentRow[x - 4] : 0;
      const up = prevRow[x];
      const upLeft = x >= 4 ? prevRow[x - 4] : 0;
      let val = raw;
      if (filter === 1) val = (raw + left) & 0xff;
      else if (filter === 2) val = (raw + up) & 0xff;
      else if (filter === 3) val = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        val = (raw + ((pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft))) & 0xff;
      }
      currentRow[x] = val;
    }
    rows.push(currentRow);
    prevRow = currentRow;
  }
  return { width, height, rows };
}

function writePng(filePath, width, height, rows) {
  const stride = width * 4;
  const rawData = Buffer.alloc(height * (stride + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter 0 (None)
    rows[y].copy(rawData, offset);
    offset += stride;
  }
  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = calcCrc(buf.slice(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  fs.writeFileSync(filePath, Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]));
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calcCrc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Generate hotspot visualization image:
// Side-by-side: Left: 90x90 Teddy Arrow with target reticle at (7, 1)
// Right: 48x48 Hand Pointer with target reticle at (18, 2)
const teddyPng = readPng('image/cursors/spouzy-big-teddies-small-tip-90.png');
const pointerPng = readPng('image/cursors/spouzy-pointer.png');

const canvasW = 320;
const canvasH = 160;
const canvasRows = [];
for (let y = 0; y < canvasH; y++) {
  const row = Buffer.alloc(canvasW * 4, 0);
  // Fill background with #FFFACD
  for (let x = 0; x < canvasW; x++) {
    row[x * 4] = 255;
    row[x * 4 + 1] = 250;
    row[x * 4 + 2] = 205;
    row[x * 4 + 3] = 255;
  }
  canvasRows.push(row);
}

function blit(destRows, srcRows, destX, destY, srcW, srcH) {
  for (let y = 0; y < srcH; y++) {
    const dy = destY + y;
    if (dy < 0 || dy >= canvasH) continue;
    for (let x = 0; x < srcW; x++) {
      const dx = destX + x;
      if (dx < 0 || dx >= canvasW) continue;
      const sa = srcRows[y][x * 4 + 3] / 255;
      if (sa === 0) continue;
      const sr = srcRows[y][x * 4];
      const sg = srcRows[y][x * 4 + 1];
      const sb = srcRows[y][x * 4 + 2];

      const dr = destRows[dy][dx * 4];
      const dg = destRows[dy][dx * 4 + 1];
      const db = destRows[dy][dx * 4 + 2];

      destRows[dy][dx * 4] = Math.round(sr * sa + dr * (1 - sa));
      destRows[dy][dx * 4 + 1] = Math.round(sg * sa + dg * (1 - sa));
      destRows[dy][dx * 4 + 2] = Math.round(sb * sa + db * (1 - sa));
      destRows[dy][dx * 4 + 3] = 255;
    }
  }
}

// Blit teddy at (30, 30) -> hotspot is at (30+7, 30+1) = (37, 31)
blit(canvasRows, teddyPng.rows, 30, 30, teddyPng.width, teddyPng.height);

// Blit pointer at (180, 50) -> hotspot is at (180+18, 50+2) = (198, 52)
blit(canvasRows, pointerPng.rows, 180, 50, pointerPng.width, pointerPng.height);

// Draw red crosshair at both hotspots
function drawCrosshair(destRows, hx, hy) {
  for (let d = -6; d <= 6; d++) {
    // horizontal
    if (hx + d >= 0 && hx + d < canvasW && d !== 0) {
      destRows[hy][(hx + d) * 4] = 220;
      destRows[hy][(hx + d) * 4 + 1] = 20;
      destRows[hy][(hx + d) * 4 + 2] = 20;
      destRows[hy][(hx + d) * 4 + 3] = 255;
    }
    // vertical
    if (hy + d >= 0 && hy + d < canvasH && d !== 0) {
      destRows[hy + d][hx * 4] = 220;
      destRows[hy + d][hx * 4 + 1] = 20;
      destRows[hy + d][hx * 4 + 2] = 20;
      destRows[hy + d][hx * 4 + 3] = 255;
    }
  }
  // center dot: cyan/yellow for high contrast
  destRows[hy][hx * 4] = 0;
  destRows[hy][hx * 4 + 1] = 255;
  destRows[hy][hx * 4 + 2] = 255;
  destRows[hy][hx * 4 + 3] = 255;
}

drawCrosshair(canvasRows, 37, 31);
drawCrosshair(canvasRows, 198, 52);

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const outPath = path.join(ARTIFACT_DIR, '02-dual-cursor-hotspot-diagram.png');
writePng(outPath, canvasW, canvasH, canvasRows);
console.log('Saved hotspot diagram:', outPath);
