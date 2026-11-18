const fs = require('fs');

['css/spouzy-edition.css', 'css/guide.css'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  console.log(`=== ${f} ===`);
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (/background.*#fff/i.test(l) || /background.*rgb/i.test(l) || /page/i.test(l) || /canvas/i.test(l)) {
      if (l.length < 300) {
        console.log(`  Line ${i+1}: ${l.trim()}`);
      } else {
        console.log(`  Line ${i+1}: [long line with background match]`);
      }
    }
  });
});
