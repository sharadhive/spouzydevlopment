const fs = require('fs');

function updateHomepageCard(fileName) {
  let content = fs.readFileSync(fileName, 'utf8');

  const cardTarget = `<h3 class="sp-card-title">Breast &amp; Genital Specialized Clinic</h3>
                <p class="sp-card-text">
                    Specialized physical wellness examinations, symptom evaluation, and corrective clinical care conducted by experienced doctors with the highest standards of dignity.
                </p>
                <ul class="sp-card-bullets">
                    <li>Discreet physical examinations &amp; diagnostics</li>
                    <li>Hormonal &amp; physiological assessments</li>
                    <li>Female &amp; male dedicated medical staff</li>
                </ul>
                <div class="sp-card-action-row">
                    <a href="book-appoinment.htm" class="sp-card-link-btn">Schedule Visit →</a>`;

  const cardReplacement = `<h3 class="sp-card-title"><a href="intimate-aesthetics-treatment.htm" style="color: inherit; text-decoration: none;">Breast &amp; Genital Specialized Clinic</a></h3>
                <p class="sp-card-text">
                    Specialized physical wellness examinations, symptom evaluation, and corrective clinical care conducted by experienced doctors with the highest standards of dignity.
                </p>
                <ul class="sp-card-bullets">
                    <li>Discreet physical examinations &amp; diagnostics</li>
                    <li>Hormonal &amp; physiological assessments</li>
                    <li>Female &amp; male dedicated medical staff</li>
                </ul>
                <div class="sp-card-action-row">
                    <a href="intimate-aesthetics-treatment.htm" class="sp-card-link-btn">Explore Clinic →</a>`;

  if (content.includes(cardTarget)) {
    content = content.replace(cardTarget, cardReplacement);
    fs.writeFileSync(fileName, content, 'utf8');
    console.log(`Successfully updated Card 4 in ${fileName}`);
  } else {
    // Try flexible match if line endings differ
    const regex = /<h3 class="sp-card-title">Breast &amp; Genital Specialized Clinic<\/h3>[\s\S]*?<div class="sp-card-action-row">[\s\S]*?<a href="book-appoinment\.htm" class="sp-card-link-btn">Schedule Visit →<\/a>/;
    if (regex.test(content)) {
      content = content.replace(regex, `<h3 class="sp-card-title"><a href="intimate-aesthetics-treatment.htm" style="color: inherit; text-decoration: none;">Breast &amp; Genital Specialized Clinic</a></h3>\n                <p class="sp-card-text">\n                    Specialized physical wellness examinations, symptom evaluation, and corrective clinical care conducted by experienced doctors with the highest standards of dignity.\n                </p>\n                <ul class="sp-card-bullets">\n                    <li>Discreet physical examinations &amp; diagnostics</li>\n                    <li>Hormonal &amp; physiological assessments</li>\n                    <li>Female &amp; male dedicated medical staff</li>\n                </ul>\n                <div class="sp-card-action-row">\n                    <a href="intimate-aesthetics-treatment.htm" class="sp-card-link-btn">Explore Clinic →</a>`);
      fs.writeFileSync(fileName, content, 'utf8');
      console.log(`Successfully updated Card 4 via regex in ${fileName}`);
    } else {
      console.error(`Card target not found in ${fileName}`);
    }
  }
}

updateHomepageCard('index.htm');
updateHomepageCard('index.html');
