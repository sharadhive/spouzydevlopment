const fs = require('fs');

let js = fs.readFileSync('js/spouzy-modern.js', 'utf8');

// 1. Add Careers to SPOUZY_SEARCH_INDEX if not already present
if (!js.includes("title: 'Careers at SPOUZY'")) {
  const counsellorTarget = `    {
      title: 'Join as a Counsellor',
      url: 'join-counsellor.htm',
      desc: 'Openings for licensed psychologists, marriage counsellors & dispute resolution mediators.',
      keywords: ['join as a counsellor', 'counsellor', 'therapist', 'psychologist', 'counselling careers', 'mediator', 'join team'],
      aliases: ['counsellor', 'join counsellor', 'therapist']
    },`;

  const careersEntries = `    {
      title: 'Join as a Counsellor',
      url: 'join-counsellor.htm',
      desc: 'Openings for licensed psychologists, marriage counsellors & dispute resolution mediators.',
      keywords: ['join as a counsellor', 'counsellor', 'therapist', 'psychologist', 'counselling careers', 'mediator', 'join team'],
      aliases: ['counsellor', 'join counsellor', 'therapist']
    },
    {
      title: 'Careers at SPOUZY',
      url: 'careers.htm',
      desc: 'Explore non-clinical career opportunities in sales coordination, digital marketing & performance marketing.',
      keywords: ['careers', 'careers at spouzy', 'jobs', 'hiring', 'work with us', 'openings', 'vacancies', 'employment'],
      aliases: ['careers', 'jobs', 'hiring']
    },
    {
      title: 'Careers: Sales Coordinator',
      url: 'careers.htm#role-sales-coordinator',
      desc: 'Sales & Client Coordination: coordinate incoming enquiries, client scheduling & consultation care.',
      keywords: ['sales coordinator', 'client coordination', 'sales', 'careers sales', 'front desk', 'client support'],
      aliases: ['sales coordinator', 'sales']
    },
    {
      title: 'Careers: Digital Marketing Executive',
      url: 'careers.htm#role-digital-marketing',
      desc: 'Marketing: educational social media, content creation, copywriting, basic SEO & community engagement.',
      keywords: ['digital marketing executive', 'digital marketing', 'content marketing', 'social media', 'marketing', 'copywriting', 'seo'],
      aliases: ['digital marketing', 'marketing']
    },
    {
      title: 'Careers: Performance Marketing Specialist',
      url: 'careers.htm#role-performance-marketing',
      desc: 'Growth & Paid Media: Google Ads, Meta Ads campaigns, conversion tracking, analytics & lead generation.',
      keywords: ['performance marketing specialist', 'performance marketing', 'paid ads', 'google ads', 'meta ads', 'growth', 'ppc'],
      aliases: ['performance marketing', 'google ads', 'paid marketing']
    },`;

  if (js.includes(counsellorTarget)) {
    js = js.replace(counsellorTarget, careersEntries);
    console.log('Added Careers entries to SPOUZY_SEARCH_INDEX.');
  } else {
    console.error('Could not find counsellorTarget in SPOUZY_SEARCH_INDEX.');
  }
}

