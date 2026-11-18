const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const shareBlocks = {};
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('sp-footer-share')) {
    const idx = content.indexOf('sp-footer-share');
    const start = content.lastIndexOf('<div class="sp-footer-extra"', idx);
    // Find the end of this div
    // Let's match from start to </div>\s*</div> (or end of sp-footer-extra)
    const match = content.substring(start).match(/<div class="sp-footer-extra">[\s\S]*?<\/div>\s*<\/div>/);
    if (match) {
      const block = match[0].trim();
      if (!shareBlocks[block]) {
        shareBlocks[block] = [];
      }
      shareBlocks[block].push(f);
    } else {
      console.log('No regex match for', f);
    }
  }
});

console.log('Distinct share block variations:', Object.keys(shareBlocks).length);
Object.keys(shareBlocks).forEach((block, i) => {
  console.log(`\n=== Variation ${i + 1} (in ${shareBlocks[block].length} files: ${shareBlocks[block].slice(0, 3).join(', ')}...) ===`);
  console.log(block);
});
