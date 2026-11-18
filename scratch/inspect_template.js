const fs = require('fs');

const contactHtml = fs.readFileSync('contactus.htm', 'utf8');

const headerStart = contactHtml.indexOf('<div class="sp-header-sticky-wrapper">');
const headerEnd = contactHtml.indexOf('<!-- 3. SUBPAGE HERO HEADER -->');
console.log('Header indices:', headerStart, headerEnd);

const headerBlock = contactHtml.substring(headerStart, headerEnd).trim();
console.log('Header length:', headerBlock.length);
console.log('Header ends with:\n', headerBlock.slice(-150));

const footerStart = contactHtml.indexOf('<!-- 5. MODERN FOOTER -->');
const footerEnd = contactHtml.indexOf('<!-- 6. INTERACTIVE SPOTLIGHT SEARCH MODAL -->');
console.log('Footer indices:', footerStart, footerEnd);
const footerBlock = contactHtml.substring(footerStart, footerEnd).trim();
console.log('Footer length:', footerBlock.length);
console.log('Footer ends with:\n', footerBlock.slice(-150));
