/**
 * Customer packages, cart and package orders.
 * Prices always come from the database; the browser only sends package ids and quantities.
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Package, CartItem, PackageOrder, User, Role, Service } = require('../models');
const { createValidator, ValidationError } = require('../config/validation');
const paymentService = require('./payment.service');
const offerService = require('./offer.service');
const notificationService = require('./notification.service');

const ORDER_STATUSES = ['pending_payment', 'paid', 'confirmed', 'completed', 'cancelled'];
const ORDER_PAYMENT_STATUSES = ['not_required', 'pending', 'paid', 'refunded', 'failed'];
const MAX_QTY = 5;
const PACKAGE_FIELDS = ['name', 'slug', 'tagline', 'description', 'price_minor', 'compare_at_minor', 'sessions_included',
  'session_minutes', 'validity_days', 'features', 'service_slugs', 'badge', 'is_active', 'sort_order'];

function httpError(message, status = 400, errors) {
  const e = new Error(message);
  e.status = status;
  if (errors) e.errors = errors;
  return e;
}

function slugify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 140);
}

function asList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const parsed = JSON.parse(v); if (Array.isArray(parsed)) return parsed; } catch (e) { /* plain text */ }
    return v.split(/\r?\n/);
  }
  return [];
}

function inr(minor) {
  return Math.round((Number(minor) || 0) / 100);
}

/**
 * Public shape of a package (no internal fields).
 * offer: the live offer linked to this package (see offer.service). An offer price replaces the
 * price everywhere (cards, cart, checkout) and the normal price is shown struck through.
 */
function presentPackage(p, offer) {
  const j = p.toJSON ? p.toJSON() : p;
  const offerPrice = offer ? offerService.effectiveOfferPrice(offer, j) : null;
  const price = offerPrice || j.price_minor;
  let compareAt = j.compare_at_minor && j.compare_at_minor > price ? j.compare_at_minor : null;
  if (offerPrice) compareAt = j.price_minor;
  return {
    id: j.id,
    name: j.name,
    slug: j.slug,
    tagline: j.tagline,
    description: j.description,
    price_minor: price,
    price_inr: inr(price),
    list_price_minor: j.price_minor,
    compare_at_inr: compareAt ? inr(compareAt) : null,
    is_free: !price,
    sessions_included: j.sessions_included,
    session_minutes: j.session_minutes,
    validity_days: j.validity_days,
    features: asList(j.features).map(String).filter(Boolean),
    service_slugs: asList(j.service_slugs).map(String).filter(Boolean),
    badge: j.badge,
    sort_order: j.sort_order,
    offer: offer ? {
      id: offer.id,
      title: offer.title,
      badge_text: offer.badge_text || null,
      description: offer.description || null,
      end_date: offer.end_date || null,
      has_price: !!offerPrice,
      save_inr: offerPrice ? inr(j.price_minor - offerPrice) : 0
    } : null
  };
}

