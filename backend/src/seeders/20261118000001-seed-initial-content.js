const manifest = require('./content-manifest.json');
const { ROLE_DEFINITIONS } = require('../config/permissions');
const models = require('../models');

module.exports = {
  name: '20261118000001-seed-initial-content.js',
  async up({ sequelize }) {
    console.log('Seeding initial production content into database...');

    // 1. Roles
    // Role permission sets live in config/permissions.js (single source of truth)
    for (const r of ROLE_DEFINITIONS) {
      await models.Role.findOrCreate({
        where: { slug: r.slug },
        defaults: r
      });
    }
    console.log(' - Roles seeded.');

    // 2. Hero Banners
    for (const b of manifest.heroBanners) {
      await models.HeroBanner.findOrCreate({
        where: { image_path: b.image_path },
        defaults: b
      });
    }
    console.log(' - Hero banners seeded.');

    // 2b. Homepage sections (editable headings on index.htm)
    for (const sec of (manifest.homepageSections || [])) {
      await models.HomepageSection.findOrCreate({
        where: { section_key: sec.section_key },
        defaults: sec
      });
    }
    console.log(' - Homepage sections seeded.');

    // 3. Tips
    for (const t of manifest.tips) {
      await models.Tip.findOrCreate({
        where: { tip_text: t.text },
        defaults: {
          tip_text: t.text,
          photo_url: t.photo_url,
          sort_order: t.sort_order,
          is_active: true,
          rotation_interval: 6
        }
      });
    }
    console.log(' - Daily relationship tips seeded.');

    // 4. Blog Categories & Articles
    const categoryMap = {};
    for (const c of manifest.blogCategories) {
      const [cat] = await models.BlogCategory.findOrCreate({
        where: { slug: c.slug },
        defaults: c
      });
      categoryMap[c.slug] = cat.id;
    }

    for (const a of manifest.blogArticles) {
      const catId = categoryMap[a.category_slug] || null;
      await models.BlogArticle.findOrCreate({
        where: { slug: a.slug },
        defaults: {
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt,
          body_html: a.body_html,
          category_id: catId,
          cover_image: a.cover_image,
          author_name: a.author_name,
          is_published: true,
          published_at: new Date()
        }
      });
    }
    console.log(' - Blog categories & articles seeded.');

    // 5. FAQs
    for (const f of manifest.faqs) {
      await models.Faq.findOrCreate({
        where: { question: f.question },
        defaults: f
      });
    }
    console.log(' - FAQs seeded.');

    // 6. Services & Practitioners
    for (const s of manifest.services) {
      await models.Service.findOrCreate({
        where: { slug: s.slug },
        defaults: s
      });
    }

    const createdPractitioners = [];
    for (const p of manifest.practitioners) {
      const [practitioner] = await models.Practitioner.findOrCreate({
        where: { name: p.name },
        defaults: p
      });
      createdPractitioners.push(practitioner);
    }

    // Default Weekly Schedules (09:00 - 21:00 IST for Days 0-6)
    // Create template schedule (practitioner_id = null)
    for (let day = 0; day <= 6; day++) {
      await models.WeeklySchedule.findOrCreate({
        where: { practitioner_id: null, day_of_week: day },
        defaults: {
          practitioner_id: null,
          day_of_week: day,
          open_time: '09:00',
          close_time: '21:00',
          is_working_day: true
        }
      });
    }

    // Also populate default schedule for each seeded practitioner
    for (const pr of createdPractitioners) {
      for (let day = 0; day <= 6; day++) {
        await models.WeeklySchedule.findOrCreate({
          where: { practitioner_id: pr.id, day_of_week: day },
          defaults: {
            practitioner_id: pr.id,
            day_of_week: day,
            open_time: '09:00',
            close_time: '21:00',
            is_working_day: true
          }
        });
      }
    }
    console.log(' - Services, practitioners, and 09:00-21:00 operating schedules seeded.');

    // 7. Career Openings
    for (const co of manifest.careerOpenings) {
      await models.CareerOpening.findOrCreate({
        where: { slug: co.slug },
        defaults: co
      });
    }
    console.log(' - Career openings seeded.');

    // 8. Site Settings
    for (const st of manifest.siteSettings) {
      await models.SiteSetting.findOrCreate({
        where: { setting_key: st.setting_key },
        defaults: st
      });
    }
    console.log(' - Public site & cursor settings seeded.');

    // 9. Example customer packages (prices and contents are edited in Admin → Packages & Orders)
    for (const pk of (manifest.packages || [])) {
      await models.Package.findOrCreate({
        where: { slug: pk.slug },
        defaults: pk
      });
    }
    console.log(' - Example customer packages seeded.');

    console.log('Seeding initial production content complete.');
  }
};
