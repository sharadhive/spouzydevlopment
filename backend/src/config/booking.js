/**
 * Booking rules shared by availability and appointment creation.
 */

// Which practitioner types can take each service (by service slug).
// Services not listed here can be booked with any active practitioner.
const SERVICE_ROLE_MAP = {
  'couples-therapy': ['counsellor'],
  'premarital': ['counsellor'],
  'general': ['counsellor'],
  'intimacy-clinic': ['doctor'],
  'mediation': ['mediator']
};

// Free consultations open this many calendar months after today (IST).
const FREE_BOOKING_MIN_MONTHS = 2;
// Verified ex-servicemen: the team is reminded to offer a consultation this many months after the last one.
const ESM_REMINDER_MONTHS = 12;
// How far ahead any booking may be made.
const MAX_BOOKING_DAYS_AHEAD = 365;
// Slots starting within this many minutes from now are treated as passed.
const SAME_DAY_BUFFER_MINUTES = 15;
// Paid booking slot hold while the patient completes online payment.
const PAYMENT_HOLD_MINUTES = 15;

// Website consultation-mode values → stored consultation_mode + clinic_location
const MODE_MAP = {
  virtual: { consultation_mode: 'video', clinic_location: null },
  video: { consultation_mode: 'video', clinic_location: null },
  phone: { consultation_mode: 'phone', clinic_location: null },
  mumbai: { consultation_mode: 'in-person', clinic_location: 'mumbai' },
  pune: { consultation_mode: 'in-person', clinic_location: 'pune' },
  delhi: { consultation_mode: 'in-person', clinic_location: 'delhi' },
  bengaluru: { consultation_mode: 'in-person', clinic_location: 'bengaluru' },
  'in-person': { consultation_mode: 'in-person', clinic_location: null }
};

const BOOKING_TYPES = ['free', 'paid'];

module.exports = {
  SERVICE_ROLE_MAP,
  FREE_BOOKING_MIN_MONTHS,
  ESM_REMINDER_MONTHS,
  MAX_BOOKING_DAYS_AHEAD,
  SAME_DAY_BUFFER_MINUTES,
  PAYMENT_HOLD_MINUTES,
  MODE_MAP,
  BOOKING_TYPES
};
