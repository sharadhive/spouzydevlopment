const fs = require('fs');

const path = 'css/spouzy-modern.css';
let css = fs.readFileSync(path, 'utf8');

const startTag = '/* --- Scheduler Block (Date & Matching Time Field with Popover) --- */';
const endTag = '/* --- Compact Appointment Summary Box --- */';

const startIndex = css.indexOf(startTag);
const endIndex = css.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate markers in css! startIndex:', startIndex, 'endIndex:', endIndex);
  process.exit(1);
}

const newSchedulerCSS = `/* --- Integrated Responsive Scheduler Block & Slot Grid --- */
.sp-scheduler-block {
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.16);
  border-radius: var(--sp-radius-lg, 12px);
  padding: 24px;
  margin: 24px 0 20px;
  box-shadow: 0 4px 18px rgba(75, 32, 48, 0.05);
}

@media (max-width: 767px) {
  .sp-scheduler-block {
    padding: 16px 12px;
  }
}

/* Demo Notice Banner */
.sp-demo-notice-banner {
  background: #FFF7E8;
  border: 1px solid var(--sp-badge-border, rgba(138, 64, 47, 0.24));
  border-radius: var(--sp-radius-md, 8px);
  padding: 10px 14px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--sp-text-heading, #4B2030);
  line-height: 1.4;
}

.sp-demo-notice-banner i {
  color: var(--sp-copper, #8A402F);
  font-size: 16px;
  flex-shrink: 0;
}

/* Scheduler Step Sections */
.sp-scheduler-section {
  margin-bottom: 24px;
}

.sp-scheduler-section:last-child {
  margin-bottom: 0;
}

.sp-scheduler-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.sp-step-hint,
.sp-operating-hours-tag {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--sp-copper, #8A402F);
  background: #FFF7E8;
  border: 1px solid rgba(138, 64, 47, 0.2);
  padding: 3px 9px;
  border-radius: 12px;
}

.sp-tz-tag {
  font-size: 12px;
  font-weight: 700;
  color: var(--sp-copper, #8A402F);
  background: #FFF7E8;
  border: 1px solid rgba(138, 64, 47, 0.22);
  padding: 4px 10px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Duration Toggle (Placed FIRST before time slots) */
.sp-duration-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 520px) {
  .sp-duration-toggle {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

.sp-duration-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.18);
  border-radius: var(--sp-radius-md, 10px);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-family: var(--sp-font-body);
  min-height: 52px;
  box-sizing: border-box;
}

.sp-duration-btn:hover {
  border-color: var(--sp-copper, #8A402F);
  background: #FFF7E8;
}

.sp-duration-btn:focus-visible {
  outline: 2px solid var(--sp-copper, #8A402F);
  outline-offset: 2px;
}

.sp-duration-btn.is-active {
  background: var(--sp-text-heading, #4B2030) !important;
  color: #ffffff !important;
  border-color: var(--sp-text-heading, #4B2030) !important;
  box-shadow: 0 4px 14px rgba(75, 32, 48, 0.25);
}

.sp-duration-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--sp-text-heading, #4B2030);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sp-duration-btn.is-active .sp-duration-title {
  color: #ffffff !important;
}

.sp-duration-desc {
  font-size: 11.5px;
  color: var(--sp-text-secondary, #65504B);
}

.sp-duration-btn.is-active .sp-duration-desc {
  color: rgba(255, 255, 255, 0.85) !important;
}

/* Date Tabs Bar */
.sp-date-tabs-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  position: relative;
  background: #faf6f2;
  border: 1.5px solid rgba(75, 32, 48, 0.14);
  border-radius: var(--sp-radius-md, 10px);
  padding: 6px;
  box-shadow: 0 2px 8px rgba(72, 30, 40, 0.03);
}

.sp-date-nav-btn {
  width: 36px;
  height: 56px;
  background: #ffffff;
  border: 1px solid rgba(75, 32, 48, 0.16);
  border-radius: 8px;
  color: var(--sp-text-heading, #4B2030);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
  font-size: 13px;
}

.sp-date-nav-btn:hover:not(:disabled) {
  background: var(--sp-copper, #8A402F);
  color: #ffffff;
  border-color: var(--sp-copper, #8A402F);
}

.sp-date-nav-btn:focus-visible {
  outline: 2px solid var(--sp-copper, #8A402F);
  outline-offset: 2px;
}

.sp-date-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  background: #f0ebe7;
  border-color: rgba(72, 30, 40, 0.08);
}

.sp-date-tabs-track {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 2px 0;
  flex: 1;
  -webkit-overflow-scrolling: touch;
}

.sp-date-tabs-track::-webkit-scrollbar {
  height: 4px;
}
.sp-date-tabs-track::-webkit-scrollbar-thumb {
  background: rgba(138, 64, 47, 0.25);
  border-radius: 2px;
}

/* Individual Date Tab */
.sp-date-tab {
  flex: 0 0 auto;
  min-width: 82px;
  padding: 8px 8px;
  border-radius: 8px;
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.14);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: all 0.2s ease;
  font-family: var(--sp-font-body);
  text-align: center;
  min-height: 56px;
  box-sizing: border-box;
}

.sp-date-tab:hover:not(.is-active) {
  background: #FFF7E8;
  border-color: var(--sp-copper, #8A402F);
}

.sp-date-tab:focus-visible {
  outline: 2px solid var(--sp-copper, #8A402F);
  outline-offset: 2px;
}

.sp-date-tab.is-active {
  background: var(--sp-text-heading, #4B2030) !important;
  color: #ffffff !important;
  border-color: var(--sp-text-heading, #4B2030) !important;
  box-shadow: 0 4px 12px rgba(75, 32, 48, 0.25);
}

.sp-tab-day-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--sp-text-secondary, #65504B);
}

.sp-date-tab.is-active .sp-tab-day-label {
  color: #ffffff !important;
}

.sp-tab-date-num {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--sp-text-heading, #4B2030);
  line-height: 1.2;
}

.sp-date-tab.is-active .sp-tab-date-num {
  color: #ffffff !important;
}

.sp-tab-slots-badge {
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(138, 64, 47, 0.12);
  color: var(--sp-copper, #8A402F);
  margin-top: 2px;
  white-space: nowrap;
}

.sp-date-tab.is-active .sp-tab-slots-badge {
  background: rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
}

.sp-date-tab.is-fully-booked .sp-tab-slots-badge {
  background: rgba(192, 42, 42, 0.12);
  color: #c02a2a;
}

.sp-date-tab.is-active.is-fully-booked .sp-tab-slots-badge {
  background: rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
}

/* Calendar Button & Synchronized Native Input */
.sp-calendar-picker-wrap {
  position: relative;
  flex-shrink: 0;
}

.sp-calendar-native-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 3;
}

.sp-calendar-trigger-btn {
  height: 56px;
  padding: 0 12px;
  background: #FFF7E8;
  border: 1px solid rgba(138, 64, 47, 0.25);
  border-radius: 8px;
  color: var(--sp-text-heading, #4B2030);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: none;
}

.sp-calendar-picker-wrap:hover .sp-calendar-trigger-btn {
  background: var(--sp-copper, #8A402F);
  color: #ffffff;
  border-color: var(--sp-copper, #8A402F);
}

.sp-calendar-native-input:focus + .sp-calendar-trigger-btn {
  outline: 2px solid var(--sp-copper, #8A402F);
  outline-offset: 2px;
}

/* Selected Date Banner */
.sp-selected-date-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 14px;
  background: #faf6f2;
  border: 1px solid rgba(75, 32, 48, 0.12);
  border-radius: var(--sp-radius-md, 8px);
}

.sp-selected-date-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}

.sp-selected-date-title {
  font-weight: 700;
  color: var(--sp-text-heading, #4B2030);
}

.sp-selected-date-tz {
  color: var(--sp-text-secondary, #65504B);
  font-size: 12px;
}

.sp-selected-date-count {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--sp-text-heading, #4B2030);
  background: #ffffff;
  border: 1px solid rgba(138, 64, 47, 0.2);
  padding: 3px 10px;
  border-radius: 12px;
}

.sp-selected-date-count.is-fully-booked {
  background: #fff0f0;
  border-color: rgba(192, 42, 42, 0.3);
  color: #c02a2a;
}

.sp-count-num {
  color: var(--sp-copper, #8A402F);
}

.sp-selected-date-count.is-fully-booked .sp-count-num {
  color: #c02a2a;
}

/* Legend */
.sp-slots-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 14px;
  padding: 8px 12px;
  background: #faf6f2;
  border-radius: 6px;
  border: 1px solid rgba(75, 32, 48, 0.1);
  font-size: 12px;
  color: var(--sp-text-secondary, #65504B);
}

.sp-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sp-legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}

.sp-legend-dot.is-available {
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.5);
}

.sp-legend-dot.is-selected {
  background: var(--sp-text-heading, #4B2030);
}

.sp-legend-dot.is-booked {
  background: #ebe5e1;
  border: 1px solid rgba(72, 30, 40, 0.18);
}

.sp-legend-dot.is-passed {
  background: #f2edea;
  border: 1px solid rgba(72, 30, 40, 0.12);
}

/* Period Sections (Morning, Afternoon, Evening) */
.sp-period-section {
  background: #ffffff;
  border: 1px solid rgba(75, 32, 48, 0.12);
  border-radius: var(--sp-radius-md, 10px);
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: 0 2px 8px rgba(72, 30, 40, 0.03);
}

.sp-period-section:last-child {
  margin-bottom: 0;
}

.sp-period-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(75, 32, 48, 0.08);
}

.sp-period-title {
  font-size: 13.5px;
  font-weight: 800;
  color: var(--sp-text-heading, #4B2030);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sp-period-time-range {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--sp-text-secondary, #65504B);
}

.sp-period-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}

@media (max-width: 480px) {
  .sp-period-slots-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

/* Individual Slot Card */
.sp-slot-card {
  min-height: 48px;
  padding: 8px 10px;
  border-radius: 8px;
  font-family: var(--sp-font-body);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: all 0.18s ease;
  text-align: center;
  box-sizing: border-box;
}

/* State: Available */
.sp-slot-card.is-available {
  background: #ffffff;
  border: 1.5px solid rgba(75, 32, 48, 0.32);
  color: var(--sp-text-heading, #4B2030);
}

.sp-slot-card.is-available:hover {
  background: #FFF7E8;
  border-color: var(--sp-copper, #8A402F);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(138, 64, 47, 0.15);
}

.sp-slot-card.is-available:focus-visible {
  outline: 2px solid var(--sp-copper, #8A402F);
  outline-offset: 2px;
}

/* State: Selected */
.sp-slot-card.is-selected {
  background: var(--sp-text-heading, #4B2030) !important;
  border-color: var(--sp-text-heading, #4B2030) !important;
  color: #ffffff !important;
  box-shadow: 0 4px 14px rgba(75, 32, 48, 0.28) !important;
}

.sp-slot-card.is-selected .sp-slot-time-text {
  color: #ffffff !important;
  font-weight: 800;
}

.sp-slot-card.is-selected .sp-slot-status-text {
  color: #ffffff !important;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* State: Booked */
.sp-slot-card.is-booked {
  background: #f3ece9;
  border: 1px solid rgba(75, 32, 48, 0.1);
  color: #8a7671;
  cursor: not-allowed;
  opacity: 0.88;
}

.sp-slot-card.is-booked .sp-slot-status-text {
  font-size: 10px;
  font-weight: 800;
  color: #c02a2a;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* State: Passed */
.sp-slot-card.is-passed {
  background: #f0eae7;
  border: 1px solid rgba(75, 32, 48, 0.08);
  color: #94827d;
  cursor: not-allowed;
  opacity: 0.82;
}

.sp-slot-card.is-passed .sp-slot-time-text {
  text-decoration: line-through;
}

.sp-slot-card.is-passed .sp-slot-status-text {
  font-size: 10px;
  font-weight: 700;
  color: #85726d;
  text-transform: uppercase;
}

.sp-slot-notice {
  padding: 14px 16px;
  border-radius: var(--sp-radius-md, 8px);
  background: #fff8f5;
  border: 1px solid rgba(138, 64, 47, 0.3);
  color: var(--sp-text-heading, #4B2030);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  margin-top: 14px;
}

`;

css = css.substring(0, startIndex) + newSchedulerCSS + css.substring(endIndex);
fs.writeFileSync(path, css, 'utf8');
console.log('Successfully updated css/spouzy-modern.css with integrated scheduler styling.');
