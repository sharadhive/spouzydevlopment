const fs = require('fs');

let content = fs.readFileSync('treatment.htm', 'utf8');

const target = `<section id="intimate-health" class="service-subject"><h2>Intimacy</h2><p>For questions about physical intimacy, discomfort or sexual well-being, ask which clinician handles your concern. You can ask what a consultation involves and discuss your preferences before an examination.</p><a class="guide-action" href="intimate-health.htm">Explore Intimacy guidance →</a></section>`;

const replacement = `<section id="intimate-health" class="service-subject"><h2>Intimacy &amp; Aesthetics</h2><p>For questions about physical intimacy, discomfort or sexual well-being, ask which clinician handles your concern. You can ask what a consultation involves and discuss your preferences before an examination.</p><a class="guide-action" href="intimate-health.htm">Explore Intimacy guidance →</a> &nbsp;•&nbsp; <a class="guide-action" href="intimate-aesthetics-treatment.htm">Breast &amp; Genital Clinic →</a></section>`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('treatment.htm', content, 'utf8');
  console.log('Successfully updated treatment.htm!');
} else {
  console.log('Target not found in treatment.htm, checking without exact match...');
}
