const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const nonStandardClickable = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = [...c.matchAll(/<([a-z0-9]+)[^>]*style="[^"]*cursor:\s*pointer[^"]*"[^>]*>/gi)];
  for (const m of matches) {
    const tag = m[1].toLowerCase();
    if (!['a', 'button', 'summary', 'select', 'input', 'label'].includes(tag)) {
      nonStandardClickable.push({ file: f, tag, snippet: m[0].substring(0, 80) });
    }
  }
}

console.log('Non-standard tags with inline cursor:pointer in HTML:', nonStandardClickable.length);
console.log(nonStandardClickable);
