const fs = require('fs');

const indexContent = fs.readFileSync('index.htm', 'utf8');
let targetContent = fs.readFileSync('intimate-aesthetics-treatment.htm', 'utf8');

// Get group-1 desktop from index.htm
const g1Desktop = indexContent.match(/<li class="sp-menu-item guide-menu"><button type="button" class="sp-nav-link" aria-expanded="false" aria-controls="group-1">[\s\S]*?<\/div>\s*<\/li>/)[0];
// Mark intimate-aesthetics-treatment as aria-current="page" in target
const g1DesktopForTarget = g1Desktop.replace('href="intimate-aesthetics-treatment.htm"', 'href="intimate-aesthetics-treatment.htm" aria-current="page"');

// Replace in target
const targetG1Match = targetContent.match(/<li class="sp-menu-item guide-menu"><button type="button" class="sp-nav-link" aria-expanded="false" aria-controls="group-1">[\s\S]*?<\/div>\s*<\/li>/)[0];
targetContent = targetContent.replace(targetG1Match, g1DesktopForTarget);

// Get group-1 drawer from index.htm
const g1Drawer = indexContent.match(/<details><summary class="sp-drawer-link">What We Do<\/summary>[\s\S]*?<\/details>/)[0];
const targetDrawerMatch = targetContent.match(/<details><summary class="sp-drawer-link">What We Do<\/summary>[\s\S]*?<\/details>/)[0];
targetContent = targetContent.replace(targetDrawerMatch, g1Drawer);

fs.writeFileSync('intimate-aesthetics-treatment.htm', targetContent, 'utf8');
console.log('Updated intimate-aesthetics-treatment.htm group-1 desktop & drawer!');
