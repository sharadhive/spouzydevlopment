const fs = require('fs');
const zlib = require('zlib');

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8, width, height, bitDepth, colorType;
  const idatChunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
      bitDepth = buf.readUInt8(offset + 16);
      colorType = buf.readUInt8(offset + 17);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
    } else if (type === 'IEND') break;
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
  return { width, height, bitDepth, colorType, rows };
}

console.log('=== ANALYZING spouzy-big-teddies-small-tip-90.png ===');
const teddy90 = readPng('image/cursors/spouzy-big-teddies-small-tip-90.png');
console.log(`Dimensions: ${teddy90.width} x ${teddy90.height}, bitDepth: ${teddy90.bitDepth}, colorType: ${teddy90.colorType}`);

// Find bounding box and first visible pixels
let minX = 999, maxX = -1, minY = 999, maxY = -1;
const nonZeroPixels = [];

for (let y = 0; y < teddy90.height; y++) {
  const row = teddy90.rows[y];
  for (let x = 0; x < teddy90.width; x++) {
    const r = row[x*4];
    const g = row[x*4 + 1];
    const b = row[x*4 + 2];
    const a = row[x*4 + 3];
    if (a > 0) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      nonZeroPixels.push({ x, y, r, g, b, a });
    }
  }
}

console.log(`Bounding box: x=[${minX}, ${maxX}], y=[${minY}, ${maxY}] (width=${maxX - minX + 1}, height=${maxY - minY + 1})`);

// Find the very top non-zero pixels (small rose-gold arrow tip)
console.log('\nTopmost 15 rows of pixels for spouzy-big-teddies-small-tip-90.png:');
for (let y = 0; y < Math.min(25, teddy90.height); y++) {
  const row = teddy90.rows[y];
  const rowPixels = [];
  for (let x = 0; x < teddy90.width; x++) {
    const r = row[x*4];
    const g = row[x*4 + 1];
    const b = row[x*4 + 2];
    const a = row[x*4 + 3];
    if (a > 10) {
      rowPixels.push({ x, r, g, b, a });
    }
  }
  if (rowPixels.length > 0) {
    const first = rowPixels[0];
    const solid = rowPixels.find(p => p.a > 180) || rowPixels[0];
    console.log(`y=${String(y).padStart(2, '0')}: count=${rowPixels.length}, firstX=${first.x} (rgba=${first.r},${first.g},${first.b},${first.a}), solidX=${solid.x} (rgba=${solid.r},${solid.g},${solid.b},${solid.a}), range=[${rowPixels[0].x}..${rowPixels[rowPixels.length-1].x}]`);
  } else {
    console.log(`y=${String(y).padStart(2, '0')}: completely transparent`);
  }
}

console.log('\n=== ANALYZING spouzy-pointer.png ===');
const pointer = readPng('image/cursors/spouzy-pointer.png');
console.log(`Dimensions: ${pointer.width} x ${pointer.height}, bitDepth: ${pointer.bitDepth}, colorType: ${pointer.colorType}`);

// Inspect pointer topmost rows
for (let y = 0; y < Math.min(15, pointer.height); y++) {
  const row = pointer.rows[y];
  const rowPixels = [];
  for (let x = 0; x < pointer.width; x++) {
    const r = row[x*4];
    const g = row[x*4 + 1];
    const b = row[x*4 + 2];
    const a = row[x*4 + 3];
    if (a > 10) rowPixels.push({ x, r, g, b, a });
  }
  if (rowPixels.length > 0) {
    const first = rowPixels[0];
    const solid = rowPixels.find(p => p.a > 180) || rowPixels[0];
    console.log(`y=${String(y).padStart(2, '0')}: count=${rowPixels.length}, firstX=${first.x} (rgba=${first.r},${first.g},${first.b},${first.a}), solidX=${solid.x} (rgba=${solid.r},${solid.g},${solid.b},${solid.a}), range=[${rowPixels[0].x}..${rowPixels[rowPixels.length-1].x}]`);
  }
}

console.log('\n=== READING spouzy-pointer.svg ===');
const svgContent = fs.readFileSync('image/cursors/spouzy-pointer.svg', 'utf8');
console.log(svgContent.substring(0, 500));
