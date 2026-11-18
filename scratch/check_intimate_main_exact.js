const fs = require('fs');
const content = fs.readFileSync('intimate-health.htm', 'utf8');

const start = content.indexOf('<main');
const end = content.indexOf('</main>') + 7;
console.log('Snippet from intimate-health.htm:');
console.log(JSON.stringify(content.substring(start - 20, end)));
