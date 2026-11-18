const fs = require('fs');

const path = 'js/spouzy-modern.js';
let js = fs.readFileSync(path, 'utf8');

const startTag = '  // 16D. ADVANCED SCHEDULER & BOOKING HANDLER (book-appoinment.htm)';
const endTag = '  // Initialize form and widget handlers';

const startIndex = js.indexOf(startTag);
const endIndex = js.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not locate markers in js! startIndex:', startIndex, 'endIndex:', endIndex);
  process.exit(1);
}

const newSchedulerJS = `  // 16D. ADVANCED SCHEDULER & BOOKING HANDLER (book-appoinment.htm)
  // =========================================================================
  function initSpouzyScheduler() {
    const form = document.getElementById('spBookingForm');
    // Only target pages with the scheduler block
    if (!form || !document.getElementById('spSchedulerBlock')) return;

    // -------------------------------------------------------------------------
    // 1. AVAILABILITY PROVIDER (Modular Demo Source - Real API swappable)
    // -------------------------------------------------------------------------
    const SpouzyAvailabilityProvider = {
      timezone: 'Asia/Kolkata',
      notice: 'Demo availability — appointment times are confirmed by our team.',
      operatingHours: {
        start: 9 * 60,   // 9:00 AM (540 min)
        end: 21 * 60     // 9:00 PM (1260 min)
      },

      /**
       * Returns array of booked intervals { start, end } in minutes from midnight.
       * Deterministic based on calendar date difference from today in IST.
       */
      getBookedIntervals(dateStr, todayStr) {
        const d1 = new Date(dateStr + 'T00:00:00');
        const d2 = new Date(todayStr + 'T00:00:00');
        const diffDays = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Today: Partially booked (e.g. 10:30-11:00 AM, 2:00-2:30 PM, 4:30-5:30 PM, 7:00-7:30 PM)
          return [
            { start: 10 * 60 + 30, end: 11 * 60 },
            { start: 14 * 60, end: 14 * 60 + 30 },
            { start: 16 * 60 + 30, end: 17 * 60 + 30 },
            { start: 19 * 60, end: 19 * 60 + 30 }
          ];
        } else if (diffDays === 1) {
          // Tomorrow: Partially booked (e.g. 11:00 AM - 12:00 PM, 3:30 - 4:00 PM, 6:00 - 6:30 PM)
          return [
            { start: 11 * 60, end: 12 * 60 },
            { start: 15 * 60 + 30, end: 16 * 60 },
            { start: 18 * 60, end: 18 * 60 + 30 }
          ];
        } else if (diffDays === 2) {
          // Day 2: FULLY BOOKED DAY demo (all 30-min slots from 9:00 AM to 9:00 PM are booked)
          const booked = [];
          for (let t = 9 * 60; t < 21 * 60; t += 30) {
            booked.push({ start: t, end: t + 30 });
          }
          return booked;
        } else if (diffDays === 3) {
          // Day 3: Widely available (only 1 midday slot booked)
          return [
            { start: 12 * 60, end: 12 * 60 + 30 }
          ];
        } else if (diffDays === 4) {
          // Day 4: Partially booked
          return [
            { start: 10 * 60, end: 10 * 60 + 30 },
            { start: 13 * 60, end: 14 * 60 },
            { start: 17 * 60, end: 18 * 60 }
          ];
        } else {
          // Deterministic hash based on date string (predictable, never random on re-render)
          const hash = dateStr.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          const booked = [];
          if (hash % 2 === 0) booked.push({ start: 10 * 60, end: 10 * 60 + 30 });
          if (hash % 3 === 0) booked.push({ start: 11 * 60 + 30, end: 12 * 60 + 30 });
          if (hash % 5 === 0) booked.push({ start: 14 * 60 + 30, end: 15 * 60 });
          if (hash % 7 === 0) booked.push({ start: 16 * 60, end: 17 * 60 });
          if (hash % 4 === 0) booked.push({ start: 18 * 60 + 30, end: 19 * 60 });
          return booked;
        }
      }
    };

    // -------------------------------------------------------------------------
    // 2. DOM ELEMENTS
    // -------------------------------------------------------------------------
    const dateInput = document.getElementById('spBookingDate');
    const calendarTriggerBtn = document.getElementById('spCalendarTriggerBtn');
    const dateTabsTrack = document.getElementById('spDateTabsTrack');
    const datePrevBtn = document.getElementById('spDatePrevBtn');
    const dateNextBtn = document.getElementById('spDateNextBtn');
    const selectedDateTitle = document.getElementById('spSelectedDateTitle');
    const availableCountNum = document.getElementById('spAvailableCountNum');
    const dateSlotCountBadge = document.getElementById('spDateSlotCountBadge');

    const durationInput = document.getElementById('spBookingDuration');
    const durationBtns = document.querySelectorAll('.sp-duration-btn');

    const slotsGridWrapper = document.getElementById('spSlotsGridWrapper');
    const slotNotice = document.getElementById('spSlotNotice');
    const selectedSlotInput = document.getElementById('spSelectedTimeSlot');

    const serviceSelect = document.getElementById('spServiceSelect');
    const consultModeSelect = document.getElementById('spConsultMode');
    const summaryBox = document.getElementById('spAppointmentSummaryBox');
    const summaryContent = document.getElementById('spSummaryContent');
    const summarySubContent = document.getElementById('spSummarySubContent');
    const validationError = document.getElementById('spBookingValidationError');
    const feedbackContainer = document.getElementById('spBookingFeedback');

    // -------------------------------------------------------------------------
    // 3. DATE & TIME HELPERS (Asia/Kolkata IST)
    // -------------------------------------------------------------------------
    function getNowIST() {
      const now = new Date();
      const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      return new Date(istString);
    }

    function getISTDateString(d = getNowIST()) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    function parseDateString(dateStr) {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    function formatFullDateIST(dateStr) {
      const dt = parseDateString(dateStr);
      if (!dt) return '';
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return weekdays[dt.getDay()] + ', ' + dt.getDate() + ' ' + months[dt.getMonth()] + ' ' + dt.getFullYear();
    }

    function formatShortDate(dateStr) {
      const dt = parseDateString(dateStr);
      if (!dt) return '';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return dt.getDate() + ' ' + months[dt.getMonth()];
    }

    function getDayLabel(dateStr, todayStr) {
      if (dateStr === todayStr) return 'Today';
      const dtToday = parseDateString(todayStr);
      const tomorrow = new Date(dtToday);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = getISTDateString(tomorrow);
      if (dateStr === tomorrowStr) return 'Tomorrow';
      const dt = parseDateString(dateStr);
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return weekdays[dt.getDay()];
    }

    function formatMinutesTo12h(mins) {
      let h = Math.floor(mins / 60);
      const m = mins % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }

    const todayIST = getISTDateString();
    let activeDateStr = todayIST;
    let windowStartDate = todayIST;

    if (dateInput) {
      dateInput.min = todayIST;
      if (!dateInput.value) {
        dateInput.value = todayIST;
      }
      activeDateStr = dateInput.value;
    }

    // -------------------------------------------------------------------------
    // 4. SLOT GENERATION & COLLISION LOGIC
    // -------------------------------------------------------------------------
    function calculateSlots(dateStr, durationMinutes) {
      const bookedIntervals = SpouzyAvailabilityProvider.getBookedIntervals(dateStr, todayIST);
      const openMin = SpouzyAvailabilityProvider.operatingHours.start;  // 540 (9:00 AM)
      const closeMin = SpouzyAvailabilityProvider.operatingHours.end; // 1260 (9:00 PM)

      const isToday = dateStr === todayIST;
      const istNow = getNowIST();
      const currentIstMinutes = istNow.getHours() * 60 + istNow.getMinutes();

      const slots = [];
      // Start times every 30 minutes. Every appointment must FINISH by closeMin (9:00 PM)
      for (let start = openMin; start + durationMinutes <= closeMin; start += 30) {
        const end = start + durationMinutes;
        const label = formatMinutesTo12h(start) + ' – ' + formatMinutesTo12h(end);
        let status = 'available';
        let statusText = 'Available';

        // Check passed slots on today
        if (isToday && start <= currentIstMinutes) {
          status = 'passed';
          statusText = 'Passed';
        }

        // Collision rule: proposedStart < bookedEnd AND proposedEnd > bookedStart
        if (status === 'available') {
          for (const booked of bookedIntervals) {
            if (start < booked.end && end > booked.start) {
              status = 'booked';
              statusText = 'Booked';
              break;
            }
          }
        }

        // Grouping: Morning (< 12:00 PM), Afternoon (12:00 PM to < 4:00 PM), Evening (>= 4:00 PM)
        let period = 'evening';
        if (start < 12 * 60) {
          period = 'morning';
        } else if (start < 16 * 60) {
          period = 'afternoon';
        }

        slots.push({
          start,
          end,
          duration: durationMinutes,
          label,
          status,
          statusText,
          period
        });
      }

      const availableCount = slots.filter(s => s.status === 'available').length;
      return { slots, availableCount };
    }

    // -------------------------------------------------------------------------
    // 5. RENDER DATE TABS
    // -------------------------------------------------------------------------
    function renderDateTabs() {
      if (!dateTabsTrack) return;
      dateTabsTrack.innerHTML = '';

      const durationVal = parseInt(durationInput ? durationInput.value : '30', 10) || 30;
      const baseDt = parseDateString(windowStartDate) || parseDateString(todayIST);

      const NUM_TABS = 7;
      for (let i = 0; i < NUM_TABS; i++) {
        const dt = new Date(baseDt);
        dt.setDate(dt.getDate() + i);
        const dStr = getISTDateString(dt);

        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'sp-date-tab';
        tabBtn.setAttribute('role', 'tab');
        tabBtn.setAttribute('data-date', dStr);

        const isCurrentActive = dStr === activeDateStr;
        if (isCurrentActive) {
          tabBtn.classList.add('is-active');
          tabBtn.setAttribute('aria-selected', 'true');
        } else {
          tabBtn.setAttribute('aria-selected', 'false');
        }

        const dayLabel = getDayLabel(dStr, todayIST);
        const shortDate = formatShortDate(dStr);

        // Pre-calculate available slot count for this tab
        const slotData = calculateSlots(dStr, durationVal);
        const count = slotData.availableCount;

        let badgeText = count + (count === 1 ? ' slot' : ' slots');
        if (count === 0) {
          badgeText = 'Fully Booked';
          tabBtn.classList.add('is-fully-booked');
        }

        tabBtn.innerHTML =
          '<span class="sp-tab-day-label">' + dayLabel + '</span>' +
          '<span class="sp-tab-date-num">' + shortDate + '</span>' +
          '<span class="sp-tab-slots-badge">' + badgeText + '</span>';

        tabBtn.addEventListener('click', function () {
          selectDate(dStr);
        });

        dateTabsTrack.appendChild(tabBtn);
      }

      // Update Prev Button state
      if (datePrevBtn) {
        datePrevBtn.disabled = windowStartDate <= todayIST;
      }
    }

    // -------------------------------------------------------------------------
    // 6. SELECT DATE & SYNCHRONIZE
    // -------------------------------------------------------------------------
    function selectDate(dStr) {
      if (dStr < todayIST) return;

      activeDateStr = dStr;
      if (dateInput) {
        dateInput.value = dStr;
      }

      // Ensure activeDateStr is inside windowStartDate .. windowStartDate + 6
      const dtActive = parseDateString(activeDateStr);
      const dtWin = parseDateString(windowStartDate);
      const diff = Math.round((dtActive - dtWin) / (1000 * 60 * 60 * 24));
      if (diff < 0 || diff >= 7) {
        windowStartDate = activeDateStr;
      }

      renderDateTabs();
      updateSelectedDateBanner();
      renderSlotGrid();
      updateSummary();
    }

    function updateSelectedDateBanner() {
      if (selectedDateTitle) {
        selectedDateTitle.textContent = formatFullDateIST(activeDateStr);
      }
      const durationVal = parseInt(durationInput ? durationInput.value : '30', 10) || 30;
      const data = calculateSlots(activeDateStr, durationVal);
      if (availableCountNum) {
        availableCountNum.textContent = data.availableCount;
      }
      if (dateSlotCountBadge) {
        if (data.availableCount === 0) {
          dateSlotCountBadge.classList.add('is-fully-booked');
          dateSlotCountBadge.innerHTML = '<span class="sp-count-num">0</span> slots · Fully Booked';
        } else {
          dateSlotCountBadge.classList.remove('is-fully-booked');
          dateSlotCountBadge.innerHTML = '<span class="sp-count-num">' + data.availableCount + '</span> ' + (data.availableCount === 1 ? 'slot' : 'slots') + ' available';
        }
      }
    }

    // -------------------------------------------------------------------------
    // 7. RENDER SLOTS GRID (Grouped into Morning, Afternoon, Evening)
    // -------------------------------------------------------------------------
    function renderSlotGrid() {
      if (!slotsGridWrapper) return;
      slotsGridWrapper.innerHTML = '';

      const durationVal = parseInt(durationInput ? durationInput.value : '30', 10) || 30;
      const result = calculateSlots(activeDateStr, durationVal);
      const slots = result.slots;

      // Check if previously selected slot is still valid
      if (selectedSlotInput && selectedSlotInput.value) {
        const currentlySelectedLabel = selectedSlotInput.value;
        const matchingSlot = slots.find(s => s.label === currentlySelectedLabel);
        if (!matchingSlot || matchingSlot.status !== 'available') {
          // Invalidate
          selectedSlotInput.value = '';
          if (slotNotice) {
            slotNotice.innerHTML = '<i class="fa fa-info-circle" style="color: var(--sp-copper); margin-right: 6px;"></i> The previously selected slot is not available for this ' + (durationVal === 60 ? '1-hour' : '30-minute') + ' selection or date. Please choose another available slot.';
            slotNotice.style.display = 'block';
          }
        } else {
          if (slotNotice) slotNotice.style.display = 'none';
        }
      }

      const periods = [
        {
          id: 'morning',
          title: 'Morning',
          icon: 'fa-sun-o',
          range: '9:00 AM – 11:30 AM starts',
          items: slots.filter(s => s.period === 'morning')
        },
        {
          id: 'afternoon',
          title: 'Afternoon',
          icon: 'fa-clock-o',
          range: '12:00 PM – 3:30 PM starts',
          items: slots.filter(s => s.period === 'afternoon')
        },
        {
          id: 'evening',
          title: 'Evening',
          icon: 'fa-moon-o',
          range: (durationVal === 60 ? '4:00 PM – 8:00 PM starts' : '4:00 PM – 8:30 PM starts'),
          items: slots.filter(s => s.period === 'evening')
        }
      ];

      periods.forEach(p => {
        if (!p.items.length) return;

        const sec = document.createElement('div');
        sec.className = 'sp-period-section';

        const hdr = document.createElement('div');
        hdr.className = 'sp-period-header';
        hdr.innerHTML =
          '<div class="sp-period-title"><i class="fa ' + p.icon + '" style="color: var(--sp-copper);"></i> ' + p.title + '</div>' +
          '<div class="sp-period-time-range">' + p.range + '</div>';
        sec.appendChild(hdr);

        const grid = document.createElement('div');
        grid.className = 'sp-period-slots-grid';

        p.items.forEach(slot => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sp-slot-card';
          btn.setAttribute('data-slot', slot.label);
          btn.setAttribute('aria-label', slot.label + ' ' + slot.statusText);

          if (slot.status === 'passed') {
            btn.classList.add('is-passed');
            btn.disabled = true;
            btn.innerHTML =
              '<span class="sp-slot-time-text">' + slot.label + '</span>' +
              '<span class="sp-slot-status-text"><i class="fa fa-history"></i> Passed</span>';
          } else if (slot.status === 'booked') {
            btn.classList.add('is-booked');
            btn.disabled = true;
            btn.innerHTML =
              '<span class="sp-slot-time-text">' + slot.label + '</span>' +
              '<span class="sp-slot-status-text"><i class="fa fa-lock"></i> Booked</span>';
          } else {
            btn.classList.add('is-available');
            const isSelected = selectedSlotInput && selectedSlotInput.value === slot.label;
            if (isSelected) {
              btn.classList.add('is-selected');
              btn.setAttribute('aria-pressed', 'true');
              btn.innerHTML =
                '<span class="sp-slot-time-text">' + slot.label + '</span>' +
                '<span class="sp-slot-status-text"><i class="fa fa-check"></i> Selected</span>';
            } else {
              btn.setAttribute('aria-pressed', 'false');
              btn.innerHTML =
                '<span class="sp-slot-time-text">' + slot.label + '</span>' +
                '<span class="sp-slot-status-text" style="font-size: 10px; opacity: 0.85;">Available</span>';
            }

            btn.addEventListener('click', function () {
              selectedSlotInput.value = slot.label;
              if (slotNotice) slotNotice.style.display = 'none';
              if (validationError) validationError.style.display = 'none';

              renderSlotGrid();
              updateSummary();
            });
          }

          grid.appendChild(btn);
        });

        sec.appendChild(grid);
        slotsGridWrapper.appendChild(sec);
      });
    }

    // -------------------------------------------------------------------------
    // 8. UPDATE APPOINTMENT SUMMARY
    // -------------------------------------------------------------------------
    function updateSummary() {
      if (!summaryContent) return;
      const durationVal = durationInput ? durationInput.value : '30';
      const slotVal = selectedSlotInput ? selectedSlotInput.value : '';
      const durationText = durationVal === '60' ? '1 hour' : '30 minutes';

      const serviceText = serviceSelect && serviceSelect.selectedIndex >= 0 ? 
        serviceSelect.options[serviceSelect.selectedIndex].text.split('(')[0].trim() : 'Clinical Consultation';
      const modeText = consultModeSelect && consultModeSelect.selectedIndex >= 0 ? 
        consultModeSelect.options[consultModeSelect.selectedIndex].text.split('(')[0].trim() : 'Encrypted Video';

      if (activeDateStr && slotVal) {
        const fullDate = formatFullDateIST(activeDateStr);
        summaryContent.className = 'sp-summary-text is-ready';
        summaryContent.innerHTML = 
          '<span class="sp-summary-highlight"><i class="fa fa-calendar-check-o"></i> ' + fullDate + '</span>' +
          '<span class="sp-summary-dot">·</span>' +
          '<span class="sp-summary-highlight"><i class="fa fa-clock-o"></i> ' + slotVal + ' IST</span>' +
          '<span class="sp-summary-dot">·</span>' +
          '<span class="sp-summary-highlight"><i class="fa fa-hourglass-half"></i> ' + durationText + '</span>';
        
        if (summarySubContent) {
          summarySubContent.style.display = 'block';
          summarySubContent.innerHTML = '<strong>' + serviceText + '</strong> · ' + modeText + '<br><small style="color: var(--sp-copper); font-weight: 600;">Subject to confirmation by SPOUZY clinical team</small>';
        }
      } else {
        summaryContent.className = 'sp-summary-text is-placeholder';
        if (activeDateStr) {
          summaryContent.textContent = 'Date: ' + formatFullDateIST(activeDateStr) + ' (' + durationText + '). Please select an available time slot above.';
        } else {
          summaryContent.textContent = 'Please choose a session duration, date, and available time slot above.';
        }
        if (summarySubContent) {
          summarySubContent.style.display = 'none';
        }
      }
    }

    // -------------------------------------------------------------------------
    // 9. EVENT LISTENERS
    // -------------------------------------------------------------------------
    // Duration toggle
    if (durationBtns.length) {
      durationBtns.forEach(btn => {
        btn.addEventListener('click', function () {
          durationBtns.forEach(b => {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          this.classList.add('is-active');
          this.setAttribute('aria-checked', 'true');

          const chosenDuration = this.getAttribute('data-duration') || '30';
          if (durationInput) durationInput.value = chosenDuration;

          renderDateTabs();
          updateSelectedDateBanner();
          renderSlotGrid();
          updateSummary();
        });
      });
    }

    // Native Date Picker Synchronization
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        if (!this.value) return;
        if (this.value < todayIST) {
          this.value = todayIST;
        }
        selectDate(this.value);
      });
    }

    // Previous Date Range Navigation
    if (datePrevBtn) {
      datePrevBtn.addEventListener('click', function () {
        const dt = parseDateString(windowStartDate);
        dt.setDate(dt.getDate() - 7);
        let newStart = getISTDateString(dt);
        if (newStart < todayIST) newStart = todayIST;
        windowStartDate = newStart;
        renderDateTabs();
      });
    }

    // Next Date Range Navigation
    if (dateNextBtn) {
      dateNextBtn.addEventListener('click', function () {
        const dt = parseDateString(windowStartDate);
        dt.setDate(dt.getDate() + 7);
        windowStartDate = getISTDateString(dt);
        renderDateTabs();
      });
    }

    if (serviceSelect) {
      serviceSelect.addEventListener('change', updateSummary);
    }

    if (consultModeSelect) {
      consultModeSelect.addEventListener('change', updateSummary);
    }

    // -------------------------------------------------------------------------
    // 10. SUBMISSION HANDLER -> WHATSAPP
    // -------------------------------------------------------------------------
    function showBookingError(msg) {
      if (validationError) {
        validationError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        validationError.style.display = 'block';
        validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (validationError) validationError.style.display = 'none';

      const dateVal = dateInput ? dateInput.value : activeDateStr;
      const slotVal = selectedSlotInput ? selectedSlotInput.value : '';
      const durationVal = durationInput ? durationInput.value : '30';
      const durationText = durationVal === '60' ? '1 hour' : '30 minutes';

      const patientNameInput = document.getElementById('spPatientName');
      const patientPhoneInput = document.getElementById('spPatientPhone');
      const patientEmailInput = document.getElementById('spPatientEmail');
      const patientNotesInput = document.getElementById('spPatientNotes');

      const patientName = patientNameInput ? patientNameInput.value.trim() : '';
      const patientPhone = patientPhoneInput ? patientPhoneInput.value.trim() : '';
      const patientEmail = patientEmailInput ? patientEmailInput.value.trim() : '';
      const patientNotes = patientNotesInput ? patientNotesInput.value.trim() : '';

      if (!dateVal) {
        showBookingError('Please choose an appointment date.');
        return;
      }

      if (dateVal < todayIST) {
        showBookingError('Past dates cannot be selected. Please choose today or a future date.');
        return;
      }

      if (!slotVal) {
        showBookingError('Please select an available appointment time slot.');
        if (slotsGridWrapper) slotsGridWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Revalidate slot availability before submitting
      const currentSlotData = calculateSlots(dateVal, parseInt(durationVal, 10));
      const matchingSlot = currentSlotData.slots.find(s => s.label === slotVal);
      if (!matchingSlot || matchingSlot.status !== 'available') {
        showBookingError('The requested time slot (' + slotVal + ') is no longer available. Please choose another slot.');
        renderSlotGrid();
        return;
      }

      if (!patientName) {
        showBookingError('Please provide your name or discreet alias.');
        if (patientNameInput) patientNameInput.focus();
        return;
      }

      if (!patientPhone) {
        showBookingError('Please provide your mobile / WhatsApp number.');
        if (patientPhoneInput) patientPhoneInput.focus();
        return;
      }

      if (!patientEmail || !patientEmail.includes('@')) {
        showBookingError('Please provide a valid confidential email ID.');
        if (patientEmailInput) patientEmailInput.focus();
        return;
      }

      const fullDate = formatFullDateIST(dateVal);
      const serviceText = serviceSelect && serviceSelect.selectedIndex >= 0 ? serviceSelect.options[serviceSelect.selectedIndex].text.trim() : 'Guidance Consultation';
      const modeText = consultModeSelect && consultModeSelect.selectedIndex >= 0 ? consultModeSelect.options[consultModeSelect.selectedIndex].text.trim() : 'Encrypted Video';

      const lines = [
        'Hello SPOUZY, I would like to request an appointment.',
        '',
        'Name / Alias: ' + patientName,
        'Phone: ' + patientPhone,
        'Email: ' + patientEmail,
        'Service: ' + serviceText,
        'Consultation Mode: ' + modeText,
        'Requested Date: ' + fullDate,
        'Requested Time: ' + slotVal + ' (IST)',
        'Duration: ' + durationText,
        'Timezone: Asia/Kolkata (IST)',
        'Additional Information: ' + (patientNotes || 'Not provided'),
        '',
        'Please confirm availability and next steps. (Subject to confirmation)'
      ];

      const fullMessage = lines.join('\n');
      openWhatsAppHandoff('918591945055', fullMessage, feedbackContainer);
    });

    // -------------------------------------------------------------------------
    // 11. URL QUERY PARAMETER PRE-SELECTION
    // -------------------------------------------------------------------------
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rawService = urlParams.get('service');
      const rawMode = urlParams.get('mode');

      if (rawService && serviceSelect) {
        const normService = rawService.trim().toLowerCase();
        for (let i = 0; i < serviceSelect.options.length; i++) {
          if (serviceSelect.options[i].value.toLowerCase().includes(normService)) {
            serviceSelect.selectedIndex = i;
            break;
          }
        }
      }

      if (rawMode && consultModeSelect) {
        const normMode = rawMode.trim().toLowerCase();
        for (let i = 0; i < consultModeSelect.options.length; i++) {
          if (consultModeSelect.options[i].value.toLowerCase().includes(normMode)) {
            consultModeSelect.selectedIndex = i;
            break;
          }
        }
      }
    } catch (e) {}

    // Initial render
    renderDateTabs();
    updateSelectedDateBanner();
    renderSlotGrid();
    updateSummary();
  }

`;

js = js.substring(0, startIndex) + newSchedulerJS + js.substring(endIndex);
fs.writeFileSync(path, js, 'utf8');
console.log('Successfully updated js/spouzy-modern.js with upgraded scheduler engine.');
