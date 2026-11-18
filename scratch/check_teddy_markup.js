const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

let matching = 0;
let nonMatching = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('class="sp-footer-teddy-toggle"') && content.includes('class="sp-footer-teddy-stage"')) {
    matching++;
  } else {
    nonMatching.push(file);
  }
});

console.log(`Matching files with toggle button: ${matching} / ${files.length}`);
if (nonMatching.length) {
  console.log('Non matching:', nonMatching);
}
