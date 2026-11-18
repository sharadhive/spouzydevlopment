const fs = require('fs');
const path = require('path');

function searchImportantCursors(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'scratch') {
      searchImportantCursors(full);
    } else if (entry.isFile() && /\.(css|html|htm|js)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        if (/cursor\s*:.*!important/i.test(l)) {
          console.log(`${full}:${i+1}: ${l.trim()}`);
        }
      });
    }
  }
}

searchImportantCursors('.');
