const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
console.log(`Auditing all ${files.length} HTML files...`);

const expectedGroup1Order = [
  'pre-marriage.htm',
  'post-marriage.htm',
  'relationships.htm',
  'intimate-health.htm',
  'intimate-aesthetics-treatment.htm',
  'divorce-mediation.htm',
  'harassment-support.htm'
];

const expectedGroup1Visuals = [
  'pre-marriage.webp',
  'post-marriage.webp',
  'relationships.webp',
  'intimate-health.webp',
  'intimate-aesthetics-treatment.webp',
  'divorce-mediation.webp',
  'harassment-support.webp'
];

let g1Issues = [];
let footerIssues = [];
let searchIssues = [];
let totalLinksChecked = 0;
let brokenLinks = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // 1. Group 1 Desktop check
  const g1Match = content.match(/<div id="group-1"[\s\S]*?<\/div>\s*<\/div>\s*<\/li>/);
  if (!g1Match) {
    g1Issues.push({ file, issue: 'Missing group-1' });
  } else {
    const opts = [...g1Match[0].matchAll(/class="sp-dropdown-item"[^>]*href=["']([^"']+)["']/g)].map(m => m[1]);
    if (opts.join(',') !== expectedGroup1Order.join(',')) {
      g1Issues.push({ file, issue: 'Group-1 options order mismatch', opts });
    }

    const visuals = [...g1Match[0].matchAll(/<figure class="nav-visual[^>]*>[\s\S]*?src=["']image\/menu\/([^"']+)["']/g)].map(m => m[1]);
    if (visuals.join(',') !== expectedGroup1Visuals.join(',')) {
      g1Issues.push({ file, issue: 'Group-1 visuals order mismatch', visuals });
    }
  }

  // 2. Group 1 Drawer check
  const drawerMatch = content.match(/<summary class="sp-drawer-link">What We Do<\/summary>[\s\S]*?<\/details>/);
  if (!drawerMatch) {
    g1Issues.push({ file, issue: 'Missing drawer What We Do' });
  } else {
    const drawerLinks = [...drawerMatch[0].matchAll(/class="sp-drawer-sublink"[^>]*href=["']([^"']+)["']/g)].map(m => m[1]);
    if (drawerLinks.join(',') !== expectedGroup1Order.join(',')) {
      g1Issues.push({ file, issue: 'Drawer What We Do order mismatch', drawerLinks });
    }
  }

  // 3. Footer check
  const footerMatch = content.match(/<li><a\s+href=["']([^"']+)["']>Breast &amp; Genital Clinic<\/a><\/li>/);
  if (!footerMatch || footerMatch[1] !== 'intimate-aesthetics-treatment.htm') {
    footerIssues.push({ file, actual: footerMatch ? footerMatch[1] : 'not found' });
  }

  // 4. Search modal check
  if (!content.includes('href="intimate-aesthetics-treatment.htm"')) {
    searchIssues.push(file);
  }

  // 5. Link integrity check
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
      brokenLinks.push({ file, link: target });
    }
  }

  const srcMatches = content.matchAll(/src=["']([^"':#]+)["']/g);
  for (const match of srcMatches) {
    let target = match[1].trim();
    if (target.includes('?')) target = target.split('?')[0];
    if (target.includes('#')) target = target.split('#')[0];
    if (!target || target.startsWith('data:') || target.startsWith('http://') || target.startsWith('https://')) continue;

    totalLinksChecked++;
    const targetPath = path.resolve(target);
    if (!fs.existsSync(targetPath)) {
      brokenLinks.push({ file, link: target });
    }
  }
}

console.log(`\n--- Verification Results ---`);
console.log(`Group-1 Desktop & Drawer Issues: ${g1Issues.length}`);
if (g1Issues.length > 0) console.error(g1Issues);

console.log(`Footer Destination Issues: ${footerIssues.length}`);
if (footerIssues.length > 0) console.error(footerIssues);

console.log(`Search Modal Issues: ${searchIssues.length}`);
if (searchIssues.length > 0) console.error(searchIssues);

console.log(`Total internal links & asset refs checked: ${totalLinksChecked}`);
console.log(`Broken links found: ${brokenLinks.length}`);
if (brokenLinks.length > 0) console.error(brokenLinks);

// Check continuation sequence
console.log('\n--- Continuation Sequence Check ---');
const cRel = fs.readFileSync('relationships.htm', 'utf8');
console.log('relationships.htm -> intimate-health.htm:', cRel.includes('href="intimate-health.htm"') && cRel.includes('Explore Intimate Health Care ↗'));

const cIntHealth = fs.readFileSync('intimate-health.htm', 'utf8');
console.log('intimate-health.htm -> intimate-aesthetics-treatment.htm:', cIntHealth.includes('href="intimate-aesthetics-treatment.htm"') && cIntHealth.includes('Explore Intimate Aesthetics Treatment ↗'));

const cIntTreat = fs.readFileSync('intimate-aesthetics-treatment.htm', 'utf8');
console.log('intimate-aesthetics-treatment.htm -> divorce-mediation.htm:', cIntTreat.includes('href="divorce-mediation.htm"') && cIntTreat.includes('Explore Divorce Mediation ↗'));

const cDivMed = fs.readFileSync('divorce-mediation.htm', 'utf8');
console.log('divorce-mediation.htm -> harassment-support.htm:', cDivMed.includes('href="harassment-support.htm"') && cDivMed.includes('Explore Prevent Sexual Violence ↗'));
