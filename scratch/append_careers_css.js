const fs = require('fs');

let css = fs.readFileSync('css/spouzy-modern.css', 'utf8');

if (!css.includes('.spouzy-careers-page')) {
  const careersStyles = `

/* ==========================================================================
   SPOUZY CAREERS PAGE STYLING
   Scoped under .spouzy-careers-page
   ========================================================================== */
.spouzy-careers-page {
  background-color: #FFFACD !important;
}

.sp-careers-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px 80px;
  width: 100%;
  box-sizing: border-box;
}

/* Introduction Section */
.sp-careers-intro-header {
  margin-bottom: 44px;
}

.sp-careers-breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.88rem;
  color: #65504B;
  margin-bottom: 14px;
}

.sp-careers-breadcrumbs a {
  color: #8A402F;
  text-decoration: none;
  transition: color 0.18s ease;
}

.sp-careers-breadcrumbs a:hover {
  text-decoration: underline;
}

.sp-careers-bc-sep {
  opacity: 0.5;
}

.sp-careers-main-title {
  font-family: var(--sp-font-serif, 'Playfair Display', Georgia, serif);
  font-size: clamp(2rem, 4.2vw, 2.75rem);
  font-weight: 700;
  color: #4B2030;
  line-height: 1.22;
  margin: 0 0 16px;
  letter-spacing: -0.02em;
}

.sp-careers-intro-desc {
  font-size: 1.05rem;
  line-height: 1.68;
  color: #3D2B2B;
  max-width: 820px;
  margin: 0 0 24px;
}

.sp-careers-view-openings-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 26px;
  background: #4B2030;
  color: #FFFFFF;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(75, 32, 48, 0.25);
  transition: all 0.25s ease;
}

.sp-careers-view-openings-btn:hover {
  background: #361521;
  color: #FFFFFF;
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(75, 32, 48, 0.35);
}

/* Current Openings Section */
.sp-careers-openings-section {
  margin-bottom: 56px;
}

.sp-careers-section-heading {
  font-family: var(--sp-font-serif, 'Playfair Display', Georgia, serif);
  font-size: 1.85rem;
  font-weight: 700;
  color: #4B2030;
  margin: 0 0 8px;
}

.sp-careers-section-sub {
  font-size: 0.95rem;
  color: #65504B;
  margin: 0 0 28px;
  line-height: 1.5;
}

.sp-job-card {
  background: #FFFCF7;
  border: 1px solid rgba(138, 64, 47, 0.2);
  border-radius: 18px;
  padding: 30px;
  margin-bottom: 24px;
  box-shadow: 0 6px 20px rgba(39, 18, 25, 0.04);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

.sp-job-card:hover {
  border-color: rgba(138, 64, 47, 0.38);
  box-shadow: 0 10px 28px rgba(39, 18, 25, 0.07);
}

.sp-job-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.sp-job-dept-badge {
  display: inline-block;
  background: #FFF4E6;
  color: #8A402F;
  border: 1px solid rgba(138, 64, 47, 0.25);
  border-radius: 9999px;
  padding: 4px 14px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sp-job-card-title {
  font-family: var(--sp-font-serif, 'Playfair Display', Georgia, serif);
  font-size: 1.5rem;
  font-weight: 700;
  color: #4B2030;
  margin: 0 0 8px;
  width: 100%;
}

.sp-job-card-summary {
  font-size: 1rem;
  color: #3D2B2B;
  line-height: 1.6;
  margin: 0 0 20px;
}

.sp-job-card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.sp-role-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  background: transparent;
  border: 1.5px solid #8A402F;
  color: #8A402F;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sp-role-toggle-btn:hover {
  background: rgba(138, 64, 47, 0.08);
}

.sp-role-toggle-btn .sp-chevron {
  transition: transform 0.25s ease;
  font-size: 0.85rem;
}

.sp-role-toggle-btn[aria-expanded="true"] .sp-chevron {
  transform: rotate(180deg);
}

.sp-role-apply-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  background: #8A402F;
  border: 1.5px solid #8A402F;
  color: #FFFFFF;
  border-radius: 9999px;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sp-role-apply-btn:hover {
  background: #6e2e20;
  border-color: #6e2e20;
  color: #FFFFFF;
  transform: translateY(-1px);
}

.sp-role-detail-panel {
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px dashed rgba(138, 64, 47, 0.24);
  animation: spRolePanelFadeIn 0.3s ease;
}

@keyframes spRolePanelFadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.sp-role-detail-panel[hidden] {
  display: none !important;
}

.sp-role-subheading {
  font-size: 1.05rem;
  font-weight: 700;
  color: #4B2030;
  margin: 18px 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp-role-subheading i {
  color: #8A402F;
  font-size: 0.95rem;
}

.sp-role-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
}

.sp-role-list li {
  position: relative;
  padding-left: 22px;
  margin-bottom: 8px;
  font-size: 0.93rem;
  color: #3D2B2B;
  line-height: 1.55;
}

.sp-role-list li::before {
  content: "•";
  position: absolute;
  left: 6px;
  top: 0;
  color: #8A402F;
  font-size: 1.2rem;
  line-height: 1.3;
}

.sp-role-terms-notice {
  background: #FFF9F2;
  border-left: 3.5px solid #8A402F;
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 0.88rem;
  color: #65504B;
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Recruitment Process Section */
.sp-recruitment-process-section {
  margin-bottom: 60px;
}

.sp-process-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
  margin-top: 24px;
}

.sp-process-card {
  background: #FFFCF7;
  border: 1px solid rgba(138, 64, 47, 0.18);
  border-radius: 16px;
  padding: 22px 20px;
  box-shadow: 0 4px 14px rgba(39, 18, 25, 0.03);
  display: flex;
  flex-direction: column;
}

.sp-process-step-num {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #4B2030;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 14px;
}

.sp-process-step-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #4B2030;
  margin: 0 0 8px;
}

.sp-process-step-desc {
  font-size: 0.88rem;
  color: #3D2B2B;
  line-height: 1.5;
  margin: 0;
}

/* Application Form Section */
.sp-careers-form-section {
  margin-bottom: 40px;
}

.sp-careers-form-card {
  background: #FFFCF7;
  border: 1px solid rgba(138, 64, 47, 0.22);
  border-radius: 20px;
  padding: 40px 36px;
  box-shadow: 0 8px 32px rgba(39, 18, 25, 0.06);
}

.sp-careers-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px 24px;
  margin-top: 26px;
}

.sp-career-col-span-2 {
  grid-column: span 2;
}

.sp-career-field-group {
  display: flex;
  flex-direction: column;
}

.sp-career-field-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #4B2030;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sp-career-field-label .sp-req-star {
  color: #c02a2a;
  margin-left: 2px;
}

.sp-career-field-label .sp-optional-tag {
  font-size: 0.78rem;
  color: #65504B;
  font-weight: normal;
}

.sp-career-input,
.sp-career-select,
.sp-career-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1.5px solid rgba(138, 64, 47, 0.24);
  border-radius: 10px;
  padding: 11px 14px;
  background: #FFFFFF;
  color: #3D2B2B;
  font-size: 0.95rem;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sp-career-input:focus,
.sp-career-select:focus,
.sp-career-textarea:focus {
  border-color: #8A402F;
  outline: none;
  box-shadow: 0 0 0 3px rgba(138, 64, 47, 0.12);
}

.sp-career-input.is-synced {
  background: #FAF7F2;
  color: #554448;
}

.sp-phone-combo {
  display: flex;
  gap: 8px;
}

.sp-phone-code-select {
  width: 90px;
  flex-shrink: 0;
}

.sp-career-helper-text {
  font-size: 0.8rem;
  color: #65504B;
  margin-top: 5px;
}

.sp-career-checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.9rem;
  color: #3D2B2B;
  line-height: 1.45;
  cursor: pointer;
  margin-top: 4px;
}

.sp-career-checkbox-label input[type="checkbox"] {
  margin-top: 3px;
  flex-shrink: 0;
  accent-color: #4B2030;
}

/* Resume Dropzone */
.sp-career-dropzone {
  border: 2px dashed rgba(138, 64, 47, 0.35);
  border-radius: 12px;
  padding: 24px 18px;
  text-align: center;
  background: #FFFDF9;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sp-career-dropzone:hover,
.sp-career-dropzone.is-dragover {
  border-color: #8A402F;
  background: #FFF6EB;
}

.sp-career-dropzone i {
  font-size: 32px;
  color: #8A402F;
  margin-bottom: 8px;
}

.sp-dropzone-prompt {
  font-size: 0.95rem;
  font-weight: 600;
  color: #4B2030;
  margin-bottom: 4px;
}

.sp-dropzone-sub {
  font-size: 0.82rem;
  color: #65504B;
}

.sp-file-preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  border: 1.5px solid rgba(138, 64, 47, 0.25);
  border-radius: 12px;
  padding: 12px 18px;
  gap: 14px;
}

.sp-file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.sp-file-thumb {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sp-file-meta {
  min-width: 0;
}

.sp-file-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #4B2030;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}

.sp-file-size {
  font-size: 0.78rem;
  color: #65504B;
}

.sp-file-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.sp-file-btn {
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(138, 64, 47, 0.3);
  background: #FFFCF7;
  color: #4B2030;
  transition: all 0.18s ease;
}

.sp-file-btn:hover {
  background: #FFF4E6;
  border-color: #8A402F;
}

.sp-file-btn-remove {
  color: #c02a2a;
  border-color: rgba(192, 42, 42, 0.3);
}

.sp-file-btn-remove:hover {
  background: #FDF2F2;
  border-color: #c02a2a;
}

.sp-inline-error {
  color: #c02a2a;
  font-size: 0.84rem;
  margin-top: 6px;
  display: none;
}

.sp-form-validation-banner {
  background: #FFF2F2;
  border: 1px solid #c02a2a;
  color: #9c1f1f;
  padding: 12px 18px;
  border-radius: 10px;
  font-size: 0.92rem;
  margin-bottom: 20px;
  display: none;
}

.sp-career-submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 34px;
  background: #4B2030;
  color: #FFFFFF;
  border: none;
  border-radius: 9999px;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(75, 32, 48, 0.25);
  transition: all 0.22s ease;
}

.sp-career-submit-btn:hover {
  background: #361521;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(75, 32, 48, 0.35);
}

/* Modal Specifics */
.sp-review-role-badge {
  display: inline-block;
  background: #FFF4E6;
  color: #8A402F;
  border: 1px solid rgba(138, 64, 47, 0.3);
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 1rem;
}

.sp-review-text-block {
  background: #FFFFFF;
  border: 1px solid rgba(138, 64, 47, 0.18);
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 0.9rem;
  color: #3D2B2B;
  line-height: 1.55;
  white-space: pre-line;
}

/* Responsive Breakpoints */
@media (max-width: 992px) {
  .sp-process-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .sp-careers-container {
    padding: 24px 16px 60px;
  }
  .sp-job-card {
    padding: 22px 18px;
  }
  .sp-careers-form-card {
    padding: 28px 18px;
  }
  .sp-careers-form-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .sp-career-col-span-2 {
    grid-column: span 1;
  }
  .sp-process-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .sp-file-name {
    max-width: 180px;
  }
  .sp-job-card-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .sp-role-toggle-btn,
  .sp-role-apply-btn {
    justify-content: center;
    width: 100%;
  }
}
`;

  css += careersStyles;
  fs.writeFileSync('css/spouzy-modern.css', css, 'utf8');
  console.log('Appended .spouzy-careers-page styles to css/spouzy-modern.css.');
} else {
  console.log('.spouzy-careers-page already present in css/spouzy-modern.css.');
}
