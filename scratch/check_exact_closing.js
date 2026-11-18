const fs = require('fs');

['index.htm', 'about-us.htm', 'contactus.htm'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const psgIdx = content.indexOf('Problem Solver Group');
  const ulIdx = content.indexOf('</ul>', psgIdx);
  const divAfterUl = content.indexOf('</div>', ulIdx);
  console.log(`=== ${file} ===`);
  console.log(JSON.stringify(content.slice(divAfterUl - 10, divAfterUl + 40)));
});
