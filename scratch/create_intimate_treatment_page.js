const fs = require('fs');

// We use corporate-kamasutra.htm as our architectural base because it contains all updated components
let base = fs.readFileSync('corporate-kamasutra.htm', 'utf8');

// Update Title & Meta
base = base.replace(
  /<title>.*?<\/title>/,
  '<title>Intimate Aesthetics Treatment – Breast &amp; Genital Clinic | SPOUZY</title>'
);
base = base.replace(
  /<meta name="description" content=".*?">/,
  '<meta name="description" content="Specialized physical wellness examinations, symptom evaluation, and corrective clinical care at the SPOUZY Breast &amp; Genital Clinic.">'
);

// Update Desktop Group 1: What We Do in base
// Replace What We Do items in base so it has 7 items, with intimate-aesthetics-treatment.htm having aria-current="page"
const g1OptionsOld = `<a class="sp-dropdown-item" href="pre-marriage.htm" data-preview-active="">Pre-Marriage</a><a class="sp-dropdown-item" href="post-marriage.htm">Post-Marriage</a><a class="sp-dropdown-item" href="relationships.htm">Relationship Guidance</a><a class="sp-dropdown-item" href="intimate-health.htm">Intimate Health Care</a><a class="sp-dropdown-item" href="divorce-mediation.htm">Divorce Mediation</a><a class="sp-dropdown-item" href="harassment-support.htm">Prevent Sexual Violence</a>`;
const g1OptionsNew = `<a class="sp-dropdown-item" href="pre-marriage.htm" data-preview-active="">Pre-Marriage</a><a class="sp-dropdown-item" href="post-marriage.htm">Post-Marriage</a><a class="sp-dropdown-item" href="relationships.htm">Relationship Guidance</a><a class="sp-dropdown-item" href="intimate-health.htm">Intimate Health Care</a><a class="sp-dropdown-item" href="intimate-aesthetics-treatment.htm" aria-current="page">Intimate Aesthetics Treatment</a><a class="sp-dropdown-item" href="divorce-mediation.htm">Divorce Mediation</a><a class="sp-dropdown-item" href="harassment-support.htm">Prevent Sexual Violence</a>`;

const g1VisualsOld = `<figure class="nav-visual selected"><img src="image/menu/pre-marriage.webp" alt="" loading="lazy"><figcaption>Pre-Marriage</figcaption></figure><figure class="nav-visual"><img src="image/menu/post-marriage.webp" alt="" loading="lazy"><figcaption>Post-Marriage</figcaption></figure><figure class="nav-visual"><img src="image/menu/relationships.webp" alt="" loading="lazy"><figcaption>Relationship Guidance</figcaption></figure><figure class="nav-visual"><img src="image/menu/intimate-health.webp" alt="" loading="lazy"><figcaption>Intimate Health Care</figcaption></figure><figure class="nav-visual"><img src="image/menu/divorce-mediation.webp" alt="" loading="lazy"><figcaption>Divorce Mediation</figcaption></figure><figure class="nav-visual"><img src="image/menu/harassment-support.webp" alt="" loading="lazy"><figcaption>Prevent Sexual Violence</figcaption></figure>`;
const g1VisualsNew = `<figure class="nav-visual selected"><img src="image/menu/pre-marriage.webp" alt="" loading="lazy"><figcaption>Pre-Marriage</figcaption></figure><figure class="nav-visual"><img src="image/menu/post-marriage.webp" alt="" loading="lazy"><figcaption>Post-Marriage</figcaption></figure><figure class="nav-visual"><img src="image/menu/relationships.webp" alt="" loading="lazy"><figcaption>Relationship Guidance</figcaption></figure><figure class="nav-visual"><img src="image/menu/intimate-health.webp" alt="" loading="lazy"><figcaption>Intimate Health Care</figcaption></figure><figure class="nav-visual"><img src="image/menu/intimate-aesthetics-treatment.webp" alt="Intimate Aesthetics Treatment" loading="lazy"><figcaption>Intimate Aesthetics Treatment</figcaption></figure><figure class="nav-visual"><img src="image/menu/divorce-mediation.webp" alt="" loading="lazy"><figcaption>Divorce Mediation</figcaption></figure><figure class="nav-visual"><img src="image/menu/harassment-support.webp" alt="" loading="lazy"><figcaption>Prevent Sexual Violence</figcaption></figure>`;

const g1DrawerOld = `<summary class="sp-drawer-link">What We Do</summary><a class="sp-drawer-sublink" href="pre-marriage.htm">Pre-Marriage<img class="drawer-option-photo" src="image/menu/pre-marriage.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="post-marriage.htm">Post-Marriage<img class="drawer-option-photo" src="image/menu/post-marriage.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="relationships.htm">Relationship Guidance<img class="drawer-option-photo" src="image/menu/relationships.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="intimate-health.htm">Intimate Health Care<img class="drawer-option-photo" src="image/menu/intimate-health.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="divorce-mediation.htm">Divorce Mediation<img class="drawer-option-photo" src="image/menu/divorce-mediation.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="harassment-support.htm">Prevent Sexual Violence<img class="drawer-option-photo" src="image/menu/harassment-support.webp" alt="" loading="lazy"></a>`;
const g1DrawerNew = `<summary class="sp-drawer-link">What We Do</summary><a class="sp-drawer-sublink" href="pre-marriage.htm">Pre-Marriage<img class="drawer-option-photo" src="image/menu/pre-marriage.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="post-marriage.htm">Post-Marriage<img class="drawer-option-photo" src="image/menu/post-marriage.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="relationships.htm">Relationship Guidance<img class="drawer-option-photo" src="image/menu/relationships.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="intimate-health.htm">Intimate Health Care<img class="drawer-option-photo" src="image/menu/intimate-health.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="intimate-aesthetics-treatment.htm">Intimate Aesthetics Treatment<img class="drawer-option-photo" src="image/menu/intimate-aesthetics-treatment.webp" alt="Intimate Aesthetics Treatment" loading="lazy"></a><a class="sp-drawer-sublink" href="divorce-mediation.htm">Divorce Mediation<img class="drawer-option-photo" src="image/menu/divorce-mediation.webp" alt="" loading="lazy"></a><a class="sp-drawer-sublink" href="harassment-support.htm">Prevent Sexual Violence<img class="drawer-option-photo" src="image/menu/harassment-support.webp" alt="" loading="lazy"></a>`;

