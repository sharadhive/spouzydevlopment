const {
  HeroBanner,
  Tip,
  BlogCategory,
  BlogArticle,
  Faq,
  VisitorQuestion,
  SiteSetting,
  User,
  HomepageSection,
  HomepageSectionHistory
} = require('../models');
const { Op } = require('sequelize');
const { createValidator, str, isTrue } = require('../config/validation');
const { imageProblem } = require('../config/media-paths');

// Public site settings the admin panel may edit (anything else is rejected)
const EDITABLE_SETTINGS = {
  announcement_text: { category: 'branding', description: 'Top marquee announcement text on public pages' },
  whatsapp_number: { category: 'contact', description: 'Primary official WhatsApp contact desk' },
  contact_phone: { category: 'contact', description: 'Official contact and consultation phone line' },
  support_email: { category: 'contact', description: 'Clinical and patient care support email' },
  cursor_enabled: { category: 'cursor', description: 'Custom teddy cursors on/off' },
  booking_requires_account: { category: 'booking', description: 'Customers must log in or create an account to book appointments' },
  chat_enabled: { category: 'chat', description: 'Show the chat assistant on the website' },
  chat_idle_seconds: { category: 'chat', description: 'End a chat after this many seconds without a reply' },
  cursor_normal_path: { category: 'cursor', description: 'Normal cursor PNG asset relative path' },
  cursor_normal_hotspot_x: { category: 'cursor', description: 'Click hotspot X coordinate for normal cursor' },
  cursor_normal_hotspot_y: { category: 'cursor', description: 'Click hotspot Y coordinate for normal cursor' },
  cursor_pointer_path: { category: 'cursor', description: 'Pointer cursor asset relative path' },
  cursor_pointer_hotspot_x: { category: 'cursor', description: 'Click hotspot X coordinate for pointer cursor' },
  cursor_pointer_hotspot_y: { category: 'cursor', description: 'Click hotspot Y coordinate for pointer cursor' }
};
const BANNER_FIELDS = ['admin_title', 'tag_eyebrow', 'category_sub', 'headline', 'headline_emphasis', 'description', 'cta_label', 'cta_url',
  'secondary_cta_label', 'secondary_cta_url', 'image_path', 'mobile_image_path', 'alt_text', 'focal_point', 'overlay_strength', 'text_alignment',
  'pills', 'status', 'sort_order', 'is_active', 'display_start', 'display_end'];
const TIP_FIELDS = ['category', 'tip_text', 'photo_url', 'alt_text', 'cta_label', 'cta_url', 'sort_order', 'is_active', 'rotation_interval'];
const BLOG_FIELDS = ['title', 'slug', 'excerpt', 'body_html', 'category_id', 'cover_image', 'banner_image', 'thumbnail_image', 'show_in_banner', 'alt_text', 'author_name', 'is_published'];

function pick(obj, fields) {
  const out = {};
  fields.forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 180);
}

