/**
 * Migration 7: offers (card images shown in a website popup and on package cards).
 * - Creates `offers` when missing. No offers are added: the popup stays off until the admin uploads one.
 * - Adds the offer permissions to existing staff roles without removing anything.
 * Idempotent: safe on fresh and existing databases.
 */
const { ADDED_PERMISSIONS } = require('../config/permissions');

module.exports = {
  name: '20261120000007-offers.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261120000007-offers.js...');
    const models = require('../models');
    await models.Offer.sync();
    console.log('  + offers table ready');

    const additions = ADDED_PERMISSIONS['20261120000007'] || {};
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
        console.log(`  ~ Added offer permissions to role \`${slug}\``);
      }
    }
    console.log('Migration 7 completed successfully.');
  },

  async down() {
    console.log('Migration 7 has no automatic rollback (additive).');
  }
};
