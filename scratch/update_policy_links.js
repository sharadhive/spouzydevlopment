const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

let filesChanged = 0;
let replacementsCount = 0;

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;

  // Policy links
  c = c.replace(/style="color:\s*#bf674f;\s*font-weight:\s*([0-9]+);\s*text-decoration:\s*underline;"/gi, (match, weight) => {
    replacementsCount++;
    return `style="color: #8A402F; font-weight: ${weight}; text-decoration: underline;"`;
  });

  // Search icon
  c = c.replace(/style="color:\s*#bf674f;\s*font-size:\s*18px;"/gi, () => {
    replacementsCount++;
    return 'style="color: #8A402F; font-size: 18px;"';
  });

  // Testimonials privacy note on homepages
  c = c.replace(/color:\s*#8a737a;\s*">Shared with client consent/gi, () => {
    replacementsCount++;
    return 'color: #65504B;">Shared with client consent';
  });

  // Badge icons on mission, vision, etc.
  c = c.replace(/style="color:\s*#e08b73;"/gi, () => {
    replacementsCount++;
    return 'style="color: #8A402F;"';
  });
  c = c.replace(/style="color:\s*#ffa502;"/gi, () => {
    replacementsCount++;
    return 'style="color: #8A402F;"';
  });
  c = c.replace(/style="color:\s*#70a1ff;"/gi, () => {
    replacementsCount++;
    return 'style="color: #2655b0;"';
  });
  c = c.replace(/style="color:\s*#2ed573;"/gi, () => {
    replacementsCount++;
    return 'style="color: #1e7e44;"';
  });

  if (c !== original) {
    fs.writeFileSync(f, c, 'utf8');
    filesChanged++;
  }
}

console.log(`Updated ${filesChanged} files with ${replacementsCount} accessible color replacements.`);
