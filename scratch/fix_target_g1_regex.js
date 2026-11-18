const fs = require('fs');

let content = fs.readFileSync('intimate-aesthetics-treatment.htm', 'utf8');

const reOpt = /(<a\s+class="sp-dropdown-item"[^>]*href=["']intimate-health\.htm["'][^>]*>[\s\S]*?<\/a>)/;
const reFig = /(<figure\s+class="nav-visual"[^>]*>[\s\S]*?src=["']image\/menu\/intimate-health\.webp["'][\s\S]*?<figcaption>Intimate Health Care<\/figcaption>[\s\S]*?<\/figure>)/;
const reDrawer = /(<a\s+class="sp-drawer-sublink"[^>]*href=["']intimate-health\.htm["'][^>]*>[\s\S]*?<\/a>)/;

// 1. Desktop option
content = content.replace(reOpt, '$1<a class="sp-dropdown-item" href="intimate-aesthetics-treatment.htm" aria-current="page">Intimate Aesthetics Treatment</a>');

// 2. Desktop preview visual
content = content.replace(reFig, '$1<figure class="nav-visual"><img src="image/menu/intimate-aesthetics-treatment.webp" alt="Intimate Aesthetics Treatment" loading="lazy"><figcaption>Intimate Aesthetics Treatment</figcaption></figure>');

// 3. Mobile drawer
content = content.replace(reDrawer, '$1<a class="sp-drawer-sublink" href="intimate-aesthetics-treatment.htm">Intimate Aesthetics Treatment<img class="drawer-option-photo" src="image/menu/intimate-aesthetics-treatment.webp" alt="Intimate Aesthetics Treatment" loading="lazy"></a>');

fs.writeFileSync('intimate-aesthetics-treatment.htm', content, 'utf8');
console.log('Successfully updated intimate-aesthetics-treatment.htm group-1!');
