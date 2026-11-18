const fs = require('fs');
const content = fs.readFileSync('intimate-health.htm', 'utf8');

const mainMatch = content.match(/<main[\s\S]*?<\/main>/);
if (mainMatch) {
  console.log('=== intimate-health.htm MAIN ===\n', mainMatch[0]);
}
