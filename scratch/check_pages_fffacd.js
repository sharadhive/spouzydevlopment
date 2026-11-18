const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
const withFFFACD = [];
const withoutFFFACD = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (/FFFACD/i.test(c)) {
    withFFFACD.push(f);
  } else {
    withoutFFFACD.push(f);
  }
}

console.log('Pages with FFFACD:', withFFFACD.length, withFFFACD);
console.log('Pages without FFFACD:', withoutFFFACD.length);
