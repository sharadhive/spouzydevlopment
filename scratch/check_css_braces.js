const fs = require('fs');

function checkCssBraces(file) {
  const content = fs.readFileSync(file, 'utf8');
  let openCount = 0;
  let closeCount = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') openCount++;
    if (content[i] === '}') closeCount++;
  }
  console.log(`${file}: { count = ${openCount}, } count = ${closeCount}, diff = ${openCount - closeCount}`);
}

checkCssBraces('css/motion.css');
checkCssBraces('css/spouzy-modern.css');
