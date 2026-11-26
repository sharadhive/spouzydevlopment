const express = require('express');
const router = express.Router();
const schedulingService = require('../services/scheduling.service');
const paymentService = require('../services/payment.service');
const { FREE_BOOKING_MIN_MONTHS, PAYMENT_HOLD_MINUTES } = require('../config/booking');
const { sendError } = require('../config/validation');
const config = require('../config/environment');
const authService = require('../services/auth.service');
const verificationService = require('../services/verification.service');

/**
 * The logged-in customer (read-only GET requests: the session cookie is enough here; booking itself
 * also checks the CSRF header in appointment.routes.js).
 */
async function customerFrom(req) {
  try {
    const sid = req.cookies && req.cookies[config.security.cookieName];
    if (!sid) return null;
    const session = await authService.validateSession(sid);
    const user = session && session.user;
    return user && user.role && user.role.slug === 'customer' ? user : null;
  } catch (e) {
    return null;
  }
}

// Public: booking rules for the website (windows + payment availability).
// For a logged-in customer also: the student / ex-servicemen benefit, a pending ID check and a booking not yet taken place.
router.get('/config', async (req, res, next) => {
  try {
    const customer = await customerFrom(req);
    let account = null;
    let benefit = { active: false };
    if (customer) {
      const status = await verificationService.statusFor(customer);
      benefit = status.benefit;
      account = {
        benefit,
        verification: status.latest ? { status: status.latest.status, category: status.latest.category, admin_message: status.latest.admin_message } : null,
        active_booking: status.active_booking
      };
    }
    const free = schedulingService.getBookingWindow('free', { freeFromToday: !!benefit.active });
    const paid = schedulingService.getBookingWindow('paid');
    const payment = await paymentService.getPublicConfig();
    res.set('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      data: {
        today: paid.today,
        timezone: 'Asia/Kolkata',
        free: { earliestDate: free.earliest, latestDate: free.latest, minMonthsAhead: benefit.active ? 0 : FREE_BOOKING_MIN_MONTHS },
        paid: { earliestDate: paid.earliest, latestDate: paid.latest, holdMinutes: PAYMENT_HOLD_MINUTES },
        payment,
        account
      }
    });
  } catch (err) {
    next(err);
  }
});

// Public: slot availability for a date
router.get('/availability', async (req, res) => {
  try {
    const { date, duration, practitionerId, serviceId, serviceSlug, bookingType } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Query parameter "date" (YYYY-MM-DD) is required.' });
    }
    let freeFromToday = false;
    if (String(bookingType) === 'free') {
      const customer = await customerFrom(req);
      if (customer) freeFromToday = !!(await verificationService.benefitFor(customer)).active;
    }
    const availability = await schedulingService.getAvailability({
      freeFromToday,
      date: String(date),
      duration: duration || 30,
      practitionerId: practitionerId && practitionerId !== 'any' ? parseInt(practitionerId, 10) : null,
      serviceId: serviceId ? parseInt(serviceId, 10) : null,
      serviceSlug: serviceSlug ? String(serviceSlug) : null,
      bookingType: bookingType ? String(bookingType) : 'paid'
    });
    res.json({ success: true, data: availability });
  } catch (err) {
    sendError(res, err);
  }
});

// Public: active practitioners (optionally only those who can take a service)
router.get('/practitioners', async (req, res, next) => {
  try {
    const practitioners = await schedulingService.getPractitioners({ serviceSlug: req.query.serviceSlug || null });
    res.json({ success: true, data: practitioners });
  } catch (err) {
    next(err);
  }
});

// Public: active services with prices
router.get('/services', async (req, res, next) => {
  try {
    const services = await schedulingService.getServices();
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
