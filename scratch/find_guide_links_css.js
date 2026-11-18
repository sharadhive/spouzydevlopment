const fs = require('fs');

for (const f of fs.readdirSync('css')) {
  if (f.endsWith('.css')) {
    const c = fs.readFileSync('css/' + f, 'utf8');
    if (c.includes('.guide-links')) {
      console.log(`Found .guide-links in css/${f}`);
      c.split('\n').forEach((l, i) => {
        if (l.includes('.guide-links') || l.includes('.nav-options')) {
          console.log(`  L${i+1}: ${l.substring(0, 100)}`);
        }
      });
    }
  }
}
