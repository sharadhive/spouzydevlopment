/**
 * India Standard Time helpers. All business dates (bookings, "today" on dashboards)
 * are in Asia/Kolkata; database timestamps (created_at) are stored in UTC.
 */
const TZ = 'Asia/Kolkata';

/** Today's date in IST as YYYY-MM-DD */
function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Minutes since midnight IST for the given instant */
function nowMinutesIST(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour').value, 10) % 24;
  const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return h * 60 + m;
}

/** UTC Date for 00:00 IST of the given YYYY-MM-DD */
function istDayStartUtc(ymd) {
  return new Date(`${ymd}T00:00:00+05:30`);
}

/** Add whole days to a YYYY-MM-DD string */
function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Add calendar months to a YYYY-MM-DD string (clamps to month end, e.g. Dec 31 + 2 = Feb 28/29) */
function addMonths(ymd, months) {
  const [y, m, d] = ymd.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) for a YYYY-MM-DD string */
function dayOfWeek(ymd) {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

function isValidYmd(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

module.exports = { TZ, todayIST, nowMinutesIST, istDayStartUtc, addDays, addMonths, dayOfWeek, isValidYmd };
