const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
const target = '<link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">';
let matchCount = 0;
const missing = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes(target)) {
    matchCount++;
  } else {
    missing.push(f);
  }
}
console.log('Matches exactly in:', matchCount, 'of', files.length);
if (missing.length > 0) {
  console.log('Missing:', missing);
}
