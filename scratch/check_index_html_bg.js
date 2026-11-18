const fs = require('fs');
const index = fs.readFileSync('index.html', 'utf8');
const lines = index.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('faf6f1')) {
    console.log(`Line ${idx+1}: ${l.trim()}`);
  }
});
