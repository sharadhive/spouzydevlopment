const fs = require('fs');

const path = 'book-appoinment.htm';
let content = fs.readFileSync(path, 'utf8');

const oldSchedulerStart = '<!-- SCHEDULER BLOCK: Date & Matching Time Field with Popover Time Picker -->';
const oldSchedulerEnd = '<!-- 4. Compact Appointment Summary -->';

const startIndex = content.indexOf(oldSchedulerStart);
const endIndex = content.indexOf(oldSchedulerEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate old scheduler block! startIndex:', startIndex, 'endIndex:', endIndex);
  process.exit(1);
}

const newSchedulerMarkup = `<!-- SCHEDULER BLOCK: Integrated Responsive Appointment Slot Grid -->
                <div class="sp-scheduler-block" id="spSchedulerBlock">
                    <!-- Notice of Demo Availability -->
                    <div class="sp-demo-notice-banner" role="status">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                        <span>Demo availability — appointment times are confirmed by our team.</span>
                    </div>

                    <!-- 1. Session Duration Selector (Placed BEFORE time slots) -->
                    <div class="sp-scheduler-section sp-duration-section">
                        <div class="sp-scheduler-section-header">
                            <label class="sp-form-label-modern" id="spDurationLabel" style="margin-bottom: 0;">
                                <i class="fa fa-hourglass-half" style="color: var(--sp-copper); margin-right: 6px;"></i>
                                1. Select Session Duration <span class="sp-req">*</span>
                            </label>
                            <span class="sp-step-hint">Consultation Depth</span>
                        </div>
                        <div class="sp-duration-toggle" role="radiogroup" aria-labelledby="spDurationLabel">
                            <button type="button" class="sp-duration-btn is-active" data-duration="30" aria-checked="true" role="radio" id="spDur30Btn">
                                <span class="sp-duration-title"><i class="fa fa-clock-o"></i> 30 minutes</span>
                                <small class="sp-duration-desc">Targeted Clinical Guidance</small>
                            </button>
                            <button type="button" class="sp-duration-btn" data-duration="60" aria-checked="false" role="radio" id="spDur60Btn">
                                <span class="sp-duration-title"><i class="fa fa-clock-o"></i> 1 hour</span>
                                <small class="sp-duration-desc">In-Depth Dual Session</small>
                            </button>
                        </div>
                    </div>

                    <!-- 2. Consultation Date Selector (Date Tabs + Calendar Picker + Prev/Next) -->
                    <div class="sp-scheduler-section sp-date-section">
                        <div class="sp-scheduler-section-header">
                            <label class="sp-form-label-modern" id="spDateLabel" for="spBookingDate" style="margin-bottom: 0;">
                                <i class="fa fa-calendar" style="color: var(--sp-copper); margin-right: 6px;"></i>
                                2. Choose Consultation Date <span class="sp-req">*</span>
                            </label>
                            <div class="sp-tz-tag" title="All consultation times are in India Standard Time">
                                <i class="fa fa-globe"></i> Asia/Kolkata (IST)
                            </div>
                        </div>

                        <!-- Date Navigation Bar -->
                        <div class="sp-date-tabs-bar" role="region" aria-label="Appointment Date Navigation">
                            <button type="button" class="sp-date-nav-btn" id="spDatePrevBtn" aria-label="Previous date range" title="Previous dates">
                                <i class="fa fa-chevron-left" aria-hidden="true"></i>
                            </button>
                            
                            <div class="sp-date-tabs-track" id="spDateTabsTrack" role="tablist" aria-label="Appointment Dates">
                                <!-- Dynamically populated date tabs (Today, Tomorrow, Upcoming) -->
                            </div>

                            <button type="button" class="sp-date-nav-btn" id="spDateNextBtn" aria-label="Next date range" title="Next dates">
                                <i class="fa fa-chevron-right" aria-hidden="true"></i>
                            </button>

                            <!-- Inline Calendar Trigger & Synchronized Native Input -->
                            <div class="sp-calendar-picker-wrap">
                                <input type="date" id="spBookingDate" name="bookingDate" class="sp-calendar-native-input" aria-label="Choose custom date from calendar">
                                <button type="button" class="sp-calendar-trigger-btn" id="spCalendarTriggerBtn" title="Pick any future date from calendar" aria-label="Open calendar date picker" tabindex="-1">
                                    <i class="fa fa-calendar-plus-o" aria-hidden="true"></i>
                                    <span class="sp-calendar-trigger-text">Calendar</span>
                                </button>
                            </div>
                        </div>

                        <!-- Selected Date & Slot Availability Status Banner -->
                        <div class="sp-selected-date-banner" id="spSelectedDateBanner">
                            <div class="sp-selected-date-info">
                                <i class="fa fa-calendar-check-o" style="color: var(--sp-copper);"></i>
                                <span class="sp-selected-date-title" id="spSelectedDateTitle">Loading date...</span>
                                <span class="sp-selected-date-tz">· Asia/Kolkata (IST)</span>
                            </div>
                            <div class="sp-selected-date-count" id="spDateSlotCountBadge">
                                <span class="sp-count-num" id="spAvailableCountNum">--</span> slots available
                            </div>
                        </div>
                    </div>

                    <!-- 3. Available Time Slots Grid (Grouped by Morning, Afternoon, Evening) -->
                    <div class="sp-scheduler-section sp-slots-section">
                        <div class="sp-scheduler-section-header">
                            <label class="sp-form-label-modern" id="spSlotsLabel" style="margin-bottom: 0;">
                                <i class="fa fa-clock-o" style="color: var(--sp-copper); margin-right: 6px;"></i>
                                3. Select Available Time Slot <span class="sp-req">*</span>
                            </label>
                            <span class="sp-operating-hours-tag">Hours: 9:00 AM – 9:00 PM IST</span>
                        </div>

                        <!-- Compact Legend -->
                        <div class="sp-slots-legend" role="note" aria-label="Slot status legend">
                            <span class="sp-legend-item"><span class="sp-legend-dot is-available"></span> Available</span>
                            <span class="sp-legend-item"><span class="sp-legend-dot is-selected"></span> Selected</span>
                            <span class="sp-legend-item"><span class="sp-legend-dot is-booked"></span> Booked</span>
                            <span class="sp-legend-item"><span class="sp-legend-dot is-passed"></span> Passed</span>
                        </div>

                        <!-- Responsive Slots Grid grouped into Morning, Afternoon, Evening -->
                        <div id="spSlotsGridWrapper" class="sp-slots-grid-wrapper">
                            <!-- Populated dynamically -->
                        </div>

                        <!-- Slot Notice (validation errors, duration changes, etc.) -->
                        <div id="spSlotNotice" class="sp-slot-notice" style="display: none;"></div>
                    </div>
                </div>

                `;

content = content.substring(0, startIndex) + newSchedulerMarkup + content.substring(endIndex);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated book-appoinment.htm with upgraded scheduler block markup.');
