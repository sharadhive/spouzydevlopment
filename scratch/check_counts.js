const fs = require('fs');
const files = fs.readdirSync('.').filter(f => (f.endsWith('.htm') || f.endsWith('.html')) && f !== 'corporate-kamasutra.htm');

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  const optMatches = content.match(/href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<\/a>/g) || [];
  const figMatches = content.match(/gen-z-kama-sutra\.webp["'][^>]*alt=["']Gen Z Kama Sutra["'][^>]*><figcaption>Gen Z Kama Sutra<\/figcaption><\/figure>/g) || [];
  const drawerMatches = content.match(/href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra<img class=["']drawer-option-photo["'][^>]*gen-z-kama-sutra\.webp/g) || [];
  const searchMatches = content.match(/href=["']gen-z-kama-sutra\.htm["'][^>]*>Gen Z Kama Sutra <span>↗<\/span><\/a>/g) || [];

  if (optMatches.length !== 1 || figMatches.length !== 1 || drawerMatches.length !== 1 || searchMatches.length !== 1) {
    console.log(`Mismatch counts in ${file}: opt=${optMatches.length}, fig=${figMatches.length}, drawer=${drawerMatches.length}, search=${searchMatches.length}`);
  }
}
console.log('Finished checking count regularity.');
