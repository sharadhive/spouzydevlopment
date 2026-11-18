const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

let errors = [];
let checked = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const psgHeading = '<h4 class="sp-footer-col-title">Problem Solver Group</h4>';
  const headingIdx = content.indexOf(psgHeading);
  if (headingIdx === -1) {
    errors.push(`${file}: footer heading not found`);
    return;
  }
  const ulIdx = content.indexOf('</ul>', headingIdx);
  if (ulIdx === -1) {
    errors.push(`${file}: </ul> not found after heading`);
    return;
  }
  const divAfterUl = content.indexOf('</div>', ulIdx);
  if (divAfterUl === -1) {
    errors.push(`${file}: </div> not found after </ul>`);
    return;
  }
  // The next character after </div> should close the column, then next is </div> closing .sp-footer-grid
  const afterColDiv = content.slice(divAfterUl + 6, divAfterUl + 50);
  checked++;
});

console.log(`Successfully checked ${checked} / ${files.length} files.`);
if (errors.length) {
  console.log('Errors:', errors);
} else {
  console.log('All 50 files have <h4 class="sp-footer-col-title">Problem Solver Group</h4> followed by </ul> and </div> in footer!');
}
