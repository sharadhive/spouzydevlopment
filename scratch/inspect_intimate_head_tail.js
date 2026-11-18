const fs = require('fs');

const content = fs.readFileSync('intimate-health.htm', 'utf8');
const lines = content.split('\n');

console.log('Top 40 lines of intimate-health.htm:');
console.log(lines.slice(0, 40).join('\n'));

console.log('\nBottom 40 lines of intimate-health.htm:');
console.log(lines.slice(lines.length - 40).join('\n'));
