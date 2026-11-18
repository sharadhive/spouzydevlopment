const fs = require('fs');

const content = fs.readFileSync('confidentiality.htm', 'utf8');

const g1Match = content.match(/id=["']group-1["'][\s\S]*?<\/div>\s*<\/div>\s*<\/li>/);
if (g1Match) {
  console.log('=== confidentiality.htm group-1 ===\n', g1Match[0]);
} else {
  console.log('group-1 not found in confidentiality.htm');
  const wwd = content.match(/What We Do[\s\S]*?<\/li>/);
  console.log('What We Do in confidentiality.htm:\n', wwd ? wwd[0] : 'None');
}
