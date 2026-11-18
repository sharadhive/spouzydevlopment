const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let count = 0;
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('spouzy-arrow') || content.includes('spouzy-pointer') || content.includes('image/cursors') || content.includes('cursors/')) {
    console.log(`Matched cursor asset in ${f}`);
    count++;
  }
}
console.log(`Total HTML files with cursor asset references: ${count}`);
