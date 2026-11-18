const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = c.match(/style=["'][^"']*background[^"']*["']/gi);
  if (matches) {
    matches.forEach(m => {
      if (/section|main|div/i.test(m) || /#fff|white|#faf/i.test(m)) {
        console.log(`${f}: ${m}`);
      }
    });
  }
}
