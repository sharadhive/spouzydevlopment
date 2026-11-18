const fs = require('fs');

const path = 'css/spouzy-modern.css';
let css = fs.readFileSync(path, 'utf8');

const regStyles = `
/* ==========================================================================
   DOCTOR & COUNSELLOR REGISTRATION / EMPANELMENT SYSTEM
   ========================================================================== */

.sp-reg-form-container {
  max-width: 940px;
  margin: 32px auto 60px;
  padding: 0 20px;
}

@media (max-width: 767px) {
  .sp-reg-form-container {
    padding: 0 14px;
    margin: 20px auto 40px;
  }
}

/* Numbered Section Cards */
.sp-reg-section-card {
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.16);
  border-radius: var(--sp-radius-lg, 12px);
  padding: 28px;
  margin-bottom: 24px;
  box-shadow: 0 4px 18px rgba(75, 32, 48, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

@media (max-width: 767px) {
  .sp-reg-section-card {
    padding: 18px 14px;
    margin-bottom: 18px;
  }
}

.sp-reg-section-card:hover {
  border-color: rgba(138, 64, 47, 0.35);
  box-shadow: 0 6px 22px rgba(75, 32, 48, 0.07);
}

.sp-reg-section-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(75, 32, 48, 0.1);
}

.sp-reg-section-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #FFF7E8;
  border: 1.5px solid rgba(138, 64, 47, 0.28);
  color: var(--sp-text-heading, #4B2030);
  font-size: 14px;
  font-weight: 800;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.sp-reg-section-title-wrap {
  flex: 1;
}

.sp-reg-section-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--sp-text-heading, #4B2030);
  margin: 0 0 4px;
  font-family: var(--sp-font-display, inherit);
}

.sp-reg-section-subtitle {
  font-size: 13px;
  color: var(--sp-text-secondary, #65504B);
  margin: 0;
  line-height: 1.4;
}

/* 3-Column Grid Row */
.sp-form-row-3col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 767px) {
  .sp-form-row-3col {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}

/* Checkbox Label with Custom Switch / Box */
.sp-form-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sp-text-heading, #4B2030);
  cursor: pointer;
  user-select: none;
  margin-top: 6px;
}

.sp-form-checkbox-label input[type="checkbox"] {
  width: 17px;
  height: 17px;
  accent-color: var(--sp-copper, #8A402F);
  cursor: pointer;
  margin: 0;
}

/* File Upload & Dropzone */
.sp-file-upload-block {
  margin-top: 8px;
}

.sp-file-dropzone {
  border: 2px dashed rgba(138, 64, 47, 0.35);
  border-radius: var(--sp-radius-md, 10px);
  background: #FFF7E8;
  padding: 18px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.sp-file-dropzone:hover {
  background: #fdf2e4;
  border-color: var(--sp-copper, #8A402F);
}

.sp-file-dropzone.has-file {
  display: none;
}

.sp-file-dropzone-icon {
  font-size: 26px;
  color: var(--sp-copper, #8A402F);
  margin-bottom: 6px;
}

.sp-file-dropzone-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--sp-text-heading, #4B2030);
  margin-bottom: 2px;
}

.sp-file-dropzone-hint {
  font-size: 11.5px;
  color: var(--sp-text-secondary, #65504B);
}

.sp-file-hidden-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

/* File Preview Card (Displayed when file is selected) */
.sp-file-preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: #faf6f2;
  border: 1.5px solid rgba(75, 32, 48, 0.16);
  border-radius: var(--sp-radius-md, 8px);
  margin-top: 8px;
}

.sp-file-info-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.sp-file-thumb {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid rgba(75, 32, 48, 0.15);
  background: #ffffff;
  display: grid;
  place-items: center;
  font-size: 20px;
  color: var(--sp-copper, #8A402F);
  flex-shrink: 0;
}

.sp-file-details {
  flex: 1;
  min-width: 0;
}

.sp-file-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--sp-text-heading, #4B2030);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.sp-file-size {
  font-size: 11.5px;
  color: var(--sp-text-secondary, #65504B);
}

.sp-file-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sp-file-action-btn {
  padding: 6px 10px;
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  border: 1px solid transparent;
}

.sp-file-action-btn.is-replace {
  background: #ffffff;
  border-color: rgba(138, 64, 47, 0.3);
  color: var(--sp-copper, #8A402F);
}

.sp-file-action-btn.is-replace:hover {
  background: #FFF7E8;
  border-color: var(--sp-copper, #8A402F);
}

.sp-file-action-btn.is-remove {
  background: #fff0f0;
  border-color: rgba(192, 42, 42, 0.25);
  color: #c02a2a;
}

.sp-file-action-btn.is-remove:hover {
  background: #c02a2a;
  color: #ffffff;
}

/* Dynamic Qualification Card */
.sp-qual-card {
  background: #faf6f2;
  border: 1.5px solid rgba(75, 32, 48, 0.14);
  border-radius: var(--sp-radius-md, 10px);
  padding: 20px;
  margin-bottom: 16px;
  position: relative;
}

.sp-qual-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(75, 32, 48, 0.1);
}

.sp-qual-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--sp-text-heading, #4B2030);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sp-remove-qual-btn {
  background: #fff0f0;
  border: 1px solid rgba(192, 42, 42, 0.25);
  color: #c02a2a;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
}

.sp-remove-qual-btn:hover {
  background: #c02a2a;
  color: #ffffff;
}

.sp-add-qual-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #FFF7E8;
  border: 1.5px solid rgba(138, 64, 47, 0.3);
  border-radius: 8px;
  color: var(--sp-copper, #8A402F);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;
}

.sp-add-qual-btn:hover {
  background: var(--sp-copper, #8A402F);
  color: #ffffff;
  border-color: var(--sp-copper, #8A402F);
  box-shadow: 0 4px 12px rgba(138, 64, 47, 0.2);
}

/* Signature Pad Component */
.sp-sig-card {
  background: #faf6f2;
  border: 1.5px solid rgba(75, 32, 48, 0.14);
  border-radius: 10px;
  padding: 18px;
  margin-top: 14px;
}

.sp-sig-canvas-wrap {
  position: relative;
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.2);
  border-radius: 8px;
  overflow: hidden;
  touch-action: none;
}

.sp-sig-canvas {
  width: 100%;
  height: 120px;
  display: block;
  cursor: crosshair;
}

.sp-sig-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(101, 80, 75, 0.4);
  font-size: 13px;
  pointer-events: none;
  font-style: italic;
}

.sp-sig-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.sp-sig-clear-btn {
  background: #ffffff;
  border: 1px solid rgba(75, 32, 48, 0.2);
  color: var(--sp-text-secondary, #65504B);
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.sp-sig-clear-btn:hover {
  background: #f0ebe7;
  color: var(--sp-text-heading, #4B2030);
}

/* WhatsApp Notice Warning Box */
.sp-wa-notice-box {
  background: #FFF7E8;
  border: 1.5px solid rgba(138, 64, 47, 0.25);
  border-radius: var(--sp-radius-md, 10px);
  padding: 14px 18px;
  margin: 18px 0 24px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--sp-text-heading, #4B2030);
}

.sp-wa-notice-box i {
  color: var(--sp-copper, #8A402F);
  font-size: 18px;
  margin-top: 2px;
  flex-shrink: 0;
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
  border-radius: 14px;
  border: 1.5px solid rgba(138, 64, 47, 0.3);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 820px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: spPopoverDrop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.sp-review-header {
  background: linear-gradient(135deg, #FFF7E8 0%, #faf4f1 100%);
  border-bottom: 1.5px solid rgba(75, 32, 48, 0.12);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sp-review-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--sp-text-heading, #4B2030);
  margin: 0;
}

.sp-review-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--sp-text-secondary, #65504B);
  cursor: pointer;
  line-height: 1;
}

.sp-review-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.sp-review-section-block {
  background: #faf6f2;
  border: 1px solid rgba(75, 32, 48, 0.1);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 16px;
}

.sp-review-sec-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--sp-copper, #8A402F);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.sp-review-grid {
  display: grid;
  grid-template-columns: 140px 1fr;
  row-gap: 6px;
  column-gap: 12px;
  font-size: 13px;
  line-height: 1.45;
}

@media (max-width: 580px) {
  .sp-review-grid {
    grid-template-columns: 1fr;
    row-gap: 3px;
  }
}

.sp-review-key {
  font-weight: 700;
  color: var(--sp-text-secondary, #65504B);
}

.sp-review-val {
  color: var(--sp-text-heading, #4B2030);
  word-break: break-word;
}

.sp-review-footer {
  background: #faf6f2;
  border-top: 1.5px solid rgba(75, 32, 48, 0.12);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.sp-review-actions-left {
  display: flex;
  gap: 10px;
}

.sp-review-actions-right {
  display: flex;
  gap: 10px;
}
`;

css += regStyles;
fs.writeFileSync(path, css, 'utf8');
console.log('Successfully appended Doctor & Counsellor registration CSS to css/spouzy-modern.css');
