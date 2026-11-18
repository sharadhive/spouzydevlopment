const fs = require('fs');

// Extract templates from contactus.htm
const contactHtml = fs.readFileSync('contactus.htm', 'utf8');

// 1. Sticky Header
const stickyStart = contactHtml.indexOf('<div class="sp-header-sticky-wrapper">');
const stickyEnd = contactHtml.indexOf('<!-- 3. SUBPAGE HERO HEADER -->');
const stickyHeaderTemplate = contactHtml.substring(stickyStart, stickyEnd).trim();

// 2. Footer to End (Search modal, mobile drawer, floating widget, scripts)
const footerStart = contactHtml.indexOf('<!-- 5. MODERN FOOTER -->');
const footerToEndTemplate = contactHtml.substring(footerStart).trim();

// Helper to generate the complete HTML for Doctor or Counsellor
function generatePage(role) {
  const isDoctor = role === 'doctor';
  const pageTitle = isDoctor
    ? 'Join SPOUZY as a Doctor | Problem Solver Group (PSG)'
    : 'Join SPOUZY as a Counsellor | Problem Solver Group (PSG)';
  const metaDesc = isDoctor
    ? 'Interested in joining SPOUZY as a doctor? Empanel your clinical practice with India’s leading relationship and intimate health network.'
    : 'Interested in joining SPOUZY as a counsellor? Empanel your counselling and therapy practice with India’s leading guidance network.';

  // Adjust active nav item in stickyHeader
  let headerHtml = stickyHeaderTemplate;
  if (isDoctor) {
    headerHtml = headerHtml
      .replace('<a class="sp-dropdown-item" href="join-doctor.htm" data-preview-active="">Doctor</a>', '<a class="sp-dropdown-item" href="join-doctor.htm" aria-current="page" data-preview-active="">Doctor</a>')
      .replace('<a class="sp-dropdown-item" href="join-doctor.htm">Doctor</a>', '<a class="sp-dropdown-item" href="join-doctor.htm" aria-current="page" data-preview-active="">Doctor</a>');
  } else {
    headerHtml = headerHtml
      .replace('<a class="sp-dropdown-item" href="join-counsellor.htm">Counsellor</a>', '<a class="sp-dropdown-item" href="join-counsellor.htm" aria-current="page" data-preview-active="">Counsellor</a>')
      .replace('<a class="sp-dropdown-item" href="join-counsellor.htm" data-preview-active="">Counsellor</a>', '<a class="sp-dropdown-item" href="join-counsellor.htm" aria-current="page" data-preview-active="">Counsellor</a>');
  }

  // Adjust active nav item in drawer
  let footerHtml = footerToEndTemplate;
  if (isDoctor) {
    footerHtml = footerHtml
      .replace('<a class="sp-drawer-sublink" href="join-doctor.htm">Doctor<', '<a class="sp-drawer-sublink" href="join-doctor.htm" aria-current="page">Doctor<');
  } else {
    footerHtml = footerHtml
      .replace('<a class="sp-drawer-sublink" href="join-counsellor.htm">Counsellor<', '<a class="sp-drawer-sublink" href="join-counsellor.htm" aria-current="page">Counsellor<');
  }

  const roleIntroTitle = isDoctor ? 'Join SPOUZY as a Doctor' : 'Join SPOUZY as a Counsellor';
  const roleIntroDesc = isDoctor
    ? 'Empanel with SPOUZY\'s clinical and personal guidance network. We collaborate with licensed medical practitioners and super-specialists committed to evidence-based, confidential care. All empanelment applications are reviewed by the SPOUZY clinical and advisory team. Complete each section below and submit to prepare your formal application for WhatsApp review.'
    : 'Collaborate with SPOUZY\'s counselling and personal guidance network. We partner with qualified psychologists, therapists, and relationship counsellors committed to supportive, confidential practice. All empanelment applications are reviewed by the SPOUZY clinical and advisory team. Complete each section below and submit to prepare your formal application for WhatsApp review.';

  const otherRoleText = isDoctor ? 'Looking to join as a Counsellor?' : 'Looking to join as a Doctor?';
  const otherRoleLink = isDoctor ? 'join-counsellor.htm' : 'join-doctor.htm';
  const otherRoleLabel = isDoctor ? 'Join SPOUZY as a Counsellor ↗' : 'Join SPOUZY as a Doctor ↗';

  // Section 2 Specialisation options
  const specialisationOptions = isDoctor
    ? `
      <option value="" disabled selected>Select primary specialisation</option>
      <option value="Clinical Sexology & Intimate Health">Clinical Sexology & Intimate Health</option>
      <option value="Reproductive Medicine & Andrology">Reproductive Medicine & Andrology</option>
      <option value="Gynaecology & Women's Health">Gynaecology & Women's Health</option>
      <option value="Psychiatry & Psychosexual Medicine">Psychiatry & Psychosexual Medicine</option>
      <option value="General Medicine & Family Practice">General Medicine & Family Practice</option>
      <option value="Dermatology & Venereology (DVD)">Dermatology & Venereology (DVD)</option>
      <option value="Urology & Men's Health">Urology & Men's Health</option>
      <option value="Other Medical Super-Speciality">Other Medical Super-Speciality</option>
    `
    : `
      <option value="" disabled selected>Select primary specialisation</option>
      <option value="Marriage & Relationship Counselling">Marriage & Relationship Counselling</option>
      <option value="Psychosexual & Intimacy Counselling">Psychosexual & Intimacy Counselling</option>
      <option value="Pre-Marital & Cohabitation Therapy">Pre-Marital & Cohabitation Therapy</option>
      <option value="Divorce Mediation & Dispute Resolution">Divorce Mediation & Dispute Resolution</option>
      <option value="Trauma, Anxiety & Individual Therapy">Trauma, Anxiety & Individual Therapy</option>
      <option value="Family & Systemic Therapy">Family & Systemic Therapy</option>
      <option value="Adolescent & Young Adult Guidance">Adolescent & Young Adult Guidance</option>
      <option value="Other Counselling Specialisation">Other Counselling Specialisation</option>
    `;

  // Section 3 Primary Degree options
  const primaryQualOptions = isDoctor
    ? `
      <option value="" disabled selected>Select primary qualification</option>
      <option value="MBBS">MBBS (Bachelor of Medicine & Bachelor of Surgery)</option>
      <option value="MD">MD (Doctor of Medicine)</option>
      <option value="MS">MS (Master of Surgery)</option>
      <option value="DNB">DNB (Diplomate of National Board)</option>
      <option value="DM">DM (Doctorate of Medicine / Super-Speciality)</option>
      <option value="MCh">MCh (Master of Chirurgiae)</option>
      <option value="BAMS">BAMS (Bachelor of Ayurvedic Medicine & Surgery)</option>
      <option value="BHMS">BHMS (Bachelor of Homeopathic Medicine & Surgery)</option>
      <option value="BDS / MDS">BDS / MDS (Dental Surgery / Oral Health)</option>
      <option value="Other">Other Medical Qualification</option>
    `
    : `
      <option value="" disabled selected>Select primary qualification</option>
      <option value="MA / MSc Clinical Psychology">MA / MSc Clinical Psychology</option>
      <option value="MA / MSc Counselling Psychology">MA / MSc Counselling Psychology</option>
      <option value="M.Phil Clinical Psychology">M.Phil Clinical Psychology</option>
      <option value="Psy.D.">Psy.D. (Doctor of Psychology)</option>
      <option value="Master of Social Work (MSW)">Master of Social Work (MSW - Medical & Psychiatric)</option>
      <option value="PGDGC">Postgraduate Diploma in Guidance & Counselling (PGDGC)</option>
      <option value="BA / BSc Psychology (Hons)">BA / BSc Psychology (Hons)</option>
      <option value="Family Therapy Diploma">Family & Systemic Therapy Diploma</option>
      <option value="Other">Other Psychology / Counselling Qualification</option>
    `;

  // Section 4 Registration Fields
  const section4Html = isDoctor
    ? `
      <!-- SECTION 4: MEDICAL COUNCIL REGISTRATION (DOCTOR) -->
      <div class="sp-reg-section-card">
        <div class="sp-reg-section-header">
          <div class="sp-reg-section-badge">4</div>
          <div class="sp-reg-section-title-wrap">
            <h2 class="sp-reg-section-title">Medical Council Registration</h2>
            <p class="sp-reg-section-subtitle">Official statutory registration with State Medical Council or National Medical Commission.</p>
          </div>
        </div>

        <div class="sp-form-grid-2col">
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spCouncilSelect">Medical Council / Licensing Body <span class="sp-req">*</span></label>
            <select id="spCouncilSelect" name="council" class="sp-form-select-modern" required>
              <option value="" disabled selected>Select Medical Council</option>
              <option value="Maharashtra Medical Council (MMC)">Maharashtra Medical Council (MMC)</option>
              <option value="Delhi Medical Council (DMC)">Delhi Medical Council (DMC)</option>
              <option value="Karnataka Medical Council (KMC)">Karnataka Medical Council (KMC)</option>
              <option value="Tamil Nadu Medical Council (TNMC)">Tamil Nadu Medical Council (TNMC)</option>
              <option value="National Medical Commission (NMC / MCI)">National Medical Commission (NMC / MCI)</option>
              <option value="National Commission for Indian System of Medicine (NCISM)">National Commission for Indian System of Medicine (NCISM)</option>
              <option value="National Commission for Homoeopathy (NCH)">National Commission for Homoeopathy (NCH)</option>
              <option value="Dental Council of India (DCI)">Dental Council of India (DCI)</option>
              <option value="Other State Medical Council">Other State Medical Council</option>
            </select>
          </div>
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegNum">Medical Council Registration Number <span class="sp-req">*</span></label>
            <input type="text" id="spRegNum" name="regNumber" class="sp-form-input-modern" placeholder="e.g. MMC-2015-08-4123" required>
          </div>
        </div>

        <div class="sp-form-grid-2col">
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegState">State of Registration <span class="sp-req">*</span></label>
            <input type="text" id="spRegState" name="regState" class="sp-form-input-modern" placeholder="e.g. Maharashtra" required>
          </div>
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegYear">Year of Registration <span class="sp-req">*</span></label>
            <input type="number" min="1960" max="2026" id="spRegYear" name="regYear" class="sp-form-input-modern" placeholder="YYYY" required>
          </div>
        </div>

        <div class="sp-form-grid-2col" style="margin-bottom: 0;">
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegValid">Valid Until / Renewal Date <span class="sp-req">*</span></label>
            <input type="text" id="spRegValid" name="regValid" class="sp-form-input-modern" placeholder="e.g. 31/12/2028 or Permanent" required>
          </div>
          <div class="sp-form-group-modern" id="spCouncilCertGroup">
            <label class="sp-form-label-modern" for="spCouncilCertInput" id="spCouncilCertLabel">Council Registration Certificate <span class="sp-req">*</span> <span class="sp-opt">(JPG or PDF, up to 10 MB)</span></label>
            <div class="sp-file-dropzone" id="spCouncilCertDropzone">
              <input type="file" id="spCouncilCertInput" class="sp-file-hidden-input" accept=".jpg,.jpeg,.pdf">
              <div class="sp-file-dropzone-icon"><i class="fa fa-id-card-o"></i></div>
              <div class="sp-file-dropzone-text">Click or drag certificate here</div>
              <div class="sp-file-dropzone-hint">Select your council registration certificate — JPG or PDF, up to 10 MB.</div>
            </div>
            <div class="sp-file-preview-card" id="spCouncilCertPreview" style="display: none;">
              <div class="sp-file-info-group">
                <div class="sp-file-thumb"><i class="fa fa-file-pdf-o" style="color: #c02a2a;"></i></div>
                <div class="sp-file-details">
                  <div class="sp-file-name">council-certificate.pdf</div>
                  <div class="sp-file-size">--</div>
                </div>
              </div>
              <div class="sp-file-actions">
                <button type="button" class="sp-file-action-btn is-replace"><i class="fa fa-refresh"></i> Replace</button>
                <button type="button" class="sp-file-action-btn is-remove"><i class="fa fa-trash"></i> Remove</button>
              </div>
            </div>
            <div id="spCouncilCertError" class="sp-field-inline-error" style="display: none; color: #c02a2a; font-size: 12.5px; font-weight: 700; margin-top: 6px;"></div>
          </div>
        </div>
      </div>
    `
    : `
      <!-- SECTION 4: PROFESSIONAL ACCREDITATION (COUNSELLOR) -->
      <div class="sp-reg-section-card">
        <div class="sp-reg-section-header">
          <div class="sp-reg-section-badge">4</div>
          <div class="sp-reg-section-title-wrap">
            <h2 class="sp-reg-section-title">Professional Registration / Accreditation</h2>
            <p class="sp-reg-section-subtitle">Accreditation details, recognised counselling bodies, or certified independent practice.</p>
          </div>
        </div>

        <div style="background: #FFF7E8; border: 1.5px solid rgba(138, 64, 47, 0.25); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
          <label class="sp-form-checkbox-label" style="font-weight: 700; color: #4B2030; display: flex; align-items: flex-start; gap: 10px; margin: 0;">
            <input type="checkbox" id="spNaRegCheck" style="margin-top: 3px;">
            <span><strong>Not Applicable</strong> — I practice as an independent certified counsellor / self-regulated therapist without statutory council registration.</span>
          </label>
        </div>

        <div class="sp-form-grid-2col">
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spCouncilSelect">Professional Body / Accreditation</label>
            <select id="spCouncilSelect" name="council" class="sp-form-select-modern">
              <option value="" disabled selected>Select Professional Body</option>
              <option value="Rehabilitation Council of India (RCI)">Rehabilitation Council of India (RCI)</option>
              <option value="Indian Association of Clinical Psychologists (IACP)">Indian Association of Clinical Psychologists (IACP)</option>
              <option value="Counsellors Association of India (CAI)">Counsellors Association of India (CAI)</option>
              <option value="National Academy of Psychology (NAOP)">National Academy of Psychology (NAOP)</option>
              <option value="British Association for Counselling & Psychotherapy (BACP)">British Association for Counselling & Psychotherapy (BACP)</option>
              <option value="American Psychological Association (APA)">American Psychological Association (APA)</option>
              <option value="Other Professional Body">Other Professional Body</option>
              <option value="Independent Certified Practice">Independent Certified Practice</option>
            </select>
          </div>
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegNum">Accreditation / Registration Number</label>
            <input type="text" id="spRegNum" name="regNumber" class="sp-form-input-modern" placeholder="e.g. RCI-CRR-A12345 or Cert Number">
          </div>
        </div>

        <div class="sp-form-grid-2col">
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegState">State / Country</label>
            <input type="text" id="spRegState" name="regState" class="sp-form-input-modern" placeholder="e.g. Maharashtra, India">
          </div>
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegYear">Registration Year</label>
            <input type="text" id="spRegYear" name="regYear" class="sp-form-input-modern" placeholder="YYYY">
          </div>
        </div>

        <div class="sp-form-grid-2col" style="margin-bottom: 0;">
          <div class="sp-form-group-modern">
            <label class="sp-form-label-modern" for="spRegValid">Valid Until</label>
            <input type="text" id="spRegValid" name="regValid" class="sp-form-input-modern" placeholder="e.g. 2028 or Lifetime">
          </div>
          <div class="sp-form-group-modern" id="spCouncilCertGroup">
            <label class="sp-form-label-modern" for="spCouncilCertInput" id="spCouncilCertLabel">Professional Registration / Accreditation Certificate <span class="sp-req" id="spCouncilCertReq">*</span> <span class="sp-opt">(JPG or PDF, up to 10 MB)</span></label>
            <div class="sp-file-dropzone" id="spCouncilCertDropzone">
              <input type="file" id="spCouncilCertInput" class="sp-file-hidden-input" accept=".jpg,.jpeg,.pdf">
              <div class="sp-file-dropzone-icon"><i class="fa fa-id-card-o"></i></div>
              <div class="sp-file-dropzone-text">Click or drag certificate here</div>
              <div class="sp-file-dropzone-hint">Select your registration or accreditation certificate — JPG or PDF, up to 10 MB.</div>
            </div>
            <div class="sp-file-preview-card" id="spCouncilCertPreview" style="display: none;">
              <div class="sp-file-info-group">
                <div class="sp-file-thumb"><i class="fa fa-file-pdf-o" style="color: #c02a2a;"></i></div>
                <div class="sp-file-details">
                  <div class="sp-file-name">certificate.pdf</div>
                  <div class="sp-file-size">--</div>
                </div>
              </div>
              <div class="sp-file-actions">
                <button type="button" class="sp-file-action-btn is-replace"><i class="fa fa-refresh"></i> Replace</button>
                <button type="button" class="sp-file-action-btn is-remove"><i class="fa fa-trash"></i> Remove</button>
              </div>
            </div>
            <div id="spCouncilCertError" class="sp-field-inline-error" style="display: none; color: #c02a2a; font-size: 12.5px; font-weight: 700; margin-top: 6px;"></div>
          </div>
        </div>
      </div>
    `;

  return `<!doctype html><html lang="en">

<head>
    <title>${pageTitle}</title>

    <meta name="description" content="${metaDesc}">
    <meta name="keywords" content="join SPOUZY, Doctor Empanelment, Marriage Counselling Mumbai, Problem Solver Group, Neilesh Jethmal, intimate healthcare, clinical psychologist empanelment">
    <meta name="author" content="Problem Solver Group (PSG)">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta charset="utf-8">
    <meta name="robots" content="all, follow">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="image/spouzy.png" type="image/png">

    <!-- Google Fonts: Plus Jakarta Sans & Playfair Display -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&amp;family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet">

    <!-- Vendor CSS -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css">
    <link href="vendor/bootstrap.min.css" rel="stylesheet">
    
    <!-- Legacy Stylesheets for Compatibility -->
    <link rel="stylesheet" type="text/css" href="css/style.css">
    <link rel="stylesheet" type="text/css" href="css/responsive.css">
    <link rel="stylesheet" type="text/css" href="css/spouzy.css">
    
    <!-- SPOUZY 2026 Modern Luxury & UI/UX Redesign System -->
    <link rel="preload" href="image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm" as="video" type="video/webm">
    <style>html,body{background-color:#FFFACD!important;}</style>
    <link rel="stylesheet" href="css/spouzy-modern.css">
    <link rel="stylesheet" href="css/spouzy-edition.css">
    <link href="css/motion.css" rel="stylesheet">
    <link rel="stylesheet" href="css/guide.css">
</head>

<body class="sp-modern-wrapper spouzy-registration-page">

    ${headerHtml}

    <!-- MAIN REGISTRATION CONTENT CONTAINER (Centred, Max-Width ~1120px) -->
    <main class="sp-reg-page-main" role="main">
        <div class="sp-reg-container">

            <!-- Compact Introduction -->
            <header class="sp-reg-intro-header">
                <nav class="sp-reg-breadcrumbs" aria-label="Breadcrumb navigation">
                    <a href="index.htm">Home</a>
                    <span class="sp-reg-bc-sep" aria-hidden="true">›</span>
                    <span>Join Our Team</span>
                    <span class="sp-reg-bc-sep" aria-hidden="true">›</span>
                    <span aria-current="page">${isDoctor ? 'Doctor' : 'Counsellor'}</span>
                </nav>
                <h1 class="sp-reg-main-title">${roleIntroTitle}</h1>
                <p class="sp-reg-intro-desc">
                    ${roleIntroDesc}
                </p>
                <div class="sp-reg-role-switch">
                    <span>${otherRoleText}</span>
                    <a href="${otherRoleLink}" class="sp-reg-switch-link">${otherRoleLabel}</a>
                </div>
            </header>

            <!-- REGISTRATION FORM -->
            <form id="spJoinAppForm" data-role="${role}" novalidate>

                <!-- SECTION 1: PERSONAL DETAILS -->
                <div class="sp-reg-section-card">
                    <div class="sp-reg-section-header">
                        <div class="sp-reg-section-badge">1</div>
                        <div class="sp-reg-section-title-wrap">
                            <h2 class="sp-reg-section-title">Personal Details</h2>
                            <p class="sp-reg-section-subtitle">Basic identity and confidential communication channels.</p>
                        </div>
                    </div>

                    <div class="sp-form-grid-name">
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spTitle">Title <span class="sp-req">*</span></label>
                            <select id="spTitle" name="title" class="sp-form-select-modern" required>
                                <option value="Dr" ${isDoctor ? 'selected' : ''}>Dr</option>
                                <option value="Mr" ${!isDoctor ? 'selected' : ''}>Mr</option>
                                <option value="Mrs">Mrs</option>
                                <option value="Ms">Ms</option>
                            </select>
                        </div>
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spFirstName">First Name <span class="sp-req">*</span></label>
                            <input type="text" id="spFirstName" name="firstName" class="sp-form-input-modern" placeholder="e.g. Raj" required>
                        </div>
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spLastName">Last Name <span class="sp-req">*</span></label>
                            <input type="text" id="spLastName" name="lastName" class="sp-form-input-modern" placeholder="e.g. Sharma" required>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spGender">Gender <span class="sp-req">*</span></label>
                            <select id="spGender" name="gender" class="sp-form-select-modern" required>
                                <option value="" disabled selected>Select gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Non-Binary">Non-Binary / Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spDob">Date of Birth <span class="sp-req">*</span></label>
                            <input type="date" id="spDob" name="dob" class="sp-form-input-modern" required>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spMobile">Mobile Number <span class="sp-req">*</span></label>
                            <input type="tel" id="spMobile" name="mobile" class="sp-form-input-modern" placeholder="+91 98200 12345" required>
                        </div>
                        <div class="sp-form-group-modern">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <label class="sp-form-label-modern" for="spWhatsapp" style="margin-bottom: 0;">WhatsApp Number <span class="sp-req">*</span></label>
                                <label class="sp-form-checkbox-label" style="margin-top: 0; font-size: 12.5px;">
                                    <input type="checkbox" id="spSameAsMobile"> Same as mobile
                                </label>
                            </div>
                            <input type="tel" id="spWhatsapp" name="whatsapp" class="sp-form-input-modern" placeholder="+91 98200 12345" required>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern sp-form-col-full">
                            <label class="sp-form-label-modern" for="spEmail">Professional Email ID <span class="sp-req">*</span></label>
                            <input type="email" id="spEmail" name="email" class="sp-form-input-modern" placeholder="practitioner@clinic.com" required>
                        </div>
                    </div>

                    <div class="sp-form-group-modern sp-form-col-full" style="margin-top: 6px;">
                        <label class="sp-form-label-modern">Recent Colour Photograph <span class="sp-req">*</span> <span class="sp-opt">(JPG, PNG, WebP · Max 5 MB)</span></label>
                        <div class="sp-file-dropzone" id="spPhotoDropzone">
                            <input type="file" id="spPhotoInput" class="sp-file-hidden-input" accept=".jpg,.jpeg,.png,.webp">
                            <div class="sp-file-dropzone-icon"><i class="fa fa-camera"></i></div>
                            <div class="sp-file-dropzone-text">Click or drag your professional photograph here</div>
                            <div class="sp-file-dropzone-hint">White or neutral background preferred · Max 5 MB</div>
                        </div>
                        <div class="sp-file-preview-card" id="spPhotoPreview" style="display: none;">
                            <div class="sp-file-info-group">
                                <div class="sp-file-thumb"><i class="fa fa-user"></i></div>
                                <div class="sp-file-details">
                                    <div class="sp-file-name">photograph.jpg</div>
                                    <div class="sp-file-size">--</div>
                                </div>
                            </div>
                            <div class="sp-file-actions">
                                <button type="button" class="sp-file-action-btn is-replace"><i class="fa fa-refresh"></i> Replace</button>
                                <button type="button" class="sp-file-action-btn is-remove"><i class="fa fa-trash"></i> Remove</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: PROFESSIONAL DETAILS -->
                <div class="sp-reg-section-card">
                    <div class="sp-reg-section-header">
                        <div class="sp-reg-section-badge">2</div>
                        <div class="sp-reg-section-title-wrap">
                            <h2 class="sp-reg-section-title">Professional Details</h2>
                            <p class="sp-reg-section-subtitle">Current clinical setting, years in practice, and specialised focus.</p>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spPracticeStatus">Employment / Practice Status <span class="sp-req">*</span></label>
                            <select id="spPracticeStatus" name="practiceStatus" class="sp-form-select-modern" required>
                                <option value="" disabled selected>Select practice status</option>
                                <option value="Private Independent Practice">Private Independent Practice</option>
                                <option value="Hospital / Clinic Attached">Hospital / Clinic Attached</option>
                                <option value="Employed / Institutional Practice">Employed / Institutional Practice</option>
                                <option value="Visiting Consultant / Telehealth">Visiting Consultant / Telehealth</option>
                                <option value="Academic / Teaching Faculty">Academic / Teaching Faculty</option>
                            </select>
                        </div>
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spExperienceYears">Years of Professional Experience <span class="sp-req">*</span></label>
                            <select id="spExperienceYears" name="experienceYears" class="sp-form-select-modern" required>
                                <option value="" disabled selected>Select experience range</option>
                                <option value="1–3 Years">1–3 Years</option>
                                <option value="4–7 Years">4–7 Years</option>
                                <option value="8–12 Years">8–12 Years</option>
                                <option value="13–20 Years">13–20 Years</option>
                                <option value="20+ Years">20+ Years (Senior Specialist / Fellow)</option>
                            </select>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spInstitutionName">Current Institution / Hospital / Practice Name <span class="sp-req">*</span></label>
                            <input type="text" id="spInstitutionName" name="institutionName" class="sp-form-input-modern" placeholder="e.g. Apollo Hospital / Private Practice Clinic" required>
                        </div>
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spAffiliations">Professional Affiliations &amp; Memberships <span class="sp-opt">(Optional)</span></label>
                            <input type="text" id="spAffiliations" name="affiliations" class="sp-form-input-modern" placeholder="e.g. IMA, FOGSI, ISSM, IPA, RCI">
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern sp-form-col-full">
                            <label class="sp-form-label-modern" for="spSpecialisation">Primary Area of Specialisation <span class="sp-req">*</span></label>
                            <select id="spSpecialisation" name="specialisation" class="sp-form-select-modern" required>
                                ${specialisationOptions}
                            </select>
                        </div>
                    </div>

                    <div class="sp-form-group-modern sp-form-col-full" style="margin-top: 6px;">
                        <label class="sp-form-label-modern" for="spObjective">Objective for Joining SPOUZY <span class="sp-req">*</span></label>
                        <textarea id="spObjective" name="objective" class="sp-form-textarea-modern" placeholder="Describe your clinical philosophy, interest in multidisciplinary intimate healthcare, and how you aim to support patients through SPOUZY..." required></textarea>
                    </div>
                </div>

                <!-- SECTION 3: QUALIFICATIONS -->
                <div class="sp-reg-section-card">
                    <div class="sp-reg-section-header">
                        <div class="sp-reg-section-badge">3</div>
                        <div class="sp-reg-section-title-wrap">
                            <h2 class="sp-reg-section-title">Qualifications &amp; Credentials</h2>
                            <p class="sp-reg-section-subtitle">Academic degrees, certified transcripts, and professional qualifications.</p>
                        </div>
                    </div>

                    <!-- Primary Qualification -->
                    <div style="background: #faf6f2; border: 1.5px solid rgba(75, 32, 48, 0.14); border-radius: 12px; padding: 22px; margin-bottom: 20px;">
                        <div style="font-size: 15px; font-weight: 800; color: #4B2030; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(75, 32, 48, 0.1);">
                            Primary Qualification <span class="sp-req">*</span>
                        </div>
                        <div class="sp-form-grid-2col">
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPrimaryQual">Primary Degree / Title <span class="sp-req">*</span></label>
                                <select id="spPrimaryQual" name="primaryQual" class="sp-form-select-modern" required>
                                    ${primaryQualOptions}
                                </select>
                            </div>
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPrimaryYear">Year of Completion <span class="sp-req">*</span></label>
                                <input type="number" min="1960" max="2026" id="spPrimaryYear" name="primaryYear" class="sp-form-input-modern" placeholder="YYYY" required>
                            </div>
                        </div>

                        <div id="spPrimaryQualOtherWrap" style="display: none; margin-bottom: 18px;">
                            <label class="sp-form-label-modern" for="spPrimaryQualOther">Specify Qualification Title <span class="sp-req">*</span></label>
                            <input type="text" id="spPrimaryQualOther" name="primaryQualOther" class="sp-form-input-modern" placeholder="Enter full qualification title">
                        </div>

                        <div class="sp-form-grid-2col">
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPrimaryCollege">College / Institute / University <span class="sp-req">*</span></label>
                                <input type="text" id="spPrimaryCollege" name="primaryCollege" class="sp-form-input-modern" placeholder="e.g. Grant Medical College / Mumbai University" required>
                            </div>
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPrimaryGrade">Marks / Grade / Honors <span class="sp-req">*</span></label>
                                <input type="text" id="spPrimaryGrade" name="primaryGrade" class="sp-form-input-modern" placeholder="e.g. First Class / 68%" required>
                            </div>
                        </div>

                        <div class="sp-form-group-modern sp-form-col-full" style="margin-top: 6px; margin-bottom: 0;">
                            <label class="sp-form-label-modern">Degree / Marksheet Certificate Attachment <span class="sp-req">*</span> <span class="sp-opt">(PDF, JPG, PNG up to 10 MB)</span></label>
                            <div class="sp-file-dropzone" id="spPrimaryCertDropzone">
                                <input type="file" id="spPrimaryCertInput" class="sp-file-hidden-input" accept=".pdf,.jpg,.jpeg,.png">
                                <div class="sp-file-dropzone-icon"><i class="fa fa-cloud-upload"></i></div>
                                <div class="sp-file-dropzone-text">Click or drag primary certificate / marksheet here</div>
                                <div class="sp-file-dropzone-hint">PDF, JPG, or PNG (Max 10 MB)</div>
                            </div>
                            <div class="sp-file-preview-card" id="spPrimaryCertPreview" style="display: none;">
                                <div class="sp-file-info-group">
                                    <div class="sp-file-thumb"><i class="fa fa-file-pdf-o" style="color: #c02a2a;"></i></div>
                                    <div class="sp-file-details">
                                        <div class="sp-file-name">certificate.pdf</div>
                                        <div class="sp-file-size">--</div>
                                    </div>
                                </div>
                                <div class="sp-file-actions">
                                    <button type="button" class="sp-file-action-btn is-replace"><i class="fa fa-refresh"></i> Replace</button>
                                    <button type="button" class="sp-file-action-btn is-remove"><i class="fa fa-trash"></i> Remove</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Optional Postgraduate Qualification -->
                    <div class="sp-qual-card">
                        <div class="sp-qual-header">
                            <span class="sp-qual-title"><i class="fa fa-certificate"></i> Postgraduate Qualification <span class="sp-opt">(Optional)</span></span>
                        </div>
                        <div class="sp-form-grid-2col">
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPgQual">Postgraduate Degree / Speciality</label>
                                <input type="text" id="spPgQual" name="pgQual" class="sp-form-input-modern" placeholder="e.g. MD Psychiatry / M.Phil Clinical Psychology">
                            </div>
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPgYear">Completion Year</label>
                                <input type="number" min="1960" max="2026" id="spPgYear" name="pgYear" class="sp-form-input-modern" placeholder="YYYY">
                            </div>
                        </div>
                        <div class="sp-form-grid-2col">
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPgCollege">College / Institute</label>
                                <input type="text" id="spPgCollege" name="pgCollege" class="sp-form-input-modern" placeholder="e.g. NIMHANS / AIIMS">
                            </div>
                            <div class="sp-form-group-modern">
                                <label class="sp-form-label-modern" for="spPgGrade">Marks / Grade</label>
                                <input type="text" id="spPgGrade" name="pgGrade" class="sp-form-input-modern" placeholder="e.g. Distinction / Honors">
                            </div>
                        </div>
                        <div class="sp-form-group-modern sp-form-col-full" style="margin-top: 6px; margin-bottom: 0;">
                            <label class="sp-form-label-modern">Postgraduate Certificate Attachment <span class="sp-opt">(PDF, JPG, PNG up to 10 MB)</span></label>
                            <div class="sp-file-dropzone" id="spPgCertDropzone">
                                <input type="file" id="spPgCertInput" class="sp-file-hidden-input" accept=".pdf,.jpg,.jpeg,.png">
                                <div class="sp-file-dropzone-icon"><i class="fa fa-cloud-upload"></i></div>
                                <div class="sp-file-dropzone-text">Click or drag postgraduate certificate here</div>
                                <div class="sp-file-dropzone-hint">PDF, JPG, or PNG (Max 10 MB)</div>
                            </div>
                            <div class="sp-file-preview-card" id="spPgCertPreview" style="display: none;">
                                <div class="sp-file-info-group">
                                    <div class="sp-file-thumb"><i class="fa fa-file-pdf-o" style="color: #c02a2a;"></i></div>
                                    <div class="sp-file-details">
                                        <div class="sp-file-name">pg-certificate.pdf</div>
                                        <div class="sp-file-size">--</div>
                                    </div>
                                </div>
                                <div class="sp-file-actions">
                                    <button type="button" class="sp-file-action-btn is-replace"><i class="fa fa-refresh"></i> Replace</button>
                                    <button type="button" class="sp-file-action-btn is-remove"><i class="fa fa-trash"></i> Remove</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Additional Qualifications Repeater Container -->
                    <div id="spAdditionalQualsContainer"></div>

                    <button type="button" id="spAddQualBtn" class="sp-add-qual-btn">
                        <i class="fa fa-plus-circle" aria-hidden="true"></i> Add Additional Qualification
                    </button>
                </div>

                ${section4Html}

                <!-- SECTION 5: WORKING PREFERENCES -->
                <div class="sp-reg-section-card">
                    <div class="sp-reg-section-header">
                        <div class="sp-reg-section-badge">5</div>
                        <div class="sp-reg-section-title-wrap">
                            <h2 class="sp-reg-section-title">Working Preferences</h2>
                            <p class="sp-reg-section-subtitle">Consultation modality and preferred operational time slots.</p>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern sp-form-col-full">
                            <label class="sp-form-label-modern" for="spWorkMode">Preferred Mode of Consultation <span class="sp-req">*</span></label>
                            <select id="spWorkMode" name="workMode" class="sp-form-select-modern" required>
                                <option value="Both Online & In-Person" selected>Both Online Telehealth &amp; In-Person Clinics</option>
                                <option value="Online Only">Online / Telehealth Consultations Only</option>
                                <option value="In-Person Only">In-Person Clinic Sessions Only</option>
                            </select>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col" style="margin-bottom: 0;">
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spTimeFrom">Preferred Working Hours: From <span class="sp-req">*</span></label>
                            <input type="time" id="spTimeFrom" name="timeFrom" class="sp-form-input-modern" value="09:00" required>
                            <span style="font-size: 11.5px; color: #65504B; margin-top: 4px;">Asia/Kolkata (IST)</span>
                        </div>
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spTimeTo">Preferred Working Hours: To <span class="sp-req">*</span></label>
                            <input type="time" id="spTimeTo" name="timeTo" class="sp-form-input-modern" value="18:00" required>
                            <span style="font-size: 11.5px; color: #65504B; margin-top: 4px;">Asia/Kolkata (IST)</span>
                            <div id="spTimeRangeError" style="display: none; color: #c02a2a; font-size: 12.5px; font-weight: 700; margin-top: 4px;"></div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 6: DECLARATION & SIGNATURE -->
                <div class="sp-reg-section-card">
                    <div class="sp-reg-section-header">
                        <div class="sp-reg-section-badge">6</div>
                        <div class="sp-reg-section-title-wrap">
                            <h2 class="sp-reg-section-title">Declaration &amp; Verification</h2>
                            <p class="sp-reg-section-subtitle">Professional ethics pledge, accuracy statement, and digital signature.</p>
                        </div>
                    </div>

                    <div style="background: #faf6f2; border: 1.5px solid rgba(75, 32, 48, 0.14); border-radius: 12px; padding: 22px; margin-bottom: 22px; font-size: 14px; line-height: 1.6; color: #3D2B2B;">
                        <p style="margin: 0 0 14px; font-weight: 600;">
                            "I hereby declare that all information, qualifications, and certificates submitted in this empanelment application are true, authentic, and complete to the best of my knowledge. I understand that false or misleading details will disqualify my application. I agree to uphold the professional ethics, patient confidentiality, and clinical standards of SPOUZY and Problem Solver Group (PSG)."
                        </p>
                        <label class="sp-form-checkbox-label" style="font-weight: 700; color: #4B2030; align-items: flex-start; gap: 10px;">
                            <input type="checkbox" id="spDeclarationCheck" required style="margin-top: 3px;">
                            <span>I have read, understood, and accept the declaration above, and agree to the <a href="terms.htm" target="_blank" style="color: #8A402F; text-decoration: underline;">Terms of Use</a> and <a href="privacy-policy.htm" target="_blank" style="color: #8A402F; text-decoration: underline;">Privacy Policy</a>. <span class="sp-req">*</span></span>
                        </label>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spDeclDate">Application Date</label>
                            <input type="date" id="spDeclDate" name="declDate" class="sp-form-input-modern" readonly>
                        </div>
                        <div class="sp-form-group-modern">
                            <label class="sp-form-label-modern" for="spSignName">Full Legal Name of Applicant <span class="sp-req">*</span></label>
                            <input type="text" id="spSignName" name="signName" class="sp-form-input-modern" placeholder="e.g. Dr. Raj Sharma" required>
                        </div>
                    </div>

                    <div class="sp-form-grid-2col">
                        <div class="sp-form-group-modern sp-form-col-full">
                            <label class="sp-form-label-modern" for="spTypedSignature">Typed Signature <span class="sp-req">*</span></label>
                            <input type="text" id="spTypedSignature" name="typedSignature" class="sp-form-input-modern" placeholder="Type your full legal name as confirmation of submission" required>
                        </div>
                    </div>

                    <!-- Digital Drawing Canvas -->
                    <div class="sp-sig-card">
                        <label class="sp-form-label-modern" style="margin-bottom: 8px;">
                            Touch / Mouse Signature Pad <span class="sp-opt">(Optional digital signature drawing)</span>
                        </label>
                        <div class="sp-sig-canvas-wrap">
                            <canvas id="spSigCanvas" class="sp-sig-canvas"></canvas>
                            <span class="sp-sig-hint" id="spSigHint">Draw your signature with mouse or touch here</span>
                        </div>
                        <div class="sp-sig-tools">
                            <span style="font-size: 11.5px; color: #65504B;">Touch and pen-enabled</span>
                            <button type="button" id="spClearSigBtn" class="sp-sig-clear-btn">
                                <i class="fa fa-eraser"></i> Clear Signature
                            </button>
                        </div>
                    </div>
                </div>

                <!-- FORM ACTIONS -->
                <div class="sp-form-actions-area">
                    <div id="spFormValidationError" style="display: none; background: #fff0f0; border: 1.5px solid rgba(192, 42, 42, 0.3); border-radius: 10px; padding: 14px 20px; margin-bottom: 20px; color: #c02a2a; font-weight: 700; font-size: 14px; text-align: left;"></div>
                    
                    <div class="sp-wa-notice-box" style="text-align: left;">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                        <div>
                            <strong>Document Attachment Notice:</strong> Browser security restricts web links from automatically attaching files to WhatsApp. When you click <em>"Review Application"</em> and then <em>"Continue on WhatsApp"</em>, WhatsApp will open with your complete application text. You will then manually attach your photograph and certificates directly in WhatsApp to complete submission.
                        </div>
                    </div>

                    <button type="submit" id="spReviewAppBtn" class="sp-submit-review-btn">
                        <i class="fa fa-check-circle" aria-hidden="true"></i> Review Application
                    </button>
                </div>

            </form>

        </div>
    </main>

    <!-- REVIEW APPLICATION MODAL -->
    <div id="spReviewModal" class="sp-review-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="spReviewTitle">
        <div class="sp-review-backdrop" id="spReviewBackdrop"></div>
        <div class="sp-review-dialog">
            <div class="sp-review-header">
                <h3 class="sp-review-title" id="spReviewTitle">Review Your Application</h3>
                <button type="button" class="sp-review-close-btn" id="spReviewCloseBtn" aria-label="Close review dialog">&times;</button>
            </div>
            <div class="sp-review-body" id="spReviewBody">
                <!-- Dynamically populated by spouzy-modern.js -->
            </div>
            <div class="sp-review-footer">
                <div class="sp-review-actions-left">
                    <button type="button" class="sp-review-secondary-btn" id="spReviewEditBtn">
                        <i class="fa fa-arrow-left"></i> Edit Details
                    </button>
                    <button type="button" class="sp-review-secondary-btn" id="spCopyAppTextBtn">
                        <i class="fa fa-clone"></i> Copy Application Text
                    </button>
                </div>
                <div class="sp-review-actions-right">
                    <button type="button" class="sp-review-whatsapp-btn" id="spReviewWhatsappBtn">
                        <i class="fa fa-whatsapp"></i> Continue on WhatsApp ↗
                    </button>
                </div>
            </div>
        </div>
    </div>

    ${footerHtml}
</html>`;
}

// Generate join-doctor.htm
fs.writeFileSync('join-doctor.htm', generatePage('doctor'), 'utf8');
console.log('Successfully generated join-doctor.htm');

// Generate join-counsellor.htm
fs.writeFileSync('join-counsellor.htm', generatePage('counsellor'), 'utf8');
console.log('Successfully generated join-counsellor.htm');
