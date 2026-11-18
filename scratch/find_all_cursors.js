const fs = require('fs');
const path = require('path');

function searchCursor(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'scratch') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchCursor(fullPath);
    } else if (entry.name.endsWith('.css') || entry.name.endsWith('.js') || entry.name.endsWith('.htm') || entry.name.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('cursor')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('cursor')) {
            console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log('Searching all cursor occurrences...');
searchCursor('.');
