const { Op } = require('sequelize');
const models = require('../models');
const { todayIST, nowMinutesIST, addMonths, addDays, dayOfWeek, isValidYmd } = require('../config/time');
const {
  SERVICE_ROLE_MAP,
  FREE_BOOKING_MIN_MONTHS,
  MAX_BOOKING_DAYS_AHEAD,
  SAME_DAY_BUFFER_MINUTES,
  BOOKING_TYPES
} = require('../config/booking');

// Appointment statuses that occupy a practitioner's time
const ACTIVE_STATUSES = ['confirmed', 'completed', 'hold', 'rescheduled'];

function timeStringToMinutes(timeStr) {
  const [h, m] = String(timeStr).split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function format12Hour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

class SchedulingService {
  /**
   * Booking window for a booking type: free consultations open FREE_BOOKING_MIN_MONTHS
   * calendar months after today; paid consultations can be booked from today.
   */
  getBookingWindow(bookingType = 'paid', { freeFromToday = false } = {}) {
    const today = todayIST();
    // verified students / ex-servicemen (see verification.service) book the free consultation from today
    const earliest = bookingType === 'free' && !freeFromToday ? addMonths(today, FREE_BOOKING_MIN_MONTHS) : today;
    const latest = addDays(today, MAX_BOOKING_DAYS_AHEAD);
    return { today, earliest, latest };
  }

  normalizeBookingType(bookingType) {
    return BOOKING_TYPES.includes(bookingType) ? bookingType : 'paid';
  }

  async resolveService({ serviceId = null, serviceSlug = null } = {}) {
    let service = null;
    if (serviceSlug) service = await models.Service.findOne({ where: { slug: String(serviceSlug) } });
    if (!service && serviceId) service = await models.Service.findByPk(parseInt(serviceId, 10));
    if (!service || !service.is_active) return null;
    return service;
  }

  allowedRoleTypes(service) {
    if (!service) return null;
    return SERVICE_ROLE_MAP[service.slug] || null;
  }

  /**
   * Active practitioners who can take this service (optionally one specific practitioner).
   * Throws if a specific practitioner was asked for but cannot take the service.
   */
  async getEligiblePractitioners(service, practitionerId = null, options = {}) {
    const roles = this.allowedRoleTypes(service);
    const where = { is_active: true };
    if (roles) where.role_type = roles;
    if (practitionerId) where.id = parseInt(practitionerId, 10);
    const list = await models.Practitioner.findAll({ where, order: [['id', 'ASC']], transaction: options.transaction });
    if (practitionerId && !list.length) {
      const err = new Error('The selected practitioner is not available for this service.');
      err.status = 400;
      err.errors = { practitionerId: err.message };
      throw err;
    }
    return list;
  }

  /**
   * One practitioner's working window and busy/blocked intervals for a date.
   */
  async getPractitionerDay(practitionerId, date, options = {}) {
    const { transaction, lock } = options;

    const override = await models.ScheduleOverride.findOne({
      where: { override_date: date, practitioner_id: { [Op.or]: [practitionerId, null] } },
      order: [['practitioner_id', 'DESC']],
      transaction
    });
    if (override && override.is_closed) {
      return { closed: true, reason: override.reason || 'Closed (holiday or leave)', open: 0, close: 0, busy: [], blocked: [] };
    }

    let openStr = '09:00';
    let closeStr = '21:00';
    if (override && override.open_time && override.close_time) {
      openStr = override.open_time;
      closeStr = override.close_time;
    } else {
      const weekly = await models.WeeklySchedule.findOne({
        where: { day_of_week: dayOfWeek(date), practitioner_id: { [Op.or]: [practitionerId, null] } },
        order: [['practitioner_id', 'DESC']],
        transaction
      });
      if (weekly) {
        if (!weekly.is_working_day) {
          return { closed: true, reason: 'Non-working day', open: 0, close: 0, busy: [], blocked: [] };
        }
        openStr = weekly.open_time || openStr;
        closeStr = weekly.close_time || closeStr;
      }
    }

    const appointments = await models.Appointment.findAll({
      where: { appointment_date: date, practitioner_id: practitionerId, status: { [Op.in]: ACTIVE_STATUSES } },
      attributes: ['id', 'start_time', 'end_time', 'status', 'hold_expires_at'],
      transaction,
      lock: lock && transaction ? transaction.LOCK.UPDATE : undefined
    });
    const now = new Date();
    const busy = appointments
      .filter(a => a.status !== 'hold' || (a.hold_expires_at && new Date(a.hold_expires_at) > now))
      .map(a => ({ start: timeStringToMinutes(a.start_time), end: timeStringToMinutes(a.end_time) }));

    const blocks = await models.BlockedInterval.findAll({
      where: { block_date: date, practitioner_id: { [Op.or]: [practitionerId, null] } },
      attributes: ['start_time', 'end_time'],
      transaction
    });
    const blocked = blocks.map(b => ({ start: timeStringToMinutes(b.start_time), end: timeStringToMinutes(b.end_time) }));

    return { closed: false, reason: null, open: timeStringToMinutes(openStr), close: timeStringToMinutes(closeStr), busy, blocked };
  }

  /** Status of one slot for one practitioner day: available | booked | blocked | closed */
  slotStatusFor(day, start, end) {
    if (day.closed || start < day.open || end > day.close) return 'closed';
    if (day.blocked.some(b => overlaps(start, end, b.start, b.end))) return 'blocked';
    if (day.busy.some(b => overlaps(start, end, b.start, b.end))) return 'booked';
    return 'available';
  }

  /**
   * Public availability for a date. A slot is available when at least one eligible
   * practitioner is free for the whole duration.
   */
  async getAvailability({ date, duration = 30, practitionerId = null, serviceId = null, serviceSlug = null, bookingType = 'paid', freeFromToday = false }) {
    if (!isValidYmd(date)) {
      const err = new Error('Invalid date format. Expected YYYY-MM-DD.');
      err.status = 400;
      throw err;
    }
    const durationMinutes = parseInt(duration, 10) === 60 ? 60 : 30;
    const type = this.normalizeBookingType(bookingType);
    const window = this.getBookingWindow(type, { freeFromToday });

    const base = {
      date,
      timezone: 'Asia/Kolkata (IST)',
      booking_type: type,
      earliest_date: window.earliest,
      latest_date: window.latest,
      duration: durationMinutes,
      is_closed: false,
      reason: null,
      operating_hours: null,
      total_slots: 0,
      available_slots: 0,
      slots: []
    };

    if (date < window.today) {
      return { ...base, is_closed: true, reason: 'This date has passed.' };
    }
    if (date < window.earliest) {
      return {
        ...base,
        is_closed: true,
        reason: type === 'free'
          ? `Free consultations can be booked from ${window.earliest} onwards. Choose a paid consultation for an earlier slot.`
          : 'This date is not open for booking yet.'
      };
    }
    if (date > window.latest) {
      return { ...base, is_closed: true, reason: 'Bookings are open up to 12 months ahead.' };
    }

    const service = (serviceId || serviceSlug) ? await this.resolveService({ serviceId, serviceSlug }) : null;
    if ((serviceId || serviceSlug) && !service) {
      const err = new Error('Selected service is invalid or unavailable.');
      err.status = 400;
      throw err;
    }

    const practitioners = await this.getEligiblePractitioners(service, practitionerId);
    if (!practitioners.length) {
      return { ...base, is_closed: true, reason: 'No practitioner is currently available for this service.' };
    }

    const days = [];
    for (const p of practitioners) {
      days.push(await this.getPractitionerDay(p.id, date));
    }
    const openDays = days.filter(d => !d.closed);
    if (!openDays.length) {
      return { ...base, is_closed: true, reason: days[0].reason || 'Closed on this date.' };
    }

    const open = Math.min(...openDays.map(d => d.open));
    const close = Math.max(...openDays.map(d => d.close));
    const isToday = date === window.today;
    const nowMin = nowMinutesIST();

    const slots = [];
    for (let start = open; start + durationMinutes <= close; start += 30) {
      const end = start + durationMinutes;
      const startStr = minutesToTimeString(start);
      const endStr = minutesToTimeString(end);

      let status;
      if (isToday && start <= nowMin + SAME_DAY_BUFFER_MINUTES) {
        status = 'passed';
      } else {
        const statuses = days.map(d => this.slotStatusFor(d, start, end));
        if (statuses.includes('available')) status = 'available';
        else if (statuses.includes('booked')) status = 'booked';
        else status = 'blocked';
      }

      let period = 'morning';
      if (start >= 720 && start < 960) period = 'afternoon';
      else if (start >= 960) period = 'evening';

      slots.push({
        start_time: startStr,
        end_time: endStr,
        label: `${format12Hour(startStr)} – ${format12Hour(endStr)}`,
        duration: durationMinutes,
        period,
        status
      });
    }

    const available = slots.filter(s => s.status === 'available').length;
    return {
      ...base,
      operating_hours: `${minutesToTimeString(open)} – ${minutesToTimeString(close)}`,
      total_slots: slots.length,
      available_slots: available,
      slots
    };
  }

  /**
   * Inside a booking transaction: lock the day's appointments for the eligible practitioners
   * and return the first practitioner free for [start, end), or null.
   */
  async findFreePractitioner({ date, startMinutes, endMinutes, practitioners, transaction }) {
    for (const p of practitioners) {
      const day = await this.getPractitionerDay(p.id, date, { transaction, lock: true });
      if (this.slotStatusFor(day, startMinutes, endMinutes) === 'available') return p;
    }
    return null;
  }

  async getPractitioners({ serviceSlug = null } = {}) {
    const service = serviceSlug ? await this.resolveService({ serviceSlug }) : null;
    const roles = this.allowedRoleTypes(service);
    const where = { is_active: true };
    if (roles) where.role_type = roles;
    return models.Practitioner.findAll({
      where,
      attributes: ['id', 'name', 'title', 'role_type', 'qualifications', 'photo_url'],
      order: [['id', 'ASC']]
    });
  }

  async getServices() {
    const services = await models.Service.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'slug', 'description', 'duration_options', 'price_30_minor', 'price_60_minor', 'modes', 'sort_order'],
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
    return services.map(s => {
      const json = s.toJSON();
      json.price_30_inr = Math.round((json.price_30_minor || 0) / 100);
      json.price_60_inr = Math.round((json.price_60_minor || 0) / 100);
      json.practitioner_types = SERVICE_ROLE_MAP[json.slug] || null;
      return json;
    });
  }
}

const schedulingService = new SchedulingService();
schedulingService.helpers = { timeStringToMinutes, minutesToTimeString, format12Hour, ACTIVE_STATUSES };
module.exports = schedulingService;
