/**
 * Admin notifications: one row per event, newest first.
 * notify() never throws: a notification problem must never break a payment, booking or form.
 * Staff see only the events their permissions allow (the `permission` stored on each row).
 */
const { Op } = require('sequelize');
const { Notification, NotificationRead, sequelize } = require('../models');
const { hasPermission } = require('../middlewares/rbac.middleware');

// type → category, permission, level
const TYPES = {
  payment_received: { category: 'payments', permission: 'orders:view', level: 'success' },
  payment_failed: { category: 'payments', permission: 'orders:view', level: 'warning' },
  bill_sent: { category: 'payments', permission: 'orders:view', level: 'info' },
  order_placed: { category: 'orders', permission: 'orders:view', level: 'info' },
  free_claimed: { category: 'orders', permission: 'orders:view', level: 'info' },
  customer_signup: { category: 'orders', permission: 'orders:view', level: 'info' },
  appointment_booked: { category: 'bookings', permission: 'appointments:view', level: 'info' },
  enquiry: { category: 'enquiries', permission: 'enquiries:view', level: 'info' },
  callback: { category: 'enquiries', permission: 'enquiries:view', level: 'warning' },
  clinical_application: { category: 'applications', permission: 'clinical_apps:view', level: 'info' },
  career_application: { category: 'applications', permission: 'careers:view', level: 'info' },
  visitor_question: { category: 'website', permission: 'moderation:view', level: 'info' },
  visitor_story: { category: 'website', permission: 'moderation:view', level: 'info' },
  id_verification: { category: 'orders', permission: 'verifications:view', level: 'warning' },
  esm_reminder: { category: 'orders', permission: 'verifications:view', level: 'info' }
};
const CATEGORIES = ['payments', 'orders', 'bookings', 'enquiries', 'applications', 'website'];
const PERMISSIONS = Array.from(new Set(Object.values(TYPES).map(t => t.permission)));

function clip(v, n) {
  const s = String(v == null ? '' : v).trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function allowedPermissions(user) {
  return PERMISSIONS.filter(p => hasPermission(user, p));
}

function present(n, readIds) {
  const j = n.toJSON ? n.toJSON() : n;
  return {
    id: j.id,
    type: j.type,
    category: j.category,
    level: j.level,
    title: j.title,
    message: j.message,
    link: j.link,
    entity_type: j.entity_type,
    entity_id: j.entity_id,
    amount_inr: j.amount_minor ? Math.round(j.amount_minor / 100) : null,
    created_at: j.createdAt || j.created_at,
    read: readIds ? readIds.has(j.id) : false
  };
}

class NotificationService {
  /**
   * Record an event for staff.
   * @param {string} type one of TYPES
   * @param {{title:string, message?:string, link?:string, entityType?:string, entityId?:string|number, amountMinor?:number}} data
   */
  async notify(type, data = {}) {
    try {
      const def = TYPES[type];
      if (!def) return null;
      return await Notification.create({
        type,
        category: def.category,
        level: data.level || def.level,
        permission: def.permission,
        title: clip(data.title, 200) || type,
        message: clip(data.message, 500) || null,
        link: clip(data.link, 255) || null,
        entity_type: data.entityType || null,
        entity_id: data.entityId !== undefined && data.entityId !== null ? String(data.entityId) : null,
        amount_minor: Number.isInteger(data.amountMinor) ? data.amountMinor : null
      });
    } catch (err) {
      console.error('[notifications] could not record', type, err.message);
      return null;
    }
  }

  async list(user, { limit = 30, beforeId, category, unreadOnly } = {}) {
    const perms = allowedPermissions(user);
    if (!perms.length) return { notifications: [], has_more: false };
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const where = { permission: { [Op.in]: perms } };
    if (beforeId) where.id = { [Op.lt]: parseInt(beforeId, 10) || 0 };
    if (category && CATEGORIES.includes(category)) where.category = category;
    if (unreadOnly) {
      where[Op.and] = [sequelize.literal(`NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = Notification.id AND nr.user_id = ${parseInt(user.id, 10)})`)];
    }
    const rows = await Notification.findAll({ where, order: [['id', 'DESC']], limit: lim + 1 });
    const page = rows.slice(0, lim);
    const reads = page.length
      ? await NotificationRead.findAll({ where: { user_id: user.id, notification_id: page.map(r => r.id) }, attributes: ['notification_id'] })
      : [];
    const readIds = new Set(reads.map(r => r.notification_id));
    // For payments: is the bill still waiting to be sent? (the "Send bill" button only shows then)
    const billIds = page.filter(n => n.entity_type === 'Invoice' && n.entity_id).map(n => parseInt(n.entity_id, 10)).filter(Boolean);
    const billStatus = {};
    if (billIds.length) {
      const { Invoice } = require('../models');
      (await Invoice.findAll({ where: { id: billIds }, attributes: ['id', 'status'] })).forEach(b => { billStatus[b.id] = b.status; });
    }
    return {
      notifications: page.map(n => {
        const out = present(n, readIds);
        if (n.entity_type === 'Invoice') out.bill_status = billStatus[parseInt(n.entity_id, 10)] || null;
        return out;
      }),
      has_more: rows.length > lim
    };
  }

  /** Unread count (last 90 days) and the newest few, for the bell */
  async summary(user, latest = 8) {
    const perms = allowedPermissions(user);
    if (!perms.length) return { unread: 0, latest_id: 0, latest: [] };
    const since = new Date(Date.now() - 90 * 864e5);
    const unread = await Notification.count({
      where: {
        permission: { [Op.in]: perms },
        createdAt: { [Op.gte]: since },
        [Op.and]: [sequelize.literal(`NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = Notification.id AND nr.user_id = ${parseInt(user.id, 10)})`)]
      }
    });
    const { notifications } = await this.list(user, { limit: latest });
    return { unread, latest_id: notifications.length ? notifications[0].id : 0, latest: notifications };
  }

  /** Mark some (ids) or all visible notifications as read for this user */
  async markRead(user, { ids, all } = {}) {
    const perms = allowedPermissions(user);
    if (!perms.length) return { marked: 0 };
    const where = { permission: { [Op.in]: perms } };
    if (!all) {
      const list = (Array.isArray(ids) ? ids : []).map(i => parseInt(i, 10)).filter(Boolean).slice(0, 500);
      if (!list.length) return { marked: 0 };
      where.id = { [Op.in]: list };
    } else {
      where.createdAt = { [Op.gte]: new Date(Date.now() - 90 * 864e5) };
    }
    where[Op.and] = [sequelize.literal(`NOT EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = Notification.id AND nr.user_id = ${parseInt(user.id, 10)})`)];
    const rows = await Notification.findAll({ where, attributes: ['id'], limit: 2000 });
    if (rows.length) {
      await NotificationRead.bulkCreate(rows.map(r => ({ notification_id: r.id, user_id: user.id })), { ignoreDuplicates: true });
    }
    return { marked: rows.length };
  }
}

const notificationService = new NotificationService();
notificationService.TYPES = TYPES;
notificationService.CATEGORIES = CATEGORIES;
module.exports = notificationService;
