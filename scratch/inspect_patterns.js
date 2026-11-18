const fs = require('fs');
const content = fs.readFileSync('index.htm', 'utf8');

// group-3
const g3Match = content.match(/<div id="group-3"[\s\S]*?<\/div>\s*<\/li>/);
if (g3Match) {
  console.log('=== GROUP-3 ===\n', g3Match[0]);
}

// Drawer No Cost Resources
const drawerMatch = content.match(/<summary class="sp-drawer-link">No Cost Resources<\/summary>[\s\S]*?<\/details>/);
if (drawerMatch) {
  console.log('=== DRAWER ===\n', drawerMatch[0]);
}

// Search Modal
const searchMatch = content.match(/<ul class="sp-search-results-list">[\s\S]*?<\/ul>/);
if (searchMatch) {
  console.log('=== SEARCH MODAL (snippet) ===\n', searchMatch[0].substring(0, 500));
  const gzItem = searchMatch[0].match(/<li class="sp-search-result-item"><a href="gen-z-kama-sutra\.htm">[\s\S]*?<\/li>/);
  console.log('=== SEARCH MODAL GEN Z ITEM ===\n', gzItem ? gzItem[0] : 'not found');
}
