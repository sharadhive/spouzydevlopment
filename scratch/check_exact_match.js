const fs = require('fs');

const sample = fs.readFileSync('index.htm', 'utf8');
const start = sample.indexOf('<div class="sp-topbar-left sp-topbar-message"');
const end = sample.indexOf('</div>', sample.indexOf('</div>', sample.indexOf('</div>', sample.indexOf('</div>', start) + 1) + 1) + 1) + 6;
const target1 = sample.slice(start, end);

console.log('Target length:', target1.length);
console.log('Target preview:\n' + target1);

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let exactMatches = 0;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes(target1)) exactMatches++;
  else if (content.includes('sp-topbar-track')) {
    console.log(f + ': has sp-topbar-track but not exact string match');
  }
});

console.log('Exact matches:', exactMatches, 'out of 35 expected.');
