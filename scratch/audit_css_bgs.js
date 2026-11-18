const fs = require('fs');

const cssFiles = fs.readdirSync('css').filter(f => f.endsWith('.css'));
const results = [];

for (const f of cssFiles) {
  const content = fs.readFileSync('css/' + f, 'utf8');
  const matches = [...content.matchAll(/(html|body|\.sp-modern-wrapper|main|section|\.care-slider|#why-spouzy|\.why-spouzy|#services|\.sp-services-section|\.sp-testimonials-section|#questions|\.guide-page)\s*\{[^}]*background(?:-color)?:\s*([^;\}]+)[^}]*\}/gi)];
  for (const m of matches) {
    results.push({
      file: f,
      selector: m[1],
      rule: m[2].trim(),
      snippet: m[0]
    });
  }
}

console.log('CSS section/page background rules found:', results.length);
console.log(JSON.stringify(results, null, 2));
