const fs = require('fs');
const c = fs.readFileSync('about-profile.htm', 'utf8');
const idx = c.indexOf('#bf674f');
console.log(c.substring(idx - 100, idx + 150));
