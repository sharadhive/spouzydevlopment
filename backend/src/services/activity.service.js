/**
 * Customer activity log: what logged-in customers did on the website.
 * Stores pages, button labels and key actions only — never form contents.
 */
const { Op } = require('sequelize');
const { CustomerActivity, User, Role } = require('../models');
const { todayIST, istDayStartUtc, addDays } = require('../config/time');

const CLIENT_EVENTS = ['page_view', 'click', 'booking_step'];
const SERVER_EVENTS = ['signup', 'login', 'login_failed', 'logout', 'password_changed', 'profile_updated',
  'cart_add', 'cart_remove', 'checkout', 'payment', 'booking', 'chat'];
const EVENT_LABELS = {
  page_view: 'Opened page',
  click: 'Pressed',
  booking_step: 'Booking',
  signup: 'Created account',
  login: 'Logged in',
  login_failed: 'Wrong password',
  logout: 'Logged out',
  password_changed: 'Changed password',
  profile_updated: 'Updated details',
  cart_add: 'Added to cart',
  cart_remove: 'Removed from cart',
  checkout: 'Checked out',
  payment: 'Paid',
  booking: 'Booked appointment',
  chat: 'Asked in chat'
};
const RETENTION_DAYS = 180;
const MAX_PER_HOUR = 400;

function clip(v, n) {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, n) : null;
}

/** Keep only the path and query of our own pages (no full URLs, no fragments) */
function cleanPage(p) {
  const s = String(p || '').trim();
  if (!s) return null;
  try {
    const u = new URL(s, 'http://local');
    return (u.pathname + u.search).slice(0, 255);
  } catch (e) {
    return s.slice(0, 255);
  }
}

function clientInfo(req) {
  if (!req) return {};
  const ip = (req.headers && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0] : (req.socket && req.socket.remoteAddress)) || null;
  return { ip_address: ip ? String(ip).slice(0, 45) : null, user_agent: req.headers ? clip(req.headers['user-agent'], 255) : null };
}

class ActivityService {
  /** Record one server-side event. Never throws (logging must not break the main action). */
  async record(userId, event, { page, label, details, req } = {}) {
    if (!userId || !SERVER_EVENTS.includes(event)) return;
    try {
      await CustomerActivity.create({
        user_id: userId,
        event,
        page: cleanPage(page || (req && req.headers ? req.headers.referer : null)),
        label: clip(label, 255),
        details: details || null,
        occurred_at: new Date(),
        ...clientInfo(req)
      });
    } catch (e) {
      console.warn('[Activity] could not record event:', e.message);
    }
  }

  /** Events sent by the website (page views, button presses), including steps taken just before logging in */
  async recordClientBatch(userId, events, req) {
    const list = Array.isArray(events) ? events.slice(0, 40) : [];
    if (!list.length) return { saved: 0 };
    const recent = await CustomerActivity.count({ where: { user_id: userId, occurred_at: { [Op.gte]: new Date(Date.now() - 3600 * 1000) } } });
    if (recent >= MAX_PER_HOUR) return { saved: 0, limited: true };

    const now = Date.now();
    const info = clientInfo(req);
    const rows = [];
    for (const ev of list) {
      if (!ev || !CLIENT_EVENTS.includes(ev.event)) continue;
      let at = Date.parse(ev.at);
      // Accept the browser's time only when it is plausible (up to 2 hours old, not in the future)
      if (isNaN(at) || at > now + 60 * 1000 || at < now - 2 * 3600 * 1000) at = now;
      const details = {};
      if (ev.href) details.href = clip(cleanPage(ev.href), 255);
      if (ev.title) details.title = clip(ev.title, 120);
      if (ev.beforeLogin) details.before_login = true;
      rows.push({
        user_id: userId,
        event: ev.event,
        page: cleanPage(ev.page),
        label: clip(ev.label, 255),
        details: Object.keys(details).length ? details : null,
        occurred_at: new Date(at),
        ...info
      });
    }
    if (rows.length) await CustomerActivity.bulkCreate(rows);
    return { saved: rows.length };
  }

  async listForUser(userId, { days = 30, limit = 500 } = {}) {
    const since = istDayStartUtc(addDays(todayIST(), -Math.max(1, Math.min(365, parseInt(days, 10) || 30)) + 1));
    const rows = await CustomerActivity.findAll({
      where: { user_id: userId, occurred_at: { [Op.gte]: since } },
      order: [['occurred_at', 'DESC'], ['id', 'DESC']],
      limit: Math.min(2000, parseInt(limit, 10) || 500)
    });
    return rows.map(r => ({
      id: r.id,
      event: r.event,
      event_label: EVENT_LABELS[r.event] || r.event,
      page: r.page,
      label: r.label,
      details: r.details,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      at: r.occurred_at
    }));
  }

  /** Customers seen on a given IST day (default today), with a short summary each */
  async activeOn(day = todayIST()) {
    const start = istDayStartUtc(day);
    const end = istDayStartUtc(addDays(day, 1));
    const rows = await CustomerActivity.findAll({
      where: { occurred_at: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ['user_id', 'event', 'page', 'label', 'occurred_at'],
      order: [['occurred_at', 'ASC']]
    });
    const byUser = new Map();
    rows.forEach(r => {
      const u = byUser.get(r.user_id) || { user_id: r.user_id, first_seen: r.occurred_at, last_seen: r.occurred_at, logins: 0, pages: 0, clicks: 0, bookings: 0, orders: 0, last_page: null };
      u.last_seen = r.occurred_at;
      if (r.event === 'login' || r.event === 'signup') u.logins += 1;
      if (r.event === 'page_view') { u.pages += 1; u.last_page = r.page; }
      if (r.event === 'click') u.clicks += 1;
      if (r.event === 'booking') u.bookings += 1;
      if (r.event === 'checkout' || r.event === 'payment') u.orders += 1;
      byUser.set(r.user_id, u);
    });
    const ids = Array.from(byUser.keys());
    const users = ids.length ? await User.findAll({ where: { id: ids }, attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }) : [];
    return users.map(u => ({
      ...byUser.get(u.id),
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      email: u.email,
      phone: u.phone
    })).sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
  }

  /** Last activity time per customer (for the customer list) */
  async lastSeenFor(userIds) {
    if (!userIds.length) return {};
    const rows = await CustomerActivity.findAll({
      where: { user_id: userIds },
      attributes: ['user_id', [CustomerActivity.sequelize.fn('MAX', CustomerActivity.sequelize.col('occurred_at')), 'last_seen']],
      group: ['user_id'],
      raw: true
    });
    const out = {};
    rows.forEach(r => { out[r.user_id] = r.last_seen; });
    return out;
  }

  async countActiveToday() {
    const start = istDayStartUtc(todayIST());
    const rows = await CustomerActivity.findAll({
      where: { occurred_at: { [Op.gte]: start } },
      attributes: [[CustomerActivity.sequelize.fn('COUNT', CustomerActivity.sequelize.fn('DISTINCT', CustomerActivity.sequelize.col('user_id'))), 'n']],
      raw: true
    });
    return parseInt(rows[0] && rows[0].n, 10) || 0;
  }

  async cleanup() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
    return CustomerActivity.destroy({ where: { occurred_at: { [Op.lt]: cutoff } } });
  }
}

const activityService = new ActivityService();
activityService.CLIENT_EVENTS = CLIENT_EVENTS;
activityService.SERVER_EVENTS = SERVER_EVENTS;
activityService.EVENT_LABELS = EVENT_LABELS;
module.exports = activityService;
