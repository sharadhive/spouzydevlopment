const fs = require('fs');
const css = fs.readFileSync('css/motion.css', 'utf8');
const lines = css.split('\n');
lines.forEach((l, i) => {
  if (/curtain|veil|unveil/i.test(l)) {
    console.log(`L${i+1}: ${l}`);
  }
});
