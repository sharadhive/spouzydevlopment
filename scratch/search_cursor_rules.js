const fs = require('fs');
const path = require('path');

function searchCursorRules(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'scratch') {
        searchCursorRules(fullPath);
      }
    } else if (entry.isFile()) {
      if (/\.(css|js)$/i.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (/cursor\s*:/i.test(line) || /custom-cursor/i.test(line) || /customCursor/i.test(line)) {
            console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchCursorRules('.');