// 2. Add initSpouzyCareersPage function before end
const careersFn = `
  /* ==========================================================================
     SPOUZY CAREERS PAGE CONTROLLER
     Manages role detail accordions, apply pre-selection, resume dropzone,
     inline validation, review modal, and WhatsApp application handoff.
     ========================================================================== */
  function initSpouzyCareersPage() {
    const pageContainer = document.querySelector('.spouzy-careers-page');
    if (!pageContainer) return;

    // 1. Expand / Collapse Role Detail Panels
    const roleToggleBtns = document.querySelectorAll('.sp-role-toggle-btn');
    roleToggleBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const targetId = this.getAttribute('aria-controls');
        const targetPanel = document.getElementById(targetId);
        if (!targetPanel) return;

        const isExpanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', String(!isExpanded));
        targetPanel.hidden = isExpanded;

        const labelSpan = this.querySelector('.sp-toggle-text');
        if (labelSpan) {
          labelSpan.textContent = isExpanded ? 'View Role Details' : 'Hide Role Details';
        }
      });
    });

    // 2. "Apply Now" Card Buttons -> Preselect Dropdown, Scroll, and Focus
    const roleSelect = document.getElementById('spCareerRole');
    const formSection = document.getElementById('spCareersFormContainer');
    const applyBtns = document.querySelectorAll('.sp-role-apply-btn');

    applyBtns.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const roleToSelect = this.getAttribute('data-role-select');
        if (roleSelect && roleToSelect) {
          roleSelect.value = roleToSelect;
        }

        if (formSection) {
          formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        setTimeout(() => {
          if (roleSelect) {
            roleSelect.focus();
          }
        }, 400);
      });
    });

    // 3. WhatsApp "Same as Mobile" Synchronization
    const mobileInput = document.getElementById('spCareerMobile');
    const whatsappInput = document.getElementById('spCareerWhatsapp');
    const sameAsMobileCheck = document.getElementById('spCareerSameAsMobile');

    function syncWhatsapp() {
      if (sameAsMobileCheck && sameAsMobileCheck.checked && mobileInput && whatsappInput) {
        whatsappInput.value = mobileInput.value;
      }
    }

    if (sameAsMobileCheck && mobileInput && whatsappInput) {
      sameAsMobileCheck.addEventListener('change', function () {
        if (this.checked) {
          whatsappInput.value = mobileInput.value;
          whatsappInput.readOnly = true;
          whatsappInput.classList.add('is-synced');
        } else {
          whatsappInput.readOnly = false;
          whatsappInput.classList.remove('is-synced');
        }
      });
      mobileInput.addEventListener('input', syncWhatsapp);
    }

    // 4. In-Memory Resume File Uploader (PDF, DOC, DOCX up to 10 MB)
    let attachedResume = null;
    const maxResumeBytes = 10 * 1024 * 1024; // 10 MB
    const allowedExts = ['.pdf', '.doc', '.docx'];

    const resumeDropzone = document.getElementById('spResumeDropzone');
    const resumeInput = document.getElementById('spResumeInput');
    const resumePreview = document.getElementById('spResumePreviewCard');
    const resumeError = document.getElementById('spResumeError');

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function setResumeError(msg) {
      if (resumeError) {
        if (msg) {
          resumeError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
          resumeError.style.display = 'block';
        } else {
          resumeError.style.display = 'none';
          resumeError.innerHTML = '';
        }
      }
    }

    function renderResumePreview(file) {
      if (!file) {
        if (resumeDropzone) resumeDropzone.style.display = 'block';
        if (resumePreview) resumePreview.style.display = 'none';
        attachedResume = null;
        setResumeError('');
        return;
      }

      attachedResume = file;
      if (resumeDropzone) resumeDropzone.style.display = 'none';
      if (resumePreview) resumePreview.style.display = 'flex';
      setResumeError('');

      const nameEl = resumePreview.querySelector('.sp-file-name');
      const sizeEl = resumePreview.querySelector('.sp-file-size');
      const iconEl = resumePreview.querySelector('.sp-file-thumb');

      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = formatBytes(file.size);
      if (iconEl) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (ext === '.pdf') {
          iconEl.innerHTML = '<i class="fa fa-file-pdf-o" style="color: #c02a2a; font-size: 24px;" aria-hidden="true"></i>';
        } else {
          iconEl.innerHTML = '<i class="fa fa-file-word-o" style="color: #2b579a; font-size: 24px;" aria-hidden="true"></i>';
        }
      }
    }

    if (resumeDropzone && resumeInput) {
      resumeDropzone.addEventListener('click', () => resumeInput.click());
      resumeDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resumeInput.click();
        }
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        resumeDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          resumeDropzone.classList.add('is-dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        resumeDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          resumeDropzone.classList.remove('is-dragover');
        });
      });

      resumeDropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) {
          handleResumeFile(files[0]);
        }
      });

      resumeInput.addEventListener('change', function () {
        if (this.files && this.files.length) {
          handleResumeFile(this.files[0]);
        }
      });
    }

    function handleResumeFile(file) {
      if (!file) return;
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) {
        setResumeError('Unsupported file format (' + ext + '). Please attach a PDF, DOC, or DOCX document.');
        if (resumeInput) resumeInput.value = '';
        return;
      }
      if (file.size > maxResumeBytes) {
        setResumeError('Resume file exceeds maximum size limit of 10 MB (Selected: ' + formatBytes(file.size) + ').');
        if (resumeInput) resumeInput.value = '';
        return;
      }
      setResumeError('');
      renderResumePreview(file);
    }

    // Replace and Remove buttons
    const replaceResumeBtn = document.getElementById('spReplaceResumeBtn');
    const removeResumeBtn = document.getElementById('spRemoveResumeBtn');

    if (replaceResumeBtn && resumeInput) {
      replaceResumeBtn.addEventListener('click', () => resumeInput.click());
    }

    if (removeResumeBtn) {
      removeResumeBtn.addEventListener('click', () => {
        if (resumeInput) resumeInput.value = '';
        renderResumePreview(null);
      });
    }

    // 5. Careers Form Submission & Review Modal
    const form = document.getElementById('spCareersForm');
    const formError = document.getElementById('spCareerFormError');
    const reviewModal = document.getElementById('spCareerReviewModal');
    const reviewContent = document.getElementById('spCareerReviewContent');
    const reviewCloseBtn = document.getElementById('spCareerReviewCloseBtn');
    const reviewEditBtn = document.getElementById('spCareerReviewEditBtn');
    const reviewWhatsappBtn = document.getElementById('spCareerReviewWhatsappBtn');
    const copyAppTextBtn = document.getElementById('spCareerCopyTextBtn');

    let preparedWhatsAppMsg = '';

    function showFormError(msg) {
      if (formError) {
        formError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        formError.style.display = 'block';
        formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }

    function closeReviewModal() {
      if (reviewModal) reviewModal.style.display = 'none';
    }

    if (reviewCloseBtn) reviewCloseBtn.addEventListener('click', closeReviewModal);
    if (reviewEditBtn) reviewEditBtn.addEventListener('click', closeReviewModal);

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (formError) formError.style.display = 'none';

        // Read fields
        const role = roleSelect ? roleSelect.value.trim() : '';
        const fullName = (document.getElementById('spCareerFullName')?.value || '').trim();
        const email = (document.getElementById('spCareerEmail')?.value || '').trim();
        const mobileCode = document.getElementById('spCareerMobileCode')?.value || '+91';
        const mobile = (document.getElementById('spCareerMobile')?.value || '').trim();
        const waCode = document.getElementById('spCareerWaCode')?.value || '+91';
        const whatsapp = (document.getElementById('spCareerWhatsapp')?.value || '').trim();
        const city = (document.getElementById('spCareerCity')?.value || '').trim();
        const exp = (document.getElementById('spCareerExp')?.value || '').trim();
        const currentRole = (document.getElementById('spCareerCurrentRole')?.value || '').trim();
        const skills = (document.getElementById('spCareerSkills')?.value || '').trim();
        const highestQual = (document.getElementById('spCareerHighestQual')?.value || '').trim();
        const portfolio = (document.getElementById('spCareerPortfolio')?.value || '').trim();
        const notice = (document.getElementById('spCareerNotice')?.value || '').trim();
        const expectedComp = (document.getElementById('spCareerExpectedComp')?.value || '').trim();
        const why = (document.getElementById('spCareerWhy')?.value || '').trim();
        const consentCheck = document.getElementById('spCareerConsent');

        // Validations
        if (!role) {
          showFormError('Please select the position you are applying for.');
          if (roleSelect) roleSelect.focus();
          return;
        }
        if (!fullName) {
          showFormError('Please provide your full legal name.');
          document.getElementById('spCareerFullName')?.focus();
          return;
        }
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          showFormError('Please provide a valid email address.');
          document.getElementById('spCareerEmail')?.focus();
          return;
        }
        const cleanMobile = mobile.replace(/[^0-9]/g, '');
        if (!cleanMobile || cleanMobile.length < 8) {
          showFormError('Please provide a valid mobile number (at least 8 digits).');
          document.getElementById('spCareerMobile')?.focus();
          return;
        }
        const cleanWa = whatsapp.replace(/[^0-9]/g, '');
        if (!cleanWa || cleanWa.length < 8) {
          showFormError('Please provide a valid WhatsApp number (at least 8 digits).');
          document.getElementById('spCareerWhatsapp')?.focus();
          return;
        }
        if (!city) {
          showFormError('Please provide your current city.');
          document.getElementById('spCareerCity')?.focus();
          return;
        }
        if (!exp) {
          showFormError('Please select your total relevant experience.');
          document.getElementById('spCareerExp')?.focus();
          return;
        }
        if (!skills) {
          showFormError('Please describe your key skills and strengths.');
          document.getElementById('spCareerSkills')?.focus();
          return;
        }
        if (!notice) {
          showFormError('Please select your notice period or availability.');
          document.getElementById('spCareerNotice')?.focus();
          return;
        }
        if (!why || why.length < 20) {
          showFormError('Please share a brief note on why you would like to join SPOUZY (minimum 20 characters).');
          document.getElementById('spCareerWhy')?.focus();
          return;
        }
        if (!attachedResume) {
          showFormError('Please attach your resume document (PDF, DOC, or DOCX, up to 10 MB).');
          if (resumeDropzone) resumeDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (!consentCheck || !consentCheck.checked) {
          showFormError('Please read and confirm the privacy policy and information accuracy declaration.');
          if (consentCheck) consentCheck.focus();
          return;
        }

        const fullMobile = mobileCode + ' ' + cleanMobile;
        const fullWa = waCode + ' ' + cleanWa;

        // Render Review Content
        if (reviewContent) {
          reviewContent.innerHTML = \`
            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">Position Applied For</h4>
              <div class="sp-review-role-badge"><strong>\${role}</strong></div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">1. Personal & Contact Information</h4>
              <div class="sp-review-grid">
                <span class="sp-review-key">Full Name:</span><span class="sp-review-val"><strong>\${fullName}</strong></span>
                <span class="sp-review-key">Email:</span><span class="sp-review-val">\${email}</span>
                <span class="sp-review-key">Mobile Number:</span><span class="sp-review-val">\${fullMobile}</span>
                <span class="sp-review-key">WhatsApp Number:</span><span class="sp-review-val">\${fullWa}</span>
                <span class="sp-review-key">Current City:</span><span class="sp-review-val">\${city}</span>
              </div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">2. Professional Background</h4>
              <div class="sp-review-grid">
                <span class="sp-review-key">Total Experience:</span><span class="sp-review-val"><strong>\${exp}</strong></span>
                <span class="sp-review-key">Current / Last Role:</span><span class="sp-review-val">\${currentRole || 'Not specified'}</span>
                <span class="sp-review-key">Highest Qualification:</span><span class="sp-review-val">\${highestQual || 'Not specified'}</span>
                <span class="sp-review-key">Key Skills:</span><span class="sp-review-val">\${skills}</span>
                <span class="sp-review-key">Portfolio / LinkedIn:</span><span class="sp-review-val">\${portfolio ? '<a href=\"' + portfolio + '\" target=\"_blank\" rel=\"noopener\">' + portfolio + ' ↗</a>' : 'Not provided'}</span>
                <span class="sp-review-key">Notice Period:</span><span class="sp-review-val">\${notice}</span>
                <span class="sp-review-key">Expected Compensation:</span><span class="sp-review-val">\${expectedComp || 'Discussed during selection process'}</span>
              </div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">3. Statement of Purpose</h4>
              <div class="sp-review-text-block">\${why}</div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">4. Attached Resume</h4>
              <div class="sp-review-grid">
                <span class="sp-review-key">Resume File:</span><span class="sp-review-val"><strong>\${attachedResume.name}</strong> (\${formatBytes(attachedResume.size)})</span>
              </div>
            </div>

            <div class="sp-wa-notice-box">
              <i class="fa fa-info-circle"></i>
              <div>
                <strong>Important WhatsApp Document Notice:</strong> Your application details will open in WhatsApp. A WhatsApp link cannot attach a selected file automatically. <strong>Please attach your resume (\${attachedResume.name}) manually in WhatsApp</strong> before sending your message to SPOUZY (+91 85919 45055).
              </div>
            </div>
          \`;
        }

        // Build WhatsApp Message Text
        const msgLines = [
          'SPOUZY Careers Application — ' + role,
          '',
          '1. CANDIDATE DETAILS',
          'Full Name: ' + fullName,
          'Email ID: ' + email,
          'Mobile: ' + fullMobile,
          'WhatsApp: ' + fullWa,
          'Current City: ' + city,
          '',
          '2. PROFESSIONAL SUMMARY',
          'Role Applied For: ' + role,
          'Total Relevant Experience: ' + exp,
          'Current / Most Recent Role: ' + (currentRole || 'Not specified'),
          'Highest Qualification: ' + (highestQual || 'Not specified'),
          'Key Skills & Strengths: ' + skills,
          portfolio ? 'Portfolio / LinkedIn: ' + portfolio : '',
          'Notice Period / Availability: ' + notice,
          'Expected Compensation: ' + (expectedComp || 'Discussed during selection process'),
          '',
          '3. WHY I WANT TO JOIN SPOUZY',
          why,
          '',
          '4. RESUME ATTACHMENT',
          'Selected File: ' + attachedResume.name + ' (' + formatBytes(attachedResume.size) + ')',
          '',
          'Applicant Note: I have confirmed my details above and will now attach my resume (' + attachedResume.name + ') manually in this chat.'
        ].filter(line => line !== '');

        preparedWhatsAppMsg = msgLines.join('\\n');

        // Open Modal
        if (reviewModal) {
          reviewModal.style.display = 'flex';
          reviewModal.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    // Continue on WhatsApp button
    if (reviewWhatsappBtn) {
      reviewWhatsappBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMsg) return;
        const encoded = encodeURIComponent(preparedWhatsAppMsg);
        const waUrl = 'https://wa.me/918591945055?text=' + encoded;
        try {
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {}
      });
    }

    // Copy Application Text Fallback
    if (copyAppTextBtn) {
      copyAppTextBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMsg) return;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(preparedWhatsAppMsg).then(() => {
            const originalText = copyAppTextBtn.innerHTML;
            copyAppTextBtn.innerHTML = '<i class="fa fa-check"></i> Copied to Clipboard!';
            setTimeout(() => { copyAppTextBtn.innerHTML = originalText; }, 2500);
          });
        } else {
          alert('Clipboard access unavailable. Please copy the text from WhatsApp.');
        }
      });
    }
  }
`;

// Insert initSpouzyCareersPage and invoke it
if (!js.includes('function initSpouzyCareersPage')) {
  // Add before initSpouzyJoinForm() call at the bottom
  const joinCall = 'initSpouzyJoinForm();';
  if (js.includes(joinCall)) {
    js = js.replace(joinCall, careersFn + '\n  initSpouzyCareersPage();\n  initSpouzyJoinForm();');
    console.log('Appended initSpouzyCareersPage() and invocation to js/spouzy-modern.js.');
  } else {
    console.error('Could not find initSpouzyJoinForm() invocation.');
  }
}

fs.writeFileSync('js/spouzy-modern.js', js, 'utf8');
console.log('Updated js/spouzy-modern.js successfully.');
