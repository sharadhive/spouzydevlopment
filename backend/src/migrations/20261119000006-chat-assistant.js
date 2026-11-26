/**
 * Migration 6: website chat assistant (conversations, messages) and its settings.
 * Idempotent: safe on fresh and existing databases.
 */
module.exports = {
  name: '20261119000006-chat-assistant.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261119000006-chat-assistant.js...');
    const models = require('../models');
    await models.ChatConversation.sync();
    await models.ChatMessage.sync();
    console.log('  + chat_conversations, chat_messages ready');

    const defaults = [
      ['chat_enabled', 'true', 'Show the chat assistant on the website'],
      ['chat_idle_seconds', '30', 'End a chat after this many seconds without a reply']
    ];
    for (const [key, value, description] of defaults) {
      const [rows] = await sequelize.query('SELECT `id` FROM `site_settings` WHERE `setting_key` = ?;', { replacements: [key] });
      if (!rows.length) {
        await sequelize.query(
          "INSERT INTO `site_settings` (`setting_key`, `setting_value`, `category`, `description`, `is_public`, `created_at`, `updated_at`) VALUES (?, ?, 'chat', ?, 1, NOW(), NOW());",
          { replacements: [key, value, description] }
        );
        console.log(`  + Setting ${key} = ${value}`);
      }
    }
    console.log('Migration 6 completed successfully.');
  },

  async down() {
    console.log('Migration 6 has no automatic rollback (additive).');
  }
};