// Remove aria-current="page" from corporate-kamasutra in group-3
base = base.replace('href="corporate-kamasutra.htm" aria-current="page"', 'href="corporate-kamasutra.htm"');

base = base.replace(g1OptionsOld, g1OptionsNew);
base = base.replace(g1VisualsOld, g1VisualsNew);
base = base.replace(g1DrawerOld, g1DrawerNew);

// Update Footer link
base = base.replace(
  '<li><a href="intimate-health.htm">Breast &amp; Genital Clinic</a></li>',
  '<li><a href="intimate-aesthetics-treatment.htm">Breast &amp; Genital Clinic</a></li>'
);

// Update Search list in modal
base = base.replace(
  '<li class="sp-search-result-item"><a href="intimate-health.htm">Intimate Health Care <span>↗</span></a></li>',
  '<li class="sp-search-result-item"><a href="intimate-health.htm">Intimate Health Care <span>↗</span></a></li>\n                <li class="sp-search-result-item"><a href="intimate-aesthetics-treatment.htm">Intimate Aesthetics Treatment <span>↗</span></a></li>'
);

// Construct new <main> content
const newMainContent = `<main class="guide-page">
        <div class="guide-heading">
            <p>What We Do • Specialized Clinical Practice</p>
            <h1>Intimate Aesthetics Treatment</h1>
            <p class="guide-subheading" style="font-size: clamp(19px, 2.2vw, 24px); line-height: 1.4; color: #5a2c3d; font-weight: 600; margin: 4px 0 14px;">Breast &amp; Genital Clinic</p>
            <p>Specialized physical wellness examinations, symptom evaluation, and corrective clinical care conducted by experienced doctors with the highest standards of dignity, discretion, and medical excellence.</p>
        </div>

        <div class="guide-body">
            <div class="sp-policy-callout" style="font-size: 13.5px; color: #633f36; background: #faf4ef; padding: 14px 18px; border-left: 3px solid #b87a62; border-radius: 0 8px 8px 0; margin-top: 10px; margin-bottom: 24px;">
                <strong>Clinical Practice Notice:</strong> Consultations and clinical assessments are strictly confidential and conducted by certified medical doctors. Read our <a href="disclaimer.htm" style="color: #bf674f; font-weight: 700; text-decoration: underline;">Medical &amp; Legal Disclaimer</a>. Clinical teleconsultations adhere to our <a href="teleconsultation-policy.htm" style="color: #bf674f; font-weight: 700; text-decoration: underline;">Teleconsultation Policy</a>.
            </div>

            <section>
                <h2>1. Specialized Physical Wellness Examinations &amp; Diagnostics</h2>
                <p>The Breast &amp; Genital Specialized Clinic provides discreet physical examinations and thorough diagnostic assessments for sensitive anatomical and physiological concerns. Every evaluation is carried out in an environment designed for complete physical privacy, emotional comfort, and professional medical rigor.</p>
            </section>

            <section>
                <h2>2. Hormonal &amp; Physiological Health Assessments</h2>
                <p>Personal well-being and intimate confidence are deeply tied to underlying hormonal balance and physiological health. Our specialists evaluate symptoms related to tissue health, hormonal variations, discomfort, and physical changes across different stages of life, developing tailored clinical corrective pathways.</p>
            </section>

            <section>
                <h2>3. Dedicated Female &amp; Male Clinical Staff</h2>
                <p>To ensure every patient feels completely respected and at ease, SPOUZY maintains dedicated female and male medical practitioners. You can request a preferred clinician for your initial consultation, physical evaluation, or in-person clinic follow-up.</p>
            </section>

            <section>
                <h2>4. Consultations &amp; Strict Confidentiality Standards</h2>
                <p>We understand that discussing intimate aesthetics and physical wellness requires profound trust. All medical records, clinical notes, and patient identities are protected under our rigorous <a href="confidentiality.htm" style="color: #843e35; font-weight: 600; text-decoration: underline;">Confidentiality Pledge</a>. You may prepare a list of concerns in advance and ask detailed questions regarding what an examination or corrective procedure involves.</p>
                <p style="margin-top: 14px; font-size: 15px; color: #6b4d56;">For relationship counselling, emotional intimacy guidance, or general psychosexual consultations, explore our separate <a href="intimate-health.htm" style="color: #843e35; font-weight: 600; text-decoration: underline;">Intimate Health Care</a> guidance.</p>
            </section>

            <div class="guide-actions">
                <a class="guide-action" href="divorce-mediation.htm">Explore Divorce Mediation ↗</a>
            </div>
        </div>
    </main>`;

// Replace <main> in base
base = base.replace(/<main class="guide-page">[\s\S]*?<\/main>/, newMainContent);

fs.writeFileSync('intimate-aesthetics-treatment.htm', base, 'utf8');
console.log('Successfully created intimate-aesthetics-treatment.htm!');
