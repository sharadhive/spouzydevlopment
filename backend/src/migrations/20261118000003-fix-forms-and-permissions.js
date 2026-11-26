/**
 * Migration 3: fields needed by the website forms (consent, declaration, booking type,
 * clinic location, enquiry source) and the canonical role permission sets.
 * Idempotent: safe to run on an existing database or after a fresh sequelize.sync().
 */
const { ROLE_DEFINITIONS } = require('../config/permissions');

// Original seed banners → the content actually shown on the live homepage.
// Only rows still holding the untouched original seed values are updated.
const HERO_BANNER_SYNC = [
  {
    "match": {
      "image_path": "image/hero-marriage.webp",
      "headline": "Space to Talk.",
      "cta_label": "Book Private Consultation"
    },
    "set": {
      "admin_title": "Marriage & Couples Therapy",
      "tag_eyebrow": "PSG CLINICAL WING",
      "category_sub": "Marriage & Couples Therapy",
      "headline": "Space to Talk.",
      "headline_emphasis": "Room to Reconnect.",
      "description": "Make space for the conversation you keep postponing. Explore communication, trust and everyday life together.",
      "pills": [
        "Communication Pattern Reset",
        "Trust & Emotional Safety",
        "Pre- & Post-Marital Guidance"
      ],
      "cta_label": "Book Marriage Session ↗",
      "cta_url": "book-appoinment.htm?service=couples-therapy",
      "secondary_cta_label": "Explore Care Options →",
      "secondary_cta_url": "#services",
      "image_path": "image/hero-marriage.webp",
      "alt_text": "A couple talking together at home",
      "sort_order": 1,
      "is_active": true,
      "status": "published"
    }
  },
  {
    "match": {
      "image_path": "image/hero-premarital.webp",
      "headline": "Before You Say I Do.",
      "cta_label": "Pre-Marriage Guidance"
    },
    "set": {
      "admin_title": "Life Foundations & Harmony",
      "tag_eyebrow": "PRE-MARITAL READINESS",
      "category_sub": "Life Foundations & Harmony",
      "headline": "Strong Foundations.",
      "headline_emphasis": "Clear Expectations for Life.",
      "description": "Before marriage, talk through expectations about money, family and the life you want to build together.",
      "pills": [
        "Pre-Marital Alignment Framework",
        "Partner Compatibility Analysis",
        "Joint Values & Life Planning"
      ],
      "cta_label": "Book Pre-Marital Guidance ↗",
      "cta_url": "book-appoinment.htm?service=premarital",
      "secondary_cta_label": "Explore Care Options →",
      "secondary_cta_url": "#services",
      "image_path": "image/hero-premarital.webp",
      "alt_text": "An engaged couple planning their future together",
      "sort_order": 4,
      "is_active": true,
      "status": "published"
    }
  },
  {
    "match": {
      "image_path": "image/hero-clinical.webp",
      "headline": "Confidential Clinical Care.",
      "cta_label": "Intimate Health Clinic"
    },
    "set": {
      "admin_title": "Doctor Consultation & Wellness",
      "tag_eyebrow": "CONFIDENTIAL CLINICAL CARE",
      "category_sub": "Doctor Consultation & Wellness",
      "headline": "Sensitive Questions.",
      "headline_emphasis": "Thoughtful Medical Care.",
      "description": "Bring your questions about intimacy and physical health to an individual consultation.",
      "pills": [
        "Certified Medical Doctors",
        "Breast & Genital Specialized Clinic",
        "100% Private Consultations"
      ],
      "cta_label": "Consult a Doctor Online ↗",
      "cta_url": "book-appoinment.htm?service=intimacy-clinic",
      "secondary_cta_label": "Explore Clinical Services →",
      "secondary_cta_url": "#services",
      "image_path": "image/hero-clinical.webp",
      "alt_text": "A patient talking privately with a doctor",
      "sort_order": 2,
      "is_active": true,
      "status": "published"
    }
  },
  {
    "match": {
      "image_path": "image/hero-mediation.webp",
      "headline": "Peaceful Transitions.",
      "cta_label": "Divorce Mediation"
    },
    "set": {
      "admin_title": "Amicable Separation Mediation",
      "tag_eyebrow": "PSG DISPUTE ADVISORY",
      "category_sub": "Amicable Separation Mediation",
      "headline": "A Difficult Decision.",
      "headline_emphasis": "A Dignified, Respectful Process.",
      "description": "Explore separation at your own pace, with room to discuss responsibilities and the decisions ahead.",
      "pills": [
        "Amicable Dispute Resolution",
        "Child-First Custody Mediation",
        "Asset & Financial Settlement"
      ],
      "cta_label": "Schedule Private Mediation ↗",
      "cta_url": "contactus.htm",
      "secondary_cta_label": "Learn About PSG →",
      "secondary_cta_url": "about-profile.htm",
      "image_path": "image/hero-mediation.webp",
      "alt_text": "Two partners discussing documents with a mediator",
      "sort_order": 3,
      "is_active": true,
      "status": "published"
    }
  }
];

