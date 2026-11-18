const fs = require('fs');

const content = fs.readFileSync('privacy-policy.htm', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Join Our Team') || lines[i].includes('join-counsellor')) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}
