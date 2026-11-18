const fs = require('fs');

['relationships.htm', 'intimate-health.htm', 'divorce-mediation.htm'].forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const m = content.match(/<div class="guide-actions">[\s\S]*?<\/div>/);
  console.log(`=== ${f} continuation ===\n`, m ? m[0] : 'None');
});
