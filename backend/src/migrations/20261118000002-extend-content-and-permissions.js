/**
 * Migration: Extend user authentication with forced password change,
 * extend hero banners & tips metadata, create homepage sections and revision histories,
 * and ensure Clinical Director role exists.
 */

module.exports = {
  name: '20261118000002-extend-content-and-permissions.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261118000002-extend-content-and-permissions.js...');

    // 1. Helper to safely add column if not exists
    async function addColumnIfNotExists(table, column, definition) {
      const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}';`);
      if (cols.length === 0) {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition};`);
        console.log(`  + Added column \`${table}\`.\`${column}\``);
      }
    }

    // 2. Extend `users` table
    await addColumnIfNotExists('users', 'must_change_password', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfNotExists('users', 'custom_permissions', 'JSON NULL');

    // 3. Extend `hero_banners` table
    await addColumnIfNotExists('hero_banners', 'admin_title', 'VARCHAR(150) NULL');
    await addColumnIfNotExists('hero_banners', 'mobile_image_path', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('hero_banners', 'focal_point', 'VARCHAR(50) NOT NULL DEFAULT "center center"');
    await addColumnIfNotExists('hero_banners', 'overlay_strength', 'FLOAT NOT NULL DEFAULT 0.45');
    await addColumnIfNotExists('hero_banners', 'text_alignment', 'VARCHAR(20) NOT NULL DEFAULT "left"');
    await addColumnIfNotExists('hero_banners', 'pills', 'JSON NULL');
    await addColumnIfNotExists('hero_banners', 'status', 'ENUM("published", "draft", "disabled") NOT NULL DEFAULT "published"');

    // 4. Extend `tips` table
    await addColumnIfNotExists('tips', 'category', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('tips', 'alt_text', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('tips', 'cta_label', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('tips', 'cta_url', 'VARCHAR(255) NULL');

    // 5. Create `homepage_sections` table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`homepage_sections\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`section_key\` VARCHAR(100) NOT NULL UNIQUE,
        \`section_name\` VARCHAR(150) NOT NULL,
        \`headline\` VARCHAR(255) NULL,
        \`subheadline\` VARCHAR(255) NULL,
        \`body_text\` TEXT NULL,
        \`content_json\` JSON NOT NULL,
        \`is_visible\` TINYINT(1) NOT NULL DEFAULT 1,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`version\` INT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  + Ensured table `homepage_sections` exists');

    // 6. Create `homepage_section_histories` table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS \`homepage_section_histories\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`section_id\` INT NOT NULL,
        \`version\` INT NOT NULL,
        \`content_json\` JSON NOT NULL,
        \`changed_by_user_id\` INT NULL,
        \`notes\` VARCHAR(255) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_hsh_section\` FOREIGN KEY (\`section_id\`) REFERENCES \`homepage_sections\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_hsh_user\` FOREIGN KEY (\`changed_by_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  + Ensured table `homepage_section_histories` exists');

    // 7. Ensure Clinical Director role exists in `roles` table
    const [directorRoles] = await sequelize.query(`SELECT id FROM \`roles\` WHERE \`slug\` = 'clinical_director';`);
    if (directorRoles.length === 0) {
      const defaultDirectorPerms = JSON.stringify([
        'clinical_apps:view',
        'clinical_apps:edit',
        'clinical_apps:export',
        'clinical_apps:download_docs',
        'practitioners:view',
        'practitioners:edit',
        'schedules:view',
        'schedules:edit',
        'services:view',
        'appointments:view',
        'appointments:create',
        'appointments:edit',
        'appointments:reschedule',
        'blogs:view',
        'blogs:edit',
        'faqs:view',
        'faqs:edit'
      ]);
      await sequelize.query(`
        INSERT INTO \`roles\` (\`slug\`, \`name\`, \`description\`, \`permissions\`, \`created_at\`, \`updated_at\`)
        VALUES (
          'clinical_director',
          'Clinical Director',
          'Clinical governance, practitioner scheduling, application approvals, and medical advisory oversight.',
          ?,
          NOW(),
          NOW()
        );
      `, { replacements: [defaultDirectorPerms] });
      console.log('  + Inserted `clinical_director` role record');
    }

    console.log('Migration completed successfully.');
  },

  async down({ sequelize }) {
    console.log('Rolling back 20261118000002-extend-content-and-permissions.js...');
    await sequelize.query('DROP TABLE IF EXISTS `homepage_section_histories`;');
    await sequelize.query('DROP TABLE IF EXISTS `homepage_sections`;');
  }
};
