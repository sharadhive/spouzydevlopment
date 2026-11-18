const fs = require('fs');

// 1. css/spouzy-modern.css
let css = fs.readFileSync('css/spouzy-modern.css', 'utf8');
css = css.replace(/--sp-copper:\s*#bf674f;/g, '--sp-copper: #8A402F;');
fs.writeFileSync('css/spouzy-modern.css', css, 'utf8');
console.log('Updated spouzy-modern.css --sp-copper to #8A402F');

// 2. contactus.htm
let contact = fs.readFileSync('contactus.htm', 'utf8');
contact = contact.replace(/color:\s*#25D366;\s*font-weight:\s*700;\s*text-decoration:\s*none;/g, 'color: #075e54; font-weight: 700; text-decoration: underline;');
contact = contact.replace(/style="display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 700; color: var\(--sp-copper\);"/g, 'style="display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 700; color: var(--sp-copper); text-decoration: underline;"');
fs.writeFileSync('contactus.htm', contact, 'utf8');
console.log('Updated contactus.htm');

// 3. create-account.htm
let createAcc = fs.readFileSync('create-account.htm', 'utf8');
createAcc = createAcc.replace('text-decoration: none;">Portal Access Notice', 'text-decoration: underline;">Portal Access Notice');
fs.writeFileSync('create-account.htm', createAcc, 'utf8');
console.log('Updated create-account.htm');

// 4. register.htm
let reg = fs.readFileSync('register.htm', 'utf8');
reg = reg.replace('text-decoration: none;">View Account Registration Notice', 'text-decoration: underline;">View Account Registration Notice');
fs.writeFileSync('register.htm', reg, 'utf8');
console.log('Updated register.htm');
