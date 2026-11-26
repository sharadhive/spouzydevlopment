/**
 * Migration 8: bills (invoices), saved bill details and admin notifications.
 * - Creates `billing_profiles`, `customer_billing_details`, `invoices`, `notifications`, `notification_reads`.
 * - Nothing is added to them: bills appear after the next payment, and the "Bill from" details are entered
 *   by staff on the first bill (then offered in a dropdown).
 * Idempotent: safe on fresh and existing databases.
 */
module.exports = {
  name: '20261120000008-bills-and-notifications.js',

  async up() {
    console.log('Running migration: 20261120000008-bills-and-notifications.js...');
    const models = require('../models');
    await models.BillingProfile.sync();
    await models.CustomerBillingDetail.sync();
    await models.Invoice.sync();
    await models.Notification.sync();
    await models.NotificationRead.sync();
    console.log('  + billing_profiles, customer_billing_details, invoices, notifications, notification_reads ready');
    console.log('Migration 8 completed successfully.');
  },

  async down() {
    console.log('Migration 8 has no automatic rollback (additive).');
  }
};
