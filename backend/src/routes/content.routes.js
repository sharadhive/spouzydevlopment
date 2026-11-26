const express = require('express');
const router = express.Router();
const contentService = require('../services/content.service');
const { submissionLimiter, faqAnswerLimiter } = require('../middlewares/rateLimit.middleware');
const { sendError } = require('../config/validation');

// Public Hero Banners
router.get('/hero-banners', async (req, res, next) => {
  try {
    const banners = await contentService.getPublicHeroBanners();
    res.json({ success: true, data: banners });
  } catch (err) {
    next(err);
  }
});

// Public Tips
router.get('/tips', async (req, res, next) => {
  try {
    const tips = await contentService.getPublicTips();
    res.json({ success: true, data: tips });
  } catch (err) {
    next(err);
  }
});

router.get('/tips/today', async (req, res, next) => {
  try {
    const tips = await contentService.getPublicTips();
    if (!tips.length) {
      return res.json({ success: true, data: null });
    }
    // Select tip based on day of month
    const day = new Date().getDate();
    const index = (day - 1) % tips.length;
    res.json({ success: true, data: tips[index] });
  } catch (err) {
    next(err);
  }
});

// Public Blogs
router.get('/blogs', async (req, res, next) => {
  try {
    const { page, limit, category, search } = req.query;
    const result = await contentService.getPublicBlogs({
      page: page || 1,
      limit: limit || 10,
      categorySlug: category,
      search
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/blogs/:slug', async (req, res, next) => {
  try {
    const blog = await contentService.getBlogBySlug(req.params.slug);
    res.json({ success: true, data: blog });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

router.get('/blog-categories', async (req, res, next) => {
  try {
    const categories = await contentService.getBlogCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

// Public FAQs
router.get('/faqs', async (req, res, next) => {
  try {
    // ?for=home (homepage questions), ?for=<page key> (a "What We Do" page: first 8, X-Total-Count = all),
    // default: the FAQ page (questions only; answers come one at a time from /faqs/:id)
    const { items, total } = await require('../services/faq.service').listPublic(String(req.query.for || '').slice(0, 40));
    res.set('Cache-Control', 'no-cache');
    res.set('X-Total-Count', String(total));
    res.json({ success: true, data: req.query.category ? items.filter(f => f.category === req.query.category) : items, total });
  } catch (err) {
    next(err);
  }
});

// One FAQ answer (opened on the FAQ page)
router.get('/faqs/:id(\\d+)', faqAnswerLimiter, async (req, res, next) => {
  try {
    const faq = await require('../services/faq.service').publicAnswer(req.params.id);
    if (!faq) return res.status(404).json({ success: false, message: 'This answer is not available.' });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: faq });
  } catch (err) {
    next(err);
  }
});

// Public Visitor Question Submission
router.post('/faqs/ask', submissionLimiter, async (req, res, next) => {
  try {
    const { question, category, submitter_name, submitter_email, consent } = req.body || {};
    const q = await contentService.submitVisitorQuestion({
      question,
      category,
      submitter_name,
      submitter_email,
      consent
    });
    res.status(201).json({
      success: true,
      message: 'Your question has been submitted for our clinical team to review.',
      data: { id: q.id }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Public approved stories (names are masked; ?home=1 for the homepage carousel)
router.get('/stories', async (req, res, next) => {
  try {
    const stories = await require('../services/story.service').listPublic({ home: req.query.home === '1' });
    res.set('Cache-Control', 'no-cache');
    res.json({ success: true, data: stories });
  } catch (err) {
    next(err);
  }
});

// Stories are shared from a customer account now (POST /api/customer/stories)
router.post('/stories/submit', (req, res) => {
  res.status(401).json({
    success: false,
    code: 'login_required',
    message: 'Please log in or create a free account to share your story. Only you and our team can see your account details.'
  });
});

// Public Site Settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await contentService.getPublicSiteSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// Public Homepage Sections
router.get('/homepage-sections', async (req, res, next) => {
  try {
    const sections = await contentService.getHomepageSections({ onlyVisible: true });
    res.json({ success: true, data: sections });
  } catch (err) {
    next(err);
  }
});

// Public Social Links
router.get('/social-links', async (req, res, next) => {
  try {
    const links = await contentService.getSocialLinks();
    res.json({ success: true, data: links });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
