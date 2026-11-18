const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

const layoutTypes = {};

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  let type = 'unknown';
  if (c.includes('class="guide-page"') || c.includes('guide-page')) {
    type = 'guide-page';
  } else if (c.includes('sp-modern-wrapper') || c.includes('sp-home-preview')) {
    type = 'home/modern-wrapper';
  } else if (c.includes('sp-booking-hub') || c.includes('sp-booking-form-hub')) {
    type = 'booking-hub';
  }
  layoutTypes[type] = (layoutTypes[type] || 0) + 1;
}

console.log('Layout types:', layoutTypes);
