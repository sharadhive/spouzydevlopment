/**
 * Dashboard analytics: counts per day and breakdowns for the admin charts.
 * Every section is included only when the staff member's role may see that data.
 * Days are Indian Standard Time days.
 */
const { Op } = require('sequelize');
const models = require('../models');
const { todayIST, istDayStartUtc, addDays } = require('../config/time');

const ALLOWED_DAYS = [7, 30, 90];

function dayList(from, days) {
  const out = [];
  for (let i = 0; i < days; i++) out.push(addDays(from, i));
  return out;
}

function countBy(rows, keyFn) {
  const out = {};
  rows.forEach(r => {
    const k = keyFn(r);
    if (k === undefined || k === null || k === '') return;
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}

function topList(counts, limit, nameFn = k => k) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, v]) => ({ name: nameFn(k), count: v }));
}

const istDay = (d) => todayIST(new Date(d));
const rupees = (minor) => Math.round((Number(minor) || 0) / 100);

async function build(user, rawDays, can) {
  const days = ALLOWED_DAYS.includes(parseInt(rawDays, 10)) ? parseInt(rawDays, 10) : 30;
  const to = todayIST();
  const from = addDays(to, -(days - 1));
  const since = istDayStartUtc(from);
  const labels = dayList(from, days);
  const isAdmin = user && user.role && user.role.slug === 'admin';
  const out = { range: { days, from, to, labels } };
  const inRange = { createdAt: { [Op.gte]: since } };

  // ---------------------------------------------------------------- bookings
  if (can('appointments:view')) {
    const [created, held] = await Promise.all([
      models.Appointment.findAll({
        where: inRange,
        attributes: ['id', 'createdAt', 'booking_type', 'status', 'consultation_mode', 'service_id', 'practitioner_id', 'payment_status', 'amount_minor_units']
      }),
      models.Appointment.findAll({
        where: { appointment_date: { [Op.gte]: from, [Op.lte]: to } },
        attributes: ['appointment_date', 'status', 'start_time']
      })
    ]);
    const services = await models.Service.findAll({ attributes: ['id', 'name'] });
    const practitioners = await models.Practitioner.findAll({ attributes: ['id', 'name'] });
    const serviceName = Object.fromEntries(services.map(s => [String(s.id), s.name]));
    const practName = Object.fromEntries(practitioners.map(p => [String(p.id), p.name]));

    const byDay = labels.map(date => ({ date, free: 0, paid: 0 }));
    const idx = Object.fromEntries(labels.map((d, i) => [d, i]));
    created.forEach(a => {
      const i = idx[istDay(a.createdAt)];
      if (i === undefined) return;
      if (a.booking_type === 'free') byDay[i].free += 1; else byDay[i].paid += 1;
    });

    const weekday = [0, 0, 0, 0, 0, 0, 0]; // Monday first
    const hours = {};
    held.filter(a => ['confirmed', 'completed', 'rescheduled', 'no_show'].includes(a.status)).forEach(a => {
      const dow = new Date(`${a.appointment_date}T00:00:00Z`).getUTCDay();
      weekday[(dow + 6) % 7] += 1;
      const h = String(a.start_time || '').slice(0, 2);
      if (h) hours[h] = (hours[h] || 0) + 1;
    });
    const finished = held.filter(a => ['completed', 'no_show'].includes(a.status));
    const showed = finished.filter(a => a.status === 'completed').length;

    out.bookings = {
      total: created.length,
      free: created.filter(a => a.booking_type === 'free').length,
      paid: created.filter(a => a.booking_type !== 'free').length,
      byDay,
      byStatus: countBy(created, a => a.status),
      byMode: countBy(created, a => a.consultation_mode || 'not set'),
      byService: topList(countBy(created, a => a.service_id), 8, k => serviceName[k] || 'Other'),
      byPractitioner: topList(countBy(created, a => a.practitioner_id), 8, k => practName[k] || 'Any specialist'),
      byWeekday: weekday,
      byHour: Object.entries(hours).sort((a, b) => a[0].localeCompare(b[0])).map(([h, c]) => ({ hour: h, count: c })),
      showUpRate: finished.length ? Math.round((showed / finished.length) * 100) : null,
      sessionsHeld: held.filter(a => a.status === 'completed').length
    };
  }

  // ---------------------------------------------------------------- revenue
  if (isAdmin || can('orders:view')) {
    const [paidOrders, paidAppointments] = await Promise.all([
      models.PackageOrder.findAll({ where: { payment_status: 'paid', paid_at: { [Op.gte]: since } }, attributes: ['paid_at', 'total_minor'] }),
      can('appointments:view') || isAdmin
        ? models.Appointment.findAll({ where: { payment_status: 'paid', updatedAt: { [Op.gte]: since } }, attributes: ['updatedAt', 'amount_minor_units'] })
        : []
    ]);
    const byDay = labels.map(date => ({ date, packages: 0, consultations: 0 }));
    const idx = Object.fromEntries(labels.map((d, i) => [d, i]));
    paidOrders.forEach(o => { const i = idx[istDay(o.paid_at)]; if (i !== undefined) byDay[i].packages += rupees(o.total_minor); });
    paidAppointments.forEach(a => { const i = idx[istDay(a.updatedAt)]; if (i !== undefined) byDay[i].consultations += rupees(a.amount_minor_units); });
    const packages = byDay.reduce((s, d) => s + d.packages, 0);
    const consultations = byDay.reduce((s, d) => s + d.consultations, 0);
    const payments = paidOrders.length + paidAppointments.length;
    let onlineEnabled = false;
    try { onlineEnabled = await require('./payment.service').isOnlinePaymentEnabled(); } catch (e) { onlineEnabled = false; }
    out.revenue = { byDay, packages, consultations, total: packages + consultations, payments, average: payments ? Math.round((packages + consultations) / payments) : 0, onlineEnabled };
  }

  // ---------------------------------------------------------------- enquiries + chat
  if (can('enquiries:view')) {
    const rows = await models.Enquiry.findAll({ where: inRange, attributes: ['createdAt', 'source', 'status', 'service_interest'] });
    const idx = Object.fromEntries(labels.map((d, i) => [d, i]));
    const byDay = labels.map(date => ({ date, count: 0 }));
    rows.forEach(r => { const i = idx[istDay(r.createdAt)]; if (i !== undefined) byDay[i].count += 1; });
    const done = rows.filter(r => ['resolved', 'closed'].includes(r.status)).length;
    out.enquiries = {
      total: rows.length,
      byDay,
      bySource: countBy(rows, r => r.source),
      byStatus: countBy(rows, r => r.status),
      byInterest: topList(countBy(rows, r => r.service_interest), 6),
      handledRate: rows.length ? Math.round((done / rows.length) * 100) : null
    };

    if (models.ChatConversation && models.ChatMessage) {
      const [convs, msgs] = await Promise.all([
        models.ChatConversation.findAll({ where: inRange, attributes: ['createdAt', 'ended_reason', 'message_count'] }),
        models.ChatMessage.findAll({ where: { sent_at: { [Op.gte]: since } }, attributes: ['sender', 'matched', 'intent'] })
      ]);
      const cByDay = labels.map(date => ({ date, count: 0 }));
      convs.forEach(c => { const i = idx[istDay(c.createdAt)]; if (i !== undefined) cByDay[i].count += 1; });
      const userMsgs = msgs.filter(m => m.sender === 'user');
      const understood = userMsgs.filter(m => m.matched !== false && m.matched !== 0).length;
      const intents = countBy(msgs.filter(m => m.sender === 'bot' && m.intent && !['greeting', 'end', 'fallback', 'unknown'].includes(m.intent)), m => String(m.intent).split('+')[0]);
      out.chat = {
        conversations: convs.length,
        messages: userMsgs.length,
        byDay: cByDay,
        understood,
        notUnderstood: userMsgs.length - understood,
        answerRate: userMsgs.length ? Math.round((understood / userMsgs.length) * 100) : null,
        topTopics: topList(intents, 6),
        endedIdle: convs.filter(c => c.ended_reason === 'idle').length
      };
    }
  }

  // ---------------------------------------------------------------- customers, orders, funnel
  if (can('orders:view')) {
    const customerRole = await models.Role.findOne({ where: { slug: 'customer' } });
    const [signups, activity, orders] = await Promise.all([
      customerRole ? models.User.findAll({ where: { role_id: customerRole.id, ...inRange }, attributes: ['id', 'createdAt'] }) : [],
      models.CustomerActivity.findAll({ where: { occurred_at: { [Op.gte]: since } }, attributes: ['user_id', 'event', 'page', 'occurred_at'] }),
      models.PackageOrder.findAll({ where: inRange, attributes: ['user_id', 'status', 'payment_status', 'items', 'total_minor'] })
    ]);
    const idx = Object.fromEntries(labels.map((d, i) => [d, i]));
    const byDay = labels.map(date => ({ date, signups: 0, active: 0 }));
    signups.forEach(u => { const i = idx[istDay(u.createdAt)]; if (i !== undefined) byDay[i].signups += 1; });
    const activeSets = labels.map(() => new Set());
    activity.forEach(a => { const i = idx[istDay(a.occurred_at)]; if (i !== undefined) activeSets[i].add(a.user_id); });
    activeSets.forEach((s, i) => { byDay[i].active = s.size; });

    const pageViews = activity.filter(a => a.event === 'page_view' && a.page);
    const pageCounts = countBy(pageViews, a => String(a.page).split('?')[0].replace(/^\//, '') || 'index.htm');

    const packageCounts = {};
    orders.forEach(o => {
      let items = o.items;
      if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
      (Array.isArray(items) ? items : []).forEach(it => {
        const name = it.name || it.package_name || 'Package';
        packageCounts[name] = (packageCounts[name] || 0) + (parseInt(it.quantity, 10) || 1);
      });
    });

    // Funnel for accounts created in the period
    const newIds = new Set(signups.map(u => u.id));
    const bookedIds = new Set(activity.filter(a => a.event === 'booking' && newIds.has(a.user_id)).map(a => a.user_id));
    const orderedIds = new Set(orders.filter(o => newIds.has(o.user_id)).map(o => o.user_id));
    const paidIds = new Set(orders.filter(o => newIds.has(o.user_id) && (o.payment_status === 'paid' || Number(o.total_minor) === 0) && o.status !== 'cancelled').map(o => o.user_id));

    out.customers = {
      newAccounts: signups.length,
      activeCustomers: new Set(activity.map(a => a.user_id)).size,
      byDay,
      topPages: topList(pageCounts, 8),
      events: countBy(activity, a => a.event)
    };
    out.orders = {
      total: orders.length,
      byStatus: countBy(orders, o => o.status),
      byPackage: topList(packageCounts, 6)
    };
    out.funnel = [
      { label: 'Accounts created', value: signups.length },
      { label: 'Booked a session', value: bookedIds.size },
      { label: 'Ordered a package', value: orderedIds.size },
      { label: 'Paid or claimed', value: paidIds.size }
    ];
  }

  // ---------------------------------------------------------------- applications
  if (can('clinical_apps:view') || can('careers:view')) {
    const idx = Object.fromEntries(labels.map((d, i) => [d, i]));
    const byDay = labels.map(date => ({ date, clinical: 0, careers: 0 }));
    const apps = {};
    if (can('clinical_apps:view')) {
      const rows = await models.ClinicalApplication.findAll({ where: inRange, attributes: ['createdAt', 'status', 'role_type'] });
      rows.forEach(r => { const i = idx[istDay(r.createdAt)]; if (i !== undefined) byDay[i].clinical += 1; });
      apps.clinicalByStatus = countBy(rows, r => r.status);
      apps.clinicalByRole = countBy(rows, r => r.role_type);
      apps.clinical = rows.length;
    }
    if (can('careers:view')) {
      const rows = await models.CareerApplication.findAll({ where: inRange, attributes: ['createdAt', 'status'] });
      rows.forEach(r => { const i = idx[istDay(r.createdAt)]; if (i !== undefined) byDay[i].careers += 1; });
      apps.careersByStatus = countBy(rows, r => r.status);
      apps.careers = rows.length;
    }
    out.applications = { ...apps, byDay };
  }

  return out;
}

module.exports = { build, ALLOWED_DAYS };
