const fs = require('fs');

const buf = fs.readFileSync('image/SPOUZY-loader.gif');

// Read header & screen descriptor
const header = buf.slice(0, 6); // GIF89a
const lsd = buf.slice(6, 13);
const packed = lsd[4];
const hasGCT = (packed & 0x80) !== 0;
const gctSize = 3 * (1 << ((packed & 0x07) + 1));
let pos = 13;
const gct = buf.slice(pos, pos + gctSize);
pos += gctSize;

// We will build output buffer parts
const parts = [];
parts.push(header);
parts.push(lsd);
parts.push(gct);

// NETSCAPE2.0 application extension with loop count = 1
// 21 FF 0B 4E 45 54 53 43 41 50 45 32 2E 30 03 01 01 00 00
const netscapeExt = Buffer.from([
  0x21, 0xFF, 0x0B,
  0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30, // "NETSCAPE2.0"
  0x03, 0x01, 0x01, 0x00, // Sub-block: ID 1, Loop count 1 (LE: 0x0001 = 1)
  0x00 // Block terminator
]);
parts.push(netscapeExt);

const frames = [];
let currentGCE = null;

while (pos < buf.length) {
  const b = buf[pos];
  if (b === 0x3B) {
    break;
  }
  if (b === 0x21) {
    const label = buf[pos + 1];
    if (label === 0xF9) { // GCE
      const blockSize = buf[pos + 2]; // 4
      const gceBuf = Buffer.from(buf.slice(pos, pos + 3 + blockSize + 1));
      currentGCE = gceBuf;
      pos += 3 + blockSize + 1;
    } else {
      // Skip other extensions (like old Netscape extension if present)
      pos += 2;
      while (buf[pos] !== 0) {
        pos += 1 + buf[pos];
      }
      pos++;
    }
  } else if (b === 0x2C) { // Image Descriptor
    const imgStart = pos;
    const packed = buf[pos + 9];
    const hasLCT = (packed & 0x80) !== 0;
    const lctSize = hasLCT ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
    let dataPos = pos + 11 + lctSize;
    while (buf[dataPos] !== 0) {
      dataPos += 1 + buf[dataPos];
    }
    const imgEnd = dataPos + 1;
    const imgBuf = buf.slice(imgStart, imgEnd);

    frames.push({
      frameIndex: frames.length,
      gce: currentGCE,
      img: imgBuf
    });
    currentGCE = null;
    pos = imgEnd;
  } else {
    pos++;
  }
}

console.log(`Parsed ${frames.length} original frames.`);

// We drop Frame 0 (empty)
// Keep Frames 1 to 32 (32 frames total)
const newFrames = frames.slice(1);
console.log(`Processing ${newFrames.length} frames (Frames 1..32).`);

newFrames.forEach((frame, idx) => {
  // GCE structure:
  // [0]=0x21, [1]=0xF9, [2]=0x04, [3]=packed, [4]=delayLow, [5]=delayHigh, [6]=transIdx, [7]=0x00
  const gce = Buffer.from(frame.gce);
  if (idx < newFrames.length - 1) {
    // Frames 1..31: set delay to 40ms (4 in units of 10ms: 0x04, 0x00)
    gce[4] = 4;
    gce[5] = 0;
  } else {
    // Frame 32 (the hold frame): set delay to 220ms (22 in units of 10ms: 0x16, 0x00)
    gce[4] = 22;
    gce[5] = 0;
  }
  parts.push(gce);
  parts.push(frame.img);
});

// Trailer
parts.push(Buffer.from([0x3B]));

const finalBuf = Buffer.concat(parts);
fs.writeFileSync('image/spouzy-transition.gif', finalBuf);
console.log(`Wrote image/spouzy-transition.gif (${finalBuf.length} bytes)`);
