const fs = require('fs');

const buf = fs.readFileSync('image/spouzy-transition.gif');
console.log('GIF size:', buf.length);

let pos = 13;
const packed = buf[10];
const gctSize = 3 * (1 << ((packed & 0x07) + 1));
pos += gctSize;

let frameCount = 0;
let totalDuration = 0;
let loopCount = null;
let currentGCE = null;

while (pos < buf.length) {
  const b = buf[pos];
  if (b === 0x3B) break;
  if (b === 0x21) {
    const label = buf[pos + 1];
    if (label === 0xF9) {
      const delay = buf.readUInt16LE(pos + 4) * 10;
      currentGCE = { delay };
      pos += 8;
    } else if (label === 0xFF) {
      const blockSize = buf[pos + 2];
      const name = buf.slice(pos + 3, pos + 3 + blockSize).toString('latin1');
      pos += 3 + blockSize;
      while (buf[pos] !== 0) {
        const subSize = buf[pos];
        if (subSize === 3 && buf[pos + 1] === 1) {
          loopCount = buf.readUInt16LE(pos + 2);
        }
        pos += 1 + subSize;
      }
      pos++;
      console.log('Found App Ext:', name, 'loopCount:', loopCount);
    } else {
      pos += 2;
      while (buf[pos] !== 0) pos += 1 + buf[pos];
      pos++;
    }
  } else if (b === 0x2C) {
    frameCount++;
    totalDuration += currentGCE ? currentGCE.delay : 0;
    const packed = buf[pos + 9];
    const hasLCT = (packed & 0x80) !== 0;
    const lctSize = hasLCT ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
    let dataPos = pos + 11 + lctSize;
    while (buf[dataPos] !== 0) {
      dataPos += 1 + buf[dataPos];
    }
    pos = dataPos + 1;
    currentGCE = null;
  } else {
    pos++;
  }
}

console.log(`Summary: Frame count: ${frameCount}, Loop count: ${loopCount}, Total duration: ${totalDuration}ms`);
