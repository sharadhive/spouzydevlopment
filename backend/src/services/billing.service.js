/**
 * Bills (invoices).
 *
 *  - A bill is created automatically when a payment succeeds (Razorpay checkout, webhook, or staff
 *    marking a package order as paid). It gets the next number for the financial year
 *    (April–March, India time), e.g. SPZ/2026-27/0001, and staff get a "Payment received" notification.
 *  - Staff open "Prepare & send": they pick or type the "Bill from" details (business name, address,
 *    GSTIN...) and the customer's billing details. New details are saved and offered in a dropdown
 *    next time. Then "Send to customer" makes the bill visible under My bills in the customer's account.
 *  - Prices already include GST. When the "Bill from" details have a GSTIN and a GST rate, the bill
 *    shows the GST contained in the amount (CGST + SGST, or IGST when the customer's GSTIN is from
 *    another state).
 */
const { Op } = require('sequelize');
const models = require('../models');
const { sequelize, Invoice, BillingProfile, CustomerBillingDetail, PaymentOrder, PaymentTransaction, PackageOrder, Appointment, User, Service, Practitioner } = models;
const { ValidationError } = require('../config/validation');
const notificationService = require('./notification.service');

const PREFIX = 'SPZ';
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MODE_LABEL = { virtual: 'Video call', video: 'Video call', phone: 'Phone call', clinic: 'In clinic', 'in-person': 'In clinic', in_person: 'In clinic' };

function httpError(message, status = 400, errors) {
  const e = new Error(message);
  e.status = status;
  if (errors) e.errors = errors;
  return e;
}
function clean(v, max) {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
}
function cleanMultiline(v, max) {
  const s = String(v == null ? '' : v).replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  return s ? s.slice(0, max) : null;
}
function asList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
  return [];
}
function asObj(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') { try { return JSON.parse(v) || null; } catch (e) { return null; } }
  return null;
}
function rupees(minor) {
  return Math.round(Number(minor || 0)) / 100;
}

/** Indian financial year of a date (India time): April 2026 – March 2027 → "2026-27" */
function financialYear(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(date);
  const y = parseInt(parts.find(p => p.type === 'year').value, 10);
  const m = parseInt(parts.find(p => p.type === 'month').value, 10);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** 5499 → "Five Thousand Four Hundred Ninety-Nine" (Indian system: lakh, crore) */
function numberToWords(n) {
  n = Math.floor(Number(n) || 0);
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? '-' + ones[x % 10] : ''));
  const three = (x) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return [h ? ones[h] + ' Hundred' : '', r ? two(r) : ''].filter(Boolean).join(' ');
  };
  const out = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) out.push(numberToWords(crore) + ' Crore');
  if (lakh) out.push(two(lakh) + ' Lakh');
  if (thousand) out.push(two(thousand) + ' Thousand');
  if (n) out.push(three(n));
  return out.join(' ');
}

function amountInWords(minor) {
  const r = Math.floor(minor / 100);
  const p = Math.round(minor % 100);
  return `Rupees ${numberToWords(r)}${p ? ` and ${numberToWords(p)} Paise` : ''} Only`;
}

/** GST contained in a tax-inclusive amount */
function taxBreakdown(totalMinor, seller, customer) {
  const rate = seller ? Number(seller.gst_rate) || 0 : 0;
  if (!seller || !seller.gstin || rate <= 0 || !totalMinor) return null;
  const taxable = Math.round(totalMinor * 100 / (100 + rate));
  const tax = totalMinor - taxable;
  const sameState = !customer || !customer.gstin || String(customer.gstin).slice(0, 2) === String(seller.gstin).slice(0, 2);
  if (sameState) {
    const cgst = Math.floor(tax / 2);
    return { rate, taxable_minor: taxable, tax_minor: tax, split: 'intra', lines: [{ label: `CGST @ ${rate / 2}%`, minor: cgst }, { label: `SGST @ ${rate / 2}%`, minor: tax - cgst }] };
  }
  return { rate, taxable_minor: taxable, tax_minor: tax, split: 'inter', lines: [{ label: `IGST @ ${rate}%`, minor: tax }] };
}

