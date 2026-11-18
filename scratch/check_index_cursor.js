const fs = require('fs');

const content = fs.readFileSync('index.htm', 'utf8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('cursor')) {
    console.log(`index.htm:${idx+1}: ${l.trim().slice(0, 100)}`);
  }
});