function newOrderNo() {
  const yy = String(new Date().getUTCFullYear()).slice(2);
  return `SP-ORD-${yy}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

class ShopService {
  // --------------------------------------------------------------------------
  // Public
  // --------------------------------------------------------------------------
  async listPublicPackages({ service } = {}) {
    const rows = await Package.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    const offers = await offerService.packageOfferMap();
    let list = rows.map(r => presentPackage(r, offers.get(r.id)));
    if (service) list = list.filter(p => !p.service_slugs.length || p.service_slugs.includes(service));
    const services = await Service.findAll({ where: { is_active: true }, attributes: ['slug', 'name'], order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    const payment = await paymentService.getPublicConfig();
    return { packages: list, services: services.map(s => ({ slug: s.slug, name: s.name })), payment: { enabled: payment.enabled, message: payment.message || null } };
  }

  // --------------------------------------------------------------------------
  // Cart
  // --------------------------------------------------------------------------
  async getCart(userId) {
    const items = await CartItem.findAll({
      where: { user_id: userId },
      include: [{ model: Package, as: 'package' }],
      order: [['id', 'ASC']]
    });
    // Drop items whose package was removed or switched off by the admin
    const stale = items.filter(i => !i.package || !i.package.is_active);
    if (stale.length) await CartItem.destroy({ where: { id: stale.map(i => i.id) } });

    const offers = await offerService.packageOfferMap();
    const lines = items.filter(i => i.package && i.package.is_active).map(i => {
      const pkg = presentPackage(i.package, offers.get(i.package.id));
      return { package: pkg, quantity: i.quantity, line_total_minor: pkg.price_minor * i.quantity, line_total_inr: inr(pkg.price_minor * i.quantity) };
    });
    const totalMinor = lines.reduce((sum, l) => sum + l.line_total_minor, 0);
    const payment = await paymentService.getPublicConfig();
    const hasFree = lines.some(l => l.package.is_free);
    const hasPaid = lines.some(l => !l.package.is_free);
    return {
      items: lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      total_minor: totalMinor,
      total_inr: inr(totalMinor),
      has_free: hasFree,
      has_paid: hasPaid,
      payment: { enabled: payment.enabled, message: payment.message || null, keyId: payment.keyId || null, checkoutScript: payment.checkoutScript || null },
      // Paid packages can be checked out only when the payment driver is on; free ones always
      can_checkout: lines.length > 0 && (!hasPaid || payment.enabled),
      removed_unavailable: stale.length
    };
  }

  async addToCart(userId, { packageId, packageSlug, quantity = 1 }) {
    const where = packageId ? { id: packageId } : { slug: String(packageSlug || '') };
    const pkg = await Package.findOne({ where });
    if (!pkg || !pkg.is_active) throw httpError('This package is not available.', 404);
    let qty = Math.max(1, Math.min(MAX_QTY, parseInt(quantity, 10) || 1));
    if (!pkg.price_minor) qty = 1; // a free package once
    const [item, created] = await CartItem.findOrCreate({
      where: { user_id: userId, package_id: pkg.id },
      defaults: { user_id: userId, package_id: pkg.id, quantity: qty }
    });
    if (!created) {
      const next = pkg.price_minor ? Math.min(MAX_QTY, item.quantity + qty) : 1;
      await item.update({ quantity: next });
    }
    return this.getCart(userId);
  }

  async updateCartItem(userId, packageId, quantity) {
    const item = await CartItem.findOne({ where: { user_id: userId, package_id: packageId }, include: [{ model: Package, as: 'package' }] });
    if (!item) throw httpError('This package is not in your cart.', 404);
    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) {
      await item.destroy();
    } else {
      await item.update({ quantity: item.package && !item.package.price_minor ? 1 : Math.min(MAX_QTY, qty) });
    }
    return this.getCart(userId);
  }

  async removeCartItem(userId, packageId) {
    await CartItem.destroy({ where: { user_id: userId, package_id: packageId } });
    return this.getCart(userId);
  }

  // --------------------------------------------------------------------------
  // Checkout
  // --------------------------------------------------------------------------
  /**
   * Free packages are confirmed immediately. Paid packages need the payment driver:
   * while it is off, checkout is refused and nothing is saved.
   * Options: freeOnly (claim only the free items in the cart), note (message for the care team).
   */
  async checkout(userId, { freeOnly = false, note = '' } = {}) {
    const cart = await this.getCart(userId);
    let lines = cart.items;
    if (freeOnly) lines = lines.filter(l => l.package.is_free);
    if (!lines.length) throw httpError(freeOnly ? 'There is no free package in your cart.' : 'Your cart is empty.');

    const total = lines.reduce((sum, l) => sum + l.line_total_minor, 0);
    const hasFree = lines.some(l => l.package.is_free);

    if (hasFree) {
      const freeIds = lines.filter(l => l.package.is_free).map(l => l.package.id);
      const previous = await PackageOrder.findAll({ where: { user_id: userId, status: { [Op.in]: ['confirmed', 'paid', 'completed'] } } });
      const alreadyClaimed = previous.some(o => asList(o.items).some(it => freeIds.includes(it.package_id) && !it.price_minor));
      if (alreadyClaimed) {
        throw httpError('You have already claimed the free package on this account. Remove it from your cart to continue.', 409);
      }
    }

    if (total > 0 && !(await paymentService.isOnlinePaymentEnabled())) {
      const cfg = await paymentService.getPublicConfig();
      throw httpError(cfg.message || 'Online payment integration is coming soon.', 409, { payment: 'coming_soon' });
    }

    const items = lines.map(l => ({
      package_id: l.package.id,
      slug: l.package.slug,
      name: l.package.name,
      price_minor: l.package.price_minor,
      list_price_minor: l.package.list_price_minor,
      offer: l.package.offer && l.package.offer.has_price ? { id: l.package.offer.id, title: l.package.offer.title } : null,
      quantity: l.quantity,
      sessions_included: l.package.sessions_included,
      session_minutes: l.package.session_minutes,
      validity_days: l.package.validity_days
    }));
    const customerNote = String(note || '').trim().slice(0, 1000) || null;

    if (total === 0) {
      const t = await sequelize.transaction();
      try {
        const order = await PackageOrder.create({
          order_no: newOrderNo(), user_id: userId, status: 'confirmed', payment_status: 'not_required',
          total_minor: 0, items, customer_note: customerNote
        }, { transaction: t });
        await CartItem.destroy({ where: { user_id: userId, package_id: items.map(i => i.package_id) }, transaction: t });
        await t.commit();
        const who = await User.findByPk(userId);
        await notificationService.notify('free_claimed', {
          title: `Free package claimed: ${items.map(i => i.name).join(', ')}`,
          message: `${who ? `${who.first_name || ''} ${who.last_name || ''}`.trim() : 'A customer'} (${who ? who.phone || who.email : ''}) claimed it · order ${order.order_no}. Contact them to schedule the session.`,
          link: '/shop?tab=orders',
          entityType: 'PackageOrder',
          entityId: order.id
        });
        return { order: this.presentOrder(order), paymentRequired: false };
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    // Paid: replace any earlier unpaid checkout of this customer, then open a payment order
    await PackageOrder.update(
      { status: 'cancelled', internal_notes: 'Replaced by a newer checkout before payment.' },
      { where: { user_id: userId, status: 'pending_payment' } }
    );
    const order = await PackageOrder.create({
      order_no: newOrderNo(), user_id: userId, status: 'pending_payment', payment_status: 'pending',
      total_minor: total, items, customer_note: customerNote
    });
    const payment = await paymentService.createPaymentOrder({ packageOrderId: order.id, amountMinorUnits: total, strict: true });
    const user = await User.findByPk(userId);
    await notificationService.notify('order_placed', {
      title: `New order ${order.order_no} · ₹${inr(total).toLocaleString('en-IN')} (awaiting payment)`,
      message: `${`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email} ordered ${items.map(i => `${i.name}${i.quantity > 1 ? ' × ' + i.quantity : ''}`).join(', ')}. You will get a "Payment received" notification once it is paid.`,
      link: '/shop?tab=orders',
      entityType: 'PackageOrder',
      entityId: order.id,
      amountMinor: total
    });
    return {
      order: this.presentOrder(order),
      paymentRequired: true,
      payment: {
        ...payment,
        name: 'SPOUZY',
        description: items.map(i => `${i.name}${i.quantity > 1 ? ' × ' + i.quantity : ''}`).join(', ').slice(0, 250),
        prefill: { name: `${user.first_name || ''} ${user.last_name || ''}`.trim(), email: user.email, contact: user.phone || '' }
      }
    };
  }

  presentOrder(o) {
    const j = o.toJSON ? o.toJSON() : o;
    return {
      id: j.id,
      order_no: j.order_no,
      status: j.status,
      payment_status: j.payment_status,
      total_minor: j.total_minor,
      total_inr: inr(j.total_minor),
      items: asList(j.items).map(i => ({ ...i, price_inr: inr(i.price_minor) })),
      customer_note: j.customer_note,
      paid_at: j.paid_at,
      created_at: j.createdAt
    };
  }

  async listCustomerOrders(userId) {
    const orders = await PackageOrder.findAll({ where: { user_id: userId }, order: [['id', 'DESC']] });
    return orders.map(o => this.presentOrder(o));
  }

  // --------------------------------------------------------------------------
  // Customer profile
  // --------------------------------------------------------------------------
  async getProfile(userId) {
    const u = await User.findByPk(userId);
    return { id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim(), first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone, member_since: u.createdAt };
  }

  async updateProfile(userId, { name, phone }) {
    const v = createValidator({ name, phone });
    v.required('name', 'Full name', { min: 2, max: 150 });
    v.phone('phone', 'Mobile number');
    v.throwIfErrors();
    const parts = String(name).trim().split(/\s+/);
    await User.update({ first_name: parts[0], last_name: parts.slice(1).join(' '), phone: String(phone).trim() }, { where: { id: userId } });
    return this.getProfile(userId);
  }

  // --------------------------------------------------------------------------
  // Admin
  // --------------------------------------------------------------------------
  async listPackagesAdmin() {
    const rows = await Package.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    const offers = await offerService.packageOfferMap();
    return rows.map(p => {
      const live = presentPackage(p, offers.get(p.id));
      // The admin edits the normal price; the live offer is shown next to it
      return {
        ...presentPackage(p),
        compare_at_inr: p.compare_at_minor ? inr(p.compare_at_minor) : null,
        live_offer: live.offer ? { ...live.offer, price_inr: live.price_inr } : null,
        is_active: p.is_active, compare_at_minor: p.compare_at_minor, updated_at: p.updatedAt
      };
    });
  }

  async savePackage(data = {}, id = null) {
    const out = {};
    PACKAGE_FIELDS.forEach(k => { if (data[k] !== undefined) out[k] = data[k]; });
    // The admin form sends rupees; store paise
    if (data.price_inr !== undefined) out.price_minor = Math.round(Number(data.price_inr) * 100);
    if (data.compare_at_inr !== undefined) out.compare_at_minor = data.compare_at_inr === '' || data.compare_at_inr === null ? null : Math.round(Number(data.compare_at_inr) * 100);
    if (out.features !== undefined) out.features = asList(out.features).map(s => String(s).trim()).filter(Boolean).slice(0, 12);
    if (out.service_slugs !== undefined) out.service_slugs = asList(out.service_slugs).map(s => String(s).trim()).filter(Boolean);
    ['sessions_included', 'session_minutes', 'validity_days', 'sort_order'].forEach(k => {
      if (out[k] !== undefined) out[k] = Math.max(0, parseInt(out[k], 10) || 0);
    });
    if (out.is_active !== undefined) out.is_active = out.is_active === true || out.is_active === 'true' || out.is_active === 1;
    if (out.badge !== undefined) out.badge = String(out.badge || '').trim().slice(0, 50) || null;

    const existing = id ? await Package.findByPk(id) : null;
    if (id && !existing) throw httpError('Package not found', 404);
    const merged = { ...(existing ? existing.toJSON() : {}), ...out };
    const errors = {};
    if (!String(merged.name || '').trim()) errors.name = 'Package name is required.';
    if (!Number.isInteger(merged.price_minor) || merged.price_minor < 0) errors.price_inr = 'Price must be zero (free) or more.';
    if (merged.compare_at_minor !== null && merged.compare_at_minor !== undefined && (!Number.isInteger(merged.compare_at_minor) || merged.compare_at_minor < 0)) errors.compare_at_inr = 'Original price must be a number.';
    if (!merged.sessions_included || merged.sessions_included < 1) errors.sessions_included = 'Include at least one session.';
    if (Object.keys(errors).length) throw new ValidationError(errors, Object.values(errors)[0]);

    if (!existing || out.slug !== undefined) {
      let base = slugify(out.slug || merged.name) || `package-${Date.now()}`;
      let slug = base;
      for (let n = 2; ; n++) {
        const clash = await Package.findOne({ where: { slug } });
        if (!clash || (existing && clash.id === existing.id)) break;
        slug = `${base}-${n}`;
      }
      out.slug = slug;
    }
    if (existing) {
      await existing.update(out);
      return existing;
    }
    return Package.create(out);
  }

  async listOrdersAdmin({ status, search, page = 1, limit = 20 } = {}) {
    const where = {};
    if (status) where.status = status;
    const include = [{ model: User, as: 'customer', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }];
    if (search) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [
        { order_no: { [Op.like]: q } },
        { '$customer.email$': { [Op.like]: q } },
        { '$customer.first_name$': { [Op.like]: q } },
        { '$customer.phone$': { [Op.like]: q } }
      ];
    }
    const lim = Math.min(100, parseInt(limit, 10) || 20);
    const { count, rows } = await PackageOrder.findAndCountAll({
      where, include, order: [['id', 'DESC']], limit: lim, offset: (Math.max(1, parseInt(page, 10)) - 1) * lim, subQuery: false
    });
    const { Invoice } = require('../models');
    const bills = rows.length ? await Invoice.findAll({ where: { package_order_id: rows.map(o => o.id), status: { [Op.ne]: 'void' } }, attributes: ['id', 'invoice_no', 'status', 'package_order_id'] }) : [];
    const billOf = {};
    bills.forEach(b => { billOf[b.package_order_id] = { id: b.id, invoice_no: b.invoice_no, status: b.status }; });
    return {
      total: count,
      orders: rows.map(o => ({
        ...this.presentOrder(o),
        invoice: billOf[o.id] || null,
        internal_notes: o.internal_notes,
        customer: o.customer ? { id: o.customer.id, name: `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim(), email: o.customer.email, phone: o.customer.phone } : null
      }))
    };
  }

  async updateOrderAdmin(id, { status, payment_status, internal_notes }) {
    const order = await PackageOrder.findByPk(id);
    if (!order) throw httpError('Order not found', 404);
    const updates = {};
    if (status !== undefined) {
      if (!ORDER_STATUSES.includes(status)) throw httpError(`Status must be one of: ${ORDER_STATUSES.join(', ')}`);
      updates.status = status;
    }
    if (payment_status !== undefined) {
      if (!ORDER_PAYMENT_STATUSES.includes(payment_status)) throw httpError(`Payment status must be one of: ${ORDER_PAYMENT_STATUSES.join(', ')}`);
      updates.payment_status = payment_status;
      if (payment_status === 'paid' && !order.paid_at) updates.paid_at = new Date();
    }
    if (internal_notes !== undefined) updates.internal_notes = String(internal_notes);
    const wasPaid = order.payment_status === 'paid';
    await order.update(updates);
    // Payment recorded by staff (cash, UPI at the clinic...): the bill is created like an online payment
    if (!wasPaid && order.payment_status === 'paid' && order.total_minor > 0) {
      await require('./billing.service').createForPackageOrder(order.id).catch(err => console.error('[billing]', err.message));
    }
    return this.presentOrder(order);
  }

  async listCustomersAdmin({ search, page = 1, limit = 25 } = {}) {
    const role = await Role.findOne({ where: { slug: 'customer' } });
    if (!role) return { total: 0, customers: [] };
    const where = { role_id: role.id };
    if (search) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [{ email: { [Op.like]: q } }, { first_name: { [Op.like]: q } }, { last_name: { [Op.like]: q } }, { phone: { [Op.like]: q } }];
    }
    const lim = Math.min(100, parseInt(limit, 10) || 25);
    const { count, rows } = await User.findAndCountAll({
      where, attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'is_active', 'createdAt', 'last_login_at'],
      order: [['id', 'DESC']], limit: lim, offset: (Math.max(1, parseInt(page, 10)) - 1) * lim
    });
    const ids = rows.map(r => r.id);
    const orders = ids.length ? await PackageOrder.findAll({ where: { user_id: ids }, attributes: ['user_id', 'status', 'total_minor', 'payment_status'] }) : [];
    return {
      total: count,
      customers: rows.map(u => {
        const mine = orders.filter(o => o.user_id === u.id);
        return {
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          email: u.email,
          phone: u.phone,
          is_active: u.is_active,
          joined: u.createdAt,
          last_login_at: u.last_login_at,
          orders: mine.length,
          paid_total_inr: inr(mine.filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total_minor, 0))
        };
      })
    };
  }

  /** Enable/disable a customer account or set a new password for them (staff action) */
  async updateCustomerAdmin(id, { is_active, password } = {}) {
    const role = await Role.findOne({ where: { slug: 'customer' } });
    const user = await User.findOne({ where: { id, role_id: role ? role.id : -1 } });
    if (!user) throw httpError('Customer not found', 404);
    const updates = {};
    if (is_active !== undefined) updates.is_active = !!is_active;
    if (password !== undefined) {
      const pw = String(password || '');
      if (!(pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw))) {
        throw httpError('The new password needs at least 8 characters with upper-case, lower-case and a number.', 400, { password: 'Too weak' });
      }
      const { hashPassword } = require('../config/security');
      updates.password_hash = await hashPassword(pw);
    }
    await user.update(updates);
    if (updates.is_active === false || updates.password_hash) {
      const { Session } = require('../models');
      await Session.destroy({ where: { user_id: user.id } });
    }
    return { id: user.id, is_active: user.is_active, password_reset: !!updates.password_hash };
  }
}

const shopService = new ShopService();
shopService.ORDER_STATUSES = ORDER_STATUSES;
shopService.ORDER_PAYMENT_STATUSES = ORDER_PAYMENT_STATUSES;
module.exports = shopService;
