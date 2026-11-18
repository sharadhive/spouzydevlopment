const fs = require('fs');
const zlib = require('zlib');

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  let width, height;
  const idatChunks = [];

  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.slice(offset + 8, offset + 8 + len));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }

  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);

  const stride = width * 4;
  const rows = [];
  let dOffset = 0;
  let prevRow = Buffer.alloc(stride, 0);

  for (let y = 0; y < height; y++) {
    const filter = decompressed[dOffset++];
    const currentRow = Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const raw = decompressed[dOffset++];
      const bpp = 4;
      const left = x >= bpp ? currentRow[x - bpp] : 0;
      const up = prevRow[x];
      const upLeft = x >= bpp ? prevRow[x - bpp] : 0;

      let val = raw;
      if (filter === 0) val = raw;
      else if (filter === 1) val = (raw + left) & 0xff;
      else if (filter === 2) val = (raw + up) & 0xff;
      else if (filter === 3) val = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        let pr = (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
        val = (raw + pr) & 0xff;
      }
      currentRow[x] = val;
    }
    rows.push(currentRow);
    prevRow = currentRow;
  }

  return { width, height, rows };
}

const { width, height, rows } = readPng('image/cursors/spouzy-teddy-large-arrow-50.png');

console.log('Top-left 10x10 pixels (x, y, R, G, B, A):');
for (let y = 0; y < 8; y++) {
  const row = rows[y];
  for (let x = 0; x < 8; x++) {
    const r = row[x*4];
    const g = row[x*4 + 1];
    const b = row[x*4 + 2];
    const a = row[x*4 + 3];
    if (a > 0) {
      console.log(`x=${x}, y=${y} -> RGBA(${r}, ${g}, ${b}, ${a})`);
    }
  }
}
