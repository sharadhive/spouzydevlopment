const fs = require('fs');

// 1. Update scratch/build_join_pages.js
let buildScript = fs.readFileSync('scratch/build_join_pages.js', 'utf8');

// Replace section4Html definition in scratch/build_join_pages.js
const oldSection4Pattern = `  // Section 4 Registration Fields
  const section4Html = isDoctor`;

const newSection4Code = `  // Section 4 Registration Fields
  const section4Html = isDoctor
    ? \`
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
    \`
    : \`
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
    \`;`;

// Find end of section4Html in build_join_pages.js
const sec4Start = buildScript.indexOf('  // Section 4 Registration Fields');
const sec4End = buildScript.indexOf('  return `<!doctype html><html lang="en">');

buildScript = buildScript.substring(0, sec4Start) + newSection4Code + '\n\n' + buildScript.substring(sec4End);
fs.writeFileSync('scratch/build_join_pages.js', buildScript, 'utf8');
console.log('Updated scratch/build_join_pages.js');
