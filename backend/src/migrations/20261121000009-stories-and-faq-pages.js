/**
 * Migration 9: customer stories and FAQ placement.
 * - visitor_stories: account owner, rating, service, city, couple detail, badge, verified flag, hide/show,
 *   homepage order and a note to the customer.
 * - faqs: where each question shows (FAQ page, homepage questions, "What We Do" pages).
 * - Copies the questions that were typed into index.htm and faq.htm into the admin (only if missing),
 *   so the admin can edit them. The 3 stories that were typed into the homepage are copied in as HIDDEN:
 *   nothing shows on the website until the admin approves or un-hides a story.
 * Idempotent: safe on fresh and existing databases.
 */
const SEED_FAQS = [
  {
    category: 'About SPOUZY',
    question: 'How are SPOUZY and PSG connected?',
    answer_html: '<p>SPOUZY is the relationship and intimate health wing of Problem Solver Group, founded by Neilesh Jethmal in 2004.</p>',
    show_on_home: false
  },
  {
    category: 'About SPOUZY',
    question: 'Which resources are free to use?',
    answer_html: '<p>The student guide, ex-servicemen family guide, Do’s and Don’ts, blog, Gen Z Kama Sutra and homepage self-assessment are available to read or use without booking.</p>',
    show_on_home: false
  },
  {
    category: 'About SPOUZY',
    question: 'How can I join the team?',
    answer_html: '<p>Open Join Our Team, select Doctor or Counsellor, and follow the professional enquiry link on that page.</p>',
    show_on_home: false
  },
  {
    category: 'Privacy & Confidentiality',
    question: 'Is our session strictly confidential?',
    answer_html: '<p>Yes, absolutely. All sessions adhere to strict clinical confidentiality and legal privilege under our <a href="confidentiality.htm">Confidentiality Pledge</a> and <a href="privacy-policy.htm">Privacy Policy</a>. We do not share records with any third parties, and anonymous consultation options are readily available.</p>',
    show_on_home: true
  },
  {
    category: 'Sessions & Booking',
    question: "Can I attend a relationship consultation alone if my partner isn't ready?",
    answer_html: '<p>Yes. Over 40% of our clients begin with individual sessions to gain emotional clarity, process their own feelings, and learn practical strategies before introducing their partner when the time is right.</p>',
    show_on_home: true
  },
  {
    category: 'Sessions & Booking',
    question: 'How do online video sessions work?',
    answer_html: '<p>Upon booking, you receive a secure, encrypted one-click video room link. No special software download is required. Both partners can join from separate locations if living apart or traveling.</p>',
    show_on_home: true
  },
  {
    category: 'Our Experts',
    question: 'What qualifications do your doctors and counsellors hold?',
    answer_html: '<p>Every specialist in the SPOUZY network is a certified medical practitioner (MD/MBBS), licensed clinical psychologist, or accredited family dispute mediator vetted under Problem Solver Group’s stringent credentialing committee.</p>',
    show_on_home: true
  }
];

const SEED_STORIES = [
  {
    display_name: 'Rohit & Priya S.', is_anonymous: false, rating: 5, service_key: 'post-marriage', city: 'Mumbai',
    tag_line: 'Married 11 Years', badge_label: 'Verified Couple',
    story_text: 'We walked into SPOUZY convinced our 11-year marriage was over. The counsellor didn’t take sides; she helped us uncover why we were hurting each other. Today, our home is peaceful again.'
  },
  {
    display_name: 'Anonymous Patient', is_anonymous: true, rating: 5, service_key: 'intimate-health', city: 'Online',
    tag_line: 'Intimacy Clinic', badge_label: 'Clinical Care',
    story_text: 'I had deep anxieties regarding intimate health that I couldn\'t share with anyone. The doctor was deeply respectful, scientific, and put me completely at ease. Complete discretion.'
  },
  {
    display_name: 'Kunal & Ananya M.', is_anonymous: false, rating: 5, service_key: 'divorce-mediation', city: 'Pune',
    tag_line: 'Amicable Mediation', badge_label: 'Amicable Resolution',
    story_text: 'Mediation with PSG saved us years of bitter court battles. We separated amicably and our children continue to feel loved and secure by both of us. Truly life-saving guidance.'
  }
];

