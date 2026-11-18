const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
console.log(`Checking ${files.length} HTML files for old transition preload...`);

let replacedCount = 0;
const oldPreload = '<link rel="preload" href="image/spouzy-transition.webp" as="image" type="image/webp">';
const newPreload = '<link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">';

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(oldPreload)) {
    const updated = content.replace(oldPreload, newPreload);
    fs.writeFileSync(file, updated, 'utf8');
    replacedCount++;
  }
});

console.log(`Updated preload in ${replacedCount} / ${files.length} files.`);

// Verification
let verified = 0;
files.forEach(file => {
  const c = fs.readFileSync(file, 'utf8');
  if (c.includes(newPreload) && !c.includes(oldPreload)) {
    verified++;
  }
});
console.log(`Verified ${verified} / ${files.length} files now have the new video preload.`);