class ContentService {
  // ==========================================================================
  // HERO BANNERS
  // ==========================================================================
  async getPublicHeroBanners() {
    const now = new Date();
    return HeroBanner.findAll({
      where: {
        is_active: true,
        status: 'published',
        [Op.and]: [
          { [Op.or]: [{ display_start: null }, { display_start: { [Op.lte]: now } }] },
          { [Op.or]: [{ display_end: null }, { display_end: { [Op.gte]: now } }] }
        ]
      },
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
  }

  async getAllHeroBanners() {
    return HeroBanner.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
  }

  async saveHeroBanner(rawData, id = null) {
    const data = { ...(rawData || {}) };
    // Older admin builds used different field names
    if (!data.headline && data.title_lead) data.headline = [data.title_lead, data.title_tail].filter(Boolean).join(' ');
    if (!data.headline_emphasis && data.highlight_phrase) data.headline_emphasis = data.highlight_phrase;
    if (!data.description && data.description_text) data.description = data.description_text;
    if (!data.cta_label && data.cta1_text) data.cta_label = data.cta1_text;
    if (!data.cta_url && data.cta1_url) data.cta_url = data.cta1_url;
    if (!data.secondary_cta_label && data.cta2_text) data.secondary_cta_label = data.cta2_text;
    if (!data.secondary_cta_url && data.cta2_url) data.secondary_cta_url = data.cta2_url;
    if (!data.image_path && data.background_image) data.image_path = data.background_image;

    const out = pick(data, BANNER_FIELDS);
    if (out.overlay_strength !== undefined) {
      const named = { light: 0.3, medium: 0.45, strong: 0.6, dark: 0.6 };
      const v = named[String(out.overlay_strength).toLowerCase()] ?? parseFloat(out.overlay_strength);
      out.overlay_strength = isNaN(v) ? 0.45 : Math.min(0.9, Math.max(0, v));
    }
    if (out.pills !== undefined) {
      out.pills = (Array.isArray(out.pills) ? out.pills : String(out.pills || '').split(/\r?\n/))
        .map(p => String(p).trim()).filter(Boolean).slice(0, 6);
    }
    ['display_start', 'display_end'].forEach(k => { if (out[k] === '') out[k] = null; });
    if (out.status !== undefined && !['published', 'draft', 'disabled'].includes(out.status)) out.status = 'draft';
    if (out.sort_order !== undefined) out.sort_order = parseInt(out.sort_order, 10) || 0;

    const v = createValidator({ ...(id ? {} : { headline: '', description: '', image_path: '' }), ...out });
    if (!id || out.headline !== undefined) v.required('headline', 'Headline');
    if (!id || out.description !== undefined) v.required('description', 'Description');
    if (!id || out.image_path !== undefined) v.required('image_path', 'Desktop image');
    ['image_path', 'mobile_image_path'].forEach(k => {
      if (out[k]) { const problem = imageProblem(out[k]); v.custom(k, !problem, problem); }
    });
    v.throwIfErrors();

    if (id) {
      const banner = await HeroBanner.findByPk(id);
      if (!banner) throw new Error('Banner not found');
      return banner.update(out);
    }
    return HeroBanner.create(out);
  }

  async deleteHeroBanner(id) {
    const banner = await HeroBanner.findByPk(id);
    if (!banner) throw new Error('Banner not found');
    return banner.destroy();
  }

  // ==========================================================================
  // DAILY TIPS
  // ==========================================================================
  async getPublicTips() {
    return Tip.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
  }

  async getAllTips() {
    return Tip.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
  }

  async saveTip(data, id = null) {
    const out = pick(data || {}, TIP_FIELDS);
    if (out.sort_order !== undefined) out.sort_order = parseInt(out.sort_order, 10) || 0;
    if (out.rotation_interval !== undefined) out.rotation_interval = Math.max(3, parseInt(out.rotation_interval, 10) || 6);
    const v = createValidator({ ...(id ? {} : { tip_text: '', photo_url: '' }), ...out });
    if (!id || out.tip_text !== undefined) v.required('tip_text', 'Tip text');
    if (!id || out.photo_url !== undefined) v.required('photo_url', 'Photo');
    if (out.photo_url) { const problem = imageProblem(out.photo_url); v.custom('photo_url', !problem, problem); }
    v.throwIfErrors();
    if (id) {
      const tip = await Tip.findByPk(id);
      if (!tip) throw new Error('Tip not found');
      return tip.update(out);
    }
    return Tip.create(out);
  }

  async deleteTip(id) {
    const tip = await Tip.findByPk(id);
    if (!tip) throw new Error('Tip not found');
    return tip.destroy();
  }

  // ==========================================================================
  // BLOGS & CATEGORIES
  // ==========================================================================
  async getBlogCategories() {
    return BlogCategory.findAll({
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
      include: [{ model: BlogArticle, as: 'articles', attributes: ['id'] }]
    });
  }

  async saveBlogCategory(data, id = null) {
    const out = pick(data || {}, ['name', 'slug', 'description', 'sort_order']);
    const v = createValidator(out);
    v.required('name', 'Category name');
    v.throwIfErrors();
    out.slug = slugify(out.slug || out.name);
    const clash = await BlogCategory.findOne({ where: { slug: out.slug } });
    if (clash && String(clash.id) !== String(id)) {
      throw Object.assign(new Error('A category with this name already exists.'), { status: 400, errors: { name: 'Already exists' } });
    }
    if (id) {
      const cat = await BlogCategory.findByPk(id);
      if (!cat) throw new Error('Category not found');
      return cat.update(out);
    }
    return BlogCategory.create(out);
  }

  async getPublicBlogs({ page = 1, limit = 10, categorySlug, search }) {
    const where = { is_published: true };
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { excerpt: { [Op.like]: `%${search}%` } }
      ];
    }

    const include = [{ model: BlogCategory, as: 'category' }];
    if (categorySlug) {
      include[0].where = { slug: categorySlug };
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await BlogArticle.findAndCountAll({
      where,
      include,
      limit: parseInt(limit, 10),
      offset,
      order: [['published_at', 'DESC'], ['id', 'DESC']]
    });

    return {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
      articles: rows
    };
  }

  async getBlogBySlug(slug) {
    const article = await BlogArticle.findOne({
      where: { slug, is_published: true },
      include: [{ model: BlogCategory, as: 'category' }]
    });
    if (!article) throw new Error('Blog article not found');
    await article.increment('view_count');
    return article;
  }

  async getAllBlogsAdmin({ page = 1, limit = 20, search }) {
    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { excerpt: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await BlogArticle.findAndCountAll({
      where,
      include: [{ model: BlogCategory, as: 'category' }],
      limit: parseInt(limit, 10),
      offset,
      order: [['id', 'DESC']]
    });

    return {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
      articles: rows
    };
  }

  async saveBlogArticle(data, id = null) {
    const out = pick(data || {}, BLOG_FIELDS);
    if (out.category_id === '' || out.category_id === null) out.category_id = null;
    else if (out.category_id !== undefined) out.category_id = parseInt(out.category_id, 10) || null;
    if (out.is_published !== undefined) out.is_published = isTrue(out.is_published);
    if (out.show_in_banner !== undefined) out.show_in_banner = isTrue(out.show_in_banner);
    ['cover_image', 'banner_image', 'thumbnail_image'].forEach(k => {
      if (out[k] !== undefined) out[k] = str(out[k]) || null;
    });

    const existing = id ? await BlogArticle.findByPk(id) : null;
    if (id && !existing) throw new Error('Article not found');

    const v = createValidator({ ...(existing ? existing.toJSON() : {}), ...out });
    v.required('title', 'Title');
    v.required('excerpt', 'Short summary');
    v.required('body_html', 'Article body');
    ['cover_image', 'banner_image', 'thumbnail_image'].forEach(k => {
      if (out[k]) { const problem = imageProblem(out[k]); v.custom(k, !problem, problem); }
    });
    v.throwIfErrors();

    // Unique slug (append -2, -3 … when needed)
    // Editing keeps the existing web address unless a new slug is given explicitly
    const base = slugify(out.slug || (existing ? existing.slug : out.title));
    let slug = base || `article-${Date.now()}`;
    for (let n = 2; ; n++) {
      const clash = await BlogArticle.findOne({ where: { slug } });
      if (!clash || (existing && clash.id === existing.id)) break;
      slug = `${base}-${n}`;
    }
    out.slug = slug;

    // Publishing for the first time stamps the publish date
    if (out.is_published && (!existing || !existing.is_published)) out.published_at = new Date();

    if (existing) return existing.update(out);
    return BlogArticle.create(out);
  }

  async deleteBlogArticle(id) {
    const art = await BlogArticle.findByPk(id);
    if (!art) throw new Error('Article not found');
    return art.destroy();
  }

  // ==========================================================================
  // FAQS & VISITOR QUESTIONS
  // ==========================================================================
  // FAQ list, editing, Excel upload/download: see faq.service.js

  async submitVisitorQuestion(data = {}) {
    const v = createValidator(data);
    v.required('question', 'Question', { min: 15, max: 2000 })
      .email('submitter_email', 'Email', { required: false })
      .consent('consent', 'Consent');
    if (str(data.submitter_name).length > 100) v.custom('submitter_name', false, 'Name must be 100 characters or fewer.');
    v.throwIfErrors();
    const q = await VisitorQuestion.create({
      question: str(data.question),
      category: str(data.category).slice(0, 100) || 'General',
      submitter_name: str(data.submitter_name) || 'Anonymous Visitor',
      submitter_email: str(data.submitter_email).toLowerCase() || null,
      consent_agreed: true,
      status: 'pending'
    });
    await require('./notification.service').notify('visitor_question', {
      title: 'New question from the FAQ page',
      message: `${q.submitter_name}: ${String(q.question).slice(0, 180)}`,
      link: '/content?tab=faqs',
      entityType: 'VisitorQuestion',
      entityId: q.id
    });
    return q;
  }

  async getVisitorQuestionsAdmin({ page = 1, limit = 20, status }) {
    const where = {};
    if (status) where.status = status;
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await VisitorQuestion.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['id', 'DESC']],
      include: [{ model: User, as: 'answered_by', attributes: ['id', 'first_name', 'last_name'] }]
    });
    return {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
      questions: rows
    };
  }

  async answerAndPublishQuestion(id, { answer_html, publish_to_faq = false, category, answerer_user_id }) {
    const q = await VisitorQuestion.findByPk(id);
    if (!q) throw new Error('Question not found');
    createValidator({ answer_html }).required('answer_html', 'Answer').throwIfErrors();
    answer_html = require('./faq.service').textToHtml(answer_html);

    await q.update({
      answer_html,
      status: publish_to_faq ? 'published' : 'answered',
      answered_by_user_id: answerer_user_id
    });

    if (publish_to_faq) {
      await Faq.create({
        category: category || q.category || 'General',
        question: q.question,
        answer_html: answer_html,
        is_published: true,
        show_on_faq_page: true,
        sort_order: ((await Faq.max('sort_order')) || 0) + 1
      });
      try { require('./chat.service').invalidate(); } catch (e) { /* chat optional */ }
    }

    return q;
  }

  async moderateQuestion(id, { status, internal_notes }) {
    const q = await VisitorQuestion.findByPk(id);
    if (!q) throw new Error('Question not found');
    const updates = {};
    if (status !== undefined) {
      if (!['pending', 'rejected'].includes(status)) throw new Error('Status must be pending or rejected (use Answer to publish).');
      updates.status = status;
    }
    if (internal_notes !== undefined) updates.internal_notes = String(internal_notes);
    await q.update(updates);
    return q;
  }

  // Client stories: see story.service.js

  // ==========================================================================
  // SITE SETTINGS
  // ==========================================================================
  async getPublicSiteSettings() {
    const settings = await SiteSetting.findAll({
      where: { is_public: true }
    });
    const map = {};
    settings.forEach(s => {
      map[s.setting_key] = s.setting_value;
    });
    return map;
  }

  async getAllSettingsAdmin() {
    return SiteSetting.findAll({
      order: [['category', 'ASC'], ['setting_key', 'ASC']]
    });
  }

  async updateSettings(settingsMap) {
    const unknown = Object.keys(settingsMap || {}).filter(k => !EDITABLE_SETTINGS[k]);
    if (unknown.length) {
      throw new Error(`Unknown setting(s): ${unknown.join(', ')}. Allowed: ${Object.keys(EDITABLE_SETTINGS).join(', ')}`);
    }
    const errors = {};
    const emailVal = settingsMap.support_email;
    if (emailVal !== undefined && emailVal !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(emailVal).trim())) {
      errors.support_email = 'Support email is not a valid email address.';
    }
    if (settingsMap.chat_idle_seconds !== undefined) {
      const n = parseInt(settingsMap.chat_idle_seconds, 10);
      if (isNaN(n) || n < 15 || n > 600) errors.chat_idle_seconds = 'Chat idle time must be between 15 and 600 seconds.';
    }
    ['whatsapp_number', 'contact_phone'].forEach(k => {
      if (settingsMap[k] !== undefined && settingsMap[k] !== '') {
        const digits = String(settingsMap[k]).replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) errors[k] = 'Enter the number with country code, e.g. +91 85919 45055.';
      }
    });
    if (Object.keys(errors).length) {
      const err = new Error('Please correct the highlighted settings.');
      err.status = 400;
      err.errors = errors;
      throw err;
    }

    const updated = [];
    for (const [key, value] of Object.entries(settingsMap)) {
      const meta = EDITABLE_SETTINGS[key];
      let setting = await SiteSetting.findOne({ where: { setting_key: key } });
      if (setting) {
        await setting.update({ setting_value: String(value).trim() });
      } else {
        setting = await SiteSetting.create({
          setting_key: key,
          setting_value: String(value).trim(),
          category: meta.category,
          description: meta.description,
          is_public: true
        });
      }
      updated.push(setting);
    }
    return updated;
  }
  // ==========================================================================
  // HOMEPAGE SECTIONS
  // ==========================================================================
  async getHomepageSections({ onlyVisible = false } = {}) {
    const where = {};
    if (onlyVisible) where.is_visible = true;
    return HomepageSection.findAll({
      where,
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
  }

  async getHomepageSection(key) {
    const section = await HomepageSection.findOne({ where: { section_key: key } });
    if (!section) throw new Error(`Homepage section '${key}' not found`);
    return section;
  }

  async updateHomepageSection(key, data, userId = null) {
    const section = await HomepageSection.findOne({ where: { section_key: key } });
    if (!section) throw new Error(`Homepage section '${key}' not found`);

    // Record revision history before updating
    await HomepageSectionHistory.create({
      section_id: section.id,
      version: section.version || 1,
      content_json: {
        headline: section.headline,
        subheadline: section.subheadline,
        body_text: section.body_text,
        content_json: section.content_json,
        is_visible: section.is_visible
      },
      changed_by_user_id: userId,
      notes: data.notes || 'Updated via CMS'
    });

    const newVersion = (section.version || 1) + 1;
    const updates = {
      version: newVersion
    };

    if (data.headline !== undefined) updates.headline = data.headline;
    if (data.subheadline !== undefined) updates.subheadline = data.subheadline;
    if (data.body_text !== undefined) updates.body_text = data.body_text;
    if (data.content_json !== undefined) updates.content_json = data.content_json;
    if (data.is_visible !== undefined) updates.is_visible = data.is_visible;
    if (data.sort_order !== undefined) updates.sort_order = data.sort_order;

    await section.update(updates);
    return section;
  }

  async getSectionHistory(key) {
    const section = await HomepageSection.findOne({ where: { section_key: key } });
    if (!section) throw new Error(`Homepage section '${key}' not found`);

    return HomepageSectionHistory.findAll({
      where: { section_id: section.id },
      order: [['version', 'DESC']],
      include: [{ model: User, as: 'changed_by', attributes: ['id', 'email', 'first_name', 'last_name'] }]
    });
  }

  async rollbackSection(key, targetVersion, userId = null) {
    const section = await HomepageSection.findOne({ where: { section_key: key } });
    if (!section) throw new Error(`Homepage section '${key}' not found`);

    const historical = await HomepageSectionHistory.findOne({
      where: { section_id: section.id, version: targetVersion }
    });
    if (!historical) throw new Error(`History version ${targetVersion} not found for section '${key}'`);

    const snap = historical.content_json || {};

    // Record current state before rollback
    await HomepageSectionHistory.create({
      section_id: section.id,
      version: section.version || 1,
      content_json: {
        headline: section.headline,
        subheadline: section.subheadline,
        body_text: section.body_text,
        content_json: section.content_json,
        is_visible: section.is_visible
      },
      changed_by_user_id: userId,
      notes: `Rollback to version ${targetVersion}`
    });

    const nextVersion = (section.version || 1) + 1;
    await section.update({
      headline: snap.headline,
      subheadline: snap.subheadline,
      body_text: snap.body_text,
      content_json: snap.content_json,
      is_visible: snap.is_visible,
      version: nextVersion
    });

    return section;
  }

  // ==========================================================================
  // FOOTER SOCIAL LINKS
  // ==========================================================================
  async getSocialLinks() {
    const setting = await SiteSetting.findOne({ where: { setting_key: 'social_links' } });
    if (!setting || !setting.setting_value) {
      return {
        facebook: '',
        linkedin: '',
        x: '',
        instagram: ''
      };
    }
    try {
      return typeof setting.setting_value === 'string'
        ? JSON.parse(setting.setting_value)
        : setting.setting_value;
    } catch (_) {
      return {};
    }
  }

  async saveSocialLinks(links, userId = null) {
    if (!links || typeof links !== 'object') {
      throw new Error('Social links must be an object');
    }

    // Platform allowlists & anti-abuse checks
    const allowedDomains = {
      facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com'],
      linkedin: ['linkedin.com', 'www.linkedin.com'],
      x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
      instagram: ['instagram.com', 'www.instagram.com']
    };

    const sanitized = {};

    for (const [platform, rawUrl] of Object.entries(links)) {
      if (!allowedDomains[platform]) continue; // ignore unknown platforms
      const urlStr = String(rawUrl || '').trim();
      if (!urlStr) {
        sanitized[platform] = '';
        continue;
      }

      // Reject non-http(s), javascript:, data:, etc.
      if (!/^https?:\/\//i.test(urlStr)) {
        throw new Error(`Invalid URL for ${platform}: Must begin with https://`);
      }

      let parsed;
      try {
        parsed = new URL(urlStr);
      } catch (e) {
        throw new Error(`Malformed URL for ${platform}`);
      }

      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`Invalid protocol for ${platform}`);
      }

      const host = parsed.hostname.toLowerCase();
      if (!allowedDomains[platform].includes(host)) {
        throw new Error(`Domain '${host}' is not an authorized official domain for ${platform}`);
      }

      // Reject share intent / popup spam URLs
      const pathAndQuery = (parsed.pathname + parsed.search).toLowerCase();
      if (
        pathAndQuery.includes('intent/tweet') ||
        pathAndQuery.includes('share') ||
        pathAndQuery.includes('sharer.php') ||
        pathAndQuery.includes('javascript:')
      ) {
        throw new Error(`Share-intent and non-profile links are not permitted for ${platform}`);
      }

      sanitized[platform] = parsed.origin + parsed.pathname;
    }

    let setting = await SiteSetting.findOne({ where: { setting_key: 'social_links' } });
    const jsonVal = JSON.stringify(sanitized);

    if (setting) {
      await setting.update({ setting_value: jsonVal });
    } else {
      setting = await SiteSetting.create({
        setting_key: 'social_links',
        setting_value: jsonVal,
        category: 'social',
        is_public: true
      });
    }

    return sanitized;
  }
}

module.exports = new ContentService();
module.exports.EDITABLE_SETTINGS = EDITABLE_SETTINGS;
