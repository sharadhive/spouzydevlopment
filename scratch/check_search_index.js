const fs = require('fs');
const js = fs.readFileSync('js/spouzy-modern.js', 'utf8');

const start = js.indexOf('const SPOUZY_SEARCH_INDEX');
const end = js.indexOf('];', start);
const indexStr = js.substring(start, end + 2);

const entries = [];
const regex = /{\s*title:\s*['"]([^'"]+)['"],\s*url:\s*['"]([^'"]+)['"]/g;
let m;
while ((m = regex.exec(indexStr)) !== null) {
  entries.push({ title: m[1], url: m[2] });
}
console.log('Search Index Entries (Total: ' + entries.length + '):');
entries.forEach((e, idx) => {
  if (/intimate|health|clinic|breast|genital/i.test(e.title) || /intimate|health|clinic/i.test(e.url)) {
    console.log(`  [${idx}] ${e.title} -> ${e.url}`);
  }
});