module.exports = {
  name: '20261118000003-fix-forms-and-permissions.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261118000003-fix-forms-and-permissions.js...');

    async function addColumnIfNotExists(table, column, definition) {
      const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}';`);
      if (cols.length === 0) {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition};`);
        console.log(`  + Added column \`${table}\`.\`${column}\``);
      }
    }

    // 1. Careers: consent
    await addColumnIfNotExists('career_applications', 'consent_agreed', 'TINYINT(1) NOT NULL DEFAULT 0');

    // 2. Clinical applications: declaration evidence
    await addColumnIfNotExists('clinical_applications', 'declaration_date', 'VARCHAR(10) NULL');
    await addColumnIfNotExists('clinical_applications', 'signed_name', 'VARCHAR(150) NULL');
    await addColumnIfNotExists('clinical_applications', 'signature_asset_id', 'INT NULL');

    // 3. Enquiries: separate columns instead of overloading preferred_clinic / message
    await addColumnIfNotExists('enquiries', 'service_interest', 'VARCHAR(200) NULL');
    await addColumnIfNotExists('enquiries', 'preferred_contact_method', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('enquiries', 'consent_agreed', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfNotExists('enquiries', 'source', "VARCHAR(50) NOT NULL DEFAULT 'contact_page'");

    // 4. Appointments: free vs paid and in-person clinic
    await addColumnIfNotExists('appointments', 'booking_type', "VARCHAR(10) NOT NULL DEFAULT 'paid'");
    await addColumnIfNotExists('appointments', 'clinic_location', 'VARCHAR(50) NULL');

    // 5. Canonical role permissions (update existing roles by slug, insert missing ones)
    for (const role of ROLE_DEFINITIONS) {
      const [rows] = await sequelize.query('SELECT id FROM `roles` WHERE `slug` = ?;', { replacements: [role.slug] });
      if (rows.length) {
        await sequelize.query(
          'UPDATE `roles` SET `permissions` = ?, `name` = ?, `description` = ?, `updated_at` = NOW() WHERE `slug` = ?;',
          { replacements: [JSON.stringify(role.permissions), role.name, role.description, role.slug] }
        );
        console.log(`  ~ Updated permissions for role \`${role.slug}\``);
      } else {
        await sequelize.query(
          'INSERT INTO `roles` (`slug`, `name`, `description`, `permissions`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, NOW(), NOW());',
          { replacements: [role.slug, role.name, role.description, JSON.stringify(role.permissions)] }
        );
        console.log(`  + Inserted role \`${role.slug}\``);
      }
    }

    // 6. Bring untouched seeded hero banners in line with the live homepage slides
    for (const pair of HERO_BANNER_SYNC) {
      const n = pair.set;
      const [result] = await sequelize.query(
        'UPDATE `hero_banners` SET `admin_title`=?, `tag_eyebrow`=?, `category_sub`=?, `headline`=?, `headline_emphasis`=?, `description`=?, `pills`=?, ' +
        '`cta_label`=?, `cta_url`=?, `secondary_cta_label`=?, `secondary_cta_url`=?, `alt_text`=?, `sort_order`=?, `updated_at`=NOW() ' +
        'WHERE `image_path`=? AND `headline`=? AND `cta_label`=?;',
        { replacements: [n.admin_title, n.tag_eyebrow, n.category_sub, n.headline, n.headline_emphasis, n.description, JSON.stringify(n.pills || []),
          n.cta_label, n.cta_url, n.secondary_cta_label, n.secondary_cta_url, n.alt_text, n.sort_order,
          pair.match.image_path, pair.match.headline, pair.match.cta_label] }
      );
      if (result && result.affectedRows) console.log(`  ~ Synced hero banner ${n.image_path} with the live homepage`);
    }

    console.log('Migration 3 completed successfully.');
  },

  async down() {
    // Additive, data-preserving migration: no automatic rollback.
    console.log('Migration 3 has no automatic rollback (columns are additive).');
  }
};
