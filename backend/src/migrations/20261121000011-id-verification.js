/**
 * Migration 11: student and ex-servicemen ID verification.
 * - Creates `id_verifications` (one row per upload; the ID files are private, like doctor certificates).
 * - New permissions `verifications:view` / `verifications:edit` exist for custom roles later; only the
 *   Administrator role (all permissions) has them now. Nothing else changes.
 * Idempotent: safe on fresh and existing databases.
 */
module.exports = {
  name: '20261121000011-id-verification.js',

  async up() {
    console.log('Running migration: 20261121000011-id-verification.js...');
    const models = require('../models');
    await models.IdVerification.sync();
    console.log('  + id_verifications ready');
    console.log('Migration 11 completed successfully.');
  },

  async down() {
    console.log('Migration 11 has no automatic rollback (additive).');
  }
};
