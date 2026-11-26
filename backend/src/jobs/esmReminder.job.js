/**
 * Daily: raise an admin notification for every verified ex-serviceman whose yearly consultation reminder is due
 * (12 months after the last consultation, or after the approval when there was none yet).
 */
async function raiseEsmReminders() {
  try {
    const n = await require('../services/verification.service').raiseYearlyReminders();
    if (n) console.log(`[Reminders] ${n} ex-servicemen yearly consultation reminder(s) raised.`);
    return n;
  } catch (err) {
    console.error('[Reminders] Could not check yearly reminders:', err.message);
    return 0;
  }
}

module.exports = { raiseEsmReminders };
