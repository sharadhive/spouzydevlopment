const fs = require('fs');
let js = fs.readFileSync('js/spouzy-modern.js', 'utf8');
js = js.replace(
  "if (!form || !document.getElementById('spConsultDate') || document.getElementById('spTimePickerTrigger')) return;",
  "if (!form || !document.getElementById('spConsultDate') || document.getElementById('spSchedulerBlock')) return;"
);
fs.writeFileSync('js/spouzy-modern.js', js, 'utf8');
console.log('Updated guard in initSpouzyQuickBookingForm');
