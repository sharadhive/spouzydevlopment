const fs = require('fs');

['css/guide.css', 'css/spouzy-edition.css', 'css/motion.css', 'css/style.css'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  console.log(`=== ${f} ===`);
  const lines = c.split('\n');
  lines.forEach((l, i) => {
    if (/(body|html|\.guide-page|\.why-spouzy|\.ed-section|#services|#questions|\.sp-modern-wrapper)\s*\{[^}]*background/i.test(l)) {
      console.log(`  Line ${i+1}: ${l.trim().slice(0, 150)}`);
    }
  });
});
