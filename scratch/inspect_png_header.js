const fs = require('fs');

const buf = fs.readFileSync('image/cursors/spouzy-teddy-large-arrow-50.png');
console.log('PNG Signature valid:', buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));

const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const bitDepth = buf.readUInt8(24);
const colorType = buf.readUInt8(25);

console.log('Width:', width);
console.log('Height:', height);
console.log('Bit depth:', bitDepth);
console.log('Color type:', colorType, '(6 = RGBA, 2 = RGB, 3 = Indexed)');
