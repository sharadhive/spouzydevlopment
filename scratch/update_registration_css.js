const fs = require('fs');

const cssPath = 'css/spouzy-modern.css';
let css = fs.readFileSync(cssPath, 'utf8');

const marker = '/* ==========================================================================\n   DOCTOR & COUNSELLOR REGISTRATION / EMPANELMENT SYSTEM';
const markerIndex = css.indexOf(marker);

if (markerIndex === -1) {
  console.error('Marker not found in css/spouzy-modern.css');
  process.exit(1);
}

const baseCss = css.substring(0, markerIndex).trimEnd();

const newRegistrationCss = `/* ==========================================================================
   DOCTOR & COUNSELLOR REGISTRATION / EMPANELMENT SYSTEM
   Scoped under .spouzy-registration-page
   ========================================================================== */

/* Main Page Canvas & Main Container */
body.spouzy-registration-page {
  background-color: #FFFACD !important;
}

.spouzy-registration-page .sp-reg-page-main {
  width: 100%;
  background: transparent;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
}

.spouzy-registration-page .sp-reg-container {
  max-width: 1120px;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px 90px;
  box-sizing: border-box;
}

@media (max-width: 767px) {
  .spouzy-registration-page .sp-reg-container {
    padding: 0 16px 80px;
  }
}

/* Compact Introduction Header */
.spouzy-registration-page .sp-reg-intro-header {
  padding: 32px 0 24px;
  box-sizing: border-box;
}

@media (max-width: 767px) {
  .spouzy-registration-page .sp-reg-intro-header {
    padding: 22px 0 18px;
  }
}

.spouzy-registration-page .sp-reg-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 500;
  color: #65504B;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.spouzy-registration-page .sp-reg-breadcrumbs a {
  color: #8A402F;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s ease;
}

.spouzy-registration-page .sp-reg-breadcrumbs a:hover {
  color: #4B2030;
  text-decoration: underline;
}

.spouzy-registration-page .sp-reg-bc-sep {
  color: rgba(101, 80, 75, 0.45);
  font-size: 12px;
}

.spouzy-registration-page .sp-reg-main-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 34px;
  font-weight: 700;
  color: #4B2030;
  line-height: 1.25;
  margin: 0 0 12px;
}

@media (max-width: 767px) {
  .spouzy-registration-page .sp-reg-main-title {
    font-size: 26px;
  }
}

.spouzy-registration-page .sp-reg-intro-desc {
  font-size: 15px;
  line-height: 1.6;
  color: #3D2B2B;
  margin: 0 0 16px;
  max-width: 860px;
}

.spouzy-registration-page .sp-reg-role-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  background: #FFF7E8;
  border: 1px solid rgba(138, 64, 47, 0.25);
  border-radius: 9999px;
  font-size: 13px;
  color: #65504B;
  box-shadow: 0 2px 8px rgba(75, 32, 48, 0.03);
  flex-wrap: wrap;
}

.spouzy-registration-page .sp-reg-switch-link {
  color: #8A402F;
  font-weight: 700;
  text-decoration: underline;
  transition: color 0.15s ease;
}

.spouzy-registration-page .sp-reg-switch-link:hover {
  color: #4B2030;
}

/* Numbered Ivory Section Cards */
.spouzy-registration-page .sp-reg-section-card {
  background: #FFFCF7;
  border: 1.5px solid rgba(75, 32, 48, 0.12);
  border-radius: 18px;
  padding: 30px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(75, 32, 48, 0.04);
  box-sizing: border-box;
  width: 100%;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

@media (max-width: 767px) {
  .spouzy-registration-page .sp-reg-section-card {
    padding: 18px 16px;
    border-radius: 16px;
    margin-bottom: 20px;
  }
}

.spouzy-registration-page .sp-reg-section-card:hover {
  border-color: rgba(138, 64, 47, 0.3);
  box-shadow: 0 6px 24px rgba(75, 32, 48, 0.06);
}

.spouzy-registration-page .sp-reg-section-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(75, 32, 48, 0.1);
}

.spouzy-registration-page .sp-reg-section-badge {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #FFF7E8;
  border: 1.5px solid rgba(138, 64, 47, 0.28);
  color: #4B2030;
  font-size: 15px;
  font-weight: 800;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.spouzy-registration-page .sp-reg-section-title-wrap {
  flex: 1;
  min-width: 0;
}

.spouzy-registration-page .sp-reg-section-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 21px;
  font-weight: 700;
  color: #4B2030;
  margin: 0 0 4px;
  line-height: 1.3;
}

@media (max-width: 767px) {
  .spouzy-registration-page .sp-reg-section-title {
    font-size: 18px;
  }
}

.spouzy-registration-page .sp-reg-section-subtitle {
  font-size: 13.5px;
  color: #65504B;
  margin: 0;
  line-height: 1.45;
}

/* Grids & Form Layout */
.spouzy-registration-page .sp-form-grid-2col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 24px;
  margin-bottom: 20px;
  width: 100%;
}

@media (max-width: 767px) {
  .spouzy-registration-page .sp-form-grid-2col {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
}

.spouzy-registration-page .sp-form-grid-name {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px 24px;
  margin-bottom: 20px;
  width: 100%;
}

@media (max-width: 767px) {
  .spouzy-registration-page .sp-form-grid-name {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
}

.spouzy-registration-page .sp-form-col-full {
  grid-column: 1 / -1;
  width: 100%;
}

.spouzy-registration-page .sp-form-group-modern {
  display: flex;
  flex-direction: column;
  min-width: 0;
  box-sizing: border-box;
}

.spouzy-registration-page .sp-form-label-modern {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #4B2030;
  margin-bottom: 8px;
  line-height: 1.35;
}

.spouzy-registration-page .sp-req {
  color: #c02a2a;
  margin-left: 2px;
  font-weight: 800;
}

.spouzy-registration-page .sp-opt {
  font-size: 12px;
  font-weight: 500;
  color: #65504B;
  margin-left: 4px;
}

/* Inputs, Selects, Textareas: 16px text, 48px min-height */
.spouzy-registration-page .sp-form-input-modern,
.spouzy-registration-page .sp-form-select-modern {
  width: 100%;
  min-height: 48px;
  height: 48px;
  padding: 10px 16px;
  font-size: 16px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #3D2B2B;
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.2);
  border-radius: 10px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.spouzy-registration-page .sp-form-select-modern {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A402F' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 14px;
  padding-right: 36px;
  cursor: pointer;
}

.spouzy-registration-page .sp-form-textarea-modern {
  width: 100%;
  min-height: 110px;
  padding: 12px 16px;
  font-size: 16px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #3D2B2B;
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.2);
  border-radius: 10px;
  box-sizing: border-box;
  outline: none;
  resize: vertical;
  line-height: 1.5;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.spouzy-registration-page .sp-form-input-modern:focus,
.spouzy-registration-page .sp-form-select-modern:focus,
.spouzy-registration-page .sp-form-textarea-modern:focus {
  border-color: #8A402F;
  box-shadow: 0 0 0 3px rgba(138, 64, 47, 0.14);
}

.spouzy-registration-page .sp-form-input-modern:disabled,
.spouzy-registration-page .sp-form-select-modern:disabled {
  background: #f4eee9;
  color: #8a737a;
  cursor: not-allowed;
  border-color: rgba(75, 32, 48, 0.12);
}

.spouzy-registration-page .sp-form-input-modern.is-synced {
  background: #FFF7E8;
  border-color: rgba(138, 64, 47, 0.35);
}

/* Checkbox Labels */
.spouzy-registration-page .sp-form-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: #4B2030;
  cursor: pointer;
  user-select: none;
}

.spouzy-registration-page .sp-form-checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #8A402F;
  cursor: pointer;
  margin: 0;
  flex-shrink: 0;
}

/* File Upload & Dropzone */
.spouzy-registration-page .sp-file-dropzone {
  border: 2px dashed rgba(138, 64, 47, 0.35);
  border-radius: 12px;
  background: #FFF7E8;
  padding: 22px 18px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  box-sizing: border-box;
}

.spouzy-registration-page .sp-file-dropzone:hover,
.spouzy-registration-page .sp-file-dropzone.is-dragover {
  background: #fdf0df;
  border-color: #8A402F;
}

.spouzy-registration-page .sp-file-dropzone-icon {
  font-size: 26px;
  color: #8A402F;
  margin-bottom: 6px;
}

.spouzy-registration-page .sp-file-dropzone-text {
  font-size: 13.5px;
  font-weight: 700;
  color: #4B2030;
  margin-bottom: 3px;
}

.spouzy-registration-page .sp-file-dropzone-hint {
  font-size: 12px;
  color: #65504B;
}

.spouzy-registration-page .sp-file-hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.spouzy-registration-page .sp-file-preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  background: #faf6f2;
  border: 1.5px solid rgba(75, 32, 48, 0.16);
  border-radius: 10px;
  box-sizing: border-box;
  margin-top: 6px;
}

.spouzy-registration-page .sp-file-info-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.spouzy-registration-page .sp-file-thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid rgba(75, 32, 48, 0.15);
  background: #ffffff;
  display: grid;
  place-items: center;
  font-size: 20px;
  color: #8A402F;
  flex-shrink: 0;
}

.spouzy-registration-page .sp-file-details {
  flex: 1;
  min-width: 0;
}

.spouzy-registration-page .sp-file-name {
  font-size: 13px;
  font-weight: 700;
  color: #4B2030;
  word-break: break-all;
  margin-bottom: 2px;
}

.spouzy-registration-page .sp-file-size {
  font-size: 11.5px;
  color: #65504B;
}

.spouzy-registration-page .sp-file-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.spouzy-registration-page .sp-file-action-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  border: 1px solid transparent;
}

.spouzy-registration-page .sp-file-action-btn.is-replace {
  background: #ffffff;
  border-color: rgba(138, 64, 47, 0.3);
  color: #8A402F;
}

.spouzy-registration-page .sp-file-action-btn.is-replace:hover {
  background: #FFF7E8;
  border-color: #8A402F;
}

.spouzy-registration-page .sp-file-action-btn.is-remove {
  background: #fff0f0;
  border-color: rgba(192, 42, 42, 0.25);
  color: #c02a2a;
}

.spouzy-registration-page .sp-file-action-btn.is-remove:hover {
  background: #c02a2a;
  color: #ffffff;
}

/* Dynamic Qualification Card */
.spouzy-registration-page .sp-qual-card {
  background: #faf6f2;
  border: 1.5px solid rgba(75, 32, 48, 0.14);
  border-radius: 12px;
  padding: 22px;
  margin-bottom: 18px;
  box-sizing: border-box;
}

.spouzy-registration-page .sp-qual-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(75, 32, 48, 0.1);
}

.spouzy-registration-page .sp-qual-title {
  font-size: 14.5px;
  font-weight: 800;
  color: #4B2030;
  display: flex;
  align-items: center;
  gap: 6px;
}

.spouzy-registration-page .sp-remove-qual-btn {
  background: #fff0f0;
  border: 1px solid rgba(192, 42, 42, 0.25);
  color: #c02a2a;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.spouzy-registration-page .sp-remove-qual-btn:hover {
  background: #c02a2a;
  color: #ffffff;
}

.spouzy-registration-page .sp-add-qual-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  background: #FFF7E8;
  border: 1.5px solid rgba(138, 64, 47, 0.3);
  border-radius: 8px;
  color: #8A402F;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 6px;
}

.spouzy-registration-page .sp-add-qual-btn:hover {
  background: #8A402F;
  color: #ffffff;
  border-color: #8A402F;
  box-shadow: 0 4px 12px rgba(138, 64, 47, 0.2);
}

/* Signature Pad Component */
.spouzy-registration-page .sp-sig-card {
  background: #faf6f2;
  border: 1.5px solid rgba(75, 32, 48, 0.14);
  border-radius: 12px;
  padding: 20px;
  margin-top: 16px;
  box-sizing: border-box;
}

.spouzy-registration-page .sp-sig-canvas-wrap {
  position: relative;
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.2);
  border-radius: 8px;
  overflow: hidden;
  touch-action: none;
}

.spouzy-registration-page .sp-sig-canvas {
  width: 100%;
  height: 120px;
  display: block;
  cursor: crosshair;
}

.spouzy-registration-page .sp-sig-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(101, 80, 75, 0.45);
  font-size: 13px;
  pointer-events: none;
  font-style: italic;
}

.spouzy-registration-page .sp-sig-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.spouzy-registration-page .sp-sig-clear-btn {
  background: #ffffff;
  border: 1px solid rgba(75, 32, 48, 0.2);
  color: #65504B;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.spouzy-registration-page .sp-sig-clear-btn:hover {
  background: #f0ebe7;
  color: #4B2030;
}

/* WhatsApp Notice Warning Box */
.spouzy-registration-page .sp-wa-notice-box {
  background: #FFF7E8;
  border: 1.5px solid rgba(138, 64, 47, 0.25);
  border-radius: 12px;
  padding: 16px 20px;
  margin: 20px 0 24px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  font-size: 13.5px;
  line-height: 1.55;
  color: #4B2030;
  box-sizing: border-box;
}

.spouzy-registration-page .sp-wa-notice-box i {
  color: #8A402F;
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

/* Bottom Action Area & Review Button */
.spouzy-registration-page .sp-form-actions-area {
  margin-top: 36px;
  text-align: center;
}

.spouzy-registration-page .sp-submit-review-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 40px;
  background: #4B2030;
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(75, 32, 48, 0.22);
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.spouzy-registration-page .sp-submit-review-btn:hover {
  background: #391824;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(75, 32, 48, 0.3);
}

@media (max-width: 580px) {
  .spouzy-registration-page .sp-submit-review-btn {
    width: 100%;
    box-sizing: border-box;
  }
}

/* Review Application Modal */
.sp-review-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.sp-review-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(39, 18, 25, 0.65);
  backdrop-filter: blur(4px);
}

.sp-review-dialog {
  position: relative;
  z-index: 2;
  background: #ffffff;
  border-radius: 16px;
  border: 1.5px solid rgba(138, 64, 47, 0.3);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: spPopoverDrop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.sp-review-header {
  background: linear-gradient(135deg, #FFF7E8 0%, #faf4f1 100%);
  border-bottom: 1.5px solid rgba(75, 32, 48, 0.12);
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sp-review-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 20px;
  font-weight: 700;
  color: #4B2030;
  margin: 0;
}

.sp-review-close-btn {
  background: none;
  border: none;
  font-size: 26px;
  color: #65504B;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.sp-review-close-btn:hover {
  color: #4B2030;
}

.sp-review-body {
  padding: 22px 26px;
  overflow-y: auto;
  flex: 1;
}

.sp-review-section-block {
  background: #faf6f2;
  border: 1px solid rgba(75, 32, 48, 0.1);
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 16px;
}

.sp-review-sec-title {
  font-size: 13.5px;
  font-weight: 800;
  color: #8A402F;
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sp-review-grid {
  display: grid;
  grid-template-columns: 150px 1fr;
  row-gap: 7px;
  column-gap: 14px;
  font-size: 13.5px;
  line-height: 1.5;
}

@media (max-width: 600px) {
  .sp-review-grid {
    grid-template-columns: 1fr;
    row-gap: 4px;
  }
}

.sp-review-key {
  font-weight: 700;
  color: #65504B;
}

.sp-review-val {
  color: #4B2030;
  word-break: break-word;
}

.sp-review-footer {
  background: #faf6f2;
  border-top: 1.5px solid rgba(75, 32, 48, 0.12);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.sp-review-actions-left {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sp-review-actions-right {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sp-review-secondary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.2);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #4B2030;
  cursor: pointer;
  transition: all 0.18s ease;
}

.sp-review-secondary-btn:hover {
  background: #FFF7E8;
  border-color: #8A402F;
  color: #8A402F;
}

.sp-review-whatsapp-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: #25D366;
  border: none;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);
  transition: all 0.18s ease;
}

.sp-review-whatsapp-btn:hover {
  background: #20ba59;
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(37, 211, 102, 0.45);
}
`;

fs.writeFileSync(cssPath, baseCss + '\n\n' + newRegistrationCss, 'utf8');
console.log('Successfully updated css/spouzy-modern.css');
