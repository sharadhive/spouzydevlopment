/**
 * Student and ex-servicemen ID verification.
 *
 * A customer uploads an ID proof (photo or PDF, kept private). The admin approves it or rejects it with a
 * message (why it failed and what to do); after a rejection the customer can upload again.
 *
 * Benefit while an approved ID is valid: the free consultation can be booked from today, like a paid one
 * (everyone else: from 2 months ahead). Students give the expiry date of their college ID; after that date
 * the benefit stops and they see the normal options again. Ex-servicemen IDs have no expiry; the team gets
 * a reminder every 12 months after their last consultation.
 *
 * For everyone: one consultation at a time. A new booking is possible after the current one has taken place
 * (or was cancelled).
 */
const { Op } = require('sequelize');
const { IdVerification, User, MediaAsset, Appointment } = require('../models');
const uploadService = require('./upload.service');
const { todayIST, addMonths, isValidYmd } = require('../config/time');
const { ESM_REMINDER_MONTHS } = require('../config/booking');
const { str } = require('../config/validation');

const CATEGORIES = {
  student: { label: 'Student', benefit: 'Student benefit' },
  ex_servicemen: { label: 'Ex-serviceman / Defence', benefit: 'Ex-servicemen benefit' }
};
const SERVICE_BRANCHES = ['Army', 'Navy', 'Air Force', 'Coast Guard', 'Central Armed Police Forces (CAPF)', 'Other defence service'];
const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function fail(message, status = 400, errors) {
  const e = new Error(message);
  e.status = status;
  if (errors) e.errors = errors;
  return e;
}

function formatDay(ymd) {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function ymdOf(date) {
  return date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(date)) : null;
}

// ---------------------------------------------------------------------------
// Benefit and booking rules
// ---------------------------------------------------------------------------
async function lastConsultationDate(userId, email) {
  const where = { status: 'completed', [Op.or]: [{ user_id: userId }, ...(email ? [{ client_email: email }] : [])] };
  const a = await Appointment.findOne({ where, order: [['appointment_date', 'DESC']], attributes: ['appointment_date'] });
  return a ? a.appointment_date : null;
}

/** The benefit of a customer right now: { active, category, label, valid_until, expired_on, reminder_due, … } */
async function benefitFor(userOrId) {
  const userId = typeof userOrId === 'object' && userOrId ? userOrId.id : userOrId;
  if (!userId) return { active: false };
  const approved = await IdVerification.findOne({ where: { user_id: userId, status: 'approved' }, order: [['reviewed_at', 'DESC'], ['id', 'DESC']] });
  if (!approved) return { active: false };
  const today = todayIST();
  const cat = CATEGORIES[approved.category] || CATEGORIES.student;
  const expired = !!(approved.expiry_date && approved.expiry_date < today);
  const out = {
    active: !expired,
    category: approved.category,
    label: cat.benefit,
    valid_until: approved.expiry_date || null,
    valid_until_text: approved.expiry_date ? formatDay(approved.expiry_date) : '',
    expired_on: expired ? approved.expiry_date : null,
    verification_id: approved.id,
    approved_on: ymdOf(approved.reviewed_at)
  };
  if (approved.category === 'ex_servicemen' && out.active) {
    const user = typeof userOrId === 'object' ? userOrId : await User.findByPk(userId, { attributes: ['id', 'email'] });
    const last = await lastConsultationDate(userId, user && user.email);
    const base = [last, out.approved_on].filter(Boolean).sort().pop();
    out.last_consultation = last;
    out.next_reminder = base ? addMonths(base, ESM_REMINDER_MONTHS) : null;
    out.reminder_due = !!(out.next_reminder && out.next_reminder <= today);
  }
  return out;
}

