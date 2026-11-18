const fs = require('fs');

const target = `<link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">
    <link rel="preload" href="image/spouzy.png" as="image" type="image/png">
    <script>(function(){try{if((sessionStorage.getItem('sp_transition_pending')==='1'||!sessionStorage.getItem('spouzy_session_active'))&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){document.documentElement.classList.add('sp-loader-pending');}}catch(e){}})();</script>`;

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let match = 0;
const missing = [];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes(target)) {
    match++;
  } else {
    missing.push(f);
  }
}

console.log(`Matched target in ${match} of ${files.length} files`);
if (missing.length) console.log('Missing:', missing);
