const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let modifiedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Desktop dropdown: after Counsellor link in nav-options
  // Handles single-line and multi-line formatting with arbitrary whitespace
  const dropdownRegex = /(<a\s+class="sp-dropdown-item"\s+href="join-counsellor\.htm"[^>]*>Counsellor<\/a>)(?!\s*<a\s+class="sp-dropdown-item"\s+href="careers\.htm")/i;
  if (dropdownRegex.test(content)) {
    content = content.replace(dropdownRegex, '$1<a class="sp-dropdown-item" href="careers.htm">Careers</a>');
    changed = true;
  }

  // 2. Desktop preview visual: after Counsellor figure
  const previewRegex = /(<figure\s+class="nav-visual"[^>]*>[\s\S]*?<figcaption>Counsellor<\/figcaption>[\s\S]*?<\/figure>)(?!\s*<figure\s+class="nav-visual"[^>]*>[\s\S]*?<figcaption>Careers<\/figcaption>)/i;
  if (previewRegex.test(content)) {
    content = content.replace(
      previewRegex,
      '$1<figure class="nav-visual"><img src="image/menu/team.webp" alt="" loading="lazy"><figcaption>Careers</figcaption></figure>'
    );
    changed = true;
  }

  // 3. Mobile drawer: after Counsellor sublink
  const drawerRegex = /(<a\s+class="sp-drawer-sublink"\s+href="join-counsellor\.htm"[^>]*>[\s\S]*?Counsellor[\s\S]*?<\/a>)(?!\s*<a\s+class="sp-drawer-sublink"\s+href="careers\.htm")/i;
  if (drawerRegex.test(content)) {
    content = content.replace(
      drawerRegex,
      '$1<a class="sp-drawer-sublink" href="careers.htm">Careers<img class="drawer-option-photo" src="image/menu/team.webp" alt="" loading="lazy"></a>'
    );
    changed = true;
  }

  // 4. Search modal list
  const searchRegex = /(<li\s+class="sp-search-result-item">\s*<a\s+href="join-counsellor\.htm">Join as a Counsellor\s*<span>↗<\/span>\s*<\/a>\s*<\/li>)(?!\s*<li\s+class="sp-search-result-item">\s*<a\s+href="careers\.htm")/i;
  if (searchRegex.test(content)) {
    content = content.replace(
      searchRegex,
      `$1\n                <li class="sp-search-result-item"><a href="careers.htm">Careers at SPOUZY <span>↗</span></a></li>\n                <li class="sp-search-result-item"><a href="careers.htm#role-sales-coordinator">Careers: Sales Coordinator <span>↗</span></a></li>\n                <li class="sp-search-result-item"><a href="careers.htm#role-digital-marketing">Careers: Digital Marketing Executive <span>↗</span></a></li>\n                <li class="sp-search-result-item"><a href="careers.htm#role-performance-marketing">Careers: Performance Marketing Specialist <span>↗</span></a></li>`
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    modifiedCount++;
    console.log(`Updated navigation in ${file}`);
  }
}

console.log(`Total files updated: ${modifiedCount}`);
