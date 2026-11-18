const fs = require('fs');

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

let withMotionJs = 0;
let withMotionCss = 0;
let withSpouzyModernJs = 0;
let withCustomJs = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('motion.js')) withMotionJs++;
  if (content.includes('motion.css')) withMotionCss++;
  if (content.includes('spouzy-modern.js')) withSpouzyModernJs++;
  if (content.includes('custom.js')) withCustomJs++;
}

console.log(`Total HTML files: ${htmlFiles.length}`);
console.log(`With motion.js: ${withMotionJs}`);
console.log(`With motion.css: ${withMotionCss}`);
console.log(`With spouzy-modern.js: ${withSpouzyModernJs}`);
console.log(`With custom.js: ${withCustomJs}`);
