const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

let matchingCount = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const psgIdx = content.indexOf('Problem Solver Group</h4>');
  if (psgIdx !== -1) {
    const ulEnd = content.indexOf('</ul>', psgIdx);
    const colDivEnd = content.indexOf('</div>', ulEnd);
    const gridDivEnd = content.indexOf('</div>', colDivEnd + 6);
    // Let's check between colDivEnd and gridDivEnd
    const between = content.slice(colDivEnd + 6, gridDivEnd).trim();
    if (between === '' || between.startsWith('<!--')) {
      matchingCount++;
    } else {
      console.log(`[NOTICE] ${file}: between = "${between}"`);
    }
  } else {
    console.log(`[WARN] ${file}: no PSG column`);
  }
});

console.log(`Verified ${matchingCount} out of ${files.length} files.`);
