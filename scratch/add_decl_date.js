const fs = require('fs');
let js = fs.readFileSync('js/spouzy-modern.js', 'utf8');

const target = "const isDoctor = role === 'doctor';";
const addition = `const isDoctor = role === 'doctor';

    // Auto-populate declaration date with current IST date
    const declDateInput = document.getElementById('spDeclDate');
    if (declDateInput && !declDateInput.value) {
      try {
        const now = new Date();
        const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        declDateInput.value = istDateStr;
      } catch (e) {
        declDateInput.value = new Date().toISOString().split('T')[0];
      }
    }`;

js = js.replace(target, addition);
fs.writeFileSync('js/spouzy-modern.js', js, 'utf8');
console.log('Added declDate auto-population to initSpouzyJoinForm');
