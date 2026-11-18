const fs = require('fs');

const css = fs.readFileSync('css/spouzy-modern.css', 'utf8');
const lines = css.split('\n');
lines.forEach((l, idx) => {
  if (idx < 250 && (/background/i.test(l) || /body/i.test(l) || /html/i.test(l))) {
    console.log(`Line ${idx+1}: ${l.trim()}`);
  }
});
