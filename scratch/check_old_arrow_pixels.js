const { width, height, rows } = (function() {
  const fs = require('fs');
  const zlib = require('zlib');
  const buf = fs.readFileSync('image/cursors/spouzy-arrow.png');
  let offset = 8, width, height;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    if (type === 'IHDR') {
      width = buf.readUInt32BE(offset + 8);
      height = buf.readUInt32BE(offset + 12);
    } else if (type === 'IDAT') {
      idat.push(buf.slice(offset + 8, offset + 8 + len));
    }
    offset += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rows = [];
  let dOffset = 0, prev = Buffer.alloc(stride, 0);
  for (let y = 0; y < height; y++) {
    const filter = decompressed[dOffset++];
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const raw = decompressed[dOffset++];
      const left = x >= 4 ? cur[x - 4] : 0;
      const up = prev[x];
      const upLeft = x >= 4 ? prev[x - 4] : 0;
      let val = raw;
      if (filter === 1) val = (raw + left) & 0xff;
      else if (filter === 2) val = (raw + up) & 0xff;
      else if (filter === 3) val = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        val = (raw + ((pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft))) & 0xff;
      }
      cur[x] = val;
    }
    rows.push(cur);
    prev = cur;
  }
  return { width, height, rows };
})();

console.log('Old spouzy-arrow.png top-left pixels:');
for (let y = 0; y < 5; y++) {
  const row = rows[y];
  for (let x = 0; x < 5; x++) {
    const a = row[x*4 + 3];
    if (a > 0) {
      console.log(`x=${x}, y=${y} -> A=${a}, RGB=(${row[x*4]},${row[x*4+1]},${row[x*4+2]})`);
    }
  }
}
