const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const reOpt = /(<a\s+class="sp-dropdown-item"[^>]*href=["']intimate-health\.htm["'][^>]*>[\s\S]*?<\/a>)/;
const reFig = /(<figure\s+class="nav-visual"[^>]*>[\s\S]*?src=["']image\/menu\/intimate-health\.webp["'][\s\S]*?<figcaption>Intimate Health Care<\/figcaption>[\s\S]*?<\/figure>)/;
const reDrawer = /(<a\s+class="sp-drawer-sublink"[^>]*href=["']intimate-health\.htm["'][^>]*>[\s\S]*?<\/a>)/;
const reFooter = /(<li><a\s+href=["']intimate-health\.htm["']>Breast &amp; Genital Clinic<\/a><\/li>)/;
const reSearch = /(<li\s+class="sp-search-result-item"><a\s+href=["']intimate-health\.htm["']>Intimate Health Care <span>↗<\/span><\/a><\/li>)/;

let failed = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const o = reOpt.test(content);
  const f = reFig.test(content);
  const d = reDrawer.test(content);
  const ft = reFooter.test(content);
  const s = reSearch.test(content);

  if (!o || !f || !d || !ft || !s) {
    failed.push({ file, o, f, d, ft, s });
  }
}

console.log(`Checked ${files.length} files. Failed count: ${failed.length}`);
if (failed.length > 0) {
  console.log('Failures:', failed);
} else {
  console.log('PERFECT! All 49 files matched all 5 patterns with flexible whitespace!');
}
