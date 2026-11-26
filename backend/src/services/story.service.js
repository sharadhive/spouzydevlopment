/**
 * Client stories (homepage "Real Transformations" and the Reviews & Testimonials page).
 *
 * - Customers share a story only while logged in. It is saved as "pending" and the admin is notified.
 * - Nothing shows on the website until the admin approves it; the admin can edit, hide, show or delete.
 * - The admin can also add stories directly.
 * - The public never sees the real name: "Rohit & Priya S." is shown as "R***t & P***a S."
 *   (or "Anonymous" when the customer or admin chooses that). Email, phone and account stay private.
 * - "Verified" is set automatically when the account has a completed or paid appointment, or a paid package.
 */
const { Op } = require('sequelize');
const { VisitorStory, User, Appointment, PackageOrder, sequelize } = require('../models');
const { STORY_SERVICES } = require('../config/service-pages');
const { createValidator, str, isTrue } = require('../config/validation');

const SERVICE_LABEL = Object.fromEntries(STORY_SERVICES.map(s => [s.key, s.label]));
const MAX_PENDING_PER_USER = 3;

function fail(message, status = 400, errors) {
  const e = new Error(message);
  e.status = status;
  if (errors) e.errors = errors;
  return e;
}

// ---------------------------------------------------------------------------
// Name masking: first and last letter of each name, stars in between
// ---------------------------------------------------------------------------
function maskWord(word) {
  const m = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}\p{M}'’-]+)([^\p{L}\p{N}]*)$/u);
  if (!m) return word;
  const [, pre, core, post] = m;
  const chars = Array.from(core.replace(/[’']/g, ''));
  if (chars.length <= 1) return pre + core + post;          // an initial ("S.") stays
  if (chars.length === 2) return pre + chars[0] + '*' + post;
  const stars = '*'.repeat(Math.min(4, chars.length - 2));
  return pre + chars[0] + stars + chars[chars.length - 1] + post;
}

function maskName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  return n.split(' ').map(w => (/^(&|and|aur|\+|\/|-)$/i.test(w) ? w : maskWord(w))).join(' ');
}

function publicName(s) {
  if (s.is_anonymous || !str(s.display_name) || /^anonymous/i.test(str(s.display_name))) {
    return str(s.display_name) && /^anonymous/i.test(str(s.display_name)) ? str(s.display_name) : 'Anonymous';
  }
  return maskName(s.display_name);
}

function badgeFor(s) {
  if (str(s.badge_label)) return str(s.badge_label);
  return s.is_verified ? 'Verified Client' : '';
}

function tagFor(s) {
  return [str(s.tag_line), str(s.city)].filter(Boolean).join(' • ') || (s.service_key && SERVICE_LABEL[s.service_key]) || '';
}

function publicShape(s) {
  return {
    id: s.id,
    name: publicName(s),
    quote: s.story_text,
    rating: Math.min(5, Math.max(1, parseInt(s.rating, 10) || 5)),
    badge: badgeFor(s),
    verified: !!s.is_verified,
    tag: tagFor(s),
    service: s.service_key ? (SERVICE_LABEL[s.service_key] || '') : '',
    date: s.approved_at || s.created_at || s.createdAt
  };
}

/** What the admin sees: everything, plus how it will look */
function adminShape(s) {
  const j = typeof s.toJSON === 'function' ? s.toJSON() : s;
  const author = j.author ? { id: j.author.id, name: `${j.author.first_name || ''} ${j.author.last_name || ''}`.trim(), email: j.author.email, phone: j.author.phone } : null;
  let state = j.status;
  if (j.status === 'approved') state = j.is_hidden ? 'hidden' : 'live';
  return { ...j, author, state, public_preview: publicShape(j), service_label: SERVICE_LABEL[j.service_key] || '' };
}

/** Customer's own view (no internal notes) */
function mineShape(s) {
  let state = s.status;
  if (s.status === 'approved') state = s.is_hidden ? 'hidden' : 'live';
  return {
    id: s.id,
    story_text: s.story_text,
    display_name: s.display_name,
    is_anonymous: !!s.is_anonymous,
    shown_as: publicName(s),
    rating: s.rating,
    service_key: s.service_key,
    service_label: SERVICE_LABEL[s.service_key] || '',
    city: s.city,
    tag_line: s.tag_line,
    state,
    customer_message: s.customer_message || '',
    edited_by_team: !!s.edited_by_team,
    submitted_at: s.created_at || s.createdAt,
    approved_at: s.approved_at
  };
}

// ---------------------------------------------------------------------------
// Verification: did this account use a SPOUZY service?
// ---------------------------------------------------------------------------
async function verificationFor(user) {
  if (!user) return { verified: false, note: '' };
  const email = String(user.email || '').toLowerCase();
  const appt = await Appointment.findOne({
    where: {
      [Op.and]: [
        { [Op.or]: [{ user_id: user.id }, ...(email ? [{ client_email: email }] : [])] },
        { [Op.or]: [{ status: 'completed' }, { payment_status: 'paid' }] }
      ]
    },
    order: [['appointment_date', 'DESC']]
  });
  if (appt) {
    return { verified: true, note: `${appt.status === 'completed' ? 'Completed' : 'Paid'} appointment ${appt.reference_no} on ${appt.appointment_date}` };
  }
  const order = await PackageOrder.findOne({
    where: { user_id: user.id, [Op.or]: [{ payment_status: 'paid' }, { status: 'completed' }] },
    order: [['id', 'DESC']]
  });
  if (order) return { verified: true, note: `${order.payment_status === 'paid' ? 'Paid' : 'Completed'} package order ${order.order_no}` };
  const booked = await Appointment.findOne({
    where: { [Op.or]: [{ user_id: user.id }, ...(email ? [{ client_email: email }] : [])], status: { [Op.in]: ['confirmed', 'rescheduled'] } }
  });
  if (booked) return { verified: false, note: `Has a booked appointment (${booked.reference_no}) that is not completed yet` };
  return { verified: false, note: 'No completed or paid appointment or package found for this account' };
}

// ---------------------------------------------------------------------------
// Field checks shared by customer and admin forms
// ---------------------------------------------------------------------------
function readFields(data, { admin = false } = {}) {
  const out = {};
  if (data.story_text !== undefined) out.story_text = str(data.story_text).replace(/\r\n?/g, '\n');
  if (data.display_name !== undefined) out.display_name = str(data.display_name).replace(/\s+/g, ' ').slice(0, 100);
  if (data.is_anonymous !== undefined) out.is_anonymous = isTrue(data.is_anonymous);
  if (data.rating !== undefined) out.rating = Math.min(5, Math.max(1, parseInt(data.rating, 10) || 5));
  if (data.service_key !== undefined) out.service_key = SERVICE_LABEL[data.service_key] ? data.service_key : null;
  if (data.city !== undefined) out.city = str(data.city).slice(0, 80) || null;
  if (data.tag_line !== undefined) out.tag_line = str(data.tag_line).slice(0, 120) || null;
  if (admin) {
    if (data.badge_label !== undefined) out.badge_label = str(data.badge_label).slice(0, 60) || null;
    if (data.is_verified !== undefined) out.is_verified = isTrue(data.is_verified);
    if (data.show_on_home !== undefined) out.show_on_home = isTrue(data.show_on_home);
    if (data.sort_order !== undefined) out.sort_order = parseInt(data.sort_order, 10) || 0;
    if (data.internal_notes !== undefined) out.internal_notes = str(data.internal_notes) || null;
    if (data.customer_message !== undefined) out.customer_message = str(data.customer_message).slice(0, 500) || null;
  }
  return out;
}

function validate(fields, { creating }) {
  const v = createValidator({ story_text: creating ? '' : 'x'.repeat(60), ...fields });
  v.required('story_text', 'Your story', { min: 40, max: 3000 });
  if (creating && !fields.is_anonymous && !fields.display_name) v.custom('display_name', false, 'Please enter the name to show (only the first and last letters are shown), or choose Anonymous.');
  v.throwIfErrors();
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
async function listPublic({ home } = {}) {
  const where = { status: 'approved', is_hidden: false };
  if (home) where.show_on_home = true;
  const rows = await VisitorStory.findAll({
    where,
    order: [['sort_order', 'ASC'], ['approved_at', 'DESC'], ['id', 'DESC']],
    limit: home ? 12 : 60
  });
  return rows.map(publicShape);
}

// ---------------------------------------------------------------------------
// Customer (logged in)
// ---------------------------------------------------------------------------
async function listMine(user) {
  const rows = await VisitorStory.findAll({ where: { user_id: user.id }, order: [['id', 'DESC']] });
  const v = await verificationFor(user);
  return {
    stories: rows.map(mineShape),
    verified: v.verified,
    services: STORY_SERVICES,
    suggested_name: `${user.first_name || ''}${user.last_name ? ' ' + String(user.last_name).charAt(0).toUpperCase() + '.' : ''}`.trim()
  };
}

async function notifyAdmin(story, user, edited) {
  try {
    await require('./notification.service').notify('visitor_story', {
      title: edited ? 'A story was edited and needs review' : 'New story to approve',
      message: `${user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'A customer'}${story.is_verified ? ' (verified client)' : ''}: “${String(story.story_text).slice(0, 140)}${String(story.story_text).length > 140 ? '…' : ''}”`,
      link: `/content?tab=stories&story=${story.id}`,
      entityType: 'VisitorStory',
      entityId: story.id
    });
  } catch (e) { /* notify never blocks */ }
}

async function submit(user, data = {}) {
  if (!isTrue(data.consent)) throw fail('Please tick the box to give permission to publish your story.', 400, { consent: 'Permission to publish is required.' });
  const fields = readFields(data);
  if (!fields.service_key) throw fail('Please choose which SPOUZY care you used.', 400, { service_key: 'Please choose which care you used.' });
  validate(fields, { creating: true });
  const pending = await VisitorStory.count({ where: { user_id: user.id, status: 'pending' } });
  if (pending >= MAX_PENDING_PER_USER) throw fail(`You already have ${pending} stories waiting for review. Please wait until our team has looked at them.`, 429);
  const v = await verificationFor(user);
  const story = await VisitorStory.create({
    ...fields,
    display_name: fields.is_anonymous ? 'Anonymous' : fields.display_name,
    user_id: user.id,
    source: 'user',
    private_email: user.email || null,
    private_phone: user.phone || null,
    consent_agreed: true,
    status: 'pending',
    is_hidden: false,
    show_on_home: true,
    is_verified: v.verified,
    verified_note: v.note || null
  });
  await notifyAdmin(story, user, false);
  return mineShape(story);
}

async function updateMine(user, id, data = {}) {
  const story = await VisitorStory.findOne({ where: { id, user_id: user.id } });
  if (!story) throw fail('Story not found.', 404);
  const fields = readFields(data);
  validate({ ...fields, story_text: fields.story_text !== undefined ? fields.story_text : story.story_text }, { creating: false });
  if (fields.is_anonymous === false && fields.display_name === '' ) throw fail('Please enter the name to show, or choose Anonymous.', 400);
  const changedText = Object.keys(fields).some(k => String(fields[k] ?? '') !== String(story[k] ?? ''));
  if (!changedText) return mineShape(story);
  if (fields.is_anonymous) fields.display_name = 'Anonymous';
  // any change goes back to the team for review (a live story is taken off the website until approved again)
  await story.update({ ...fields, status: 'pending', approved_at: null, edited_by_team: false });
  await notifyAdmin(story, user, true);
  return mineShape(story);
}

/** The customer withdraws their story: it is deleted everywhere */
async function withdrawMine(user, id) {
  const story = await VisitorStory.findOne({ where: { id, user_id: user.id } });
  if (!story) throw fail('Story not found.', 404);
  await story.destroy();
  return { id: Number(id), withdrawn: true };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
const AUTHOR = { model: User, as: 'author', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'], required: false };

async function adminList({ state = 'pending', q } = {}) {
  const where = {};
  if (state === 'pending') where.status = 'pending';
  else if (state === 'live') Object.assign(where, { status: 'approved', is_hidden: false });
  else if (state === 'hidden') Object.assign(where, { status: 'approved', is_hidden: true });
  else if (state === 'rejected') where.status = 'rejected';
  if (q) {
    const like = `%${String(q).trim()}%`;
    where[Op.or] = [{ story_text: { [Op.like]: like } }, { display_name: { [Op.like]: like } }, { city: { [Op.like]: like } }];
  }
  const rows = await VisitorStory.findAll({
    where,
    include: [AUTHOR],
    order: state === 'live' ? [['sort_order', 'ASC'], ['approved_at', 'DESC'], ['id', 'DESC']] : [['id', 'DESC']],
    limit: 300
  });
  const [pending, live, hidden, rejected, all] = await Promise.all([
    VisitorStory.count({ where: { status: 'pending' } }),
    VisitorStory.count({ where: { status: 'approved', is_hidden: false } }),
    VisitorStory.count({ where: { status: 'approved', is_hidden: true } }),
    VisitorStory.count({ where: { status: 'rejected' } }),
    VisitorStory.count()
  ]);
  return { stories: rows.map(adminShape), counts: { pending, live, hidden, rejected, all }, services: STORY_SERVICES };
}

async function adminGet(id) {
  const s = await VisitorStory.findByPk(id, { include: [AUTHOR] });
  if (!s) throw fail('Story not found.', 404);
  return adminShape(s);
}

async function adminCreate(data = {}) {
  const fields = readFields(data, { admin: true });
  validate(fields, { creating: true });
  const publish = data.publish === undefined ? true : isTrue(data.publish);
  const story = await VisitorStory.create({
    ...fields,
    display_name: fields.is_anonymous ? (fields.display_name && /^anonymous/i.test(fields.display_name) ? fields.display_name : 'Anonymous') : fields.display_name,
    source: 'admin',
    consent_agreed: true,
    status: 'approved',
    approved_at: new Date(),
    is_hidden: !publish
  });
  return adminGet(story.id);
}

async function adminUpdate(id, data = {}) {
  const story = await VisitorStory.findByPk(id);
  if (!story) throw fail('Story not found.', 404);
  const fields = readFields(data, { admin: true });
  validate({ ...fields, story_text: fields.story_text !== undefined ? fields.story_text : story.story_text }, { creating: false });
  if (fields.is_anonymous && !(fields.display_name && /^anonymous/i.test(fields.display_name))) {
    // keep the real name for the record when the source is a customer; the public sees "Anonymous" anyway
    if (story.source !== 'user') fields.display_name = 'Anonymous';
  }
  if (story.source === 'user' && (fields.story_text !== undefined && fields.story_text !== story.story_text)) fields.edited_by_team = true;
  await story.update(fields);
  return adminGet(id);
}

/** action: approve | reject | hide | show */
async function adminModerate(id, { action, status, internal_notes, customer_message } = {}) {
  const story = await VisitorStory.findByPk(id);
  if (!story) throw fail('Story not found.', 404);
  const act = action || (status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : status === 'pending' ? 'pending' : null);
  const upd = {};
  if (act === 'approve') Object.assign(upd, { status: 'approved', is_hidden: false, approved_at: new Date() });
  else if (act === 'reject') Object.assign(upd, { status: 'rejected', is_hidden: false });
  else if (act === 'hide') Object.assign(upd, { status: 'approved', is_hidden: true });
  else if (act === 'show') Object.assign(upd, { status: 'approved', is_hidden: false, approved_at: story.approved_at || new Date() });
  else if (act === 'pending') Object.assign(upd, { status: 'pending' });
  else if (internal_notes === undefined && customer_message === undefined) throw fail('Choose approve, reject, hide or show.');
  if (internal_notes !== undefined) upd.internal_notes = str(internal_notes) || null;
  if (customer_message !== undefined) upd.customer_message = str(customer_message).slice(0, 500) || null;
  await story.update(upd);
  return adminGet(id);
}

async function adminRemove(id) {
  const story = await VisitorStory.findByPk(id);
  if (!story) throw fail('Story not found.', 404);
  await story.destroy();
  return { id: Number(id) };
}

/** Homepage order of live stories */
async function adminReorder(ids = []) {
  const list = (Array.isArray(ids) ? ids : []).map(n => parseInt(n, 10)).filter(Boolean);
  await sequelize.transaction(async (t) => {
    for (let i = 0; i < list.length; i++) await VisitorStory.update({ sort_order: i + 1 }, { where: { id: list[i] }, transaction: t });
  });
  return { ok: true };
}

module.exports = {
  maskName,
  publicName,
  listPublic,
  listMine,
  submit,
  updateMine,
  withdrawMine,
  adminList,
  adminGet,
  adminCreate,
  adminUpdate,
  adminModerate,
  adminRemove,
  adminReorder,
  verificationFor,
  STORY_SERVICES
};
