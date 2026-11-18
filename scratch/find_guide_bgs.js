const fs = require('fs');

const guide = fs.readFileSync('css/guide.css', 'utf8');
const lines = guide.split('\n');
lines.forEach((l, i) => {
  if (/background(-color)?:\s*#[a-f0-9]{3,6}/i.test(l) || /background(-color)?:\s*linear-gradient/i.test(l)) {
    console.log(`guide.css line ${i+1}:`, l.substring(0, 150));
  }
});
