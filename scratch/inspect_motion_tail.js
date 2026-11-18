const fs = require('fs');
const js = fs.readFileSync('js/motion.js', 'utf8');
const lines = js.split('\n');
console.log(lines.slice(470, 517).join('\n'));
