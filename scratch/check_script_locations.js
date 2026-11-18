const fs = require('fs');

const content = fs.readFileSync('about-us.htm', 'utf8');

// Find css links
const cssLinks = content.match(/<link[^>]*\.css[^>]*>/g) || [];
console.log('CSS links in about-us.htm:\n', cssLinks.join('\n'));

// Find script tags
const scriptTags = content.match(/<script[^>]*>[\s\S]*?<\/script>|<script[^>]*>/g) || [];
console.log('\nScript tags in about-us.htm:\n', scriptTags.join('\n'));
