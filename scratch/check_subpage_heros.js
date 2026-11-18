const fs = require('fs');

const files = [
  'about-profile.htm',
  'appointment.htm',
  'book-appoinment.htm',
  'contactus.htm',
  'mission.htm',
  'under-construction.htm',
  'vision.htm'
];

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const idx = c.indexOf('sp-subpage-hero');
  if (idx !== -1) {
    const end = c.indexOf('</section>', idx);
    console.log(`=== ${f} ===`);
    console.log(c.substring(idx - 15, end + 10));
  }
}
