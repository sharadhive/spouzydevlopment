const fs = require('fs');

// Read contactus.htm as the gold standard for full sticky header and full footer
const contactHtml = fs.readFileSync('contactus.htm', 'utf8');

// 1. Extract Head template
const headStart = contactHtml.indexOf('<head>');
const headEnd = contactHtml.indexOf('</head>');

// 2. Extract Sticky Header
const stickyStart = contactHtml.indexOf('<div class="sp-header-sticky-wrapper">');
const stickyEnd = contactHtml.indexOf('<!-- 3. SUBPAGE HERO HEADER -->');
const stickyHeaderRaw = contactHtml.substring(stickyStart, stickyEnd).trim();

// 3. Extract Footer + Modals + Drawer + Floating widget + Scripts
const footerStart = contactHtml.indexOf('<!-- 5. MODERN FOOTER -->');
const footerToEnd = contactHtml.substring(footerStart).trim();

console.log('Sticky Header length:', stickyHeaderRaw.length);
console.log('Footer to End length:', footerToEnd.length);
console.log('Sticky Header ends with:\n', stickyHeaderRaw.slice(-100));
