const fs = require('fs');
const path = require('path');

const target = '<link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">';
const replacement = '<link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">\n    <link rel="preload" href="image/spouzy.png" as="image" type="image/png">\n    <script>(function(){try{if((sessionStorage.getItem(\'sp_transition_pending\')===\'1\'||!sessionStorage.getItem(\'spouzy_session_active\'))&&!(window.matchMedia&&window.matchMedia(\'(prefers-reduced-motion: reduce)\').matches)){document.documentElement.classList.add(\'sp-loader-pending\');}}catch(e){}})();</script>';

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
console.log('Processing', files.length, 'HTML files...');

let updated = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('sp-loader-pending')) {
    console.log(file, 'already has bootstrap script, skipping.');
    continue;
  }
  if (!content.includes(target)) {
    console.warn(file, 'does not contain target preload link!');
    continue;
  }
  const newContent = content.replace(target, replacement);
  fs.writeFileSync(file, newContent, 'utf8');
  updated++;
}

console.log('Successfully updated', updated, 'files.');
