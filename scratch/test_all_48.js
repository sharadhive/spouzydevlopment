const fs = require('fs');
const files = fs.readdirSync('.').filter(f => (f.endsWith('.htm') || f.endsWith('.html')) && f !== 'corporate-kamasutra.htm');

const reOpt = /(<a class="sp-dropdown-item"[^>]*href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<\/a>)/;
const reFig = /(<figure class="nav-visual"[^>]*><img[^>]*gen-z-kama-sutra\.webp[^>]*><figcaption>Gen Z Kama Sutra<\/figcaption><\/figure>)/;
const reDrawer = /(<a class="sp-drawer-sublink"[^>]*href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<img class="drawer-option-photo"[^>]*gen-z-kama-sutra\.webp[^>]*><\/a>)/;
const reSearch = /(<li class="sp-search-result-item"><a href=["']gen-z-kama-sutra\.htm["']>Gen Z Kama Sutra <span>↗<\/span><\/a><\/li>)/;

let allPassed = true;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const o = reOpt.test(content);
  const f = reFig.test(content);
  const d = reDrawer.test(content);
  const s = reSearch.test(content);
  if (!o || !f || !d || !s) {
    console.error(`Mismatch in ${file}: opt=${o}, fig=${f}, drawer=${d}, search=${s}`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log(`All ${files.length} files successfully matched all 4 patterns!`);
}
