const fs = require('fs');
const path = require('path');

const cssDir = 'css';
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
for (const f of files) {
  const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (/cursor\s*:/i.test(l)) {
      console.log(`${f}:${idx+1}: ${l.trim()}`);
    }
  });
}
