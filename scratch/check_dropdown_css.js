const fs = require('fs');

const css = fs.readFileSync('css/menu.css', 'utf8');
const lines = css.split('\n');
console.log('=== menu.css guide-links rules ===');
lines.forEach((l, i) => {
  if (/guide-links|nav-options|nav-preview|sp-dropdown-item/i.test(l)) {
    console.log(`L${i+1}: ${l}`);
  }
});

const modernCss = fs.readFileSync('css/spouzy-modern.css', 'utf8');
console.log('\n=== spouzy-modern.css guide-links rules ===');
modernCss.split('\n').forEach((l, i) => {
  if (/guide-links|nav-options|nav-preview/i.test(l)) {
    console.log(`L${i+1}: ${l}`);
  }
});
