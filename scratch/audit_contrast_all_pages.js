const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const subpageHeros = [];
const textShimmer = [];
const breadcrumbs = [];
const storyContainers = [];
const heroPillBadges = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('sp-subpage-hero')) subpageHeros.push(f);
  if (c.includes('sp-text-shimmer') || c.includes('sp-text-gold-shimmer')) textShimmer.push(f);
  if (c.includes('sp-breadcrumbs')) breadcrumbs.push(f);
  if (c.includes('sp-story-container')) storyContainers.push(f);
  if (c.includes('sp-hero-pill-badge')) heroPillBadges.push(f);
}

console.log('Files with sp-subpage-hero:', subpageHeros);
console.log('Files with sp-text-shimmer:', textShimmer);
console.log('Files with sp-breadcrumbs:', breadcrumbs);
console.log('Files with sp-story-container:', storyContainers);
console.log('Files with sp-hero-pill-badge:', heroPillBadges);