function norm(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

module.exports = {
  name: '20261121000009-stories-and-faq-pages.js',

  async up({ sequelize }) {
    console.log('Running migration: 20261121000009-stories-and-faq-pages.js...');

    async function addColumnIfNotExists(table, column, definition) {
      const [cols] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}';`);
      if (cols.length === 0) {
        await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition};`);
        console.log(`  + Added column \`${table}\`.\`${column}\``);
      }
    }

    // FAQ placement
    await addColumnIfNotExists('faqs', 'show_on_faq_page', 'TINYINT(1) NOT NULL DEFAULT 1');
    await addColumnIfNotExists('faqs', 'show_on_home', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfNotExists('faqs', 'home_order', 'INT NOT NULL DEFAULT 0');
    await addColumnIfNotExists('faqs', 'pages', 'JSON NULL');

    // Stories
    await addColumnIfNotExists('visitor_stories', 'user_id', 'INT NULL');
    await addColumnIfNotExists('visitor_stories', 'source', "VARCHAR(10) NOT NULL DEFAULT 'visitor'");
    await addColumnIfNotExists('visitor_stories', 'rating', 'INT NOT NULL DEFAULT 5');
    await addColumnIfNotExists('visitor_stories', 'service_key', 'VARCHAR(40) NULL');
    await addColumnIfNotExists('visitor_stories', 'city', 'VARCHAR(80) NULL');
    await addColumnIfNotExists('visitor_stories', 'tag_line', 'VARCHAR(120) NULL');
    await addColumnIfNotExists('visitor_stories', 'badge_label', 'VARCHAR(60) NULL');
    await addColumnIfNotExists('visitor_stories', 'is_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfNotExists('visitor_stories', 'verified_note', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('visitor_stories', 'is_hidden', 'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfNotExists('visitor_stories', 'show_on_home', 'TINYINT(1) NOT NULL DEFAULT 1');
    await addColumnIfNotExists('visitor_stories', 'sort_order', 'INT NOT NULL DEFAULT 0');
    await addColumnIfNotExists('visitor_stories', 'customer_message', 'VARCHAR(500) NULL');
    await addColumnIfNotExists('visitor_stories', 'edited_by_team', 'TINYINT(1) NOT NULL DEFAULT 0');
    const [idx] = await sequelize.query("SHOW INDEX FROM `visitor_stories` WHERE Key_name = 'visitor_stories_user_id';");
    if (!idx.length) {
      try {
        await sequelize.query('CREATE INDEX `visitor_stories_user_id` ON `visitor_stories` (`user_id`);');
      } catch (e) { /* index is an optimisation only */ }
    }

    // Copy the typed-in questions into the admin (only the ones that are not there yet)
    const [faqRows] = await sequelize.query('SELECT `id`, `question` FROM `faqs`;');
    const existing = new Map(faqRows.map(r => [norm(r.question), r.id]));
    let order = faqRows.length;
    let homeOrder = 0;
    let added = 0;
    for (const f of SEED_FAQS) {
      if (f.show_on_home) homeOrder += 1;
      const id = existing.get(norm(f.question));
      if (id) {
        if (f.show_on_home) {
          await sequelize.query('UPDATE `faqs` SET `show_on_home` = 1, `home_order` = ? WHERE `id` = ? AND `show_on_home` = 0;', { replacements: [homeOrder, id] });
        }
        continue;
      }
      order += 1;
      await sequelize.query(
        'INSERT INTO `faqs` (`category`, `question`, `answer_html`, `sort_order`, `is_published`, `show_on_faq_page`, `show_on_home`, `home_order`, `pages`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, 1, 1, ?, ?, NULL, UTC_TIMESTAMP(), UTC_TIMESTAMP());',
        { replacements: [f.category, f.question, f.answer_html, order, f.show_on_home ? 1 : 0, f.show_on_home ? homeOrder : 0] }
      );
      added += 1;
    }
    if (added) console.log(`  + Copied ${added} website question(s) into the admin FAQs`);

    // The 3 homepage stories: copied in hidden (the admin decides whether they go live)
    const [storyRows] = await sequelize.query('SELECT `story_text` FROM `visitor_stories`;');
    const have = new Set(storyRows.map(r => norm(r.story_text).slice(0, 60)));
    let storiesAdded = 0;
    for (let i = 0; i < SEED_STORIES.length; i++) {
      const s = SEED_STORIES[i];
      if (have.has(norm(s.story_text).slice(0, 60))) continue;
      await sequelize.query(
        'INSERT INTO `visitor_stories` (`display_name`, `is_anonymous`, `story_text`, `status`, `consent_agreed`, `approved_at`, `source`, `rating`, `service_key`, `city`, `tag_line`, `badge_label`, `is_verified`, `is_hidden`, `show_on_home`, `sort_order`, `internal_notes`, `created_at`, `updated_at`) ' +
        "VALUES (?, ?, ?, 'approved', 1, UTC_TIMESTAMP(), 'admin', ?, ?, ?, ?, ?, 0, 1, 1, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP());",
        { replacements: [s.display_name, s.is_anonymous ? 1 : 0, s.story_text, s.rating, s.service_key, s.city, s.tag_line, s.badge_label, i + 1,
          'Copied from the old homepage. Hidden until you choose Show.'] }
      );
      storiesAdded += 1;
    }
    if (storiesAdded) console.log(`  + Copied ${storiesAdded} homepage stor${storiesAdded === 1 ? 'y' : 'ies'} into the admin (hidden)`);
    console.log('Migration 9 completed successfully.');
  },

  async down() {
    console.log('Migration 9 has no automatic rollback (additive).');
  }
};
