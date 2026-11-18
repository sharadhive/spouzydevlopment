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

const content = fs.readFileSync('index.htm', 'utf8');
const leftStart = content.indexOf('class="sp-topbar-left sp-topbar-message"');
const divStart = content.lastIndexOf('<div', leftStart);
const rightStart = content.indexOf('class="sp-topbar-right"', leftStart);
const divRightStart = content.lastIndexOf('<div', rightStart);
const newContent = content.slice(0, divStart) + replacementBlock + '\n            ' + content.slice(divRightStart);

const checkStart = newContent.indexOf('sp-topbar-modern');
console.log(newContent.slice(checkStart - 12, checkStart + 1600));
