const fs = require('fs');

['index.htm', 'index.html', 'about-us.htm', 'corporate-kamasutra.htm', 'intimate-aesthetics-treatment.htm'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const psgHeading = '<h4 class="sp-footer-col-title">Problem Solver Group</h4>';
  const headingIdx = content.indexOf(psgHeading);
  const ulIdx = content.indexOf('</ul>', headingIdx);
  const divAfterUl = content.indexOf('</div>', ulIdx);
  console.log(`=== ${file} ===`);
  console.log(content.slice(divAfterUl, divAfterUl + 60));
});
