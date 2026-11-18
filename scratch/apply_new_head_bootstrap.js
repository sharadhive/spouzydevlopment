const fs = require('fs');

const target = `<link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">
    <link rel="preload" href="image/spouzy.png" as="image" type="image/png">
    <script>(function(){try{if((sessionStorage.getItem('sp_transition_pending')==='1'||!sessionStorage.getItem('spouzy_session_active'))&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){document.documentElement.classList.add('sp-loader-pending');}}catch(e){}})();</script>`;

const replacement = `<link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">
    <style>html,body{background-color:#FFFACD!important;}</style>`;

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
let count = 0;

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes(target)) {
    const updated = c.replace(target, replacement);
    fs.writeFileSync(f, updated, 'utf8');
    count++;
  }
}

console.log(`Updated ${count} of ${files.length} HTML files.`);
