const fs = require('fs');

const edition = fs.readFileSync('css/spouzy-edition.css', 'utf8');
const lines = edition.split('\n');
lines.forEach((l, i) => {
  if (/background(-color)?:\s*#[a-f0-9]{3,6}/i.test(l) || /background(-color)?:\s*linear-gradient/i.test(l)) {
    console.log(`spouzy-edition.css line ${i+1}:`, l.substring(0, 150));
  }
});
