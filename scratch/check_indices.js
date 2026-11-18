const fs = require('fs');
['join-doctor.htm', 'join-counsellor.htm'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const hIdx = c.indexOf('</header>');
  const fIdx = c.indexOf('<footer class="sp-footer-modern">');
  console.log(f + ': headerEnd at ' + hIdx + ', footerStart at ' + fIdx);
  console.log('Between: ' + c.substring(hIdx + 9, fIdx).trim());
});
