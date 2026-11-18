const fs = require('fs');

const c = fs.readFileSync('index.htm', 'utf8');
const idx = c.indexOf('sp-text-shimmer');
console.log('Index:', idx);
if (idx !== -1) {
  console.log(c.substring(idx - 60, idx + 120));
  const next = c.indexOf('sp-text-shimmer', idx + 1);
  if (next !== -1) console.log(c.substring(next - 60, next + 120));
}
