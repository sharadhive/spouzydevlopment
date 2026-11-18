const fs = require('fs');

const h = fs.readFileSync('index.htm', 'utf8');
const regex = /<li class="sp-menu-item guide-menu">[\s\S]*?Join Our Team[\s\S]*?<\/li>/;
const match = h.match(regex);
console.log(match ? match[0] : 'not found');
