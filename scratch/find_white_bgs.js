const fs = require('fs');

const mod = fs.readFileSync('css/spouzy-modern.css', 'utf8');
const lines = mod.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('background: #ffffff;') || l.includes('background-color: #ffffff;')) {
    console.log(`spouzy-modern.css line ${idx+1}:`, l);
    console.log(lines.slice(Math.max(0, idx - 4), idx + 5).join('\n'));
    console.log('---');
  }
});
