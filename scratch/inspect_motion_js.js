const fs = require('fs');

const motionJs = fs.readFileSync('js/motion.js', 'utf8');
const lines = motionJs.split('\n');

lines.forEach((line, idx) => {
  if (/curtain|veil|unveil|arrival|transition|loader/i.test(line)) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
