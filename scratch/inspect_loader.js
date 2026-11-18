const fs = require('fs');

console.log('=== spouzy-modern.js loader occurrences ===');
const js = fs.readFileSync('js/spouzy-modern.js', 'utf8');
js.split('\n').forEach((l, i) => {
  if (/loader/i.test(l)) {
    console.log(`L${i+1}: ${l}`);
  }
});

console.log('\n=== spouzy-modern.css loader occurrences ===');
const css = fs.readFileSync('css/spouzy-modern.css', 'utf8');
css.split('\n').forEach((l, i) => {
  if (/loader/i.test(l)) {
    console.log(`L${i+1}: ${l}`);
  }
});
