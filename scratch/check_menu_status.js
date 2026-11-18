const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
console.log('Total HTML files:', files.length);

const results = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const hasDesktopGroup3 = content.includes('id="group-3"');
  const hasDesktopCorp = content.includes('href="corporate-kamasutra.htm"') && content.includes('corporate-kamasutra.webp');
  const hasDrawerCorp = content.includes('href="corporate-kamasutra.htm"') && content.includes('sp-drawer-sublink');
  const hasSearchModal = content.includes('sp-search-results-list');
  const hasSearchModalCorp = hasSearchModal && content.includes('href="corporate-kamasutra.htm"');
  results.push({ file, hasDesktopGroup3, hasDesktopCorp, hasDrawerCorp, hasSearchModal, hasSearchModalCorp });
}

console.log('Files with Desktop Corp:', results.filter(r => r.hasDesktopCorp).map(r => r.file));
console.log('Files missing Desktop Corp:', results.filter(r => r.hasDesktopGroup3 && !r.hasDesktopCorp).map(r => r.file));
console.log('Files missing Drawer Corp:', results.filter(r => !r.hasDrawerCorp).map(r => r.file));
console.log('Files with search modal missing Corp:', results.filter(r => r.hasSearchModal && !r.hasSearchModalCorp).map(r => r.file));
