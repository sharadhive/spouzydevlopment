const fs = require('fs');

const buf = fs.readFileSync('image/SPOUZY-loader.gif');
console.log('GIF header:', buf.slice(0, 6).toString('ascii'));
const width = buf.readUInt16LE(6);
const height = buf.readUInt16LE(8);
console.log('Dimensions:', width, 'x', height);

// Check if Graphic Control Extension has transparent color flag
let pos = 13;
// Global Color Table flag
const gctFlag = buf[10];
const hasGCT = (gctFlag & 0x80) !== 0;
const gctSize = 3 * (1 << ((gctFlag & 0x07) + 1));
console.log('Has GCT:', hasGCT, 'GCT size:', gctSize);

if (hasGCT) pos += gctSize;

let transparentFound = false;
while (pos < buf.length) {
  if (buf[pos] === 0x21) { // Extension introducer
    const label = buf[pos + 1];
    if (label === 0xF9) { // Graphic Control Extension
      const blockSize = buf[pos + 2];
      const packed = buf[pos + 3];
      const hasTransparency = (packed & 0x01) !== 0;
      const transIndex = buf[pos + 6];
      console.log('Graphic Control Extension found! Transparency flag:', hasTransparency, 'index:', transIndex);
      transparentFound = true;
      break;
    }
    pos += 2;
    while (buf[pos] !== 0) pos += buf[pos] + 1;
    pos++;
  } else {
    break;
  }
}
