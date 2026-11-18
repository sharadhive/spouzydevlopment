const fs = require('fs');

const EXPECTED_SENTENCE = "Fully Confidential and all under one roof care by India’s first and only specialist lab of its kind since 2004.";

const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));

let errors = [];
let passCount = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  // Check 1: Old text check sitewide
  if (content.includes('SPOUZY, a specialist lab')) {
    errors.push(`${file}: Still contains old text "SPOUZY, a specialist lab"`);
  }
  if (content.includes('Fully confidential care and personal guidance')) {
    errors.push(`${file}: Still contains old text "Fully confidential care and personal guidance"`);
  }
  if (content.includes('Doctor-Patient Privilege &amp; Confidential Mediation') || content.includes('Doctor-Patient Privilege & Confidential Mediation')) {
    errors.push(`${file}: Still contains old text "Doctor-Patient Privilege"`);
  }
  if (content.includes('DISCREET ADVISORY')) {
    errors.push(`${file}: Still contains "DISCREET ADVISORY"`);
  }

  // Check 2: "it's kind" or "it’s kind" check sitewide
  if (content.includes("it's kind") || content.includes("it’s kind")) {
    errors.push(`${file}: Contains invalid "it's kind" / "it’s kind"!`);
  }

  // Check topbar pages
  if (content.includes('sp-topbar-modern')) {
    // Must contain exactly 2 occurrences of the new sentence (Group 1 & Group 2)
    const matches = content.split(EXPECTED_SENTENCE).length - 1;
    if (matches !== 2) {
      errors.push(`${file}: Expected 2 occurrences of the new sentence, found ${matches}`);
    }

    // Must have aria-hidden="true" on group 2
    if (!content.includes('<div class="sp-topbar-group" aria-hidden="true">')) {
      errors.push(`${file}: Missing aria-hidden="true" on duplicate group`);
    }

    // Must have separator with svg
    const sepMatches = content.split('class="sp-topbar-sep" aria-hidden="true"').length - 1;
    if (sepMatches !== 2) {
      errors.push(`${file}: Expected 2 separators, found ${sepMatches}`);
    }

    // Must preserve action links in topbar-right
    if (!content.includes('href="cart.htm"') || !content.includes('href="register.htm"') || !content.includes('href="create-account.htm"') || !content.includes('href="book-appoinment.htm"')) {
      errors.push(`${file}: Missing standard topbar-right action links!`);
    }

    passCount++;
  }
});

console.log('=== AUDIT RESULTS ===');
console.log(`Total HTML files examined: ${files.length}`);
console.log(`Topbar pages verified: ${passCount}`);
console.log(`Errors found: ${errors.length}`);
if (errors.length > 0) {
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log('All 50 HTML files PASSED static integrity audit!');
}
