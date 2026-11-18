const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const patterns = new Map();
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const start = content.indexOf('sp-topbar-left sp-topbar-message');
  if (start !== -1) {
    const divStart = content.lastIndexOf('<div', start);
    const end = content.indexOf('sp-topbar-right', start);
    if (end !== -1) {
      const divEnd = content.lastIndexOf('<div', end);
      const block = content.slice(divStart, divEnd).trim();
      const normalized = block.replace(/\s+/g, ' ');
      if (!patterns.has(normalized)) {
        patterns.set(normalized, []);
      }
      patterns.get(normalized).push(f);
    }
  }
});

console.log('Unique patterns found:', patterns.size);
let i = 1;
for (const [pat, fileList] of patterns.entries()) {
  console.log(`\nPattern ${i} (${fileList.length} files): ${fileList.slice(0, 5).join(', ')}...`);
  console.log(pat);
  i++;
}