/** An upcoming consultation that is not finished yet (booked while logged in, or with the account's email) */
async function activeBookingFor({ userId, email }) {
  if (!userId && !email) return null;
  const today = todayIST();
  const who = [];
  if (userId) who.push({ user_id: userId });
  if (email) who.push({ client_email: String(email).toLowerCase() });
  const appt = await Appointment.findOne({
    where: {
      [Op.and]: [
        { [Op.or]: who },
        {
          [Op.or]: [
            { status: { [Op.in]: ['confirmed', 'rescheduled'] }, appointment_date: { [Op.gte]: today } },
            { status: 'hold', hold_expires_at: { [Op.gt]: new Date() } }
          ]
        }
      ]
    },
    order: [['appointment_date', 'ASC'], ['start_time', 'ASC']]
  });
  if (!appt) return null;
  return {
    reference_no: appt.reference_no,
    date: appt.appointment_date,
    date_text: formatDay(appt.appointment_date),
    start_time: appt.start_time,
    booking_type: appt.booking_type,
    status: appt.status
  };
}

/** Throws when the customer already has a consultation that has not taken place yet */
async function assertNoActiveBooking({ userId, email }) {
  const active = await activeBookingFor({ userId, email });
  if (!active) return;
  const e = fail(`You already have a consultation booked on ${active.date_text} at ${active.start_time} (${active.reference_no}). ` +
    'You can book your next consultation after this one has taken place. To change the date, use "Reschedule / cancel" in My account.', 409);
  e.publicCode = 'ACTIVE_BOOKING';
  throw e;
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------
function fileInfo(asset) {
  return asset ? { name: asset.original_name, type: asset.mime_type, size: asset.file_size } : null;
}

function customerShape(v) {
  if (!v) return null;
  return {
    id: v.id,
    category: v.category,
    category_label: (CATEGORIES[v.category] || {}).label || v.category,
    institution_name: v.institution_name,
    service_branch: v.service_branch,
    id_number: v.id_number,
    expiry_date: v.expiry_date,
    expiry_text: v.expiry_date ? formatDay(v.expiry_date) : '',
    status: v.status,
    admin_message: v.status === 'rejected' ? (v.admin_message || '') : '',
    submitted_at: v.created_at || v.createdAt,
    reviewed_at: v.reviewed_at,
    files: [fileInfo(v.front), fileInfo(v.back)].filter(Boolean)
  };
}

async function statusFor(user) {
  const latest = await IdVerification.findOne({
    where: { user_id: user.id },
    include: [{ model: MediaAsset, as: 'front', attributes: ['original_name', 'mime_type', 'file_size'] }, { model: MediaAsset, as: 'back', attributes: ['original_name', 'mime_type', 'file_size'] }],
    order: [['id', 'DESC']]
  });
  const benefit = await benefitFor(user);
  const active = await activeBookingFor({ userId: user.id, email: user.email });
  return {
    latest: customerShape(latest),
    benefit,
    active_booking: active,
    // a new upload is possible unless the current one is still waiting
    can_upload: !latest || latest.status !== 'pending',
    categories: Object.entries(CATEGORIES).map(([key, c]) => ({ key, label: c.label })),
    service_branches: SERVICE_BRANCHES
  };
}

function checkFile(file, label) {
  if (!file) return `${label} is required.`;
  if (!FILE_TYPES.includes(file.mimetype)) return `${label}: please upload a JPG, PNG or PDF file.`;
  if (file.size > MAX_FILE_BYTES) return `${label} is larger than 8 MB. Please upload a JPG, PNG or PDF of 8 MB or less.`;
  return null;
}

async function submit(user, data = {}, files = {}, rejectedFiles = {}) {
  const category = str(data.category);
  if (!CATEGORIES[category]) throw fail('Please choose Student or Ex-serviceman / Defence.', 400, { category: 'Please choose Student or Ex-serviceman / Defence.' });
  const errors = {};
  const out = { category, id_number: str(data.id_number).slice(0, 60) || null };
  const today = todayIST();
  if (category === 'student') {
    out.institution_name = str(data.institution_name).slice(0, 150);
    out.expiry_date = str(data.expiry_date);
    if (out.institution_name.length < 3) errors.institution_name = 'Please enter the name of your college or institution.';
    if (!isValidYmd(out.expiry_date)) errors.expiry_date = 'Please enter the date your student ID is valid until.';
    else if (out.expiry_date < today) errors.expiry_date = 'This ID has already expired. Please upload your current student ID.';
    out.service_branch = null;
  } else {
    out.service_branch = str(data.service_branch).slice(0, 60);
    if (!out.service_branch || !SERVICE_BRANCHES.includes(out.service_branch)) errors.service_branch = 'Please choose your service.';
    out.institution_name = null;
    out.expiry_date = null;
  }
  const front = files.front || files.document || null;
  const back = files.back || null;
  if (rejectedFiles.front) errors.front = rejectedFiles.front;
  else {
    const frontProblem = checkFile(front, 'ID proof front');
    if (frontProblem) errors.front = frontProblem;
  }
  if (rejectedFiles.back) errors.back = rejectedFiles.back;
  else if (back) {
    const p = checkFile(back, 'ID proof back');
    if (p) errors.back = p;
  }
  if (Object.keys(errors).length) throw fail(Object.values(errors)[0], 400, errors);

  const pending = await IdVerification.findOne({ where: { user_id: user.id, status: 'pending' }, order: [['id', 'DESC']] });
  const store = (f) => uploadService.storeFile({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype, size: f.size, isPrivate: true, userId: user.id });
  const storedAssets = [];
  let frontAsset;
  let backAsset = null;
  let row;
  try {
    frontAsset = await store(front);
    storedAssets.push(frontAsset.id);
    if (back) {
      backAsset = await store(back);
      storedAssets.push(backAsset.id);
    }
    if (pending) {
      // still waiting: replace the files and details instead of adding another request
      const old = [pending.front_asset_id, pending.back_asset_id].filter(Boolean);
      await pending.update({ ...out, front_asset_id: frontAsset.id, back_asset_id: backAsset ? backAsset.id : null });
      for (const id of old) { try { await uploadService.deleteAsset(id); } catch (e) { /* ignore */ } }
      row = pending;
    } else {
      row = await IdVerification.create({ ...out, user_id: user.id, front_asset_id: frontAsset.id, back_asset_id: backAsset ? backAsset.id : null, status: 'pending' });
    }
  } catch (err) {
    for (const assetId of storedAssets) {
      try { await uploadService.deleteAsset(assetId); } catch (e) { /* ignore */ }
    }
    throw fail(/match|extension|prohibited/i.test(err.message) ? 'This file does not look like a real JPG, PNG or PDF. Please upload the ID again.' : err.message);
  }
  const attempts = await IdVerification.count({ where: { user_id: user.id } });
  try {
    await require('./notification.service').notify('id_verification', {
      title: `${CATEGORIES[category].label} ID to verify`,
      message: `${`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email}${category === 'student' ? ` · ${out.institution_name}` : ` · ${out.service_branch}`}${attempts > 1 ? ` · upload ${attempts}` : ''}`,
      link: `/verifications?id=${row.id}`,
      entityType: 'IdVerification',
      entityId: row.id
    });
  } catch (e) { /* notify never blocks */ }
  return statusFor(user);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
const CUSTOMER = { model: User, as: 'customer', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] };
const FILES = [
  { model: MediaAsset, as: 'front', attributes: ['id', 'original_name', 'mime_type', 'file_size'] },
  { model: MediaAsset, as: 'back', attributes: ['id', 'original_name', 'mime_type', 'file_size'] }
];

function adminShape(v, extra = {}) {
  const j = v.toJSON ? v.toJSON() : v;
  const today = todayIST();
  const c = j.customer || {};
  let state = j.status;
  if (j.status === 'approved' && j.expiry_date && j.expiry_date < today) state = 'expired';
  return {
    id: j.id,
    category: j.category,
    category_label: (CATEGORIES[j.category] || {}).label || j.category,
    institution_name: j.institution_name,
    service_branch: j.service_branch,
    id_number: j.id_number,
    expiry_date: j.expiry_date,
    status: j.status,
    state,
    admin_message: j.admin_message,
    internal_note: j.internal_note,
    submitted_at: j.createdAt || j.created_at,
    reviewed_at: j.reviewed_at,
    reviewer: j.reviewer ? `${j.reviewer.first_name || ''} ${j.reviewer.last_name || ''}`.trim() : null,
    reminded_at: j.reminded_at,
    customer: { id: c.id, name: `${c.first_name || ''} ${c.last_name || ''}`.trim(), email: c.email, phone: c.phone },
    files: [j.front && { which: 'front', id: j.front.id, name: j.front.original_name, type: j.front.mime_type, size: j.front.file_size, url: `/api/media/private/${j.front.id}` },
      j.back && { which: 'back', id: j.back.id, name: j.back.original_name, type: j.back.mime_type, size: j.back.file_size, url: `/api/media/private/${j.back.id}` }].filter(Boolean),
    ...extra
  };
}

async function adminList({ state = 'pending', q } = {}) {
  const today = todayIST();
  const where = {};
  if (state === 'pending') where.status = 'pending';
  else if (state === 'approved') Object.assign(where, { status: 'approved', [Op.or]: [{ expiry_date: null }, { expiry_date: { [Op.gte]: today } }] });
  else if (state === 'expired') Object.assign(where, { status: 'approved', expiry_date: { [Op.lt]: today } });
  else if (state === 'rejected') where.status = 'rejected';
  else if (state === 'reminders') Object.assign(where, { status: 'approved', category: 'ex_servicemen' });
  const include = [{ ...CUSTOMER }, { model: User, as: 'reviewer', attributes: ['first_name', 'last_name'] }, ...FILES];
  if (q) {
    const like = `%${String(q).trim()}%`;
    include[0] = { ...CUSTOMER, where: { [Op.or]: [{ first_name: { [Op.like]: like } }, { last_name: { [Op.like]: like } }, { email: { [Op.like]: like } }, { phone: { [Op.like]: like } }] } };
  }
  let rows = await IdVerification.findAll({ where, include, order: state === 'pending' ? [['id', 'ASC']] : [['id', 'DESC']], limit: 500 });
  // only the latest decision per person counts for the approved / expired / reminder lists
  if (['approved', 'expired', 'reminders'].includes(state)) {
    const latestApproved = {};
    rows.forEach(r => { if (!latestApproved[r.user_id] || r.id > latestApproved[r.user_id].id) latestApproved[r.user_id] = r; });
    rows = rows.filter(r => latestApproved[r.user_id] === r);
  }
  let shaped = rows.map(r => adminShape(r));
  if (state === 'reminders') {
    const withDue = [];
    for (const r of shaped) {
      const b = await benefitFor(r.customer.id);
      if (b.active && b.reminder_due && b.verification_id === r.id) withDue.push({ ...r, last_consultation: b.last_consultation, next_reminder: b.next_reminder });
    }
    shaped = withDue;
  }
  const attempts = {};
  const counts = await IdVerification.findAll({ attributes: ['user_id'], where: { user_id: { [Op.in]: shaped.map(r => r.customer.id).filter(Boolean) } } });
  counts.forEach(c => { attempts[c.user_id] = (attempts[c.user_id] || 0) + 1; });
  shaped.forEach(r => { r.attempts = attempts[r.customer.id] || 1; });
  return { items: shaped, counts: await counts_(), service_branches: SERVICE_BRANCHES };
}

async function counts_() {
  const today = todayIST();
  const [pending, approved, expired, rejected] = await Promise.all([
    IdVerification.count({ where: { status: 'pending' } }),
    IdVerification.count({ where: { status: 'approved', [Op.or]: [{ expiry_date: null }, { expiry_date: { [Op.gte]: today } }] } }),
    IdVerification.count({ where: { status: 'approved', expiry_date: { [Op.lt]: today } } }),
    IdVerification.count({ where: { status: 'rejected' } })
  ]);
  return { pending, approved, expired, rejected };
}

async function adminGet(id) {
  const v = await IdVerification.findByPk(id, { include: [CUSTOMER, { model: User, as: 'reviewer', attributes: ['first_name', 'last_name'] }, ...FILES] });
  if (!v) throw fail('Not found.', 404);
  const history = await IdVerification.findAll({
    where: { user_id: v.user_id, id: { [Op.ne]: v.id } },
    include: [{ model: User, as: 'reviewer', attributes: ['first_name', 'last_name'] }, ...FILES],
    order: [['id', 'DESC']]
  });
  const benefit = await benefitFor(v.user_id);
  return adminShape(v, { history: history.map(h => adminShape(h)), benefit });
}

async function approve(id, { expiry_date, internal_note } = {}, staffId) {
  const v = await IdVerification.findByPk(id);
  if (!v) throw fail('Not found.', 404);
  const upd = { status: 'approved', admin_message: null, reviewed_by_user_id: staffId || null, reviewed_at: new Date() };
  if (expiry_date !== undefined) {
    const e = str(expiry_date);
    if (e && !isValidYmd(e)) throw fail('Please give a valid date (YYYY-MM-DD).', 400, { expiry_date: 'Invalid date.' });
    upd.expiry_date = e || null;
  }
  const finalExpiry = upd.expiry_date !== undefined ? upd.expiry_date : v.expiry_date;
  if (v.category === 'student' && !finalExpiry) throw fail('A student ID needs the date it is valid until.', 400, { expiry_date: 'Required for students.' });
  if (finalExpiry && finalExpiry < todayIST()) throw fail('This ID has already expired; it cannot be approved. Reject it and ask for the current ID.', 400, { expiry_date: 'Already expired.' });
  if (internal_note !== undefined) upd.internal_note = str(internal_note) || null;
  await v.update(upd);
  return adminGet(id);
}

async function reject(id, { message, internal_note } = {}, staffId) {
  const v = await IdVerification.findByPk(id);
  if (!v) throw fail('Not found.', 404);
  const msg = str(message);
  if (msg.length < 10) throw fail('Please write the reason and what the customer should do (at least 10 characters).', 400, { message: 'Required.' });
  await v.update({ status: 'rejected', admin_message: msg.slice(0, 1000), reviewed_by_user_id: staffId || null, reviewed_at: new Date(), ...(internal_note !== undefined ? { internal_note: str(internal_note) || null } : {}) });
  return adminGet(id);
}

/** The team has contacted an ex-serviceman about the yearly consultation */
async function markReminded(id) {
  const v = await IdVerification.findByPk(id);
  if (!v) throw fail('Not found.', 404);
  await v.update({ reminded_at: new Date(), reminder_notified_at: new Date() });
  return adminGet(id);
}

/** Daily job: one admin notification per ex-serviceman whose yearly consultation reminder is due */
async function raiseYearlyReminders() {
  const rows = await IdVerification.findAll({ where: { status: 'approved', category: 'ex_servicemen' }, include: [CUSTOMER], order: [['id', 'DESC']] });
  const seen = new Set();
  let raised = 0;
  for (const v of rows) {
    if (seen.has(v.user_id)) continue;
    seen.add(v.user_id);
    const b = await benefitFor(v.customer || v.user_id);
    if (!b.active || !b.reminder_due || b.verification_id !== v.id) continue;
    // once a year: not again within ESM_REMINDER_MONTHS of the last reminder
    const last = ymdOf(v.reminder_notified_at);
    if (last && addMonths(last, ESM_REMINDER_MONTHS) > todayIST()) continue;
    try {
      await require('./notification.service').notify('esm_reminder', {
        title: 'Yearly consultation reminder due',
        message: `${v.customer ? `${v.customer.first_name || ''} ${v.customer.last_name || ''}`.trim() : 'An ex-serviceman'}: ${b.last_consultation ? `last consultation ${formatDay(b.last_consultation)}` : 'no consultation yet'}. Please remind them to book.`,
        link: `/verifications?state=reminders&id=${v.id}`,
        entityType: 'IdVerification',
        entityId: v.id
      });
      await v.update({ reminder_notified_at: new Date() });
      raised++;
    } catch (e) { /* keep going */ }
  }
  return raised;
}

/** Private files that belong to an ID verification (media download permission check) */
async function ownsAsset(assetId) {
  const id = parseInt(assetId, 10);
  const v = await IdVerification.findOne({ where: { [Op.or]: [{ front_asset_id: id }, { back_asset_id: id }] }, attributes: ['id'] });
  return !!v;
}

module.exports = {
  CATEGORIES,
  SERVICE_BRANCHES,
  benefitFor,
  activeBookingFor,
  assertNoActiveBooking,
  statusFor,
  submit,
  adminList,
  adminGet,
  approve,
  reject,
  markReminded,
  raiseYearlyReminders,
  ownsAsset
};
