const fs = require('fs');
const content = fs.readFileSync('index.htm', 'utf8');

const s4Match = content.match(/<!-- Service 4[\s\S]*?<\/article>/);
if (s4Match) {
  console.log('=== Service 4 in index.htm ===\n', s4Match[0]);
}

const bannerMatch = content.match(/Breast &amp; Genital Specialized Clinic/);
if (bannerMatch) {
  const idx = content.indexOf('Breast &amp; Genital Specialized Clinic');
  console.log('=== Banner snippet in index.htm ===\n', content.substring(idx - 150, idx + 150));
}