function profileSnapshot(p) {
  if (!p) return null;
  const j = p.toJSON ? p.toJSON() : p;
  return {
    profile_id: j.id || null,
    business_name: j.business_name,
    address: j.address,
    gstin: j.gstin || null,
    phone: j.phone || null,
    email: j.email || null,
    website: j.website || null,
    sac_code: j.sac_code || null,
    gst_rate: Number(j.gst_rate) || 0,
    footer_note: j.footer_note || null
  };
}

function present(inv, { forCustomer = false } = {}) {
  const j = inv.toJSON ? inv.toJSON() : inv;
  const seller = asObj(j.seller);
  const customer = asObj(j.customer) || {};
  const items = asList(j.items).map(i => ({
    ...i,
    unit_inr: rupees(i.unit_minor),
    list_inr: rupees(i.list_minor),
    discount_inr: rupees(i.discount_minor),
    total_inr: rupees(i.total_minor)
  }));
  const tax = taxBreakdown(j.total_minor, seller, customer);
  const out = {
    id: j.id,
    invoice_no: j.invoice_no,
    status: j.status,
    issued_at: j.issued_at,
    sent_at: j.sent_at,
    viewed_at: j.viewed_at,
    seller,
    customer: { name: customer.name, company: customer.company || null, email: customer.email || null, phone: customer.phone || null, address: customer.address || null, gstin: customer.gstin || null },
    items,
    subtotal_inr: rupees(j.subtotal_minor),
    discount_inr: rupees(j.discount_minor),
    total_inr: rupees(j.total_minor),
    total_minor: j.total_minor,
    amount_in_words: amountInWords(j.total_minor),
    tax: tax ? { ...tax, taxable_inr: rupees(tax.taxable_minor), tax_inr: rupees(tax.tax_minor), lines: tax.lines.map(l => ({ ...l, inr: rupees(l.minor) })) } : null,
    payment: asObj(j.payment),
    notes: j.notes
  };
  if (!forCustomer) {
    out.user_id = j.user_id;
    out.source = j.source;
    out.package_order_id = j.package_order_id;
    out.appointment_id = j.appointment_id;
    out.payment_order_id = j.payment_order_id;
    out.sent_by = j.sent_by ? `${j.sent_by.first_name || ''} ${j.sent_by.last_name || ''}`.trim() : null;
  }
  return out;
}

function itemsFromPackageOrder(order) {
  return asList(order.items).map(it => {
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    const unit = parseInt(it.price_minor, 10) || 0;
    const list = Math.max(unit, parseInt(it.list_price_minor, 10) || unit);
    const detail = [
      it.sessions_included ? `${it.sessions_included} ${it.sessions_included === 1 ? 'session' : 'sessions'} × ${it.session_minutes || 60} min` : null,
      it.validity_days ? `valid ${it.validity_days} days` : null,
      it.offer && it.offer.title ? `Offer: ${it.offer.title}` : null
    ].filter(Boolean).join(' · ');
    return { description: it.name || 'SPOUZY package', detail, quantity: qty, unit_minor: unit, list_minor: list, discount_minor: (list - unit) * qty, total_minor: unit * qty };
  });
}

