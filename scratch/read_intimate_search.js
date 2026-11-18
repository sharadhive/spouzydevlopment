const fs = require('fs');
const js = fs.readFileSync('js/spouzy-modern.js', 'utf8');

const idx = js.indexOf("'intimate-health.htm'");
if (idx !== -1) {
  console.log(js.substring(idx - 100, idx + 400));
}
