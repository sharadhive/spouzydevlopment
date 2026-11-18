const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const teddyMarkup = `
            <!-- Col 5: SPOUZY Companion Animation -->
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
                        width="240"
                        height="135">
                    <button
                        type="button"
                        class="sp-footer-teddy-toggle"
                        aria-label="Pause animation"
                        title="Pause animation">
                        <svg class="sp-teddy-icon-pause" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                            <rect x="5" y="4" width="4" height="16" rx="1"></rect>
                            <rect x="15" y="4" width="4" height="16" rx="1"></rect>
                        </svg>
                        <svg class="sp-teddy-icon-play" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" style="display: none;">
                            <polygon points="6,4 20,12 6,20"></polygon>
                        </svg>
                    </button>
                </div>
            </div>`;

let updatedCount = 0;
let skippedCount = 0;
let errorList = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  if (content.includes('class="sp-footer-teddy"')) {
    skippedCount++;
    return;
  }

  const heading = '<h4 class="sp-footer-col-title">Problem Solver Group</h4>';
  const headingIdx = content.indexOf(heading);
  if (headingIdx === -1) {
    errorList.push(`${file}: Problem Solver Group heading not found`);
    return;
  }

  const ulIdx = content.indexOf('</ul>', headingIdx);
  if (ulIdx === -1) {
    errorList.push(`${file}: </ul> not found after heading`);
    return;
  }

  const divAfterUl = content.indexOf('</div>', ulIdx);
  if (divAfterUl === -1) {
    errorList.push(`${file}: </div> not found after </ul>`);
    return;
  }

  const insertPos = divAfterUl + 6; // Right after </div>
  const newContent = content.slice(0, insertPos) + teddyMarkup + content.slice(insertPos);

  fs.writeFileSync(file, newContent, 'utf8');
  updatedCount++;
});

console.log(`Injection completed.`);
console.log(`Updated: ${updatedCount} files.`);
console.log(`Skipped (already present): ${skippedCount} files.`);
if (errorList.length) {
  console.log('Errors:', errorList);
} else {
  console.log('All files processed with 0 errors.');
}

// Verification phase: check all files
let verifiedCount = 0;
files.forEach(file => {
  const c = fs.readFileSync(file, 'utf8');
  const count = (c.match(/class="sp-footer-teddy"/g) || []).length;
  if (count === 1) {
    verifiedCount++;
  } else {
    console.error(`Verification failed for ${file}: found ${count} occurrences`);
  }
});

console.log(`Verification: ${verifiedCount} / ${files.length} files have exactly 1 teddy component.`);
