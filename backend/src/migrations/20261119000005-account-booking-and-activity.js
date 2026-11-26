/**
 * Migration 5: bookings linked to customer accounts, customer activity log,
 * and the "require an account to book" website setting.
 * Idempotent: safe on fresh and existing databases.
 */
module.exports = {
  name: '20261119000005-account-booking-and-activity.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261119000005-account-booking-and-activity.js...');
    const models = require('../models');

    const [cols] = await sequelize.query("SHOW COLUMNS FROM `appointments` LIKE 'user_id';");
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE `appointments` ADD COLUMN `user_id` INT NULL AFTER `client_whatsapp`;');
      await sequelize.query('CREATE INDEX `appointments_user_id` ON `appointments` (`user_id`);');
      console.log('  + Added column `appointments`.`user_id`');
    }

    await models.CustomerActivity.sync();
    console.log('  + customer_activities ready');

    const [rows] = await sequelize.query("SELECT `id` FROM `site_settings` WHERE `setting_key` = 'booking_requires_account';");
    if (!rows.length) {
      await sequelize.query(
        "INSERT INTO `site_settings` (`setting_key`, `setting_value`, `category`, `description`, `is_public`, `created_at`, `updated_at`) VALUES ('booking_requires_account', 'true', 'booking', 'Customers must log in or create an account to book appointments', 1, NOW(), NOW());"
      );
      console.log('  + Setting booking_requires_account = true');
    }

    console.log('Migration 5 completed successfully.');
  },

  async down() {
    console.log('Migration 5 has no automatic rollback (additive).');
  }
};
