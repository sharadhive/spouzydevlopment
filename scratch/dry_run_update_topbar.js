const fs = require('fs');

const replacementBlock = `<div class="sp-topbar-left sp-topbar-message" aria-label="Announcement">
                <div class="sp-topbar-track">
                    <div class="sp-topbar-group">
                        <span class="sp-topbar-sentence">Fully Confidential and all under one roof care by India’s first and only specialist lab of its kind since 2004.</span>
                        <span class="sp-topbar-sep" aria-hidden="true"><svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><polygon points="4,0 8,4 4,8 0,4"/></svg></span>
                    </div>
                    <div class="sp-topbar-group" aria-hidden="true">
                        <span class="sp-topbar-sentence">Fully Confidential and all under one roof care by India’s first and only specialist lab of its kind since 2004.</span>
                        <span class="sp-topbar-sep" aria-hidden="true"><svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><polygon points="4,0 8,4 4,8 0,4"/></svg></span>
                    </div>
                </div>
            </div>`;

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

let successCount = 0;
const matchedFiles = [];
const skippedFiles = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('sp-topbar-modern')) {
    skippedFiles.push(file);
    return;
  }

  // Find start of sp-topbar-left sp-topbar-message
  const leftStart = content.indexOf('class="sp-topbar-left sp-topbar-message"');
  if (leftStart === -1) {
    console.log(`[WARN] ${file}: has sp-topbar-modern but no sp-topbar-left`);
    return;
  }
  const divStart = content.lastIndexOf('<div', leftStart);

  // Find start of sp-topbar-right
  const rightStart = content.indexOf('class="sp-topbar-right"', leftStart);
  if (rightStart === -1) {
    console.log(`[WARN] ${file}: has sp-topbar-left but no sp-topbar-right`);
    return;
  }
  const divRightStart = content.lastIndexOf('<div', rightStart);

  // Slice old block
  const oldBlock = content.slice(divStart, divRightStart).trim();

  // New content
  const newContent = content.slice(0, divStart) + replacementBlock + '\n            ' + content.slice(divRightStart);
  matchedFiles.push(file);
  successCount++;
});

console.log(`Matched files (${matchedFiles.length}):`, matchedFiles.join(', '));
console.log(`Skipped files (${skippedFiles.length}):`, skippedFiles.join(', '));
