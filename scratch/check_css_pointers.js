const fs = require('fs');

const cssFiles = fs.readdirSync('css').filter(f => f.endsWith('.css'));
const pointerRules = [];

for (const f of cssFiles) {
  const content = fs.readFileSync('css/' + f, 'utf8');
  const matches = [...content.matchAll(/([^{}]+)\{[^{}]*cursor:\s*pointer[^{}]*\}/gi)];
  for (const m of matches) {
    pointerRules.push({
      file: f,
      selector: m[1].replace(/\/\*.*?\*\//gs, '').trim()
    });
  }
}

console.log('CSS selectors with cursor:pointer:', pointerRules.length);
console.log(JSON.stringify(pointerRules, null, 2));
