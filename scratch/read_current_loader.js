const fs = require('fs');

console.log('=== js/spouzy-modern.js lines 1-100 ===');
const js = fs.readFileSync('js/spouzy-modern.js', 'utf8');
console.log(js.split('\n').slice(0, 100).join('\n'));

console.log('\n=== css/spouzy-modern.css lines 4815-4875 ===');
const css = fs.readFileSync('css/spouzy-modern.css', 'utf8');
console.log(css.split('\n').slice(4815, 4875).join('\n'));
