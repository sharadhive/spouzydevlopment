const fs = require('fs');

const path = 'js/spouzy-modern.js';
let js = fs.readFileSync(path, 'utf8');

const engineCode = `
  // =========================================================================
  // 19. DOCTOR & COUNSELLOR REGISTRATION ENGINE (join-doctor.htm & join-counsellor.htm)
  // =========================================================================
  function initSpouzyJoinForm() {
    const form = document.getElementById('spJoinAppForm');
    if (!form) return;

    const role = form.getAttribute('data-role') || 'doctor';
    const isDoctor = role === 'doctor';

    // File storage cache (in-memory for previews and checklist only, not in localStorage)
    const attachedFiles = {
      photo: null,
      primaryCert: null,
      pgCert: null,
      additionalCerts: {}
    };

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // -------------------------------------------------------------------------
    // 1. WhatsApp Number "Same as Mobile" Synchronization
    // -------------------------------------------------------------------------
    const mobileInput = document.getElementById('spMobile');
    const whatsappInput = document.getElementById('spWhatsapp');
    const sameAsMobileCheck = document.getElementById('spSameAsMobile');

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

    // -------------------------------------------------------------------------
    // 2. Generic File Dropzone & Preview Handler
    // -------------------------------------------------------------------------
    function setupFileUploader(dropzoneId, inputId, previewCardId, fileKey, maxBytes, allowedExtensions) {
      const dropzone = document.getElementById(dropzoneId);
      const fileInput = document.getElementById(inputId);
      const previewCard = document.getElementById(previewCardId);
      if (!dropzone || !fileInput || !previewCard) return;

      function renderPreview(file) {
        if (!file) {
          dropzone.style.display = 'block';
          previewCard.style.display = 'none';
          attachedFiles[fileKey] = null;
          return;
        }

        attachedFiles[fileKey] = file;
        dropzone.style.display = 'none';
        previewCard.style.display = 'flex';

        const nameEl = previewCard.querySelector('.sp-file-name');
        const sizeEl = previewCard.querySelector('.sp-file-size');
        const thumbEl = previewCard.querySelector('.sp-file-thumb');

        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = formatBytes(file.size);

        if (thumbEl) {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
              thumbEl.innerHTML = '<img src="' + e.target.result + '" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';
            };
            reader.readAsDataURL(file);
          } else {
            thumbEl.innerHTML = '<i class="fa fa-file-pdf-o" style="color: #c02a2a;"></i>';
          }
        }
      }

      fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          const file = this.files[0];
          const ext = '.' + file.name.split('.').pop().toLowerCase();
          if (!allowedExtensions.includes(ext)) {
            alert('Unsupported file format. Please upload ' + allowedExtensions.join(', '));
            this.value = '';
            return;
          }
          if (file.size > maxBytes) {
            alert('File exceeds the maximum allowed size of ' + formatBytes(maxBytes));
            this.value = '';
            return;
          }
          renderPreview(file);
        }
      });

      // Drag and drop events
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.remove('is-dragover');
        });
      });
      dropzone.addEventListener('drop', e => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // Actions inside preview card (Replace & Remove)
      const replaceBtn = previewCard.querySelector('.is-replace');
      const removeBtn = previewCard.querySelector('.is-remove');

      if (replaceBtn) {
        replaceBtn.addEventListener('click', () => fileInput.click());
      }
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          fileInput.value = '';
          renderPreview(null);
        });
      }
    }

    // Photo: max 5MB (JPG, PNG, WebP)
    setupFileUploader('spPhotoDropzone', 'spPhotoInput', 'spPhotoPreview', 'photo', 5 * 1024 * 1024, ['.jpg', '.jpeg', '.png', '.webp']);
    // Primary Cert: max 10MB (PDF, JPG, PNG)
    setupFileUploader('spPrimaryCertDropzone', 'spPrimaryCertInput', 'spPrimaryCertPreview', 'primaryCert', 10 * 1024 * 1024, ['.pdf', '.jpg', '.jpeg', '.png']);
    // PG Cert: max 10MB
    setupFileUploader('spPgCertDropzone', 'spPgCertInput', 'spPgCertPreview', 'pgCert', 10 * 1024 * 1024, ['.pdf', '.jpg', '.jpeg', '.png']);

    // -------------------------------------------------------------------------
    // 3. "Other" Qualification Textfield Toggles
    // -------------------------------------------------------------------------
    const primaryQualSelect = document.getElementById('spPrimaryQual');
    const primaryQualOtherWrap = document.getElementById('spPrimaryQualOtherWrap');
    if (primaryQualSelect && primaryQualOtherWrap) {
      primaryQualSelect.addEventListener('change', function () {
        if (this.value === 'Other') {
          primaryQualOtherWrap.style.display = 'block';
          const input = primaryQualOtherWrap.querySelector('input');
          if (input) input.required = true;
        } else {
          primaryQualOtherWrap.style.display = 'none';
          const input = primaryQualOtherWrap.querySelector('input');
          if (input) input.required = false;
        }
      });
    }

    // -------------------------------------------------------------------------
    // 4. Dynamic Additional Qualifications Repeater
    // -------------------------------------------------------------------------
    const addQualBtn = document.getElementById('spAddQualBtn');
    const additionalQualsContainer = document.getElementById('spAdditionalQualsContainer');
    let qualCount = 0;

    if (addQualBtn && additionalQualsContainer) {
      addQualBtn.addEventListener('click', function () {
        qualCount++;
        const qualIndex = qualCount;
        const card = document.createElement('div');
        card.className = 'sp-qual-card';
        card.setAttribute('data-qual-id', qualIndex);

        card.innerHTML = \`
          <div class="sp-qual-header">
            <span class="sp-qual-title"><i class="fa fa-graduation-cap"></i> Additional Qualification #\${qualIndex}</span>
            <button type="button" class="sp-remove-qual-btn" aria-label="Remove this qualification"><i class="fa fa-times"></i> Remove</button>
          </div>
          <div class="sp-form-row-2col">
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">Degree / Certification Title <span class="sp-req">*</span></label>
              <input type="text" name="additionalDegree_\${qualIndex}" class="sp-form-input-modern sp-add-degree" placeholder="e.g. Diploma in Psychosexual Medicine" required>
            </div>
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">College / Institute / University <span class="sp-req">*</span></label>
              <input type="text" name="additionalCollege_\${qualIndex}" class="sp-form-input-modern sp-add-college" placeholder="e.g. King Edward Memorial Hospital" required>
            </div>
          </div>
          <div class="sp-form-row-2col">
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">Completion Year <span class="sp-req">*</span></label>
              <input type="number" min="1960" max="2026" name="additionalYear_\${qualIndex}" class="sp-form-input-modern sp-add-year" placeholder="YYYY" required>
            </div>
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">Marks / Grade / Honors</label>
              <input type="text" name="additionalGrade_\${qualIndex}" class="sp-form-input-modern sp-add-grade" placeholder="e.g. Distinction / Grade A">
            </div>
          </div>
          <div class="sp-form-group-modern" style="margin-bottom: 0;">
            <label class="sp-form-label-modern">Certificate Attachment <span class="sp-opt">(PDF, JPG, PNG up to 10 MB)</span></label>
            <div class="sp-file-dropzone" id="spAddCertDropzone_\${qualIndex}">
              <input type="file" id="spAddCertInput_\${qualIndex}" class="sp-file-hidden-input" accept=".pdf,.jpg,.jpeg,.png">
              <div class="sp-file-dropzone-icon"><i class="fa fa-cloud-upload"></i></div>
              <div class="sp-file-dropzone-text">Click or drag certificate here</div>
              <div class="sp-file-dropzone-hint">PDF, JPG, or PNG (Max 10 MB)</div>
            </div>
            <div class="sp-file-preview-card" id="spAddCertPreview_\${qualIndex}" style="display: none;">
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
        \`;

        additionalQualsContainer.appendChild(card);

        // Setup dropzone for this dynamic qualification
        setupFileUploader(
          'spAddCertDropzone_' + qualIndex,
          'spAddCertInput_' + qualIndex,
          'spAddCertPreview_' + qualIndex,
          'addCert_' + qualIndex,
          10 * 1024 * 1024,
          ['.pdf', '.jpg', '.jpeg', '.png']
        );

        // Remove listener
        const removeBtn = card.querySelector('.sp-remove-qual-btn');
        removeBtn.addEventListener('click', function () {
          delete attachedFiles['addCert_' + qualIndex];
          card.remove();
        });
      });
    }

    // -------------------------------------------------------------------------
    // 5. Counsellor "Not Applicable" Registration Toggle
    // -------------------------------------------------------------------------
    const naRegCheck = document.getElementById('spNaRegCheck');
    const councilSelect = document.getElementById('spCouncilSelect');
    const regNumInput = document.getElementById('spRegNum');
    const regStateInput = document.getElementById('spRegState');
    const regYearInput = document.getElementById('spRegYear');
    const regValidInput = document.getElementById('spRegValid');

    if (naRegCheck) {
      naRegCheck.addEventListener('change', function () {
        const isNA = this.checked;
        if (regNumInput) {
          regNumInput.required = !isNA;
          regNumInput.disabled = isNA;
          if (isNA) regNumInput.value = 'Not Applicable';
          else regNumInput.value = '';
        }
        if (councilSelect) councilSelect.disabled = isNA;
        if (regStateInput) regStateInput.disabled = isNA;
        if (regYearInput) regYearInput.disabled = isNA;
        if (regValidInput) regValidInput.disabled = isNA;
      });
    }

    // -------------------------------------------------------------------------
    // 6. Interactive Signature Canvas Pad
    // -------------------------------------------------------------------------
    const sigCanvas = document.getElementById('spSigCanvas');
    const clearSigBtn = document.getElementById('spClearSigBtn');
    let isDrawing = false;
    let hasDrawnSignature = false;

    if (sigCanvas) {
      const ctx = sigCanvas.getContext('2d');
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4B2030';

      function resizeCanvas() {
        const rect = sigCanvas.getBoundingClientRect();
        sigCanvas.width = rect.width;
        sigCanvas.height = rect.height;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#4B2030';
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      function getPos(e) {
        const rect = sigCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      }

      function startDraw(e) {
        isDrawing = true;
        hasDrawnSignature = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }

      function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }

      function stopDraw() {
        isDrawing = false;
      }

      sigCanvas.addEventListener('mousedown', startDraw);
      sigCanvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', stopDraw);

      sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
      sigCanvas.addEventListener('touchmove', draw, { passive: false });
      sigCanvas.addEventListener('touchend', stopDraw);

      if (clearSigBtn) {
        clearSigBtn.addEventListener('click', function () {
          ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
          hasDrawnSignature = false;
        });
      }
    }

    // -------------------------------------------------------------------------
    // 7. Time Range Validation (Preferred Timings)
    // -------------------------------------------------------------------------
    const timeFrom = document.getElementById('spTimeFrom');
    const timeTo = document.getElementById('spTimeTo');
    const timeError = document.getElementById('spTimeRangeError');

    function validateTimes() {
      if (!timeFrom || !timeTo || !timeFrom.value || !timeTo.value) {
        if (timeError) timeError.style.display = 'none';
        return true;
      }
      const [h1, m1] = timeFrom.value.split(':').map(Number);
      const [h2, m2] = timeTo.value.split(':').map(Number);
      const t1 = h1 * 60 + m1;
      const t2 = h2 * 60 + m2;
      if (t2 <= t1) {
        if (timeError) {
          timeError.textContent = 'Preferred \"To Time\" must be later than \"From Time\".';
          timeError.style.display = 'block';
        }
        return false;
      }
      if (timeError) timeError.style.display = 'none';
      return true;
    }

    if (timeFrom) timeFrom.addEventListener('change', validateTimes);
    if (timeTo) timeTo.addEventListener('change', validateTimes);

    // -------------------------------------------------------------------------
    // 8. Application Review Modal & Submission Handler
    // -------------------------------------------------------------------------
    const reviewModal = document.getElementById('spReviewModal');
    const reviewCloseBtn = document.getElementById('spReviewCloseBtn');
    const reviewEditBtn = document.getElementById('spReviewEditBtn');
    const reviewWhatsappBtn = document.getElementById('spReviewWhatsappBtn');
    const copyAppTextBtn = document.getElementById('spCopyAppTextBtn');
    const validationError = document.getElementById('spFormValidationError');

    function closeReview() {
      if (reviewModal) reviewModal.style.display = 'none';
    }

    if (reviewCloseBtn) reviewCloseBtn.addEventListener('click', closeReview);
    if (reviewEditBtn) reviewEditBtn.addEventListener('click', closeReview);

    let preparedWhatsAppMessage = '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (validationError) validationError.style.display = 'none';

      // 1. Validate Time Range
      if (!validateTimes()) {
        showError('Please check your preferred working hours. \"To Time\" must be later than \"From Time\".');
        if (timeTo) timeTo.focus();
        return;
      }

      // 2. Validate Required Photo
      if (!attachedFiles.photo) {
        showError('Please attach a recent colour photograph.');
        const drop = document.getElementById('spPhotoDropzone');
        if (drop) drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // 3. Validate Primary Marksheet / Certificate
      if (!attachedFiles.primaryCert) {
        showError('Please attach your Primary Qualification marksheet or certificate.');
        const drop = document.getElementById('spPrimaryCertDropzone');
        if (drop) drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // 4. Validate Declaration Checkbox
      const declarationCheck = document.getElementById('spDeclarationCheck');
      if (!declarationCheck || !declarationCheck.checked) {
        showError('Please read and accept the declaration by checking the declaration box.');
        if (declarationCheck) declarationCheck.focus();
        return;
      }

      // 5. Validate Typed Signature
      const typedSigInput = document.getElementById('spTypedSignature');
      if (!typedSigInput || !typedSigInput.value.trim()) {
        showError('Please provide your typed signature.');
        if (typedSigInput) typedSigInput.focus();
        return;
      }

      // Gather Form Data
      const title = document.getElementById('spTitle')?.value || '';
      const firstName = document.getElementById('spFirstName')?.value.trim() || '';
      const lastName = document.getElementById('spLastName')?.value.trim() || '';
      const fullName = (title ? title + ' ' : '') + firstName + ' ' + lastName;
      const gender = document.getElementById('spGender')?.value || '';
      const dob = document.getElementById('spDob')?.value || '';
      const mobile = document.getElementById('spMobile')?.value.trim() || '';
      const whatsapp = document.getElementById('spWhatsapp')?.value.trim() || '';
      const email = document.getElementById('spEmail')?.value.trim() || '';

      const practiceStatus = document.getElementById('spPracticeStatus')?.value || '';
      const experienceYears = document.getElementById('spExperienceYears')?.value || '';
      const institutionName = document.getElementById('spInstitutionName')?.value.trim() || '';
      const affiliations = document.getElementById('spAffiliations')?.value.trim() || 'None';
      const specialisation = document.getElementById('spSpecialisation')?.value.trim() || '';
      const objective = document.getElementById('spObjective')?.value.trim() || '';

      let primaryQual = primaryQualSelect?.value || '';
      if (primaryQual === 'Other') {
        const otherVal = document.getElementById('spPrimaryQualOther')?.value.trim();
        if (otherVal) primaryQual = 'Other: ' + otherVal;
      }
      const primaryCollege = document.getElementById('spPrimaryCollege')?.value.trim() || '';
      const primaryYear = document.getElementById('spPrimaryYear')?.value.trim() || '';
      const primaryGrade = document.getElementById('spPrimaryGrade')?.value.trim() || '';

      const pgQual = document.getElementById('spPgQual')?.value || '';
      const pgCollege = document.getElementById('spPgCollege')?.value.trim() || '';
      const pgYear = document.getElementById('spPgYear')?.value.trim() || '';
      const pgGrade = document.getElementById('spPgGrade')?.value.trim() || '';

      // Additional qualifications
      const addCards = additionalQualsContainer ? additionalQualsContainer.querySelectorAll('.sp-qual-card') : [];
      const additionalQualsList = [];
      addCards.forEach(c => {
        const deg = c.querySelector('.sp-add-degree')?.value.trim() || '';
        const col = c.querySelector('.sp-add-college')?.value.trim() || '';
        const yr = c.querySelector('.sp-add-year')?.value.trim() || '';
        const grd = c.querySelector('.sp-add-grade')?.value.trim() || '';
        const qId = c.getAttribute('data-qual-id');
        const certFile = attachedFiles['addCert_' + qId];
        if (deg && col) {
          additionalQualsList.push({
            degree: deg, college: col, year: yr, grade: grd, fileName: certFile ? certFile.name : 'Not attached'
          });
        }
      });

      const isNA = naRegCheck ? naRegCheck.checked : false;
      const council = isNA ? 'Not Applicable (Independent Certified)' : (councilSelect?.value || 'N/A');
      const regNum = isNA ? 'Not Applicable' : (regNumInput?.value.trim() || 'N/A');
      const regState = isNA ? 'N/A' : (regStateInput?.value || 'N/A');
      const regYear = isNA ? 'N/A' : (regYearInput?.value.trim() || 'N/A');
      const regValid = isNA ? 'N/A' : (regValidInput?.value.trim() || 'N/A');

      const workMode = document.getElementById('spWorkMode')?.value || 'Both';
      const fromTime = timeFrom?.value || '';
      const toTime = timeTo?.value || '';
      const timingSummary = (fromTime && toTime) ? fromTime + ' to ' + toTime + ' IST' : 'Flexible';

      const declDate = document.getElementById('spDeclDate')?.value || new Date().toISOString().split('T')[0];
      const typedSig = typedSigInput.value.trim();

      // Compile Documents Checklist
      const docList = [];
      if (attachedFiles.photo) docList.push('1. Photograph: ' + attachedFiles.photo.name + ' (' + formatBytes(attachedFiles.photo.size) + ')');
      if (attachedFiles.primaryCert) docList.push('2. Primary Qualification Marksheet/Cert: ' + attachedFiles.primaryCert.name + ' (' + formatBytes(attachedFiles.primaryCert.size) + ')');
      if (attachedFiles.pgCert) docList.push('3. Postgraduate Cert: ' + attachedFiles.pgCert.name + ' (' + formatBytes(attachedFiles.pgCert.size) + ')');
      additionalQualsList.forEach((q, idx) => {
        docList.push((4 + idx) + '. Additional Cert (' + q.degree + '): ' + q.fileName);
      });
      if (hasDrawnSignature) {
        docList.push('Digital Drawing Pad Signature: Included');
      }

      // Populate Review Modal Content
      const reviewBody = document.getElementById('spReviewBody');
      if (reviewBody) {
        reviewBody.innerHTML = \`
          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">Application Role</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Role:</span>
              <span class="sp-review-val"><strong>\${isDoctor ? 'Doctor (Medical & Clinical Panel)' : 'Counsellor (Therapy & Advisory Panel)'}</strong></span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">1. Personal Details</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Full Name:</span><span class="sp-review-val">\${fullName}</span>
              <span class="sp-review-key">Gender / DOB:</span><span class="sp-review-val">\${gender} · \${dob}</span>
              <span class="sp-review-key">Mobile / WhatsApp:</span><span class="sp-review-val">\${mobile} / \${whatsapp}</span>
              <span class="sp-review-key">Email ID:</span><span class="sp-review-val">\${email}</span>
              <span class="sp-review-key">Photograph:</span><span class="sp-review-val">\${attachedFiles.photo ? attachedFiles.photo.name + ' (' + formatBytes(attachedFiles.photo.size) + ')' : 'None'}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">2. Professional Details</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Practice Status:</span><span class="sp-review-val">\${practiceStatus}</span>
              <span class="sp-review-key">Experience:</span><span class="sp-review-val">\${experienceYears}</span>
              <span class="sp-review-key">Current Institution:</span><span class="sp-review-val">\${institutionName}</span>
              <span class="sp-review-key">Affiliations:</span><span class="sp-review-val">\${affiliations}</span>
              <span class="sp-review-key">Specialisation:</span><span class="sp-review-val">\${specialisation}</span>
              <span class="sp-review-key">Objective:</span><span class="sp-review-val">\${objective || 'None'}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">3. Qualifications</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Primary:</span><span class="sp-review-val"><strong>\${primaryQual}</strong> (\${primaryYear}) · \${primaryCollege} · Marks/Grade: \${primaryGrade} · Attached: \${attachedFiles.primaryCert ? attachedFiles.primaryCert.name : 'No'}</span>
              \${pgQual && pgQual !== 'None' ? \`<span class="sp-review-key">Postgraduate:</span><span class="sp-review-val"><strong>\${pgQual}</strong> (\${pgYear}) · \${pgCollege} · Marks/Grade: \${pgGrade} · Attached: \${attachedFiles.pgCert ? attachedFiles.pgCert.name : 'No'}</span>\` : ''}
              \${additionalQualsList.map(q => \`<span class="sp-review-key">Additional:</span><span class="sp-review-val"><strong>\${q.degree}</strong> (\${q.year}) · \${q.college} · \${q.grade} · Attached: \${q.fileName}</span>\`).join('')}
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">4. \${isDoctor ? 'Medical Council Registration' : 'Professional Registration / Accreditation'}</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Council / Body:</span><span class="sp-review-val">\${council}</span>
              <span class="sp-review-key">Registration Number:</span><span class="sp-review-val">\${regNum}</span>
              <span class="sp-review-key">State & Year:</span><span class="sp-review-val">\${regState} · \${regYear}</span>
              <span class="sp-review-key">Valid Until:</span><span class="sp-review-val">\${regValid}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">5. Working Preferences</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Consultation Mode:</span><span class="sp-review-val">\${workMode}</span>
              <span class="sp-review-key">Preferred Hours:</span><span class="sp-review-val">\${timingSummary}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">6. Declaration & Verification</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Declaration:</span><span class="sp-review-val">Agreed & Confirmed</span>
              <span class="sp-review-key">Date:</span><span class="sp-review-val">\${declDate}</span>
              <span class="sp-review-key">Typed Signature:</span><span class="sp-review-val"><em>\${typedSig}</em></span>
              <span class="sp-review-key">Canvas Signature:</span><span class="sp-review-val">\${hasDrawnSignature ? 'Drawn signature recorded' : 'Not drawn (Typed signature provided)'}</span>
            </div>
          </div>

          <div class="sp-wa-notice-box">
            <i class="fa fa-info-circle"></i>
            <div>
              <strong>Important WhatsApp Document Notice:</strong> WhatsApp links cannot automatically transfer files from your web browser. After clicking <em>\"Continue on WhatsApp\"</em>, please review the text, tap <strong>Send</strong> in WhatsApp, and then <strong>manually attach your photograph and certificates</strong> in the chat with SPOUZY (+91 85919 45055).
            </div>
          </div>
        \`;
      }

      // Build WhatsApp message
      const msgLines = [
        '*** SPOUZY ' + (isDoctor ? 'DOCTOR' : 'COUNSELLOR') + ' EMPANELMENT APPLICATION ***',
        '',
        'APPLICATION ROLE: ' + (isDoctor ? 'Doctor (Medical & Clinical Panel)' : 'Counsellor (Therapy & Advisory Panel)'),
        '',
        '1. PERSONAL DETAILS',
        'Full Name: ' + fullName,
        'Gender: ' + gender,
        'Date of Birth: ' + dob,
        'Mobile Number: ' + mobile,
        'WhatsApp Number: ' + whatsapp,
        'Email ID: ' + email,
        '',
        '2. PROFESSIONAL DETAILS',
        'Current Practice Status: ' + practiceStatus,
        'Years of Experience: ' + experienceYears,
        'Current Institution / Practice: ' + institutionName,
        'Affiliations: ' + affiliations,
        'Specialisations: ' + specialisation,
        'Objective for Joining: ' + (objective || 'Not provided'),
        '',
        '3. QUALIFICATIONS',
        'Primary: ' + primaryQual + ' (' + primaryYear + ') from ' + primaryCollege + ' [Marks: ' + primaryGrade + ']',
        pgQual && pgQual !== 'None' ? 'Postgraduate: ' + pgQual + ' (' + pgYear + ') from ' + pgCollege + ' [Marks: ' + pgGrade + ']' : '',
        additionalQualsList.length ? 'Additional Credentials:\\n' + additionalQualsList.map(q => ' - ' + q.degree + ' (' + q.year + ') from ' + q.college).join('\\n') : '',
        '',
        '4. REGISTRATION DETAILS',
        'Council / Professional Body: ' + council,
        'Registration Number: ' + regNum,
        'State / Jurisdiction: ' + regState,
        'Registration Year: ' + regYear,
        'Valid Until: ' + regValid,
        '',
        '5. WORKING PREFERENCES',
        'Consultation Mode: ' + workMode,
        'Preferred Working Hours: ' + timingSummary,
        '',
        '6. CHECKLIST OF DOCUMENTS TO ATTACH IN THIS CHAT',
        docList.join('\\n'),
        '',
        '7. DECLARATION & SIGNATURE',
        '\"I hereby declare that all information submitted is true and complete to the best of my knowledge and professional record.\"',
        'Date: ' + declDate,
        'Typed Signature: ' + typedSig,
        hasDrawnSignature ? 'Canvas Signature: Drawn on web form' : '',
        '',
        'Applicant note: I will now attach my photograph and credential certificates in this chat for verification.'
      ].filter(l => l !== '');

      preparedWhatsAppMessage = msgLines.join('\\n');

      // Open Modal
      if (reviewModal) {
        reviewModal.style.display = 'flex';
        reviewModal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    function showError(msg) {
      if (validationError) {
        validationError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        validationError.style.display = 'block';
        validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }

    // Continue on WhatsApp button
    if (reviewWhatsappBtn) {
      reviewWhatsappBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMessage) return;
        const encoded = encodeURIComponent(preparedWhatsAppMessage);
        const waUrl = 'https://wa.me/918591945055?text=' + encoded;
        try {
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {}
      });
    }

    // Copy Application Text Fallback
    if (copyAppTextBtn) {
      copyAppTextBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMessage) return;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(preparedWhatsAppMessage).then(() => {
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

  // Auto-init on page load
  initSpouzyJoinForm();
`;

js += engineCode;
fs.writeFileSync(path, js, 'utf8');
console.log('Successfully appended Doctor & Counsellor registration engine to js/spouzy-modern.js');
