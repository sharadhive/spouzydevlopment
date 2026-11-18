const fs = require('fs');

const files = fs.readdirSync('.').filter(f => (f.endsWith('.htm') || f.endsWith('.html')) && f !== 'intimate-aesthetics-treatment.htm');

const reOpt = /(<a\s+class="sp-dropdown-item"[^>]*href=["']intimate-health\.htm["'][^>]*>[\s\S]*?<\/a>)/;
const reFig = /(<figure\s+class="nav-visual"[^>]*>[\s\S]*?src=["']image\/menu\/intimate-health\.webp["'][\s\S]*?<figcaption>Intimate Health Care<\/figcaption>[\s\S]*?<\/figure>)/;
const reDrawer = /(<a\s+class="sp-drawer-sublink"[^>]*href=["']intimate-health\.htm["'][^>]*>[\s\S]*?<\/a>)/;
const reFooter = /(<li><a\s+href=["']intimate-health\.htm["']>Breast &amp; Genital Clinic<\/a><\/li>)/;
const reSearch = /(<li\s+class="sp-search-result-item"><a\s+href=["']intimate-health\.htm["']>Intimate Health Care <span>↗<\/span><\/a><\/li>)/;

let updated = 0;
let errors = [];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Check if all 5 patterns match
  if (!reOpt.test(content) || !reFig.test(content) || !reDrawer.test(content) || !reFooter.test(content) || !reSearch.test(content)) {
    errors.push({ file, opt: reOpt.test(content), fig: reFig.test(content), drawer: reDrawer.test(content), footer: reFooter.test(content), search: reSearch.test(content) });
    continue;
  }

  // 1. Desktop option
  content = content.replace(reOpt, '$1<a class="sp-dropdown-item" href="intimate-aesthetics-treatment.htm">Intimate Aesthetics Treatment</a>');

  // 2. Desktop preview visual
  content = content.replace(reFig, '$1<figure class="nav-visual"><img src="image/menu/intimate-aesthetics-treatment.webp" alt="Intimate Aesthetics Treatment" loading="lazy"><figcaption>Intimate Aesthetics Treatment</figcaption></figure>');

  // 3. Mobile drawer
  content = content.replace(reDrawer, '$1<a class="sp-drawer-sublink" href="intimate-aesthetics-treatment.htm">Intimate Aesthetics Treatment<img class="drawer-option-photo" src="image/menu/intimate-aesthetics-treatment.webp" alt="Intimate Aesthetics Treatment" loading="lazy"></a>');

  // 4. Footer link
  content = content.replace(reFooter, '<li><a href="intimate-aesthetics-treatment.htm">Breast &amp; Genital Clinic</a></li>');

  // 5. Search modal item
  content = content.replace(reSearch, '$1\n                <li class="sp-search-result-item"><a href="intimate-aesthetics-treatment.htm">Intimate Aesthetics Treatment <span>↗</span></a></li>');

  fs.writeFileSync(file, content, 'utf8');
  updated++;
}

console.log(`Successfully updated ${updated} / ${files.length} HTML files.`);
if (errors.length > 0) {
  console.error('Errors in files:', errors);
}
