const fs = require('fs');

['corporate-kamasutra.htm', 'intimate-aesthetics-treatment.htm', 'index.htm'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const start = content.indexOf('sp-topbar-modern');
  const end = content.indexOf('sp-header-modern', start);
  console.log('=== ' + f + ' ===');
  console.log(content.slice(start - 12, end - 15));
});
