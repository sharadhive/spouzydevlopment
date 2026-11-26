const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { authenticate } = require('../middlewares/auth.middleware');
const { authLimiter, customerAuthLimiter } = require('../middlewares/rateLimit.middleware');
const { sendError } = require('../config/validation');
const activityService = require('../services/activity.service');
const rateLimit = require('express-rate-limit');

// "Does an account exist?" checks from the booking page
const accountCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' }
});

const { getEffectivePermissions } = require('../middlewares/rbac.middleware');

// Unified / Admin Login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const result = await authService.loginAdmin({ email, password, req });

    // Set secure HTTP-only session cookie
    res.cookie('spouzy_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
});

// Customer accounts (website). A readable `spouzy_customer` flag cookie tells the website
// to show "My Account"; the session itself stays in the HTTP-only cookie.
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
function setCustomerCookies(res, token) {
  res.cookie('spouzy_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE
  });
  res.cookie('spouzy_customer', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE
  });
}

// Customer Registration (signs the new customer in straight away)
router.post('/customer/register', customerAuthLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    await authService.registerCustomer({
      name: b.name, firstName: b.firstName, lastName: b.lastName,
      email: b.email, phone: b.phone, password: b.password, consent: b.consent,
      category: b.category !== undefined ? b.category : b.special_category
    });
    const result = await authService.loginCustomer({ email: b.email, password: b.password, req });
    setCustomerCookies(res, result.token);
    await activityService.record(result.user.id, 'signup', { req, label: b.source ? String(b.source) : 'Sign-up form' });
    res.status(201).json({
      success: true,
      message: 'Your account has been created.',
      user: result.user
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Customer Login
router.post('/customer/login', customerAuthLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const identifier = String(b.identifier || b.email || '').trim();
    if (!identifier || !b.password) {
      return res.status(400).json({ success: false, message: 'Please enter your email or mobile number and your password.' });
    }
    try {
      const result = await authService.loginCustomer({ email: identifier, password: b.password, req });
      setCustomerCookies(res, result.token);
      await activityService.record(result.user.id, 'login', { req, label: b.source ? String(b.source) : 'Login form' });
      return res.json({
        success: true,
        message: 'Login successful',
        user: result.user
      });
    } catch (e) {
      const known = await authService.findCustomer(identifier);
      if (known && known.role && known.role.slug === 'customer') {
        await activityService.record(known.id, 'login_failed', { req });
      }
      return res.status(401).json({ success: false, message: 'Incorrect email/mobile or password.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not log in right now. Please try again.' });
  }
});

// Booking page: is there already an account for this email / mobile?
router.post('/customer/check', accountCheckLimiter, async (req, res) => {
  try {
    const { email, phone } = req.body || {};
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Enter your email or mobile number.' });
    }
    const result = await authService.checkCustomerAccount({ email, phone });
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// Get Current Profile
router.get('/me', authenticate, async (req, res) => {
  const u = req.user;
  const roleSlug = u.role?.slug || (typeof u.role === 'string' ? u.role : '');
  const roleName = u.role?.name || (roleSlug ? roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1) : 'User');
  const permissions = getEffectivePermissions(u);

  res.json({
    success: true,
    user: {
      id: u.id,
      email: u.email,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      phone: u.phone,
      must_change_password: !!u.must_change_password,
      role: {
        id: u.role?.id || null,
        slug: roleSlug,
        name: roleName,
        permissions
      },
      role_slug: roleSlug,
      role_name: roleName,
      permissions,
      effective_permissions: permissions
    }
  });
});

// Change own password (staff). Required after an admin creates or resets an account.
router.post('/change-password', authLimiter, authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const models = require('../models');
    const { hashPassword, comparePassword } = require('../config/security');
    if (!newPassword || String(newPassword).length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters with upper-case, lower-case and a number.', errors: { newPassword: 'Too weak' } });
    }
    const user = await models.User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const ok = await comparePassword(String(currentPassword || ''), user.password_hash);
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.', errors: { currentPassword: 'Incorrect' } });
    }
    if (await comparePassword(String(newPassword), user.password_hash)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current one.', errors: { newPassword: 'Same as current' } });
    }
    await user.update({ password_hash: await hashPassword(String(newPassword)), must_change_password: false });
    // End all other sessions
    const { Op } = require('sequelize');
    await models.Session.destroy({ where: { user_id: user.id, id: { [Op.ne]: req.sessionId } } });
    if (req.user.role && req.user.role.slug === 'customer') await activityService.record(user.id, 'password_changed', { req });
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not change the password.' });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.token || req.sessionId || req.session?.id;
    if (req.user && req.user.role && req.user.role.slug === 'customer') {
      await activityService.record(req.user.id, 'logout', { req });
    }
    await authService.logout(token);
    res.clearCookie('spouzy_session', { path: '/' });
    res.clearCookie('spouzy_customer', { path: '/' });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
