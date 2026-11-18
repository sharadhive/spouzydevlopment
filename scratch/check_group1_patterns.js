const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const reOpt = /(<a class="sp-dropdown-item"[^>]*href=["']intimate-health\.htm["'][^>]*>Intimate Health Care<\/a>)/;
const reFig = /(<figure class="nav-visual"[^>]*><img[^>]*intimate-health\.webp[^>]*><figcaption>Intimate Health Care<\/figcaption><\/figure>)/;
const reDrawer = /(<a class="sp-drawer-sublink"[^>]*href=["']intimate-health\.htm["'][^>]*>Intimate Health Care<img class="drawer-option-photo"[^>]*intimate-health\.webp[^>]*><\/a>)/;
const reFooter = /(<li><a href=["']intimate-health\.htm["']>Breast &amp; Genital Clinic<\/a><\/li>)/;
const reSearch = /(<li class="sp-search-result-item"><a href=["']intimate-health\.htm["']>Intimate Health Care <span>↗<\/span><\/a><\/li>)/;

let optCount = 0, figCount = 0, drawerCount = 0, footerCount = 0, searchCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (reOpt.test(content)) optCount++;
  else console.log(`Missing Opt in ${file}`);

  if (reFig.test(content)) figCount++;
  else console.log(`Missing Fig in ${file}`);

  if (reDrawer.test(content)) drawerCount++;
  else console.log(`Missing Drawer in ${file}`);

  if (reFooter.test(content)) footerCount++;
  else console.log(`Missing Footer in ${file}`);

  if (reSearch.test(content)) searchCount++;
  else console.log(`Missing Search in ${file}`);
}

console.log(`\nChecked ${files.length} files:`);
console.log(`Opt matches: ${optCount}/${files.length}`);
console.log(`Fig matches: ${figCount}/${files.length}`);
console.log(`Drawer matches: ${drawerCount}/${files.length}`);
console.log(`Footer matches: ${footerCount}/${files.length}`);
console.log(`Search matches: ${searchCount}/${files.length}`);
