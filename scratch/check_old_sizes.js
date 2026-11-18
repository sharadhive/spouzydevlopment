const fs = require('fs');

['spouzy-arrow.png', 'spouzy-pointer.png', 'spouzy-teddy-large-arrow-50.png'].forEach(f => {
  const buf = fs.readFileSync('image/cursors/' + f);
  console.log(f, buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20));
});
