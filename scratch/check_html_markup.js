const fs = require('fs');

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
for (const f of htmlFiles) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('page-curtain') || content.includes('sp-first-visit-loader') || content.includes('preloader')) {
    console.log(`Found loader markup in ${f}`);
  }
}
console.log('Checked all HTML files for hardcoded loader markup.');
