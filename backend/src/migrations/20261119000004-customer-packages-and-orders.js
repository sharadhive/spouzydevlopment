/**
 * Migration 4: customer packages, cart and package orders.
 * - Creates `packages`, `cart_items`, `package_orders` when missing.
 * - Adds `payment_orders.package_order_id` so online payments can be linked to package orders.
 * - Adds the new shop permissions to existing staff roles without removing anything.
 * Idempotent: safe on a fresh database (tables already created by migration 1) and on older ones.
 */
const { ADDED_PERMISSIONS } = require('../config/permissions');

module.exports = {
  name: '20261119000004-customer-packages-and-orders.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261119000004-customer-packages-and-orders.js...');
    const models = require('../models');

    // 1. New tables (sync() only creates tables that do not exist yet)
    await models.Package.sync();
    await models.PackageOrder.sync();
    await models.CartItem.sync();
    console.log('  + packages, package_orders, cart_items ready');

    // 2. Link payment orders to package orders
    const [cols] = await sequelize.query("SHOW COLUMNS FROM `payment_orders` LIKE 'package_order_id';");
    if (cols.length === 0) {
      await sequelize.query('ALTER TABLE `payment_orders` ADD COLUMN `package_order_id` INT NULL AFTER `appointment_id`;');
      console.log('  + Added column `payment_orders`.`package_order_id`');
    }

    // 3. Merge the new permissions into existing roles
    const additions = ADDED_PERMISSIONS['20261119000004'] || {};
    for (const [slug, perms] of Object.entries(additions)) {
      const [rows] = await sequelize.query('SELECT `id`, `permissions` FROM `roles` WHERE `slug` = ?;', { replacements: [slug] });
      if (!rows.length) continue;
      let current = rows[0].permissions;
      if (typeof current === 'string') {
        try { current = JSON.parse(current); } catch (e) { current = []; }
      }
      current = Array.isArray(current) ? current : [];
      const merged = Array.from(new Set([...current, ...perms]));
      if (merged.length !== current.length) {
        await sequelize.query('UPDATE `roles` SET `permissions` = ?, `updated_at` = NOW() WHERE `id` = ?;', {
          replacements: [JSON.stringify(merged), rows[0].id]
        });
        console.log(`  ~ Added shop permissions to role \`${slug}\``);
      }
    }

    console.log('Migration 4 completed successfully.');
  },

  async down() {
    console.log('Migration 4 has no automatic rollback (tables and columns are additive).');
  }
};
