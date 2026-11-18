const fs = require('fs');
const path = require('path');

function searchDir(dir, queries) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'scratch') {
        searchDir(fullPath, queries);
      }
    } else if (entry.isFile()) {
      if (/\.(css|js|html|htm)$/i.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const q of queries) {
          if (content.includes(q)) {
            console.log(`Found "${q}" in ${fullPath}`);
          }
        }
      }
    }
  }
}

searchDir('.', ['spouzy-arrow', 'spouzy-pointer', 'image/cursors', 'cursors/', 'spouzy-teddy-large-arrow']);
