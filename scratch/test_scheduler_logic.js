// Verification test for Spouzy availability and interval collision logic
const SpouzyAvailabilityProvider = {
  timezone: 'Asia/Kolkata',
  operatingHours: {
    start: 9 * 60,   // 540 (9:00 AM)
    end: 21 * 60     // 1260 (9:00 PM)
  },

  getBookedIntervals(dateStr, todayStr) {
    const d1 = new Date(dateStr + 'T00:00:00');
    const d2 = new Date(todayStr + 'T00:00:00');
    const diffDays = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return [
        { start: 10 * 60 + 30, end: 11 * 60 },
        { start: 14 * 60, end: 14 * 60 + 30 },
        { start: 16 * 60 + 30, end: 17 * 60 + 30 },
        { start: 19 * 60, end: 19 * 60 + 30 }
      ];
    } else if (diffDays === 1) {
      return [
        { start: 11 * 60, end: 12 * 60 },
        { start: 15 * 60 + 30, end: 16 * 60 },
        { start: 18 * 60, end: 18 * 60 + 30 }
      ];
    } else if (diffDays === 2) {
      const booked = [];
      for (let t = 9 * 60; t < 21 * 60; t += 30) {
        booked.push({ start: t, end: t + 30 });
      }
      return booked;
    } else if (diffDays === 3) {
      return [
        { start: 12 * 60, end: 12 * 60 + 30 }
      ];
    } else {
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

function formatMinutesTo12h(mins) {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function generateSlots(dateStr, durationMinutes, todayStr, currentIstMinutes) {
  const bookedIntervals = SpouzyAvailabilityProvider.getBookedIntervals(dateStr, todayStr);
  const openMin = SpouzyAvailabilityProvider.operatingHours.start;
  const closeMin = SpouzyAvailabilityProvider.operatingHours.end;
  const isToday = dateStr === todayStr;

  const slots = [];
  // Start times every 30 minutes. Every appointment must FINISH by closeMin (9:00 PM)
  for (let start = openMin; start + durationMinutes <= closeMin; start += 30) {
    const end = start + durationMinutes;
    const label = formatMinutesTo12h(start) + ' – ' + formatMinutesTo12h(end);
    let status = 'available';
    let statusText = 'Available';

    // Check if slot has passed for today
    if (isToday && start <= currentIstMinutes) {
      status = 'passed';
      statusText = 'Passed';
    }

    // Check collision with booked intervals: proposedStart < bookedEnd AND proposedEnd > bookedStart
    if (status === 'available') {
      for (const booked of bookedIntervals) {
        if (start < booked.end && end > booked.start) {
          status = 'booked';
          statusText = 'Booked';
          break;
        }
      }
    }

    // Determine period: Morning (< 12:00 PM), Afternoon (12:00 PM to < 4:00 PM), Evening (>= 4:00 PM)
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

// RUN TESTS
console.log('=== TEST 1: Collision logic with booked 10:30 - 11:00 AM ===');
const sampleBooked = [{ start: 630, end: 660 }]; // 10:30 - 11:00 AM
// Check adjacent 30m slot before: 10:00 - 10:30 (600 - 630)
const coll1 = (600 < 660 && 630 > 630);
console.log('Adjacent 10:00-10:30 AM before: collides?', coll1, '(expected: false)');
// Check 1h slot starting at 10:00 AM: 10:00 - 11:00 (600 - 660)
const coll2 = (600 < 660 && 660 > 630);
console.log('1-hour 10:00-11:00 AM: collides?', coll2, '(expected: true)');
// Check 30m slot starting at 10:30 AM: 10:30 - 11:00 (630 - 660)
const coll3 = (630 < 660 && 660 > 630);
console.log('30-min 10:30-11:00 AM: collides?', coll3, '(expected: true)');
// Check 1h slot starting at 10:30 AM: 10:30 - 11:30 (630 - 690)
const coll4 = (630 < 660 && 690 > 630);
console.log('1-hour 10:30-11:30 AM: collides?', coll4, '(expected: true)');
// Check adjacent 30m slot after: 11:00 - 11:30 (660 - 690)
const coll5 = (660 < 660 && 690 > 630);
console.log('Adjacent 11:00-11:30 AM after: collides?', coll5, '(expected: false)');

console.log('\n=== TEST 2: Operating Hours & Last Slots ===');
const todayStr = '2026-11-17';
const res30 = generateSlots(todayStr, 30, todayStr, 0); // simulated midnight
const last30 = res30.slots[res30.slots.length - 1];
console.log('30-min total slots generated:', res30.slots.length, 'Last slot:', last30.label, '(expected: 08:30 PM – 09:00 PM)');

const res60 = generateSlots(todayStr, 60, todayStr, 0);
const last60 = res60.slots[res60.slots.length - 1];
console.log('1-hour total slots generated:', res60.slots.length, 'Last slot:', last60.label, '(expected: 08:00 PM – 09:00 PM)');

console.log('\n=== TEST 3: Periods Grouping (30-min) ===');
const mornings = res30.slots.filter(s => s.period === 'morning');
const afternoons = res30.slots.filter(s => s.period === 'afternoon');
const evenings = res30.slots.filter(s => s.period === 'evening');
console.log('Morning slots:', mornings.map(s => s.label.split(' – ')[0]).join(', '));
console.log('Afternoon slots:', afternoons.map(s => s.label.split(' – ')[0]).join(', '));
console.log('Evening slots:', evenings.map(s => s.label.split(' – ')[0]).join(', '));

console.log('\n=== TEST 4: Fully Booked Day (Day 2) ===');
const day2Str = '2026-11-19';
const resDay2_30 = generateSlots(day2Str, 30, todayStr, 0);
console.log('Day 2 (30-min) available slots count:', resDay2_30.availableCount, '(expected: 0)');
const resDay2_60 = generateSlots(day2Str, 60, todayStr, 0);
console.log('Day 2 (60-min) available slots count:', resDay2_60.availableCount, '(expected: 0)');

console.log('\nAll tests completed!');
