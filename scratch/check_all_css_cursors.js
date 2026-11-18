const fs = require('fs');
const path = require('path');

const cssDir = 'css';
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
for (const f of files) {
  const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
  if (content.includes('spouzy-arrow') || content.includes('spouzy-pointer') || content.includes('cursors') || (content.includes('cursor:') && content.includes('url('))) {
    console.log(`Matched in css/${f}`);
    const lines = content.split('\n');
    lines.forEach((l, idx) => {
      if (l.includes('cursor') && l.includes('url(')) {
        console.log(`  Line ${idx+1}: ${l.trim()}`);
      }
    });
  }
}
