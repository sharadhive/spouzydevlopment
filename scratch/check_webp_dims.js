const fs = require('fs');

function getDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  // WebP
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    // VP8 / VP8L / VP8X
    const chunkType = buf.slice(12, 16).toString('ascii');
    if (chunkType === 'VP8X') {
      const w = 1 + buf.readUIntLE(24, 3);
      const h = 1 + buf.readUIntLE(27, 3);
      return { format: 'VP8X', w, h };
    } else if (chunkType === 'VP8 ') {
      // Keyframe header
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      return { format: 'VP8', w, h };
    } else if (chunkType === 'VP8L') {
      const b1 = buf[21];
      const b2 = buf[22];
      const b3 = buf[23];
      const b4 = buf[24];
      const w = 1 + (((b2 & 0x3f) << 8) | b1);
      const h = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      return { format: 'VP8L', w, h };
    }
  }
  return { format: 'unknown', size: buf.length };
}

['image/menu/intimate-health.webp', 'image/menu/join-doctor.webp', 'image/menu/counselling.webp'].forEach(p => {
  console.log(p, getDimensions(p));
});
