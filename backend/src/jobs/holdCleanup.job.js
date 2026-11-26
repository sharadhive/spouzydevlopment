const { Appointment, AppointmentStatusHistory, PaymentOrder } = require('../models');
const { Op } = require('sequelize');

/**
 * Release paid-booking slot holds whose payment window expired.
 */
async function cleanExpiredHolds() {
  try {
    const now = new Date();
    const expiredAppointments = await Appointment.findAll({
      where: {
        status: 'hold',
        hold_expires_at: { [Op.lt]: now }
      }
    });

    if (expiredAppointments.length > 0) {
      console.log(`[Job: holdCleanup] Found ${expiredAppointments.length} expired holds to release.`);
      for (const apt of expiredAppointments) {
        await apt.update({
          status: 'cancelled',
          payment_status: apt.payment_status === 'paid' ? 'paid' : 'failed',
          cancellation_reason: 'Slot hold expired without payment confirmation'
        });
        await AppointmentStatusHistory.create({
          appointment_id: apt.id,
          previous_status: 'hold',
          new_status: 'cancelled',
          changed_by_user_id: null,
          notes: 'Slot hold expired without payment confirmation'
        });
        await PaymentOrder.update(
          { status: 'expired' },
          { where: { appointment_id: apt.id, status: { [Op.in]: ['created', 'attempted'] } } }
        );
      }
    }
  } catch (err) {
    console.error('[Job: holdCleanup] Error cleaning expired holds:', err.message);
  }

  // Keep customer activity for 180 days (checked at most once an hour)
  if (Date.now() - lastActivityCleanup > 3600 * 1000) {
    lastActivityCleanup = Date.now();
    try {
      const removed = await require('../services/activity.service').cleanup();
      if (removed) console.log(`[Job: holdCleanup] Removed ${removed} activity records older than 180 days.`);
    } catch (err) {
      console.error('[Job: holdCleanup] Activity cleanup failed:', err.message);
    }
  }
}
let lastActivityCleanup = 0;

// Allow running directly from a cPanel cron job:
//   node backend/src/jobs/holdCleanup.job.js
if (require.main === module) {
  cleanExpiredHolds().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { cleanExpiredHolds };
