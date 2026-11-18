const fs = require('fs');

const buf = fs.readFileSync('image/SPOUZY-loader.gif');
console.log('Total file size:', buf.length, 'bytes');

const header = buf.slice(0, 6).toString('ascii');
const width = buf.readUInt16LE(6);
const height = buf.readUInt16LE(8);
const packed = buf[10];
const hasGCT = (packed & 0x80) !== 0;
const gctSize = 3 * (1 << ((packed & 0x07) + 1));

console.log(`GIF Header: ${header}, Canvas: ${width}x${height}, hasGCT: ${hasGCT}, gctSize: ${gctSize}`);

let pos = 13;
let gct = null;
if (hasGCT) {
  gct = buf.slice(pos, pos + gctSize);
  pos += gctSize;
}

const frames = [];
let currentGCE = null;

while (pos < buf.length) {
  const b = buf[pos];
  if (b === 0x3B) {
    console.log('Found GIF Trailer at pos:', pos);
    break;
  }
  if (b === 0x21) {
    // Extension
    const label = buf[pos + 1];
    if (label === 0xF9) { // Graphic Control Extension
      const blockSize = buf[pos + 2]; // 4
      const gcePacked = buf[pos + 3];
      const disposalMethod = (gcePacked >> 2) & 0x07;
      const userInput = (gcePacked & 0x02) !== 0;
      const transFlag = (gcePacked & 0x01) !== 0;
      const delay = buf.readUInt16LE(pos + 4) * 10; // in ms
      const transIndex = buf[pos + 6];
      currentGCE = {
        disposalMethod,
        delay,
        transFlag,
        transIndex,
        pos
      };
      pos += 3 + blockSize + 1; // 3 + 4 + 1 = 8
    } else if (label === 0xFF) { // Application Extension (NETSCAPE2.0)
      const blockSize = buf[pos + 2];
      const appName = buf.slice(pos + 3, pos + 3 + blockSize).toString('latin1');
      pos += 3 + blockSize;
      // read sub-blocks
      let loopCount = null;
      while (buf[pos] !== 0) {
        const subBlockSize = buf[pos];
        if (subBlockSize === 3 && buf[pos + 1] === 1) {
          loopCount = buf.readUInt16LE(pos + 2);
        }
        pos += 1 + subBlockSize;
      }
      pos++; // skip terminating 0
      console.log(`Application Extension: ${appName}, loopCount: ${loopCount}`);
    } else {
      // Other extension
      pos += 2;
      while (buf[pos] !== 0) {
        pos += 1 + buf[pos];
      }
      pos++;
    }
  } else if (b === 0x2C) {
    // Image Descriptor
    const left = buf.readUInt16LE(pos + 1);
    const top = buf.readUInt16LE(pos + 3);
    const w = buf.readUInt16LE(pos + 5);
    const h = buf.readUInt16LE(pos + 7);
    const imgPacked = buf[pos + 9];
    const hasLCT = (imgPacked & 0x80) !== 0;
    const lctSize = hasLCT ? 3 * (1 << ((imgPacked & 0x07) + 1)) : 0;
    const lzwMin = buf[pos + 10 + lctSize];
    
    // Scan through image sub-blocks
    const imgDataStart = pos + 11 + lctSize;
    let dataPos = imgDataStart;
    while (buf[dataPos] !== 0) {
      dataPos += 1 + buf[dataPos];
    }
    const imgDataEnd = dataPos; // pointing at 0x00
    const frameEnd = imgDataEnd + 1;

    frames.push({
      frameIndex: frames.length,
      left, top, w, h,
      hasLCT, lctSize,
      lzwMin,
      gce: currentGCE,
      startPos: currentGCE ? currentGCE.pos : pos,
      endPos: frameEnd,
      dataLength: frameEnd - (currentGCE ? currentGCE.pos : pos)
    });

    currentGCE = null;
    pos = frameEnd;
  } else {
    console.log('Unknown byte at pos:', pos, b.toString(16));
    pos++;
  }
}

console.log(`Total frames found: ${frames.length}`);
let totalDuration = 0;
frames.forEach(f => {
  const d = f.gce ? f.gce.delay : 0;
  totalDuration += d;
  console.log(`Frame ${f.frameIndex}: dims ${f.w}x${f.h} at (${f.left},${f.top}), delay: ${d}ms, disposal: ${f.gce ? f.gce.disposalMethod : 'none'}, trans: ${f.gce ? f.gce.transFlag : false} (idx: ${f.gce ? f.gce.transIndex : -1})`);
});
console.log(`Total cycle duration: ${totalDuration}ms`);
