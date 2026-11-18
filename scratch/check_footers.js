const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
console.log('Total files:', files.length);

const patterns = {};
const variations = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const hasShare = content.includes('Share SPOUZY');
  const hasSpFooterShare = content.includes('sp-footer-share');
  const hasExtras = content.includes('sp-footer-extras');
  const key = 'share:' + hasShare + '_footerShare:' + hasSpFooterShare + '_extras:' + hasExtras;
  patterns[key] = (patterns[key] || 0) + 1;

  if (hasSpFooterShare) {
    // Extract the sp-footer-extra containing sp-footer-share
    const match = content.match(/<div class="sp-footer-extra"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g);
    // Let's get the exact snippet around sp-footer-share
    const shareIndex = content.indexOf('sp-footer-share');
    const snippetStart = content.lastIndexOf('<div class="sp-footer-extra"', shareIndex);
    const snippetEnd = content.indexOf('</div>\n        </div>', shareIndex);
    if (snippetStart !== -1 && snippetEnd !== -1) {
      const snippet = content.substring(snippetStart, snippetEnd + 6);
      if (!variations.some(v => v.snippet === snippet)) {
        variations.push({ file: f, snippet: snippet });
      }
    }
  } else {
    console.log('File without sp-footer-share:', f);
  }
});

console.log('Patterns:', JSON.stringify(patterns, null, 2));
console.log('Unique snippets count:', variations.length);
variations.forEach((v, i) => {
  console.log(`\n--- Snippet ${i + 1} (${v.file}) ---`);
  console.log(v.snippet);
});
