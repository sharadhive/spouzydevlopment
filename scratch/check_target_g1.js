const fs = require('fs');

const content = fs.readFileSync('intimate-aesthetics-treatment.htm', 'utf8');
const idx = content.indexOf('aria-controls="group-1"');
console.log('Snippet around group-1 in intimate-aesthetics-treatment.htm:\n', content.substring(idx - 100, idx + 200));
