const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
console.log(`Found ${files.length} HTML files.`);

let totalLinksChecked = 0;
let brokenLinks = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Check hrefs
  const hrefMatches = content.matchAll(/href=["']([^"':#]+)(?:#[^"']*)?["']/g);
  for (const match of hrefMatches) {
    let target = match[1].trim();
    if (target.includes('?')) target = target.split('?')[0];
    if (target.includes('#')) target = target.split('#')[0];
    if (!target || target.startsWith('tel:') || target.startsWith('mailto:') || target.startsWith('javascript:')) continue;
    if (target.startsWith('http://') || target.startsWith('https://')) continue;

    totalLinksChecked++;
    const targetPath = path.resolve(target);
    if (!fs.existsSync(targetPath)) {
      brokenLinks.push({ file, link: target, type: 'href' });
    }
  }

  // Check srcs
  const srcMatches = content.matchAll(/src=["']([^"':#]+)["']/g);
  for (const match of srcMatches) {
    const target = match[1].trim();
    if (!target || target.startsWith('data:') || target.startsWith('http://') || target.startsWith('https://')) continue;

    totalLinksChecked++;
    const targetPath = path.resolve(target);
    if (!fs.existsSync(targetPath)) {
      brokenLinks.push({ file, link: target, type: 'src' });
    }
  }
}

console.log(`Checked ${totalLinksChecked} internal link/asset references.`);
if (brokenLinks.length > 0) {
  console.error(`Found ${brokenLinks.length} broken links:`, brokenLinks);
} else {
  console.log('SUCCESS: 0 broken links found across all files!');
}

// Check Group 3 in all files
const expectedGroup3Order = [
  'students.htm',
  'military-families.htm',
  'faq.htm',
  'blog.htm',
  'gen-z-kama-sutra.htm',
  'corporate-kamasutra.htm'
];

let group3Issues = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const g3 = content.match(/<div id="group-3"[\s\S]*?<\/div>\s*<\/div>\s*<\/li>/);
  if (!g3) {
    group3Issues.push({ file, issue: 'Missing group-3' });
    continue;
  }
  const links = [...g3[0].matchAll(/class="sp-dropdown-item"[^>]*href=["']([^"']+)["']/g)].map(m => m[1]);
  if (links.join(',') !== expectedGroup3Order.join(',')) {
    group3Issues.push({ file, issue: 'Desktop options mismatch', links });
  }

  const visuals = [...g3[0].matchAll(/<figure class="nav-visual[^>]*><img[^>]*src=["']image\/menu\/([^"']+)["']/g)].map(m => m[1]);
  const expectedVisuals = [
    'students.webp',
    'military-families.webp',
    'faq.webp',
    'blog.webp',
    'gen-z-kama-sutra.webp',
    'corporate-kamasutra.webp'
  ];
  if (visuals.join(',') !== expectedVisuals.join(',')) {
    group3Issues.push({ file, issue: 'Visuals mismatch', visuals });
  }

  // Check drawer
  const drawer = content.match(/<summary class="sp-drawer-link">No Cost Resources<\/summary>[\s\S]*?<\/details>/);
  if (!drawer) {
    group3Issues.push({ file, issue: 'Missing drawer No Cost Resources' });
    continue;
  }
  const drawerLinks = [...drawer[0].matchAll(/class="sp-drawer-sublink"[^>]*href=["']([^"']+)["']/g)].map(m => m[1]);
  if (drawerLinks.join(',') !== expectedGroup3Order.join(',')) {
    group3Issues.push({ file, issue: 'Drawer links mismatch', drawerLinks });
  }
}

if (group3Issues.length > 0) {
  console.error(`Found ${group3Issues.length} group-3 issues:`, group3Issues);
} else {
  console.log(`SUCCESS: All ${files.length} files have perfectly matched No Cost Resources in desktop dropdown and mobile drawer!`);
}

// Check search index in spouzy-modern.js
const modernJs = fs.readFileSync('js/spouzy-modern.js', 'utf8');
console.log('Search index contains corporate-kamasutra.htm:', modernJs.includes("url: 'corporate-kamasutra.htm'"));
console.log('Search index contains gen-z-kama-sutra.htm:', modernJs.includes("url: 'gen-z-kama-sutra.htm'"));

// Check continuation sequence
const continuationTests = [
  { file: 'blog.htm', target: 'gen-z-kama-sutra.htm', label: 'Explore Gen Z Kama Sutra ↗' },
  { file: 'gen-z-kama-sutra.htm', target: 'corporate-kamasutra.htm', label: 'Explore Corporate Kamasutra ↗' },
  { file: 'corporate-kamasutra.htm', isTerminal: true }
];

for (const ct of continuationTests) {
  const c = fs.readFileSync(ct.file, 'utf8');
  if (ct.isTerminal) {
    const hasGuideActions = c.includes('guide-actions');
    console.log(`${ct.file} terminal check:`, !hasGuideActions ? 'PASS (no guide-actions)' : 'FAIL (has guide-actions)');
  } else {
    const hasTarget = c.includes(`href="${ct.target}"`) && c.includes(ct.label);
    console.log(`${ct.file} continuation check -> ${ct.target}:`, hasTarget ? 'PASS' : 'FAIL');
  }
}
