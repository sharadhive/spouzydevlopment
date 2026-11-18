const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = c.match(/href=["'][^"']*#intimate-[^"']*["']/g);
  if (matches) {
    console.log(`Found anchor references in ${f}:`, matches);
  }
}
