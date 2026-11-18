const fs = require('fs');
const css = fs.readFileSync('css/spouzy-modern.css', 'utf8');
const lines = css.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('spouzy-arrow') || l.includes('spouzy-pointer') || l.includes('image/cursors')) {
    console.log(`Line ${idx+1}: ${l}`);
  }
});
