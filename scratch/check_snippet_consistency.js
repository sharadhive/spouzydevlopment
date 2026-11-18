const fs = require('fs');
const files = fs.readdirSync('.').filter(f => (f.endsWith('.htm') || f.endsWith('.html')) && f !== 'corporate-kamasutra.htm');

const results = {
  optMatch: [],
  optNoMatch: [],
  figMatch: [],
  figNoMatch: [],
  drawerMatch: [],
  drawerNoMatch: [],
  searchMatch: [],
  searchNoMatch: []
};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  // Desktop option: contains href="gen-z-kama-sutra.htm">Gen Z Kama Sutra</a>
  if (/href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<\/a>/.test(content)) {
    results.optMatch.push(file);
  } else {
    results.optNoMatch.push(file);
  }

  // Desktop figure: contains gen-z-kama-sutra.webp
  if (/gen-z-kama-sutra\.webp["'][^>]*alt=["']Gen Z Kama Sutra["'][^>]*><figcaption>Gen Z Kama Sutra<\/figcaption><\/figure>/.test(content)) {
    results.figMatch.push(file);
  } else {
    results.figNoMatch.push(file);
  }

  // Drawer: contains sp-drawer-sublink ... gen-z-kama-sutra.htm
  if (/href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<img class=["']drawer-option-photo["'][^>]*gen-z-kama-sutra\.webp/.test(content)) {
    results.drawerMatch.push(file);
  } else {
    results.drawerNoMatch.push(file);
  }

  // Search list: contains href="gen-z-kama-sutra.htm">Gen Z Kama Sutra <span>↗</span></a>
  if (/href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra <span>↗<\/span><\/a>/.test(content)) {
    results.searchMatch.push(file);
  } else {
    results.searchNoMatch.push(file);
  }
}

console.log('Total files checked:', files.length);
console.log('Desktop opt matched:', results.optMatch.length, 'no match:', results.optNoMatch);
console.log('Desktop fig matched:', results.figMatch.length, 'no match:', results.figNoMatch);
console.log('Drawer matched:', results.drawerMatch.length, 'no match:', results.drawerNoMatch);
console.log('Search matched:', results.searchMatch.length, 'no match:', results.searchNoMatch);
