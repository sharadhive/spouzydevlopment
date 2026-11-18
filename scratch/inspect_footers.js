const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
console.log('Total files found:', files.length);

let matching = 0;
let errors = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Look for Problem Solver Group heading in footer
  const psgIdx = content.indexOf('Problem Solver Group');
  if (psgIdx === -1) {
    errors.push(`${file}: 'Problem Solver Group' NOT found`);
    return;
  }
  // Find the next </ul> and next </div>
  const ulIdx = content.indexOf('</ul>', psgIdx);
  if (ulIdx === -1) {
    errors.push(`${file}: '</ul>' after PSG not found`);
    return;
  }
  const divAfterUl = content.indexOf('</div>', ulIdx);
  if (divAfterUl === -1) {
    errors.push(`${file}: '</div>' closing PSG column not found`);
    return;
  }
  // Check what comes after that div
  const sliceAfter = content.slice(divAfterUl, divAfterUl + 60).replace(/\r?\n\s*/g, ' ');
  matching++;
});

console.log(`Matching files: ${matching} / ${files.length}`);
if (errors.length) {
  console.log('Errors:', errors);
} else {
  console.log('All 50 files have standard PSG column structure!');
}
