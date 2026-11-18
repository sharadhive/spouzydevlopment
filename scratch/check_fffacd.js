const fs = require('fs');
const index = fs.readFileSync('index.htm', 'utf8');
const lines = index.split('\n');
lines.forEach((l, idx) => {
  if (/FFFACD/i.test(l)) {
    console.log(`Line ${idx+1}: ${l.trim()}`);
  }
});
