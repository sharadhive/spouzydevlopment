const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/contrast_audit_raw.json', 'utf8'));

console.log('Total pages with issues:', Object.keys(data).length);

const grouped = {};
for (const [page, issues] of Object.entries(data)) {
  for (const iss of issues) {
    const key = `${iss.tag}.${iss.className}`;
    if (!grouped[key]) grouped[key] = { count: 0, pages: new Set(), samples: [] };
    grouped[key].count++;
    grouped[key].pages.add(page);
    if (grouped[key].samples.length < 3) {
      grouped[key].samples.push({ text: iss.text, color: iss.color, ratio: iss.ratio });
    }
  }
}

for (const [k, v] of Object.entries(grouped)) {
  console.log(`\nSelector: ${k} (${v.count} occurrences across ${v.pages.size} pages):`);
  console.log('  Pages:', Array.from(v.pages).slice(0, 8));
  console.log('  Sample:', v.samples[0]);
}
