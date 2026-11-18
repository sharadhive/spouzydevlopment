const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const cssUsage = {};

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = [...c.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)];
  for (const m of matches) {
    const css = m[1];
    cssUsage[css] = (cssUsage[css] || 0) + 1;
  }
}

console.log('CSS Usage across HTML files:', cssUsage);
