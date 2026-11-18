const fs = require('fs');
const content = fs.readFileSync('index.htm', 'utf8');

const matches = content.match(/<article class="sp-service-card-modern[\s\S]*?<\/article>/g);
if (matches) {
  matches.forEach((m, idx) => {
    const title = m.match(/<h3 class="sp-card-title">([\s\S]*?)<\/h3>/);
    const link = m.match(/<div class="sp-card-action-row">([\s\S]*?)<\/div>/);
    console.log(`Card ${idx + 1}: ${title ? title[1].trim() : 'no title'}`);
    console.log(`  Actions: ${link ? link[1].trim().replace(/\s+/g, ' ') : 'none'}`);
  });
}
