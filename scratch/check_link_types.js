const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let dataHrefs = 0;
let roleLinks = 0;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('data-href')) dataHrefs++;
  if (c.includes('role="link"')) roleLinks++;
}
console.log({ dataHrefs, roleLinks });
