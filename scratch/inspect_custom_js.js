const fs = require('fs');
const js = fs.readFileSync('js/custom.js', 'utf8');
js.split('\n').forEach((l, i) => {
  if (/loader/i.test(l)) {
    console.log(`L${i+1}: ${l}`);
  }
});
