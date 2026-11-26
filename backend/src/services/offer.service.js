/**
 * Offers: card images uploaded in the admin panel.
 *
 * An offer is live when it is switched on, today (India time) is inside its start/end dates,
 * its image file exists and, when it is linked to a package, that package is on the website.
 * Live offers:
 *  - appear in the website popup (when "show in popup" is on);
 *  - appear on the linked package's card;
 *  - when they have an offer price, that price is what the customer pays at checkout.
 * With no live offer the website shows no popup at all.
 */
const { Op } = require('sequelize');
const { Offer, Package } = require('../models');
const { ValidationError } = require('../config/validation');
const { imageProblem } = require('../config/media-paths');
const { todayIST } = require('../config/time');

const FIELDS = ['title', 'description', 'image_path', 'image_alt', 'badge_text', 'package_id', 'cta_label', 'cta_url',
  'terms', 'start_date', 'end_date', 'show_popup', 'is_active', 'sort_order'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Our own pages (e.g. "packages.htm", "pre-marriage.htm#faq") or a secure outside address
const URL_RE = /^(https:\/\/[^\s"'<>]+|\/?[a-z0-9][a-z0-9\-/]*\.html?([?#][^\s"'<>]*)?|#[a-z0-9-]+)$/i;

function httpError(message, status = 400, errors) {
  const e = new Error(message);
  e.status = status;
  if (errors) e.errors = errors;
  return e;
}

function rupees(minor) {
  return Math.round((Number(minor) || 0) / 100);
}

function clean(v, max) {
  const s = String(v == null ? '' : v).trim();
  return s ? s.slice(0, max) : null;
}

function asDate(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).slice(0, 10);
  return DATE_RE.test(s) ? s : 'invalid';
}

function bool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/** Where an offer stands today: live, scheduled, ended, off, or why it cannot show */
function offerStatus(o, today = todayIST()) {
  const j = o.toJSON ? o.toJSON() : o;
  if (!j.is_active) return 'off';
  if (j.start_date && j.start_date > today) return 'scheduled';
  if (j.end_date && j.end_date < today) return 'ended';
  if (imageProblem(j.image_path) || !String(j.image_path || '').trim()) return 'image_missing';
  if (j.package_id && (!j.package || !j.package.is_active)) return 'package_hidden';
  return 'live';
}

/** The price an offer gives its package, or null when it does not lower the price */
function effectiveOfferPrice(offer, pkg) {
  if (!offer || offer.offer_price_minor === null || offer.offer_price_minor === undefined) return null;
  const price = Number(offer.offer_price_minor);
  if (!pkg || !pkg.price_minor || !(price > 0) || price >= pkg.price_minor) return null;
  return price;
}

function defaultCta(o, pkg) {
  if (o.cta_label) return o.cta_label;
  if (pkg) return o.offer_price_minor ? 'Claim this offer' : 'View package';
  return 'Learn more';
}

/** Public shape of a live offer */
function presentPublic(o) {
  const j = o.toJSON ? o.toJSON() : o;
  const pkg = j.package && j.package.is_active ? j.package : null;
  const offerPrice = effectiveOfferPrice(j, pkg);
  return {
    id: j.id,
    title: j.title,
    description: j.description,
    image_url: j.image_path,
    image_alt: j.image_alt || j.title,
    badge_text: j.badge_text,
    terms: j.terms,
    start_date: j.start_date,
    end_date: j.end_date,
    show_popup: !!j.show_popup,
    cta_label: defaultCta(j, pkg),
    cta_url: pkg ? `packages.htm#pkg-${pkg.slug}` : (j.cta_url || 'packages.htm'),
    package: pkg ? {
      id: pkg.id,
      slug: pkg.slug,
      name: pkg.name,
      price_inr: rupees(pkg.price_minor),
      offer_price_inr: offerPrice ? rupees(offerPrice) : null,
      is_free: !pkg.price_minor
    } : null
  };
}

class OfferService {
  /** Live offers in display order (cheap query; used by the website, packages and the chat) */
  async liveOffers() {
    const today = todayIST();
    const rows = await Offer.findAll({
      where: {
        is_active: true,
        [Op.and]: [
          { [Op.or]: [{ start_date: null }, { start_date: { [Op.lte]: today } }] },
          { [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: today } }] }
        ]
      },
      include: [{ model: Package, as: 'package', required: false }],
      order: [['sort_order', 'ASC'], ['id', 'DESC']]
    });
    return rows.filter(o => offerStatus(o, today) === 'live');
  }

  async listPublic() {
    const live = await this.liveOffers();
    return live.map(presentPublic);
  }

  /**
   * The best live offer for each package id: the lowest offer price wins; otherwise the first in order.
   * @returns {Map<number, object>}
   */
  async packageOfferMap() {
    const map = new Map();
    const live = await this.liveOffers();
    for (const o of live) {
      if (!o.package_id || !o.package) continue;
      const current = map.get(o.package_id);
      const price = effectiveOfferPrice(o, o.package);
      const currentPrice = current ? effectiveOfferPrice(current, current.package) : null;
      if (!current || (price !== null && (currentPrice === null || price < currentPrice))) map.set(o.package_id, o);
    }
    return map;
  }

  // --------------------------------------------------------------------------
  // Admin
  // --------------------------------------------------------------------------
  async listAdmin() {
    const today = todayIST();
    const rows = await Offer.findAll({
      include: [{ model: Package, as: 'package', required: false }],
      order: [['sort_order', 'ASC'], ['id', 'DESC']]
    });
    return rows.map(o => {
      const j = o.toJSON();
      const pkg = j.package || null;
      return {
        ...j,
        offer_price_inr: j.offer_price_minor !== null && j.offer_price_minor !== undefined ? rupees(j.offer_price_minor) : null,
        package: pkg ? { id: pkg.id, name: pkg.name, slug: pkg.slug, price_inr: rupees(pkg.price_minor), is_active: pkg.is_active } : null,
        status: offerStatus(o, today),
        image_problem: imageProblem(j.image_path) || null
      };
    });
  }

  /**
   * Create or update an offer. canSetPrice: the user may change package prices (packages:edit);
   * only they can add, change or remove an offer price.
   */
  async save(data = {}, id = null, { canSetPrice = false } = {}) {
    const existing = id ? await Offer.findByPk(id) : null;
    if (id && !existing) throw httpError('Offer not found', 404);

    const out = {};
    FIELDS.forEach(k => { if (data[k] !== undefined) out[k] = data[k]; });
    if (out.title !== undefined) out.title = clean(out.title, 120);
    if (out.description !== undefined) out.description = clean(out.description, 300);
    if (out.image_path !== undefined) out.image_path = clean(out.image_path, 255);
    if (out.image_alt !== undefined) out.image_alt = clean(out.image_alt, 160);
    if (out.badge_text !== undefined) out.badge_text = clean(out.badge_text, 40);
    if (out.cta_label !== undefined) out.cta_label = clean(out.cta_label, 40);
    if (out.cta_url !== undefined) out.cta_url = clean(out.cta_url, 255);
    if (out.terms !== undefined) out.terms = clean(out.terms, 500);
    if (out.start_date !== undefined) out.start_date = asDate(out.start_date);
    if (out.end_date !== undefined) out.end_date = asDate(out.end_date);
    if (out.show_popup !== undefined) out.show_popup = bool(out.show_popup);
    if (out.is_active !== undefined) out.is_active = bool(out.is_active);
    if (out.sort_order !== undefined) out.sort_order = Math.max(0, parseInt(out.sort_order, 10) || 0);
    if (out.package_id !== undefined) out.package_id = out.package_id === '' || out.package_id === null ? null : parseInt(out.package_id, 10) || null;

    // The admin form sends the offer price in rupees
    if (data.offer_price_inr !== undefined) {
      const v = data.offer_price_inr;
      out.offer_price_minor = v === '' || v === null ? null : Math.round(Number(v) * 100);
    }

    const before = existing ? existing.toJSON() : {};
    const merged = { ...before, ...out };
    if (merged.package_id === null) merged.offer_price_minor = null;
    if (out.package_id === null && before.offer_price_minor) out.offer_price_minor = null;

    // Price changes need the package-price permission
    const priceBefore = before.offer_price_minor ?? null;
    const priceAfter = merged.offer_price_minor ?? null;
    const priceTouched = priceAfter !== priceBefore || (priceAfter !== null && (merged.package_id ?? null) !== (before.package_id ?? null));
    if (priceTouched && !canSetPrice) {
      throw httpError('Only staff who can change package prices can set an offer price. Leave the offer price empty, or ask an administrator.', 403);
    }

    const errors = {};
    if (!merged.title) errors.title = 'Offer title is required.';
    if (!merged.image_path) errors.image_path = 'Upload the offer card image.';
    else {
      const problem = imageProblem(merged.image_path);
      if (problem) errors.image_path = problem;
    }
    if (merged.start_date === 'invalid') errors.start_date = 'Pick a valid start date.';
    if (merged.end_date === 'invalid') errors.end_date = 'Pick a valid end date.';
    if (!errors.start_date && !errors.end_date && merged.start_date && merged.end_date && merged.end_date < merged.start_date) {
      errors.end_date = 'The last day cannot be before the first day.';
    }
    if (merged.cta_url && !URL_RE.test(merged.cta_url)) {
      errors.cta_url = 'Use a website page such as packages.htm or a full https:// address.';
    }

    let pkg = null;
    if (merged.package_id) {
      pkg = await Package.findByPk(merged.package_id);
      if (!pkg) errors.package_id = 'This package no longer exists.';
    }
    if (merged.offer_price_minor !== null && merged.offer_price_minor !== undefined) {
      const price = merged.offer_price_minor;
      if (!pkg) errors.offer_price_inr = 'Choose the package this offer price is for.';
      else if (!pkg.price_minor) errors.offer_price_inr = `${pkg.name} is already free, so it cannot have an offer price.`;
      else if (!Number.isInteger(price) || price < 100) errors.offer_price_inr = 'The offer price must be at least ₹1.';
      else if (price >= pkg.price_minor) errors.offer_price_inr = `The offer price must be lower than the normal price (₹${rupees(pkg.price_minor).toLocaleString('en-IN')}).`;
    }
    if (Object.keys(errors).length) throw new ValidationError(errors, Object.values(errors)[0]);

    if (existing) {
      await existing.update(out);
      return existing;
    }
    return Offer.create({ show_popup: true, is_active: true, ...out });
  }

  async remove(id) {
    const offer = await Offer.findByPk(id);
    if (!offer) throw httpError('Offer not found', 404);
    await offer.destroy();
    return { id: Number(id) };
  }
}

const offerService = new OfferService();
offerService.offerStatus = offerStatus;
offerService.effectiveOfferPrice = effectiveOfferPrice;
module.exports = offerService;
