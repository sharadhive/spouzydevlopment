const fs = require('fs');

let content = fs.readFileSync('intimate-health.htm', 'utf8');

const target = `<main class="guide-page"><div class="guide-heading"><p>What We Do</p><h1>Intimate Health Care</h1><p>Bring a question about physical intimacy, sexual well-being or breast and genital health to a practitioner.</p></div><div class="guide-body">\r
<div class="sp-policy-callout" style="font-size: 13.5px; color: #633f36; background: #faf4ef; padding: 12px 16px; border-left: 3px solid #b87a62; border-radius: 0 8px 8px 0; margin-top: 18px; margin-bottom: 20px;">\r
        <strong>Clinical Disclaimer:</strong> Information on this page is for health awareness only and is not a substitute for formal diagnosis or medical advice. Read our <a href="disclaimer.htm" style="color: #bf674f; font-weight: 700; text-decoration: underline;">Medical &amp; Legal Disclaimer</a>. Online consultations follow our <a href="teleconsultation-policy.htm" style="color: #bf674f; font-weight: 700; text-decoration: underline;">Teleconsultation Policy</a>.\r
    </div><section><h2>Choosing a consultation</h2><p>Ask which practitioner sees people with your concern, what the appointment involves and whether an in-person visit is appropriate.</p></section><section><h2>What to bring</h2><p>Prepare a short list of questions. Ask how any sensitive records should be shared before sending them. You can also ask about privacy and who will be present.</p></section><div class="guide-actions"><a class="guide-action" href="divorce-mediation.htm">Explore Divorce Mediation ↗</a></div></div></main>`;

const replacement = `<main class="guide-page"><div class="guide-heading"><p>What We Do</p><h1>Intimate Health Care</h1><p>Bring a question about physical intimacy, sexual well-being or clinical health to an experienced practitioner.</p></div><div class="guide-body">\r
<div class="sp-policy-callout" style="font-size: 13.5px; color: #633f36; background: #faf4ef; padding: 12px 16px; border-left: 3px solid #b87a62; border-radius: 0 8px 8px 0; margin-top: 18px; margin-bottom: 20px;">\r
        <strong>Clinical Disclaimer:</strong> Information on this page is for health awareness only and is not a substitute for formal diagnosis or medical advice. Read our <a href="disclaimer.htm" style="color: #bf674f; font-weight: 700; text-decoration: underline;">Medical &amp; Legal Disclaimer</a>. Online consultations follow our <a href="teleconsultation-policy.htm" style="color: #bf674f; font-weight: 700; text-decoration: underline;">Teleconsultation Policy</a>.\r
    </div>\r
<div class="sp-policy-callout" style="font-size: 14px; color: #493039; background: #fffaf5; border: 1px solid #e0c9be; border-left: 3px solid #843e35; border-radius: 8px; padding: 14px 18px; margin: 16px 0 22px;">\r
        <strong>Specialized Practice:</strong> For physical wellness examinations, symptom evaluation, and corrective clinical care, explore our dedicated <a href="intimate-aesthetics-treatment.htm" style="color: #843e35; font-weight: 700; text-decoration: underline;">Breast &amp; Genital Clinic (Intimate Aesthetics Treatment) ↗</a>.\r
    </div><section><h2>Choosing a consultation</h2><p>Ask which practitioner sees people with your concern, what the appointment involves and whether an in-person visit is appropriate.</p></section><section><h2>What to bring</h2><p>Prepare a short list of questions. Ask how any sensitive records should be shared before sending them. You can also ask about privacy and who will be present.</p></section><div class="guide-actions"><a class="guide-action" href="intimate-aesthetics-treatment.htm">Explore Intimate Aesthetics Treatment ↗</a></div></div></main>`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('intimate-health.htm', content, 'utf8');
  console.log('Successfully updated intimate-health.htm main content!');
} else {
  console.error('Target not found in intimate-health.htm');
}
