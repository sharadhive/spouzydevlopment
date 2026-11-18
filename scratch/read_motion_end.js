const fs = require('fs');

const motionJs = fs.readFileSync('js/motion.js', 'utf8');
console.log('Total characters in motion.js:', motionJs.length);
console.log('Total lines in motion.js:', motionJs.split('\n').length);

// Print the last 40 lines
const lines = motionJs.split('\n');
console.log('Last 40 lines of motion.js:\n');
console.log(lines.slice(lines.length - 40).join('\n'));
