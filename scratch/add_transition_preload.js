const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let updated = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('href="image/spouzy-transition.webp"')) {
    return;
  }
  const target = '<link rel="stylesheet" href="css/spouzy-modern.css">';
  if (content.includes(target)) {
    const replacement = '<link rel="preload" href="image/spouzy-transition.webp" as="image" type="image/webp">\n    <link rel="stylesheet" href="css/spouzy-modern.css">';
    const newContent = content.replace(target, replacement);
    fs.writeFileSync(file, newContent, 'utf8');
    updated++;
  } else {
    console.log('Target not found in:', file);
  }
});

console.log(`Updated preload in ${updated} files.`);
