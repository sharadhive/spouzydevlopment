const fs = require('fs');
const zlib = require('zlib');

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
  return { width, height, rows };
}

const { width, height, rows } = readPng('image/cursors/spouzy-teddy-large-arrow-50.png');

console.log('Arrow outline analysis (first non-zero pixel on each row):');
for (let y = 0; y < 15; y++) {
  const row = rows[y];
  let firstX = -1;
  let firstSolidX = -1;
  let lastX = -1;
  for (let x = 0; x < width; x++) {
    const a = row[x*4 + 3];
    if (a > 30 && firstX === -1) firstX = x;
    if (a > 200 && firstSolidX === -1) firstSolidX = x;
    if (a > 30) lastX = x;
  }
  console.log(`y=${String(y).padStart(2, '0')}: firstAlpha>30 at x=${firstX}, firstSolid at x=${firstSolidX}, lastAlpha>30 at x=${lastX}`);
}
