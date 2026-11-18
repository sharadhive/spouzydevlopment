const fs = require('fs');
const content = fs.readFileSync('treatment.htm', 'utf8');

const idx = content.indexOf('id="intimate-health"');
if (idx !== -1) {
  console.log(content.substring(idx - 100, idx + 500));
} else {
  console.log('id="intimate-health" not found in treatment.htm');
}
