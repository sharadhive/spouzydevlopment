const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const inlineBgs = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = [...c.matchAll(/style="[^"]*background(?:-color)?:\s*([^;"]+)[^"]*"/gi)];
  for (const m of matches) {
    const val = m[1].trim();
    if (!['transparent', 'none', '#fffacd', '#FFFACD', 'var(--sp-page-bg, #FFFACD)'].includes(val)) {
      inlineBgs.push({ file: f, val, context: m[0].substring(0, 100) });
    }
  }
}

console.log('Inline background occurrences found:', inlineBgs.length);
console.log(JSON.stringify(inlineBgs.slice(0, 30), null, 2));
