const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let updatedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Desktop dropdown item
  if (content.includes('join-counsellor.htm') && !content.includes('href="careers.htm"')) {
    // Add Careers after Counsellor in dropdown
    content = content.replace(
      /(<a class="sp-dropdown-item" href="join-counsellor\.htm"[^>]*>Counsellor<\/a>)(?!\s*<a class="sp-dropdown-item" href="careers\.htm")/g,
      '$1<a class="sp-dropdown-item" href="careers.htm">Careers</a>'
    );

    // Add Careers visual in preview
    content = content.replace(
      /(<figure class="nav-visual"[^>]*><img src="image\/menu\/join-counsellor\.webp"[^>]*><figcaption>Counsellor<\/figcaption><\/figure>)(?!\s*<figure class="nav-visual"><img src="image\/menu\/team\.webp")/g,
      '$1<figure class="nav-visual"><img src="image/menu/team.webp" alt="" loading="lazy"><figcaption>Careers</figcaption></figure>'
    );

    // Add Careers in drawer
    content = content.replace(
      /(<a class="sp-drawer-sublink" href="join-counsellor\.htm"[^>]*>Counsellor<img class="drawer-option-photo" src="image\/menu\/join-counsellor\.webp"[^>]*><\/a>)(?!\s*<a class="sp-drawer-sublink" href="careers\.htm")/g,
      '$1<a class="sp-drawer-sublink" href="careers.htm">Careers<img class="drawer-option-photo" src="image/menu/team.webp" alt="" loading="lazy"></a>'
    );

    // Add Careers in search results list
    content = content.replace(
      /(<li class="sp-search-result-item"><a href="join-counsellor\.htm">Join as a Counsellor <span>↗<\/span><\/a><\/li>)(?!\s*<li class="sp-search-result-item"><a href="careers\.htm")/g,
      '$1\n                <li class="sp-search-result-item"><a href="careers.htm">Careers at SPOUZY <span>↗</span></a></li>\n                <li class="sp-search-result-item"><a href="careers.htm#role-sales-coordinator">Careers: Sales Coordinator <span>↗</span></a></li>\n                <li class="sp-search-result-item"><a href="careers.htm#role-digital-marketing">Careers: Digital Marketing Executive <span>↗</span></a></li>\n                <li class="sp-search-result-item"><a href="careers.htm#role-performance-marketing">Careers: Performance Marketing Specialist <span>↗</span></a></li>'
    );

    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    updatedCount++;
  }
}

console.log(`Updated navigation in ${updatedCount} files.`);
