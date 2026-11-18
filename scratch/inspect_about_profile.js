const fs = require('fs');

const c = fs.readFileSync('about-profile.htm', 'utf8');

// Find all headings, paragraphs, and cards in about-profile.htm
const lines = c.split('\n');
console.log('Total lines in about-profile.htm:', lines.length);

// Print sections
let inHero = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<section') || line.includes('<main') || line.includes('class="sp-subpage-hero"')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
  }
}
