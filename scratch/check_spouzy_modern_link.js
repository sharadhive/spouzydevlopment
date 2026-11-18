const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let count = 0;
const missing = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('css/spouzy-modern.css')) {
    count++;
  } else {
    missing.push(f);
  }
}

console.log(`Files with css/spouzy-modern.css: ${count} of ${files.length}`);
if (missing.length) console.log('Missing:', missing);
