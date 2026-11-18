const fs = require('fs');

['intimate-health.htm', 'corporate-kamasutra.htm', 'about-profile.htm', 'appointment.htm'].forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  console.log(`=== ${f} ===`);
  const bodyIdx = c.indexOf('<body');
  const bodyTag = c.slice(bodyIdx, c.indexOf('>', bodyIdx) + 1);
  console.log('Body tag:', bodyTag);
  const mainIdx = c.indexOf('<main');
  if (mainIdx !== -1) {
    console.log('Main tag:', c.slice(mainIdx, c.indexOf('>', mainIdx) + 1));
  }
  // Find first 3 sections or articles
  const sections = [];
  let sIdx = 0;
  while (sections.length < 3) {
    const found = c.indexOf('<section', sIdx);
    if (found === -1) break;
    sections.push(c.slice(found, c.indexOf('>', found) + 1));
    sIdx = found + 1;
  }
  console.log('Sections:', sections);
});
