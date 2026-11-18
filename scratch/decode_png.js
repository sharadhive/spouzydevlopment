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
      if (filter === 0) { // None
        val = raw;
      } else if (filter === 1) { // Sub
        val = (raw + left) & 0xff;
      } else if (filter === 2) { // Up
        val = (raw + up) & 0xff;
      } else if (filter === 3) { // Average
        val = (raw + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) { // Paeth
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        let pr;
        if (pa <= pb && pa <= pc) pr = left;
        else if (pb <= pc) pr = up;
        else pr = upLeft;
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
console.log(`Decoded PNG: ${width}x${height}`);

// Print ASCII art of the cursor
const ascii = [];
for (let y = 0; y < height; y++) {
  let line = '';
  const row = rows[y];
  for (let x = 0; x < width; x++) {
    const a = row[x * 4 + 3];
    if (a === 0) line += ' ';
    else if (a < 50) line += '.';
    else if (a < 150) line += '+';
    else line += '#';
  }
  ascii.push(String(y).padStart(2, '0') + ': ' + line);
}
fs.writeFileSync('scratch/teddy_ascii.txt', ascii.join('\n'));
console.log('Saved scratch/teddy_ascii.txt');

// Print first 10 rows to console
console.log(ascii.slice(0, 20).join('\n'));
