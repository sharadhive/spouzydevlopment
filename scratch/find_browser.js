const fs = require('fs');

const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\sharad yadav\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    console.log('BROWSER_FOUND:', p);
    process.exit(0);
  }
}

console.log('NO_BROWSER_FOUND');
