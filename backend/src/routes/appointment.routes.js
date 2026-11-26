const express = require('express');
const router = express.Router();
const appointmentService = require('../services/appointment.service');
const { submissionLimiter } = require('../middlewares/rateLimit.middleware');
const { sendError } = require('../config/validation');
const authService = require('../services/auth.service');
const activityService = require('../services/activity.service');
const config = require('../config/environment');
const { SiteSetting } = require('../models');

/**
 * The logged-in customer, if any. The session cookie is only trusted together with the
 * CSRF header, so another website cannot book in a customer's name.
 */
async function currentCustomer(req) {
  const sid = req.cookies && req.cookies[config.security.cookieName];
  if (!sid) return null;
  const csrfCookie = req.cookies.spouzy_csrf;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfCookie || csrfCookie !== csrfHeader) return null;
  const session = await authService.validateSession(sid);
  const user = session && session.user;
  return user && user.role && user.role.slug === 'customer' ? user : null;
}

let settingCache = { at: 0, value: true };
async function bookingRequiresAccount() {
  if (Date.now() - settingCache.at < 30 * 1000) return settingCache.value;
  const row = await SiteSetting.findOne({ where: { setting_key: 'booking_requires_account' } });
  settingCache = { at: Date.now(), value: !row || String(row.setting_value).toLowerCase() !== 'false' };
  return settingCache.value;
}

// Public: Book appointment
router.post(['/', '/book'], submissionLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const customer = await currentCustomer(req);
    if (!customer && await bookingRequiresAccount()) {
      return res.status(401).json({
        success: false,
        code: 'LOGIN_REQUIRED',
        message: 'Please log in or create your free account to confirm the appointment.'
      });
    }
    // Logged-in customers always book with the details saved on their account
    const accountName = customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : '';
    const result = await appointmentService.createAppointment({
      userId: customer ? customer.id : null,
      serviceId: b.serviceId,
      serviceSlug: b.serviceSlug,
      practitionerId: b.practitionerId && b.practitionerId !== 'any' ? b.practitionerId : null,
      date: b.date,
      startTime: b.startTime,
      duration: b.duration,
      consultationMode: b.consultationMode || b.mode,
      bookingType: b.bookingType,
      clientName: customer ? (accountName || b.clientName) : b.clientName,
      clientEmail: customer ? customer.email : b.clientEmail,
      clientMobile: customer && customer.phone ? customer.phone : b.clientMobile,
      clientWhatsapp: customer && customer.phone ? customer.phone : b.clientWhatsapp,
      clientNotes: b.clientNotes,
      consent: b.consent
    });

    const { appointment, practitioner, service, payment } = result;
    if (customer) {
      await activityService.record(customer.id, 'booking', {
        req,
        label: `${service && service.name ? service.name : 'Appointment'} · ${appointment.appointment_date} ${appointment.start_time}`,
        details: { reference_no: appointment.reference_no, booking_type: appointment.booking_type, status: appointment.status }
      });
    }
    res.status(201).json({
      success: true,
      message: payment.onlineEnabled
        ? 'Slot held. Please complete the payment to confirm your appointment.'
        : 'Appointment booked successfully.',
      data: {
        id: appointment.id,
        referenceNo: appointment.reference_no,
        date: appointment.appointment_date,
        startTime: appointment.start_time,
        endTime: appointment.end_time,
        duration: appointment.duration_minutes,
        bookingType: appointment.booking_type,
        consultationMode: appointment.consultation_mode,
        clinicLocation: appointment.clinic_location,
        status: appointment.status,
        paymentStatus: appointment.payment_status,
        holdExpiresAt: appointment.hold_expires_at,
        practitioner,
        service,
        payment
      }
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Public: Look up an appointment (reference + email must match)
router.get('/lookup/:referenceNo', async (req, res) => {
  try {
    const appt = await appointmentService.getByReferenceNo(req.params.referenceNo);
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email || email !== String(appt.client_email).toLowerCase()) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({
      success: true,
      data: {
        referenceNo: appt.reference_no,
        clientName: appt.client_name,
        date: appt.appointment_date,
        startTime: appt.start_time,
        endTime: appt.end_time,
        duration: appt.duration_minutes,
        consultationMode: appt.consultation_mode,
        bookingType: appt.booking_type,
        status: appt.status,
        paymentStatus: appt.payment_status,
        service: appt.service ? { name: appt.service.name, slug: appt.service.slug } : null,
        practitioner: appt.practitioner ? { name: appt.practitioner.name, title: appt.practitioner.title } : null
      }
    });
  } catch (err) {
    res.status(404).json({ success: false, message: 'Appointment not found' });
  }
});

// Settings page calls this so a change applies immediately
router.resetBookingSettingCache = () => { settingCache.at = 0; };

module.exports = router;
