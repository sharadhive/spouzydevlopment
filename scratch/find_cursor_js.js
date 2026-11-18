const fs = require('fs');

function checkJsFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const f of files) {
    const fullPath = dir + '/' + f.name;
    if (f.isDirectory() && f.name !== 'node_modules' && f.name !== '.git' && f.name !== 'scratch') {
      checkJsFiles(fullPath);
    } else if (f.isFile() && f.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/cursor/i.test(content) || /mouse.*follower/i.test(content)) {
        console.log(`Found cursor/mouse reference in ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((l, i) => {
          if (/cursor/i.test(l)) {
            console.log(`  Line ${i+1}: ${l.trim().slice(0, 100)}`);
          }
        });
      }
    }
  }
}

checkJsFiles('.');
