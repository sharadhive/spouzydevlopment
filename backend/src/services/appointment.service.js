const { Op, Transaction } = require('sequelize');
const crypto = require('crypto');
const models = require('../models');
const { createValidator, ValidationError, str } = require('../config/validation');
const { isValidYmd, nowMinutesIST } = require('../config/time');
const { MODE_MAP, BOOKING_TYPES, SAME_DAY_BUFFER_MINUTES, PAYMENT_HOLD_MINUTES } = require('../config/booking');

function timeStringToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateReference(prefix = 'SP-APT') {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${random}`;
}

class AppointmentService {
  /**
   * Public booking. Validates everything server-side, picks a free eligible practitioner
   * inside a locked transaction, and applies free / paid rules:
   *   - free: only from FREE_BOOKING_MIN_MONTHS months ahead, no payment, confirmed
   *   - paid + online payment enabled: 15-minute hold until payment is verified
   *   - paid + online payment not enabled: confirmed, payment pending ("coming soon")
   */
  async createAppointment(input = {}) {
    const schedulingService = require('./scheduling.service');
    const paymentService = require('./payment.service');

    const bookingType = BOOKING_TYPES.includes(input.bookingType) ? input.bookingType : 'paid';
    const date = str(input.date);
    const startTime = str(input.startTime);
    const durationMinutes = parseInt(input.duration, 10) === 60 ? 60 : 30;
    const modeKey = str(input.consultationMode || input.mode || 'virtual').toLowerCase();
    const mode = MODE_MAP[modeKey];

    const v = createValidator({ ...input, date, startTime });
    v.required('clientName', 'Name', { min: 2, max: 150 })
      .email('clientEmail')
      .phone('clientMobile', 'Mobile number')
      .custom('date', isValidYmd(date), 'Please choose a valid date.')
      .custom('startTime', /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime), 'Please choose a valid time slot.')
      .custom('consultationMode', !!mode, 'Please choose a valid consultation mode.')
      .custom('serviceId', !!(input.serviceId || input.serviceSlug), 'Please choose a service.');
    if (input.clientNotes && str(input.clientNotes).length > 1000) {
      v.custom('clientNotes', false, 'Notes must be 1000 characters or fewer.');
    }
    if (input.requireConsent !== false) {
      v.consent('consent', 'Agreement to the terms and privacy policy');
    }
    v.throwIfErrors();

    const service = await schedulingService.resolveService({ serviceId: input.serviceId, serviceSlug: input.serviceSlug });
    if (!service) {
      throw new ValidationError({ serviceId: 'Selected service is invalid or unavailable.' });
    }
    if (Array.isArray(service.modes) && service.modes.length && !service.modes.includes(mode.consultation_mode)) {
      throw new ValidationError({ consultationMode: `${service.name} is not offered as ${mode.consultation_mode}. Please choose another mode.` });
    }

    // Logged-in customers: one consultation at a time, and the student / ex-servicemen benefit
    const verificationService = require('./verification.service');
    let freeFromToday = false;
    if (input.userId) {
      await verificationService.assertNoActiveBooking({ userId: input.userId, email: str(input.clientEmail).toLowerCase() });
      if (bookingType === 'free') freeFromToday = !!(await verificationService.benefitFor(input.userId)).active;
    }
    const window = schedulingService.getBookingWindow(bookingType, { freeFromToday });
    if (date < window.today) {
      throw new ValidationError({ date: 'This date has passed.' });
    }
    if (date < window.earliest) {
      throw new ValidationError({ date: `Free consultations can be booked from ${window.earliest} onwards. Choose a paid consultation for an earlier slot.` });
    }
    if (date > window.latest) {
      throw new ValidationError({ date: 'Bookings are open up to 12 months ahead.' });
    }

    const startMinutes = timeStringToMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;
    const endTime = minutesToTimeString(endMinutes);
    if (date === window.today && startMinutes <= nowMinutesIST() + SAME_DAY_BUFFER_MINUTES) {
      throw new ValidationError({ startTime: 'This time has already passed. Please choose a later slot.' });
    }

    const practitioners = await schedulingService.getEligiblePractitioners(service, input.practitionerId || null);
    if (!practitioners.length) {
      const err = new Error('No practitioner is currently available for this service. Please contact us on WhatsApp.');
      err.status = 409;
      throw err;
    }

    const isPaid = bookingType === 'paid';
    const amountMinor = isPaid ? (durationMinutes === 60 ? service.price_60_minor : service.price_30_minor) : 0;
    const onlinePayment = isPaid && amountMinor > 0 ? await paymentService.isOnlinePaymentEnabled() : false;

    let initialStatus = 'confirmed';
    let initialPaymentStatus = 'not_required';
    let holdExpiresAt = null;
    if (isPaid && amountMinor > 0) {
      initialPaymentStatus = 'pending';
      if (onlinePayment) {
        initialStatus = 'hold';
        holdExpiresAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000);
      }
    }

    const result = await models.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
    }, async (t) => {
      const practitioner = await schedulingService.findFreePractitioner({
        date, startMinutes, endMinutes, practitioners, transaction: t
      });
      if (!practitioner) {
        const err = new Error(`The ${startTime}–${endTime} slot on ${date} is no longer available. Please choose another slot.`);
        err.status = 409;
        err.errors = { startTime: 'This slot was just taken. Please choose another one.' };
        throw err;
      }

      const referenceNo = generateReference('SP-APT');
      const appointment = await models.Appointment.create({
        reference_no: referenceNo,
        client_name: str(input.clientName),
        client_email: str(input.clientEmail).toLowerCase(),
        client_mobile: str(input.clientMobile),
        client_whatsapp: str(input.clientWhatsapp) || str(input.clientMobile),
        user_id: input.userId || null,
        service_id: service.id,
        practitioner_id: practitioner.id,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        consultation_mode: mode.consultation_mode,
        clinic_location: mode.clinic_location,
        booking_type: bookingType,
        status: initialStatus,
        payment_status: initialPaymentStatus,
        amount_minor_units: amountMinor,
        hold_expires_at: holdExpiresAt,
        client_notes: str(input.clientNotes)
      }, { transaction: t });

      await models.AppointmentStatusHistory.create({
        appointment_id: appointment.id,
        previous_status: null,
        new_status: initialStatus,
        notes: `Created via website (${bookingType}${onlinePayment ? ', awaiting online payment' : ''}). Reference: ${referenceNo}`
      }, { transaction: t });

      return { appointment, practitioner };
    });

    const { appointment, practitioner } = result;
    await require('./notification.service').notify('appointment_booked', {
      title: `New ${bookingType === 'free' ? 'free ' : ''}booking: ${service.name}`,
      message: `${appointment.client_name} · ${appointment.appointment_date} at ${String(appointment.start_time).slice(0, 5)} with ${practitioner.name} (${appointment.reference_no})${isPaid && amountMinor > 0 ? ` · ₹${Math.round(amountMinor / 100).toLocaleString('en-IN')} ${onlinePayment ? 'awaiting online payment' : 'to be collected'}` : ''}`,
      link: `/appointments?ref=${encodeURIComponent(appointment.reference_no)}`,
      entityType: 'Appointment',
      entityId: appointment.id
    });
    return {
      appointment,
      practitioner: { id: practitioner.id, name: practitioner.name, title: practitioner.title },
      service: { id: service.id, name: service.name, slug: service.slug },
      payment: {
        required: isPaid && amountMinor > 0,
        onlineEnabled: onlinePayment,
        amountMinor,
        amountInr: Math.round(amountMinor / 100),
        message: isPaid && amountMinor > 0 && !onlinePayment
          ? 'Online payment integration is coming soon. Your slot is reserved; our team will contact you to complete payment.'
          : null
      }
    };
  }

  /**
   * Reschedule appointment with conflict check
   */
  async rescheduleAppointment({ appointmentId, newDate, newStartTime, durationMinutes, changedByUserId, reason }) {
    if (!isValidYmd(newDate)) throw new Error('Please choose a valid new date.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(newStartTime || ''))) throw new Error('Please choose a valid new start time (HH:MM).');
    durationMinutes = parseInt(durationMinutes, 10) === 60 ? 60 : 30;
    const startMinutes = timeStringToMinutes(newStartTime);
    const endMinutes = startMinutes + durationMinutes;
    const newEndTime = minutesToTimeString(endMinutes);

    return models.sequelize.transaction(async (t) => {
      const appt = await models.Appointment.findByPk(appointmentId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!appt) throw new Error('Appointment not found.');

      // Check conflicts on new date/time
      const conflicts = await models.Appointment.findAll({
        where: {
          id: { [Op.ne]: appt.id },
          appointment_date: newDate,
          practitioner_id: appt.practitioner_id,
          status: { [Op.in]: ['confirmed', 'completed', 'hold', 'rescheduled'] }
        },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      const now = new Date();
      const hasConflict = conflicts.some(c => {
        if (c.status === 'hold' && (!c.hold_expires_at || new Date(c.hold_expires_at) <= now)) return false;
        const cStart = timeStringToMinutes(c.start_time);
        const cEnd = timeStringToMinutes(c.end_time);
        return startMinutes < cEnd && endMinutes > cStart;
      });

      if (hasConflict) {
        throw new Error('Target slot is already booked. Please choose another time.');
      }

      const previousStatus = appt.status;
      appt.appointment_date = newDate;
      appt.start_time = newStartTime;
      appt.end_time = newEndTime;
      appt.duration_minutes = durationMinutes;
      appt.status = 'rescheduled';
      await appt.save({ transaction: t });

      await models.AppointmentStatusHistory.create({
        appointment_id: appt.id,
        previous_status: previousStatus,
        new_status: 'rescheduled',
        changed_by_user_id: changedByUserId,
        notes: `Rescheduled to ${newDate} ${newStartTime}–${newEndTime}. Reason: ${reason || 'Patient request'}`
      }, { transaction: t });

      return appt;
    });
  }

  /**
   * Update appointment status (confirm, cancel, complete, no-show)
   */
  async updateStatus({ appointmentId, newStatus, changedByUserId, reason, internalNotes }) {
    const validStatuses = ['confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status "${newStatus}". Allowed: ${validStatuses.join(', ')}`);
    }

    return models.sequelize.transaction(async (t) => {
      const appt = await models.Appointment.findByPk(appointmentId, {
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!appt) throw new Error('Appointment not found.');

      const prev = appt.status;
      appt.status = newStatus;
      if (reason) appt.cancellation_reason = reason;
      if (internalNotes) appt.internal_notes = internalNotes;
      await appt.save({ transaction: t });

      await models.AppointmentStatusHistory.create({
        appointment_id: appt.id,
        previous_status: prev,
        new_status: newStatus,
        changed_by_user_id: changedByUserId,
        notes: reason || internalNotes || `Status changed from ${prev} to ${newStatus}`
      }, { transaction: t });

      return appt;
    });
  }

  /**
   * Look up appointment by reference number (for patient lookup screen)
   */
  async getByReferenceNo(referenceNo) {
    const appt = await models.Appointment.findOne({
      where: { reference_no: referenceNo },
      include: [
        { model: models.Service, as: 'service', attributes: ['id', 'name', 'slug', 'description', 'duration_options', 'price_30_minor', 'price_60_minor'] },
        { model: models.Practitioner, as: 'practitioner', attributes: ['id', 'name', 'title', 'photo_url'] }
      ]
    });
    if (!appt) throw new Error('Appointment not found');
    return appt;
  }

  /**
   * Admin: List appointments with pagination and filters
   */
  async listAppointments({ page = 1, limit = 20, date, dateFrom, dateTo, status, practitionerId, search, bookingType, paymentStatus }) {
    const where = {};
    if (date) where.appointment_date = date;
    if (dateFrom || dateTo) {
      where.appointment_date = {};
      if (dateFrom) where.appointment_date[Op.gte] = dateFrom;
      if (dateTo) where.appointment_date[Op.lte] = dateTo;
    }
    if (bookingType) where.booking_type = bookingType;
    if (paymentStatus) where.payment_status = paymentStatus;
    if (status) where.status = status;
    if (practitionerId) where.practitioner_id = practitionerId;
    if (search) {
      where[Op.or] = [
        { reference_no: { [Op.like]: `%${search}%` } },
        { client_name: { [Op.like]: `%${search}%` } },
        { client_email: { [Op.like]: `%${search}%` } },
        { client_mobile: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const { count, rows } = await models.Appointment.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['appointment_date', 'DESC'], ['start_time', 'ASC']],
      include: [
        { model: models.Service, as: 'service', attributes: ['id', 'name', 'slug', 'description', 'duration_options', 'price_30_minor', 'price_60_minor'] },
        { model: models.Practitioner, as: 'practitioner', attributes: ['id', 'name', 'title'] },
        { model: models.AppointmentStatusHistory, as: 'status_history' }
      ]
    });

    return {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
      appointments: rows
    };
  }

  /**
   * Admin: Get appointment by ID
   */
  async getById(id) {
    const appt = await models.Appointment.findByPk(id, {
      include: [
        { model: models.Service, as: 'service' },
        { model: models.Practitioner, as: 'practitioner' },
        { model: models.AppointmentStatusHistory, as: 'status_history', order: [['id', 'DESC']] }
      ]
    });
    if (!appt) throw new Error('Appointment not found');
    return appt;
  }
}

module.exports = new AppointmentService();
