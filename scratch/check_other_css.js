const fs = require('fs');

['css/menu.css', 'css/spouzy.css', 'css/style.css'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  console.log(`=== ${f} ===`);
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('spouzy-arrow') || l.includes('spouzy-pointer') || l.includes('cursors') || (l.includes('cursor') && l.includes('url('))) {
      console.log(`  Line ${i+1}: ${l.trim()}`);
    }
  });
});
