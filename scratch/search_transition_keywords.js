const fs = require('fs');
const path = require('path');

const keywords = ['page-curtain', 'veil', 'unveil', 'sp-arrival', 'curtain', 'transition', 'loader'];

function searchInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const found = {};
  for (const kw of keywords) {
    const re = new RegExp(kw, 'gi');
    const matches = content.match(re);
    if (matches) {
      found[kw] = matches.length;
    }
  }
  return found;
}

console.log('=== SEARCHING IN JS FILES ===');
for (const file of fs.readdirSync('js')) {
  if (file.endsWith('.js')) {
    const res = searchInFile(path.join('js', file));
    if (Object.keys(res).length > 0) {
      console.log(`js/${file}:`, JSON.stringify(res));
    }
  }
}

console.log('\n=== SEARCHING IN CSS FILES ===');
for (const file of fs.readdirSync('css')) {
  if (file.endsWith('.css')) {
    const res = searchInFile(path.join('css', file));
    if (Object.keys(res).length > 0) {
      console.log(`css/${file}:`, JSON.stringify(res));
    }
  }
}

console.log('\n=== SEARCHING IN HTML FILES (first 5 as sample) ===');
const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
for (const file of htmlFiles.slice(0, 5)) {
  const res = searchInFile(file);
  if (Object.keys(res).length > 0) {
    console.log(`${file}:`, JSON.stringify(res));
  }
}
