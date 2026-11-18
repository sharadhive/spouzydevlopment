const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('cursor:') || content.includes('cursor :') || content.includes('spouzy-arrow') || content.includes('spouzy-pointer')) {
    console.log(`Found cursor reference in ${f}`);
  }
}
console.log('Finished checking HTML files.');
