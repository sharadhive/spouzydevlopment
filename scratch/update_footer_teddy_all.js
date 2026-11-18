const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const oldBlockRegex = /<!-- Col 5: SPOUZY Companion Animation -->[\s\S]*?<div class="sp-footer-teddy"[\s\S]*?<\/div>\s*<\/div>/;

const newBlock = `<!-- Col 5: SPOUZY Companion Animation -->
            <div class="sp-footer-teddy" aria-label="SPOUZY companion animation">
                <div class="sp-footer-teddy-stage">
                    <video
                        class="sp-footer-teddy-video"
                        src="image/gif/SPOUZY_Teddy_Dance_Transparent.webm"
                        autoplay
                        muted
                        loop
                        playsinline
                        preload="none"
                        aria-hidden="true">
                        <source src="image/gif/SPOUZY_Teddy_Dance_Transparent.webm" type="video/webm">
                    </video>
                    <img
                        class="sp-footer-teddy-static"
                        src="image/gif/spouzy-teddy-dance-static.png"
                        alt="SPOUZY companion animation fallback"
                        loading="lazy"
                        width="400"
                        height="225">
                    <div class="sp-footer-teddy-shadow" aria-hidden="true"></div>
                </div>
            </div>`;

let updatedCount = 0;
let errors = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (oldBlockRegex.test(content)) {
    const updated = content.replace(oldBlockRegex, newBlock);
    fs.writeFileSync(file, updated, 'utf8');
    updatedCount++;
  } else {
    errors.push(file);
  }
});

console.log(`Updated ${updatedCount} / ${files.length} files.`);
if (errors.length) {
  console.log('Errors:', errors);
}

// Verification:
let shadowCount = 0;
let toggleCount = 0;
files.forEach(file => {
  const c = fs.readFileSync(file, 'utf8');
  if (c.includes('class="sp-footer-teddy-shadow"')) shadowCount++;
  if (c.includes('class="sp-footer-teddy-toggle"')) toggleCount++;
});

console.log(`Verification: ${shadowCount} / ${files.length} files have ground shadow.`);
console.log(`Verification: ${toggleCount} / ${files.length} files have toggle button (should be 0).`);
