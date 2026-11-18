const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

console.log('=== SEARCHING FOR CLINICAL CONTENT ===');
for (const f of ['treatment.htm', 'intimate-health.htm', 'counselling.htm', 'join-doctor.htm']) {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const main = content.match(/<main[\s\S]*?<\/main>/);
    console.log(`\n--- ${f} ---`);
    console.log(main ? main[0].substring(0, 600) : 'No main');
  }
}
