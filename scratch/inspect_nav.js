const fs = require('fs');
const content = fs.readFileSync('join-doctor.htm', 'utf8');

// 1. Desktop Nav
const navMatch = content.match(/<li class="sp-menu-item guide-menu"><button[^>]*>Join Our Team[\s\S]*?<\/li>/);
console.log('--- Desktop Nav ---');
console.log(navMatch ? navMatch[0] : 'Not found');

// 2. Mobile Drawer
const drawerMatch = content.match(/<details><summary class="sp-drawer-link">Join Our Team[\s\S]*?<\/details>/);
console.log('--- Mobile Drawer ---');
console.log(drawerMatch ? drawerMatch[0] : 'Not found');

// 3. Search Results
const searchMatch = content.match(/<ul class="sp-search-results-list">[\s\S]*?<\/ul>/);
console.log('--- Search Results Snippet ---');
if (searchMatch) {
  const lines = searchMatch[0].split('\n').filter(l => l.includes('join-') || l.includes('Doctor'));
  console.log(lines.join('\n'));
}
