const fs = require('fs');

function inspectLines(filePath, lineNumbers) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== ${filePath} ===`);
  for (const ln of lineNumbers) {
    const start = Math.max(0, ln - 5);
    const end = Math.min(lines.length, ln + 5);
    for (let i = start; i < end; i++) {
      console.log(`${i+1}: ${lines[i]}`);
    }
    console.log('---');
  }
}

inspectLines('css/guide.css', [236, 296]);
inspectLines('css/motion.css', [858, 889]);
