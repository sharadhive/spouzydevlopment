const fs = require('fs');

const files = fs.readdirSync('.').filter(f => (f.endsWith('.htm') || f.endsWith('.html')) && f !== 'corporate-kamasutra.htm');

const reOpt = /(<a class="sp-dropdown-item"[^>]*href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<\/a>)/;
const reFig = /(<figure class="nav-visual"[^>]*><img[^>]*gen-z-kama-sutra\.webp[^>]*><figcaption>Gen Z Kama Sutra<\/figcaption><\/figure>)/;
const reDrawer = /(<a class="sp-drawer-sublink"[^>]*href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<img class="drawer-option-photo"[^>]*gen-z-kama-sutra\.webp[^>]*><\/a>)/;
const reSearch = /(<li class="sp-search-result-item"><a href=["']gen-z-kama-sutra\.htm["']>Gen Z Kama Sutra <span>↗<\/span><\/a><\/li>)/;

let updatedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Verify all 4 exist
  if (!reOpt.test(content) || !reFig.test(content) || !reDrawer.test(content) || !reSearch.test(content)) {
    console.error(`ERROR: Skipping ${file} due to missing pattern match!`);
    continue;
  }

  // 1. Desktop option
  content = content.replace(reOpt, '$1<a class="sp-dropdown-item" href="corporate-kamasutra.htm">Corporate Kamasutra</a>');

  // 2. Desktop preview visual
  content = content.replace(reFig, '$1<figure class="nav-visual"><img src="image/menu/corporate-kamasutra.webp" alt="Corporate Kamasutra" loading="lazy"><figcaption>Corporate Kamasutra</figcaption></figure>');

  // 3. Mobile drawer
  content = content.replace(reDrawer, '$1<a class="sp-drawer-sublink" href="corporate-kamasutra.htm">Corporate Kamasutra<img class="drawer-option-photo" src="image/menu/corporate-kamasutra.webp" alt="Corporate Kamasutra" loading="lazy"></a>');

  // 4. Static search modal
  content = content.replace(reSearch, '$1\n                <li class="sp-search-result-item"><a href="corporate-kamasutra.htm">Corporate Kamasutra <span>↗</span></a></li>');

  fs.writeFileSync(file, content, 'utf8');
  updatedCount++;
}

console.log(`Successfully updated ${updatedCount} / ${files.length} HTML files.`);
