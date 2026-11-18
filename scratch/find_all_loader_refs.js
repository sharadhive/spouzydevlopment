const fs = require('fs');

const searchTerms = ['spouzy_loader_shown', 'sp-first-visit-loader', 'sp-arrival', 'veil-in', 'veil-out'];

function search(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = dir + '/' + f;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const term of searchTerms) {
      if (content.includes(term)) {
        console.log(`Found "${term}" in ${full}`);
      }
    }
  }
}

search('js');
search('css');
