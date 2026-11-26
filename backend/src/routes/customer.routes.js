/**
 * Website customer area: cart, checkout, orders and profile.
 * Mounted at /api/customer with authentication and CSRF protection (see app.js).
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const shopService = require('../services/shop.service');
const { sendError } = require('../config/validation');
const activityService = require('../services/activity.service');
const chatService = require('../services/chat.service');
const rateLimit = require('express-rate-limit');

// Chat: at most 40 messages a minute per customer
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: (req) => `chat-${req.user ? req.user.id : req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'You are sending messages very quickly. Please wait a moment.' }
});
const { Appointment, Service, Practitioner } = require('../models');

router.use(authenticate);
router.use((req, res, next) => {
  const slug = req.user && req.user.role ? req.user.role.slug : '';
  if (slug !== 'customer') {
    return res.status(403).json({ success: false, message: 'Please sign in with a customer account.' });
  }
  next();
});

const handle = (fn) => async (req, res) => {
  try {
    const data = await fn(req);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

router.get('/profile', handle(req => shopService.getProfile(req.user.id)));
router.put('/profile', handle(async req => {
  const profile = await shopService.updateProfile(req.user.id, req.body || {});
  await activityService.record(req.user.id, 'profile_updated', { req });
  return profile;
}));

router.get('/cart', handle(req => shopService.getCart(req.user.id)));
router.post('/cart', handle(async req => {
  const cart = await shopService.addToCart(req.user.id, req.body || {});
  const b = req.body || {};
  const item = cart.items.find(i => i.package.slug === b.packageSlug || i.package.id === parseInt(b.packageId, 10));
  await activityService.record(req.user.id, 'cart_add', { req, label: item ? item.package.name : String(b.packageSlug || b.packageId || '') });
  return cart;
}));
router.patch('/cart/:packageId', handle(req => shopService.updateCartItem(req.user.id, parseInt(req.params.packageId, 10), (req.body || {}).quantity)));
router.delete('/cart/:packageId', handle(async req => {
  const cart = await shopService.removeCartItem(req.user.id, parseInt(req.params.packageId, 10));
  await activityService.record(req.user.id, 'cart_remove', { req, label: `Package #${req.params.packageId}` });
  return cart;
}));

router.post('/checkout', handle(async req => {
  const result = await shopService.checkout(req.user.id, req.body || {});
  const o = result.order;
  await activityService.record(req.user.id, 'checkout', {
    req,
    label: `${o.order_no} · ${o.items.map(i => i.name).join(', ')}`,
    details: { order_no: o.order_no, total_inr: o.total_inr, payment_required: result.paymentRequired }
  });
  return result;
}));
router.get('/orders', handle(req => shopService.listCustomerOrders(req.user.id)));

// My bills: bills the SPOUZY team has sent (see billing.service)
const billingService = require('../services/billing.service');
router.get('/invoices', handle(req => billingService.listForCustomer(req.user.id)));
router.get('/invoices/:id', handle(req => billingService.getForCustomer(req.user.id, req.params.id)));

// Appointments booked while logged in
router.get('/appointments', handle(async req => {
  const rows = await Appointment.findAll({
    where: { user_id: req.user.id },
    include: [
      { model: Service, as: 'service', attributes: ['id', 'name', 'slug'] },
      { model: Practitioner, as: 'practitioner', attributes: ['id', 'name', 'title'] }
    ],
    order: [['appointment_date', 'DESC'], ['start_time', 'DESC']],
    limit: 100
  });
  return rows.map(a => ({
    reference_no: a.reference_no,
    date: a.appointment_date,
    start_time: a.start_time,
    end_time: a.end_time,
    duration: a.duration_minutes,
    service: a.service ? a.service.name : null,
    practitioner: a.practitioner ? `${a.practitioner.name}${a.practitioner.title ? ', ' + a.practitioner.title : ''}` : null,
    mode: a.consultation_mode,
    clinic_location: a.clinic_location,
    booking_type: a.booking_type,
    status: a.status,
    payment_status: a.payment_status,
    amount_inr: Math.round((a.amount_minor_units || 0) / 100)
  }));
}));

// My stories: share an experience (reviewed by the team before it shows on the website)
const storyService = require('../services/story.service');
const storyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `story-${req.user ? req.user.id : req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'You have sent several stories in the last hour. Please try again a little later.' }
});
router.get('/stories', handle(req => storyService.listMine(req.user)));
router.post('/stories', storyLimiter, handle(req => storyService.submit(req.user, req.body || {})));
router.put('/stories/:id', storyLimiter, handle(req => storyService.updateMine(req.user, parseInt(req.params.id, 10) || 0, req.body || {})));
router.delete('/stories/:id', handle(req => storyService.withdrawMine(req.user, parseInt(req.params.id, 10) || 0)));

// Student / ex-servicemen ID verification (create-account.htm and My account)
const verificationService = require('../services/verification.service');
const idUpload = require('multer')({
  storage: require('multer').memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype);
    if (!allowed) {
      req.rejectedFiles = req.rejectedFiles || {};
      const label = file.fieldname === 'back' ? 'ID proof back' : 'ID proof front';
      req.rejectedFiles[file.fieldname] = `${label}: please upload a JPG, PNG or PDF file.`;
      return cb(null, false);
    }
    cb(null, true);
  }
});
const idLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => `idv-${req.user ? req.user.id : req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads in the last hour. Please try again a little later.' }
});
router.get('/verification', handle(req => verificationService.statusFor(req.user)));
router.post('/verification', idLimiter, (req, res) => {
  idUpload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }])(req, res, async (err) => {
    try {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
          ? 'The file is larger than 8 MB. Please upload a JPG, PNG or PDF of 8 MB or less.'
          : 'The file could not be uploaded. Please upload a JPG, PNG or PDF file (max 8 MB).';
        const field = err.field === 'back' ? 'back' : 'front';
        return res.status(400).json({ success: false, message: msg, errors: { [field]: msg } });
      }
      const files = {};
      Object.entries(req.files || {}).forEach(([k, arr]) => { files[k] = arr && arr[0]; });
      const data = await verificationService.submit(req.user, req.body || {}, files, req.rejectedFiles || {});
      res.json({ success: true, data, message: 'Thank you. Our team will check your ID soon.' });
    } catch (e) {
      sendError(res, e);
    }
  });
});

// Website chat assistant (js/spouzy-chat.js)
router.post('/chat/start', chatLimiter, handle(req => chatService.start(req.user, req.body || {})));
router.post('/chat/message', chatLimiter, handle(req => chatService.message(req.user, parseInt((req.body || {}).conversationId, 10) || 0, (req.body || {}).text, req)));
router.post('/chat/end', handle(req => chatService.end(req.user, parseInt((req.body || {}).conversationId, 10) || 0, (req.body || {}).reason)));

// Website activity (pages opened, buttons pressed) — see js/spouzy-content.js
router.post('/activity', handle(req => activityService.recordClientBatch(req.user.id, (req.body || {}).events, req)));

module.exports = router;
