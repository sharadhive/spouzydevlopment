const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html') || f.endsWith('.js'));

console.log('=== SEARCHING FOR BREAST & GENITAL ===');
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (/breast/i.test(content) || /genital/i.test(content) || /aesthetics/i.test(content)) {
    console.log(`Found in ${f}:`);
    const lines = content.split('\n');
    lines.forEach((l, idx) => {
      if (/breast|genital|aesthetics/i.test(l)) {
        console.log(`  L${idx+1}: ${l.trim().substring(0, 150)}`);
      }
    });
  }
}
