const fs = require('fs');
let js = fs.readFileSync('js/spouzy-modern.js', 'utf8');
js = js.replace(/const fullMessage = lines\.join\('[\r\n]+'\);/, "const fullMessage = lines.join('\\n');");
fs.writeFileSync('js/spouzy-modern.js', js, 'utf8');
console.log('Fixed fullMessage join in js/spouzy-modern.js');