async function itemsFromAppointment(appt) {
  const service = appt.service_id ? await Service.findByPk(appt.service_id) : null;
  const practitioner = appt.practitioner_id ? await Practitioner.findByPk(appt.practitioner_id) : null;
  const when = appt.appointment_date ? new Date(`${appt.appointment_date}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
  const detail = [
    `${appt.duration_minutes || 60}-minute session`,
    when ? `${when}${appt.start_time ? ', ' + String(appt.start_time).slice(0, 5) + ' IST' : ''}` : null,
    practitioner ? practitioner.name : null,
    MODE_LABEL[appt.consultation_mode] || null,
    `Booking ${appt.reference_no}`
  ].filter(Boolean).join(' · ');
  const amount = appt.amount_minor_units || 0;
  return [{ description: service ? service.name : 'Consultation', detail, quantity: 1, unit_minor: amount, list_minor: amount, discount_minor: 0, total_minor: amount }];
}

async function lastCustomerDetails(userId, email) {
  const where = userId ? { user_id: userId } : (email ? { email: String(email).toLowerCase() } : null);
  if (!where) return null;
  return CustomerBillingDetail.findOne({ where, order: [['last_used_at', 'DESC'], ['id', 'DESC']] });
}

class BillingService {
  // --------------------------------------------------------------------------
  // Creating bills
  // --------------------------------------------------------------------------
  async defaultProfile() {
    return (await BillingProfile.findOne({ where: { is_default: true }, order: [['id', 'ASC']] }))
      || BillingProfile.findOne({ order: [['last_used_at', 'DESC'], ['id', 'DESC']] });
  }

  /** Save a new bill with the next number of its financial year (retries if two are created at once) */
  async createInvoice(data) {
    const fy = financialYear(data.issued_at || new Date());
    for (let attempt = 0; attempt < 6; attempt++) {
      const max = await Invoice.max('seq', { where: { fy } });
      const seq = (Number(max) || 0) + 1;
      try {
        return await Invoice.create({ ...data, fy, seq, invoice_no: `${PREFIX}/${fy}/${String(seq).padStart(4, '0')}` });
      } catch (err) {
        if (err.name !== 'SequelizeUniqueConstraintError') throw err;
        if (data.payment_order_id) {
          const existing = await Invoice.findOne({ where: { payment_order_id: data.payment_order_id } });
          if (existing) return existing;
        }
      }
    }
    throw new Error('Could not number the bill. Please try again.');
  }

  async customerSnapshot({ userId, name, email, phone }) {
    const saved = await lastCustomerDetails(userId, email);
    return {
      user_id: userId || null,
      name: (saved && saved.name) || name || 'Customer',
      company: saved ? saved.company : null,
      email: email || (saved && saved.email) || null,
      phone: phone || (saved && saved.phone) || null,
      address: saved ? saved.address : null,
      gstin: saved ? saved.gstin : null,
      detail_id: saved ? saved.id : null
    };
  }

  /** Called after a payment succeeded (checkout or webhook). Never throws. */
  async onPaymentReceived(paymentOrderId) {
    try {
      return await this.createForPaymentOrder(paymentOrderId);
    } catch (err) {
      console.error('[billing] could not create the bill for payment order', paymentOrderId, err.message);
      return null;
    }
  }

  async createForPaymentOrder(paymentOrderId) {
    const existing = await Invoice.findOne({ where: { payment_order_id: paymentOrderId } });
    if (existing) return existing;
    const po = await PaymentOrder.findByPk(paymentOrderId);
    if (!po || po.status !== 'paid') return null;
    const tx = await PaymentTransaction.findOne({ where: { payment_order_id: po.id, status: 'success' }, order: [['id', 'DESC']] });
    const paidAt = (tx && tx.createdAt) || new Date();
    let data;
    if (po.package_order_id) {
      const order = await PackageOrder.findByPk(po.package_order_id);
      if (!order) return null;
      const user = await User.findByPk(order.user_id);
      const items = itemsFromPackageOrder(order);
      data = {
        user_id: order.user_id,
        package_order_id: order.id,
        customer: await this.customerSnapshot({ userId: order.user_id, name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '', email: user && user.email, phone: user && user.phone }),
        items,
        payment: { method: 'Online payment (Razorpay)', gateway_payment_id: tx ? tx.gateway_payment_id : null, payment_reference: po.order_reference, reference: order.order_no, reference_label: 'Order', paid_at: paidAt }
      };
    } else if (po.appointment_id) {
      const appt = await Appointment.findByPk(po.appointment_id);
      if (!appt) return null;
      data = {
        user_id: appt.user_id || null,
        appointment_id: appt.id,
        customer: await this.customerSnapshot({ userId: appt.user_id, name: appt.client_name, email: appt.client_email, phone: appt.client_mobile }),
        items: await itemsFromAppointment(appt),
        payment: { method: 'Online payment (Razorpay)', gateway_payment_id: tx ? tx.gateway_payment_id : null, payment_reference: po.order_reference, reference: appt.reference_no, reference_label: 'Booking', paid_at: paidAt }
      };
    } else {
      return null;
    }
    const subtotal = data.items.reduce((s, i) => s + i.list_minor * i.quantity, 0);
    const discount = data.items.reduce((s, i) => s + i.discount_minor, 0);
    let invoice;
    try {
      invoice = await this.createInvoice({
        ...data,
        payment_order_id: po.id,
        status: 'ready',
        source: 'online',
        issued_at: new Date(),
        seller: profileSnapshot(await this.defaultProfile()),
        subtotal_minor: subtotal,
        discount_minor: discount,
        total_minor: po.amount_minor_units
      });
    } catch (err) {
      const again = await Invoice.findOne({ where: { payment_order_id: po.id } });
      if (again) return again;
      throw err;
    }
    await this.notifyPayment(invoice, 'online');
    return invoice;
  }

  /** Staff marked a package order as paid (cash, UPI at the clinic...): create its bill if it has none */
  async createForPackageOrder(packageOrderId) {
    const order = await PackageOrder.findByPk(packageOrderId);
    if (!order || order.payment_status !== 'paid' || !order.total_minor) return null;
    const existing = await Invoice.findOne({ where: { package_order_id: order.id, status: { [Op.ne]: 'void' } } });
    if (existing) return existing;
    const user = await User.findByPk(order.user_id);
    const items = itemsFromPackageOrder(order);
    const invoice = await this.createInvoice({
      user_id: order.user_id,
      package_order_id: order.id,
      status: 'ready',
      source: 'manual',
      issued_at: new Date(),
      seller: profileSnapshot(await this.defaultProfile()),
      customer: await this.customerSnapshot({ userId: order.user_id, name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '', email: user && user.email, phone: user && user.phone }),
      items,
      subtotal_minor: items.reduce((s, i) => s + i.list_minor * i.quantity, 0),
      discount_minor: items.reduce((s, i) => s + i.discount_minor, 0),
      total_minor: order.total_minor,
      payment: { method: 'Payment recorded by the SPOUZY team', reference: order.order_no, reference_label: 'Order', paid_at: order.paid_at || new Date() }
    });
    await this.notifyPayment(invoice, 'manual');
    return invoice;
  }

  async notifyPayment(invoice, source) {
    const customer = asObj(invoice.customer) || {};
    const items = asList(invoice.items).map(i => i.description + (i.quantity > 1 ? ` × ${i.quantity}` : '')).join(', ');
    const amount = '₹' + rupees(invoice.total_minor).toLocaleString('en-IN');
    await notificationService.notify('payment_received', {
      title: `${source === 'manual' ? 'Payment recorded' : 'Payment received'} · ${amount}`,
      message: `${customer.name || 'A customer'} paid for ${items || 'their order'}. Bill ${invoice.invoice_no} is ready: check the details and send it.`,
      link: `/shop?tab=bills&bill=${invoice.id}`,
      entityType: 'Invoice',
      entityId: invoice.id,
      amountMinor: invoice.total_minor
    });
  }

  // --------------------------------------------------------------------------
  // Staff: list, prepare, send
  // --------------------------------------------------------------------------
  async listAdmin({ status, search, page = 1, limit = 20 } = {}) {
    const where = {};
    if (['ready', 'sent', 'void'].includes(status)) where.status = status;
    if (search) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [{ invoice_no: { [Op.like]: q } }, sequelize.where(sequelize.cast(sequelize.col('customer'), 'CHAR'), { [Op.like]: q })];
    }
    const lim = Math.min(100, parseInt(limit, 10) || 20);
    const { count, rows } = await Invoice.findAndCountAll({
      where, order: [['id', 'DESC']], limit: lim, offset: (Math.max(1, parseInt(page, 10) || 1) - 1) * lim,
      include: [{ model: User, as: 'sent_by', attributes: ['first_name', 'last_name'] }]
    });
    const counts = {};
    for (const s of ['ready', 'sent']) counts[s] = await Invoice.count({ where: { status: s } });
    return { total: count, counts, invoices: rows.map(r => present(r)) };
  }

  async getAdmin(id) {
    const inv = await Invoice.findByPk(id, { include: [{ model: User, as: 'sent_by', attributes: ['first_name', 'last_name'] }] });
    if (!inv) throw httpError('Bill not found', 404);
    const customer = asObj(inv.customer) || {};
    const [profiles, details] = await Promise.all([
      this.listProfiles(),
      this.listCustomerDetails({ userId: inv.user_id, email: customer.email })
    ]);
    return { invoice: present(inv), profiles, customer_details: details };
  }

  /**
   * Save the details of a bill that has not been sent yet.
   * body.seller: { profile_id } to use a saved "Bill from", or the fields (saved as a new entry when new)
   * body.customer: { name, company, email, phone, address, gstin } (saved for this customer when new)
   */
  async updateDetails(id, body = {}) {
    const inv = await Invoice.findByPk(id);
    if (!inv) throw httpError('Bill not found', 404);
    if (inv.status !== 'ready') throw httpError('This bill has already been sent to the customer, so it can no longer be changed.', 409);
    const errors = {};
    const updates = {};

    // Bill from
    if (body.seller) {
      const s = body.seller;
      let profile = null;
      if (s.profile_id && !s.edit) {
        profile = await BillingProfile.findByPk(s.profile_id);
        if (!profile) errors['seller.profile_id'] = 'These saved details no longer exist. Choose others or enter new details.';
      } else {
        const fields = {
          business_name: clean(s.business_name, 150),
          address: cleanMultiline(s.address, 400),
          gstin: clean(s.gstin, 15) ? clean(s.gstin, 15).toUpperCase() : null,
          phone: clean(s.phone, 30),
          email: clean(s.email, 150),
          website: clean(s.website, 150),
          sac_code: clean(s.sac_code, 10),
          gst_rate: Math.max(0, Math.min(28, Number(s.gst_rate) || 0)),
          footer_note: clean(s.footer_note, 300)
        };
        if (!fields.business_name) errors['seller.business_name'] = 'Business name is required.';
        if (!fields.address) errors['seller.address'] = 'Business address is required.';
        if (fields.gstin && !GSTIN_RE.test(fields.gstin)) errors['seller.gstin'] = 'GSTIN should be 15 characters, e.g. 27ABCDE1234F1Z5.';
        if (fields.gst_rate > 0 && !fields.gstin) errors['seller.gst_rate'] = 'Add your GSTIN to show GST on the bill (or set the rate to 0).';
        if (fields.email && !EMAIL_RE.test(fields.email)) errors['seller.email'] = 'Enter a valid email address.';
        if (!Object.keys(errors).length) {
          // Reuse an identical saved entry instead of saving a duplicate
          profile = s.profile_id ? await BillingProfile.findByPk(s.profile_id) : null;
          if (profile) {
            await profile.update(fields);
          } else {
            const all = await BillingProfile.findAll();
            profile = all.find(p => p.business_name === fields.business_name && p.address === fields.address && (p.gstin || null) === fields.gstin) || null;
            if (profile) await profile.update(fields);
            else profile = await BillingProfile.create({ ...fields, is_default: (await BillingProfile.count()) === 0 });
          }
        }
      }
      if (profile) {
        if (s.make_default) {
          await BillingProfile.update({ is_default: false }, { where: { id: { [Op.ne]: profile.id } } });
          await profile.update({ is_default: true });
        }
        await profile.update({ last_used_at: new Date() });
        updates.seller = profileSnapshot(profile);
      }
    }

    // Bill to
    if (body.customer) {
      const c = body.customer;
      const current = asObj(inv.customer) || {};
      const fields = {
        name: clean(c.name, 150),
        company: clean(c.company, 150),
        email: clean(c.email, 150) ? clean(c.email, 150).toLowerCase() : null,
        phone: clean(c.phone, 30),
        address: cleanMultiline(c.address, 400),
        gstin: clean(c.gstin, 15) ? clean(c.gstin, 15).toUpperCase() : null
      };
      if (!fields.name) errors['customer.name'] = 'Customer name is required.';
      if (fields.gstin && !GSTIN_RE.test(fields.gstin)) errors['customer.gstin'] = 'Customer GSTIN should be 15 characters, e.g. 27ABCDE1234F1Z5.';
      if (fields.email && !EMAIL_RE.test(fields.email)) errors['customer.email'] = 'Enter a valid email address.';
      if (!Object.keys(errors).length) {
        // Save for this customer when anything beyond their account details was entered
        let detailId = null;
        if (fields.address || fields.gstin || fields.company) {
          const where = inv.user_id ? { user_id: inv.user_id } : { email: fields.email || current.email || null };
          const saved = await CustomerBillingDetail.findAll({ where });
          let row = saved.find(d => d.name === fields.name && (d.company || null) === fields.company && (d.address || null) === fields.address && (d.gstin || null) === fields.gstin);
          if (row) await row.update({ phone: fields.phone, last_used_at: new Date() });
          else row = await CustomerBillingDetail.create({ ...fields, user_id: inv.user_id || null, email: fields.email || current.email || null, last_used_at: new Date() });
          detailId = row.id;
        }
        updates.customer = { ...fields, user_id: inv.user_id || null, detail_id: detailId };
      }
    }

    if (body.notes !== undefined) updates.notes = clean(body.notes, 500);
    if (Object.keys(errors).length) throw new ValidationError(errors, Object.values(errors)[0]);
    await inv.update(updates);
    return this.getAdmin(inv.id);
  }

  async send(id, staffUser) {
    const inv = await Invoice.findByPk(id);
    if (!inv) throw httpError('Bill not found', 404);
    if (inv.status === 'sent') return this.getAdmin(inv.id);
    if (inv.status !== 'ready') throw httpError('This bill cannot be sent.', 409);
    const seller = asObj(inv.seller);
    if (!seller || !seller.business_name || !seller.address) {
      throw httpError('Add the "Bill from" details (business name and address) before sending the bill.', 400, { 'seller.business_name': 'Required before sending' });
    }
    await inv.update({ status: 'sent', sent_at: new Date(), sent_by_user_id: staffUser ? staffUser.id : null });
    const customer = asObj(inv.customer) || {};
    await notificationService.notify('bill_sent', {
      title: `Bill ${inv.invoice_no} sent to ${customer.name || 'the customer'}`,
      message: `₹${rupees(inv.total_minor).toLocaleString('en-IN')} · ${inv.user_id ? 'Now in the customer\'s account under My bills.' : 'This customer has no account; print or share the bill.'}${staffUser ? ` Sent by ${staffUser.first_name || 'staff'}.` : ''}`,
      link: `/shop?tab=bills&bill=${inv.id}`,
      entityType: 'Invoice',
      entityId: inv.id,
      amountMinor: inv.total_minor
    });
    return this.getAdmin(inv.id);
  }

  // Saved "Bill from" and "Bill to" details --------------------------------
  async listProfiles() {
    const rows = await BillingProfile.findAll({ order: [['is_default', 'DESC'], ['last_used_at', 'DESC'], ['id', 'DESC']] });
    return rows.map(r => ({ ...profileSnapshot(r), id: r.id, is_default: r.is_default, last_used_at: r.last_used_at }));
  }

  async setDefaultProfile(id) {
    const p = await BillingProfile.findByPk(id);
    if (!p) throw httpError('Saved details not found', 404);
    await BillingProfile.update({ is_default: false }, { where: {} });
    await p.update({ is_default: true });
    return this.listProfiles();
  }

  async deleteProfile(id) {
    const p = await BillingProfile.findByPk(id);
    if (!p) throw httpError('Saved details not found', 404);
    await p.destroy(); // bills keep their own copy of the details
    return this.listProfiles();
  }

  async listCustomerDetails({ userId, email }) {
    const where = userId ? { user_id: userId } : (email ? { email: String(email).toLowerCase() } : null);
    if (!where) return [];
    const rows = await CustomerBillingDetail.findAll({ where, order: [['last_used_at', 'DESC'], ['id', 'DESC']], limit: 20 });
    return rows.map(r => ({ id: r.id, name: r.name, company: r.company, email: r.email, phone: r.phone, address: r.address, gstin: r.gstin, last_used_at: r.last_used_at }));
  }

  // --------------------------------------------------------------------------
  // Customer: My bills
  // --------------------------------------------------------------------------
  async listForCustomer(userId) {
    const rows = await Invoice.findAll({ where: { user_id: userId, status: 'sent' }, order: [['id', 'DESC']] });
    return rows.map(r => {
      const p = present(r, { forCustomer: true });
      return { id: p.id, invoice_no: p.invoice_no, issued_at: p.issued_at, sent_at: p.sent_at, total_inr: p.total_inr, items: p.items.map(i => i.description), is_new: !r.viewed_at };
    });
  }

  async getForCustomer(userId, id) {
    const inv = await Invoice.findOne({ where: { id: parseInt(id, 10) || 0, user_id: userId, status: 'sent' } });
    if (!inv) throw httpError('Bill not found', 404);
    if (!inv.viewed_at) await inv.update({ viewed_at: new Date() });
    return present(inv, { forCustomer: true });
  }
}

const billingService = new BillingService();
billingService.financialYear = financialYear;
billingService.amountInWords = amountInWords;
billingService.taxBreakdown = taxBreakdown;
module.exports = billingService;
