const fs = require('fs');
const js = fs.readFileSync('js/spouzy-modern.js', 'utf8');
const lines = js.split('\n');
console.log(lines.slice(934, 965).join('\n'));
