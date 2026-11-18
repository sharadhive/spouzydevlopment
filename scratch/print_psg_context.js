const fs = require('fs');
const content = fs.readFileSync('index.htm', 'utf8');
const psgIdx = content.indexOf('Problem Solver Group');
const ulIdx = content.indexOf('</ul>', psgIdx);
const divAfterUl = content.indexOf('</div>', ulIdx);
console.log(content.slice(psgIdx - 40, divAfterUl + 100));
