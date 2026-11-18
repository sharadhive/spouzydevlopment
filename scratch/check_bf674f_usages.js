const fs = require('fs');

const testFiles = ['about-profile.htm', 'counselling.htm', 'cart.htm', 'create-account.htm', 'treatment.htm'];

for (const f of testFiles) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = [...c.matchAll(/style="[^"]*#bf674f[^"]*"/gi)];
  console.log(`=== ${f} (${matches.length} matches) ===`);
  for (const m of matches) {
    console.log('  ', m[0]);
  }
}
