const fs = require('fs');

const css = fs.readFileSync('css/spouzy-modern.css', 'utf8');

const bgMatches = css.match(/--sp-[a-z0-9_-]*(?:bg|ivory|cream|surface|canvas)[^;]*;/gi) || [];
console.log('Background CSS variables:');
console.log([...new Set(bgMatches)].slice(0, 30));

const colorVars = css.match(/--sp-[a-z0-9_-]*:[^;]+;/gi) || [];
console.log('\nAll --sp color vars:');
console.log([...new Set(colorVars)].filter(c => /bg|ivory|cream|surface|canvas|background/i.test(c)));
