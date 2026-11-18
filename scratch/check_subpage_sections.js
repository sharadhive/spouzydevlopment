const fs = require('fs');

const testFiles = ['about-us.htm', 'faq.htm', 'intimate-health.htm', 'corporate-kamasutra.htm', 'services.htm', 'treatment.htm'];

for (const f of testFiles) {
  const c = fs.readFileSync(f, 'utf8');
  const sectionTags = [...c.matchAll(/<section[^>]*class=["']([^"']*)["'][^>]*>/gi)].map(m => m[1]);
  const mainTag = [...c.matchAll(/<main[^>]*class=["']([^"']*)["'][^>]*>/gi)].map(m => m[1]);
  console.log(`=== ${f} ===`);
  console.log('main classes:', mainTag);
  console.log('section classes:', sectionTags);
}
