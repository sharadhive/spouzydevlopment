const fs = require('fs');

for (const file of ['css/style.css', 'css/responsive.css']) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = [...content.matchAll(/(html|body|\.sp-modern-wrapper|section|\.content|\.main-content)\s*\{[^}]*background(?:-color)?:\s*([^;\}]+)[^}]*\}/gi)];
  console.log(`Results for ${file}:`, matches.length);
  for (const m of matches) {
    console.log(m[0].substring(0, 120));
  }
}
