const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
const missingDesktop = [];
const missingDrawer = [];
const missingSearch = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (!content.includes('class="sp-dropdown-item" href="careers.htm"')) {
    missingDesktop.push(f);
  }
  if (!content.includes('class="sp-drawer-sublink" href="careers.htm"')) {
    missingDrawer.push(f);
  }
  if (!content.includes('href="careers.htm"')) {
    missingSearch.push(f);
  }
}

console.log('Total files checked:', files.length);
console.log('Missing Desktop Dropdown:', missingDesktop);
console.log('Missing Drawer:', missingDrawer);
console.log('Missing Any Careers:', missingSearch);
