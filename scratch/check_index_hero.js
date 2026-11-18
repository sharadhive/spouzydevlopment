const fs = require('fs');

const c = fs.readFileSync('index.htm', 'utf8');
const idx = c.indexOf('sp-hero-banner-section');
const second = c.indexOf('sp-hero-banner-section', idx + 1);
console.log(c.substring(second - 20, second + 1500));
