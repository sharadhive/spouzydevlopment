const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  // Find topbar
  const topbarStart = content.indexOf('sp-topbar-modern');
  let remaining = content;
  if (topbarStart !== -1) {
    const headerStart = content.indexOf('<header', topbarStart);
    if (headerStart !== -1) {
      remaining = content.slice(0, topbarStart) + content.slice(headerStart);
    }
  }
  if (remaining.includes('specialist lab')) {
    console.log(f + ': contains "specialist lab" outside topbar');
  }
  if (remaining.includes('Fully confidential care')) {
    console.log(f + ': contains "Fully confidential care" outside topbar');
  }
});

console.log('Outside topbar check complete.');
