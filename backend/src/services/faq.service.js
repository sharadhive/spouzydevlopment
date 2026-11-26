/**
 * FAQs: where each question shows, the Excel / CSV upload (preview, then import), the Excel download
 * and the sample file.
 *
 * Placement:
 *   show_on_faq_page  -> faq.htm (the big list with search and filters)
 *   show_on_home      -> homepage "Common Questions Before Booking" (ordered by home_order)
 *   pages             -> any of the "What We Do" pages (config/service-pages.js)
 *
 * Answers are written as plain text (in the admin and in Excel) and turned into safe HTML:
 *   blank line = new paragraph, "- " or "• " at the start of a line = bullet point, "1. " = numbered,
 *   **bold**, [link text](page.htm or https://...), and web addresses become links.
 */
const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const { Faq, sequelize } = require('../models');
const { SERVICE_PAGES, PAGE_KEYS, findPage } = require('../config/service-pages');
const xlsx = require('../utils/xlsx');
const { createValidator, str, isTrue } = require('../config/validation');

const MAX_ROWS = 5000;

// ---------------------------------------------------------------------------
// Text <-> HTML
// ---------------------------------------------------------------------------
const SAFE_HTML = {
  allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'h4'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, attribs) => {
      const href = attribs.href || '';
      const external = /^https?:\/\//i.test(href);
      return { tagName: 'a', attribs: external ? { href, target: '_blank', rel: 'noopener' } : { href } };
    }
  }
};

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeHref(u) {
  const v = String(u || '').trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  if (/^[a-z0-9][a-z0-9_\-/]*\.html?(#[\w-]*)?(\?[\w=&%-]*)?$/i.test(v)) return v; // a page of this website
  if (/^#[\w-]+$/.test(v)) return v;
  if (/^www\./i.test(v)) return 'https://' + v;
  return null;
}

function inline(text) {
  // links written as [text](address) first, then bare web addresses, then **bold**
  const parts = [];
  let rest = String(text);
  const re = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/;
  let m;
  while ((m = re.exec(rest))) {
    parts.push({ t: rest.slice(0, m.index) });
    const href = safeHref(m[2]);
    parts.push(href ? { a: href, label: m[1] } : { t: m[0] });
    rest = rest.slice(m.index + m[0].length);
  }
  parts.push({ t: rest });
  return parts.map(p => {
    if (p.a) return `<a href="${esc(p.a)}">${esc(p.label)}</a>`;
    let s = esc(p.t);
    s = s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)'"])/gi, (all, pre, url) => {
      const href = safeHref(url.replace(/&amp;/g, '&'));
      return href ? `${pre}<a href="${esc(href)}">${url}</a>` : all;
    });
    s = s.replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]+\w)/g, (all, pre, mail) => `${pre}<a href="mailto:${mail}">${mail}</a>`);
    s = s.replace(/\*\*([^*\n]{1,300})\*\*/g, '<strong>$1</strong>');
    return s;
  }).join('');
}

/** Plain text (admin box / Excel cell) -> safe HTML. HTML that is pasted in is cleaned and kept. */
function textToHtml(text) {
  const t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();
  if (!t) return '';
  if (/<\/?(p|br|ul|ol|li|a|strong|b|em|i)\b[^>]*>/i.test(t)) return sanitizeHtml(t, SAFE_HTML).trim();
  const blocks = t.split(/\n\s*\n+/);
  const out = [];
  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.type}>` + list.items.map(i => `<li>${inline(i)}</li>`).join('') + `</${list.type}>`); list = null; } };
    lines.forEach(line => {
      const bullet = line.match(/^(?:[-•*·▪●]|✓|✔)\s+(.+)$/);
      const numbered = line.match(/^\d{1,2}[.)]\s+(.+)$/);
      if (bullet || numbered) {
        const type = bullet ? 'ul' : 'ol';
        flushPara();
        if (list && list.type !== type) flushList();
        if (!list) list = { type, items: [] };
        list.items.push((bullet || numbered)[1]);
      } else {
        flushList();
        para.push(line);
      }
    });
    flushList();
    flushPara();
  });
  return sanitizeHtml(out.join(''), SAFE_HTML);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10))).replace(/&amp;/g, '&');
}

/** Safe HTML -> the same plain-text format (used for the Excel download and the admin editor) */
function htmlToText(html) {
  let s = String(html || '');
  s = s.replace(/\r?\n/g, ' ');
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, label) => {
    const text = decodeEntities(label.replace(/<[^>]+>/g, '')).trim();
    const h = decodeEntities(href);
    if (!text || text === h || text === h.replace(/^mailto:/, '') || 'https://' + text === h) return text || h;
    return `[${text}](${h})`;
  });
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (m, inner) => {
    let n = 0;
    return '\n\n' + inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (x, li) => `${++n}. ${li.trim()}\n`) + '\n';
  });
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (m, li) => `- ${li.trim()}\n`);
  s = s.replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n\n');
  s = s.replace(/<\/p>\s*/gi, '\n\n').replace(/<p\b[^>]*>/gi, '');
  s = s.replace(/<\/?h\d\b[^>]*>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normQ(t) {
  return String(t || '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function pagesOf(f) {
  let p = f.pages;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = []; } }
  return Array.isArray(p) ? p.filter(k => PAGE_KEYS.has(k)) : [];
}

function cleanPages(list) {
  const arr = Array.isArray(list) ? list : String(list || '').split(/[,;|\n]/);
  const keys = new Set();
  arr.forEach(v => {
    const p = PAGE_KEYS.has(v) ? { key: v } : findPage(v);
    if (p) keys.add(p.key);
  });
  return SERVICE_PAGES.map(p => p.key).filter(k => keys.has(k));
}

function shapeAdmin(f) {
  const j = typeof f.toJSON === 'function' ? f.toJSON() : f;
  return { ...j, pages: pagesOf(j), answer_text: htmlToText(j.answer_html) };
}

function invalidateChat() {
  try { require('./chat.service').invalidate(); } catch (e) { /* chat optional */ }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
/** How many questions (with answers) a "What We Do" page box shows */
const PAGE_BOX_LIMIT = 8;

/**
 * Public lists.
 *   'home'      homepage questions, with answers
 *   <page key>  a "What We Do" page box: the first 8 with answers (`total` = how many that page has)
 *   default     the FAQ page: every question WITHOUT its answer; answers are opened one at a time
 *               (publicAnswer), so the whole set cannot be copied in one go
 */
async function listPublic(forWhat) {
  const rows = await Faq.findAll({ where: { is_published: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  const shape = (f, withAnswer) => ({ id: f.id, category: f.category || 'General', question: f.question, ...(withAnswer ? { answer_html: f.answer_html } : {}), pages: pagesOf(f) });
  if (forWhat === 'home') {
    const list = rows.filter(f => f.show_on_home).sort((a, b) => (a.home_order - b.home_order) || (a.id - b.id));
    return { items: list.map(f => shape(f, true)), total: list.length };
  }
  if (forWhat && PAGE_KEYS.has(forWhat)) {
    const list = rows.filter(f => pagesOf(f).includes(forWhat));
    return { items: list.slice(0, PAGE_BOX_LIMIT).map(f => shape(f, true)), total: list.length };
  }
  const list = rows.filter(f => f.show_on_faq_page);
  return { items: list.map(f => shape(f, false)), total: list.length };
}

/** One published answer (FAQ page popup, links from the chat and the service pages) */
async function publicAnswer(id) {
  const f = await Faq.findOne({ where: { id: parseInt(id, 10) || 0, is_published: true } });
  if (!f || !(f.show_on_faq_page || f.show_on_home || pagesOf(f).length)) return null;
  return { id: f.id, category: f.category || 'General', question: f.question, answer_html: f.answer_html, pages: pagesOf(f) };
}

// ---------------------------------------------------------------------------
// Admin: list, save, bulk actions, order
// ---------------------------------------------------------------------------
async function listAdmin() {
  const rows = await Faq.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  return rows.map(shapeAdmin);
}

async function meta() {
  const rows = await Faq.findAll({ attributes: ['category', 'is_published', 'show_on_faq_page', 'show_on_home', 'pages'] });
  const categories = {};
  const pageCounts = {};
  let faqPage = 0;
  let home = 0;
  rows.forEach(r => {
    const c = r.category || 'General';
    categories[c] = (categories[c] || 0) + 1;
    if (r.show_on_faq_page) faqPage += 1;
    if (r.show_on_home) home += 1;
    pagesOf(r).forEach(k => { pageCounts[k] = (pageCounts[k] || 0) + 1; });
  });
  return {
    pages: SERVICE_PAGES.map(p => ({ ...p, count: pageCounts[p.key] || 0 })),
    categories: Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    total: rows.length,
    faq_page: faqPage,
    home
  };
}

async function save(data = {}, id = null) {
  const out = {};
  if (data.category !== undefined) out.category = str(data.category).slice(0, 100) || 'General';
  if (data.question !== undefined) out.question = str(data.question);
  if (data.answer_text !== undefined) out.answer_html = textToHtml(data.answer_text);
  else if (data.answer_html !== undefined) out.answer_html = textToHtml(data.answer_html);
  if (data.sort_order !== undefined) out.sort_order = parseInt(data.sort_order, 10) || 0;
  if (data.home_order !== undefined) out.home_order = parseInt(data.home_order, 10) || 0;
  ['is_published', 'show_on_faq_page', 'show_on_home'].forEach(k => { if (data[k] !== undefined) out[k] = isTrue(data[k]); });
  if (data.pages !== undefined) out.pages = cleanPages(data.pages);

  const v = createValidator({ question: id ? 'x' : '', answer_html: id ? 'x' : '', ...out });
  v.required('question', 'Question', { max: 2000 });
  v.required('answer_html', 'Answer');
  v.throwIfErrors();

  let faq;
  if (id) {
    faq = await Faq.findByPk(id);
    if (!faq) { const e = new Error('FAQ not found'); e.status = 404; throw e; }
    if (out.show_on_home && !faq.show_on_home && out.home_order === undefined) out.home_order = await nextHomeOrder();
    await faq.update(out);
  } else {
    if (out.sort_order === undefined) out.sort_order = ((await Faq.max('sort_order')) || 0) + 1;
    if (out.show_on_home && out.home_order === undefined) out.home_order = await nextHomeOrder();
    faq = await Faq.create({ category: 'General', is_published: true, show_on_faq_page: true, show_on_home: false, pages: [], ...out });
  }
  invalidateChat();
  return shapeAdmin(faq);
}

async function nextHomeOrder() {
  return ((await Faq.max('home_order', { where: { show_on_home: true } })) || 0) + 1;
}

async function remove(id) {
  const faq = await Faq.findByPk(id);
  if (!faq) { const e = new Error('FAQ not found'); e.status = 404; throw e; }
  await faq.destroy();
  invalidateChat();
  return { id: Number(id) };
}

/** action: publish | hide | delete | add_page | remove_page | set_category | faq_page_on | faq_page_off */
async function bulk({ ids, action, page, category } = {}) {
  const list = (Array.isArray(ids) ? ids : []).map(n => parseInt(n, 10)).filter(Boolean);
  if (!list.length) { const e = new Error('Select at least one question.'); e.status = 400; throw e; }
  const rows = await Faq.findAll({ where: { id: { [Op.in]: list } } });
  let changed = 0;
  await sequelize.transaction(async (t) => {
    for (const f of rows) {
      if (action === 'delete') { await f.destroy({ transaction: t }); changed++; continue; }
      const upd = {};
      if (action === 'publish') upd.is_published = true;
      else if (action === 'hide') upd.is_published = false;
      else if (action === 'faq_page_on') upd.show_on_faq_page = true;
      else if (action === 'faq_page_off') upd.show_on_faq_page = false;
      else if (action === 'set_category') upd.category = str(category).slice(0, 100) || 'General';
      else if (action === 'add_page' || action === 'remove_page') {
        if (!PAGE_KEYS.has(page)) { const e = new Error('Choose a page.'); e.status = 400; throw e; }
        const cur = pagesOf(f);
        upd.pages = action === 'add_page' ? cleanPages([...cur, page]) : cur.filter(k => k !== page);
      } else { const e = new Error('Unknown action.'); e.status = 400; throw e; }
      await f.update(upd, { transaction: t });
      changed++;
    }
  });
  invalidateChat();
  return { changed };
}

/** ids in the new order. list: 'home' (homepage questions) or 'faq' (FAQ page order) */
async function reorder({ ids, list } = {}) {
  const order = (Array.isArray(ids) ? ids : []).map(n => parseInt(n, 10)).filter(Boolean);
  const field = list === 'home' ? 'home_order' : 'sort_order';
  await sequelize.transaction(async (t) => {
    for (let i = 0; i < order.length; i++) {
      await Faq.update({ [field]: i + 1 }, { where: { id: order[i] }, transaction: t });
    }
  });
  invalidateChat();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Excel columns (the same for the sample file, the download and the upload)
// ---------------------------------------------------------------------------
const YES_NO = ['Yes', 'No'];
function columns() {
  return [
    { key: 'id', header: 'ID (empty = new)', width: 11 },
    { key: 'category', header: 'Category', width: 22 },
    { key: 'question', header: 'Question *', width: 46, required: true },
    { key: 'answer', header: 'Answer *', width: 70, required: true },
    { key: 'order', header: 'Order', width: 8 },
    { key: 'published', header: 'Show on website', width: 12, list: YES_NO, hint: 'Yes = visible. No = saved but hidden. Empty = Yes.' },
    { key: 'faq_page', header: 'FAQ page', width: 10, list: YES_NO, hint: 'Show on the FAQ page. Empty = Yes.' },
    ...SERVICE_PAGES.map(p => ({ key: 'page:' + p.key, header: p.label, width: Math.max(11, Math.min(18, p.label.length + 2)), list: YES_NO, hint: `Also show on the ${p.label} page. Empty = No.` }))
  ];
}

function rowFor(f) {
  const pages = pagesOf(f);
  return [
    f.id, f.category || 'General', f.question, htmlToText(f.answer_html), f.sort_order || '',
    f.is_published ? 'Yes' : 'No', f.show_on_faq_page ? 'Yes' : 'No',
    ...SERVICE_PAGES.map(p => (pages.includes(p.key) ? 'Yes' : 'No'))
  ];
}

function instructions(kind) {
  const pageList = SERVICE_PAGES.map(p => p.label).join(', ');
  return [
    ['SPOUZY FAQs: how to fill this file', 'title'],
    [kind === 'export'
      ? 'This is a copy of your FAQs. Edit it in Excel and upload it again in Admin → Website Content → FAQs → Upload Excel. Rows with an ID update that question.'
      : 'Fill one question per row on the "FAQs" sheet, then upload it in Admin → Website Content → FAQs → Upload Excel. You will see a preview before anything is saved.', 'body'],
    ['', 'body'],
    ['Columns', 'strong'],
    ['ID — leave empty for new questions. Downloaded files have the ID filled in so the same question is updated, not added twice.', 'body'],
    ['Category — a short group name, for example "Pre-Marriage", "Privacy & Confidentiality", "Fees & Packages". The FAQ page shows a filter button for every category.', 'body'],
    ['Question * and Answer * — required. Rows without both are skipped and listed in the preview.', 'body'],
    ['Order — optional number. Smaller numbers show first. Empty keeps the order of the file.', 'body'],
    ['Show on website — Yes or No. No keeps the question saved but hidden. Empty means Yes.', 'body'],
    ['FAQ page — Yes or No: show it on the main FAQ page. Empty means Yes.', 'body'],
    [`Page columns (${pageList}) — choose Yes to also show the question on that page. You can choose several pages for one question. Empty means No.`, 'body'],
    ['', 'body'],
    ['Writing answers', 'strong'],
    ['• Press Alt + Enter inside a cell for a new line. Leave an empty line between two paragraphs.', 'body'],
    ['• Start a line with "- " for a bullet point, or "1. " for a numbered list.', 'body'],
    ['• **two stars** around words make them bold.', 'body'],
    ['• Links: [Confidentiality Pledge](confidentiality.htm) or a full web address like https://spouzy.com', 'body'],
    ['', 'body'],
    ['Uploading', 'strong'],
    ['• "Add new and update matching" (normal): new questions are added; a question with the same ID, or exactly the same question text, is updated. Nothing else is removed.', 'body'],
    ['• "Replace FAQ page list": questions on the FAQ page that are not in the file are deleted. Homepage questions are never deleted by an upload.', 'body'],
    ['• Up to 5,000 rows in one file. Save as "Excel Workbook (.xlsx)". CSV also works.', 'body'],
    kind === 'export' ? ['', 'body'] : ['• The 3 rows starting with "EXAMPLE" show how to fill the file. Delete them and add your own questions (if you forget, the upload skips them).', 'hint']
  ];
}

async function exportXlsx() {
  const rows = await Faq.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  const list = rows.filter(f => f.show_on_faq_page || pagesOf(f).length || !f.show_on_home);
  return xlsx.writeWorkbook([
    { name: 'FAQs', active: true, columns: columns(), rows: list.map(rowFor) },
    { name: 'How to fill', text: instructions('export') }
  ], { title: 'SPOUZY FAQs' });
}

function templateXlsx() {
  const cols = columns();
  const yes = (keys) => SERVICE_PAGES.map(p => (keys.includes(p.key) ? 'Yes' : 'No'));
  // Example rows: the upload skips any row whose category or question starts with "EXAMPLE",
  // so the file can be uploaded even if they are left in by mistake.
  const samples = [
    ['', 'EXAMPLE (delete this row)', 'EXAMPLE: What happens in the first pre-marriage counselling session?',
      'Your counsellor meets you both, listens to what you want from the sessions and explains how they work.\n\nIn the first session you will:\n- talk about your expectations from marriage\n- agree on goals for the next sessions\n- ask any questions you have\n\nEverything you share stays private under our [Confidentiality Pledge](confidentiality.htm).',
      1, 'Yes', 'Yes', ...yes(['pre-marriage', 'relationships'])],
    ['', 'EXAMPLE (delete this row)', 'EXAMPLE: Is my visit to the intimate health clinic kept private?',
      'Yes. **Your records are never shared** without your written permission. You can also book a [video consultation](book-appoinment.htm) from home.',
      2, 'Yes', 'Yes', ...yes(['intimate-health', 'intimate-aesthetics'])],
    ['', 'EXAMPLE (delete this row)', 'EXAMPLE: A question saved but not shown yet',
      'Choose "No" in "Show on website" to keep a question ready without showing it.',
      3, 'No', 'Yes', ...yes([])]
  ];
  return xlsx.writeWorkbook([
    { name: 'FAQs', active: true, columns: cols, rows: samples },
    { name: 'How to fill', text: instructions('template') }
  ], { title: 'SPOUZY FAQ upload sample' });
}

// ---------------------------------------------------------------------------
// Upload: read -> check -> preview -> import
// ---------------------------------------------------------------------------
function headerKey(cell) {
  const h = String(cell || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[*:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!h) return null;
  if (/^(id|faq id|#|faq no|faq number)$/.test(h)) return 'id';
  if (/^(category|categories|section|topic|group|type)$/.test(h)) return 'category';
  if (/^(question|questions|faq question|q)\b/.test(h)) return 'question';
  if (/^(answer|answers|faq answer|a|reply)\b/.test(h)) return 'answer';
  if (/^(order|sort order|sort|position|sequence|priority|sr no|sr\. no|s no|serial no|serial)$/.test(h)) return 'order';
  if (/^(show on website|published|publish|visible|status|active|live|show)$/.test(h)) return 'published';
  if (/^(faq page|show on faq page|on faq page|faq)$/.test(h)) return 'faq_page';
  if (/^(pages|show on pages|service pages|service page|page|what we do pages|show on)$/.test(h)) return 'pages';
  const page = findPage(h.replace(/^(show on|also show on|on)\s+/, '').replace(/\s+page$/, ''));
  if (page) return 'page:' + page.key;
  return null;
}

function yesNo(v, fallback) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s) return { value: fallback };
  if (/^(yes|y|true|1|✓|✔|x|show|shown|published|publish|live|visible|on|haan|ha)$/.test(s)) return { value: true };
  if (/^(no|n|false|0|hide|hidden|draft|off|unpublished|nahi)$/.test(s)) return { value: false };
  return { error: true };
}

function parseUpload(buffer, filename) {
  const table = xlsx.readTable(buffer, filename);
  const rows = table.rows;
  let headerRow = -1;
  let map = null;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const m = {};
    (rows[r] || []).forEach((cell, c) => {
      const k = headerKey(cell);
      if (k && m[k] === undefined) m[k] = c;
    });
    if (m.question !== undefined && m.answer !== undefined) { headerRow = r; map = m; break; }
  }
  if (!map) {
    const e = new Error('We could not find the "Question" and "Answer" columns. Please use the headings from the sample file (first row of the sheet).');
    e.status = 400;
    throw e;
  }
  const pageCols = Object.keys(map).filter(k => k.startsWith('page:'));
  const hasPageInfo = pageCols.length > 0 || map.pages !== undefined;
  const out = [];
  const errors = [];
  const warnings = [];
  let empty = 0;
  let examples = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const get = (k) => (map[k] === undefined ? '' : String(row[map[k]] == null ? '' : row[map[k]]).trim());
    const line = r + 1;
    const question = get('question').replace(/\s+/g, ' ');
    const answer = get('answer');
    if (!question && !answer && !get('category')) { empty++; continue; }
    if (/^example\b/i.test(get('category')) || /^example\s*[:\-–]/i.test(question)) { examples++; continue; }
    if (out.length + errors.length >= MAX_ROWS) {
      errors.push({ row: line, message: `Only ${MAX_ROWS} rows can be uploaded at once. Split the file and upload the rest separately.` });
      break;
    }
    const problems = [];
    if (!question) problems.push('Question is empty');
    if (!answer) problems.push('Answer is empty');
    if (question.length > 2000) problems.push('Question is longer than 2,000 characters');
    if (answer.length > 20000) problems.push('Answer is longer than 20,000 characters');
    const pub = yesNo(get('published'), true);
    const fp = yesNo(get('faq_page'), true);
    if (pub.error) problems.push(`"Show on website" must be Yes or No (found "${get('published')}")`);
    if (fp.error) problems.push(`"FAQ page" must be Yes or No (found "${get('faq_page')}")`);
    let pages = [];
    pageCols.forEach(k => {
      const yn = yesNo(get(k), false);
      if (yn.error) problems.push(`"${SERVICE_PAGES.find(p => 'page:' + p.key === k).label}" must be Yes or No (found "${get(k)}")`);
      else if (yn.value) pages.push(k.slice(5));
    });
    if (map.pages !== undefined && get('pages')) {
      const raw = get('pages').split(/[,;|\n]/).map(s => s.trim()).filter(Boolean);
      const unknown = raw.filter(v => !findPage(v));
      if (unknown.length) warnings.push({ row: line, message: `Unknown page name ignored: ${unknown.join(', ')}` });
      pages = cleanPages([...pages, ...raw]);
    }
    const orderRaw = get('order');
    let order = null;
    if (orderRaw) {
      order = parseInt(orderRaw, 10);
      if (!Number.isFinite(order)) { problems.push(`Order must be a number (found "${orderRaw}")`); order = null; }
    }
    const idRaw = get('id');
    const id = idRaw ? parseInt(idRaw, 10) : null;
    if (idRaw && !Number.isFinite(id)) problems.push(`ID must be a number or empty (found "${idRaw}")`);
    if (problems.length) { errors.push({ row: line, question: question.slice(0, 120), message: problems.join('; ') }); continue; }
    out.push({
      line, id: id || null, question, answer, category: (get('category') || 'General').slice(0, 100),
      order, published: pub.value, faq_page: fp.value, pages: cleanPages(pages), hasPageInfo
    });
  }
  // the same question twice in one file
  const seen = new Map();
  const unique = [];
  out.forEach(r => {
    const k = normQ(r.question);
    if (seen.has(k)) {
      errors.push({ row: r.line, question: r.question.slice(0, 120), message: `Same question as row ${seen.get(k)} — only the first one is used` });
      return;
    }
    seen.set(k, r.line);
    unique.push(r);
  });
  errors.sort((a, b) => a.row - b.row);
  return {
    sheet: table.sheet,
    rows: unique,
    errors,
    warnings,
    empty,
    examples,
    columns: Object.keys(map).map(k => (k.startsWith('page:') ? SERVICE_PAGES.find(p => 'page:' + p.key === k).label : k)),
    hasPageInfo
  };
}

function samePages(a, b) {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

/**
 * mode: 'preview' (nothing saved) or 'apply'
 * strategy: 'merge' (add new, update matching) or 'replace' (FAQ page list becomes exactly the file)
 */
async function importFile(buffer, filename, { mode = 'preview', strategy = 'merge' } = {}) {
  const parsed = parseUpload(buffer, filename);
  const existing = await Faq.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  const byId = new Map(existing.map(f => [f.id, f]));
  const byQ = new Map();
  existing.forEach(f => { const k = normQ(f.question); if (!byQ.has(k)) byQ.set(k, f); });
  const replace = strategy === 'replace';
  const anyOrder = parsed.rows.some(r => r.order !== null);
  let nextOrder = replace ? 0 : ((await Faq.max('sort_order')) || 0);

  const creates = [];
  const updates = [];
  let unchanged = 0;
  const touched = new Set();
  const warnings = [...parsed.warnings];
  parsed.rows.forEach((r, idx) => {
    let target = r.id ? byId.get(r.id) : null;
    if (r.id && !target) warnings.push({ row: r.line, message: `ID ${r.id} was not found, so this question will be added as new` });
    if (!target) target = byQ.get(normQ(r.question)) || null;
    if (target && touched.has(target.id)) target = null; // two rows pointing at one question: keep the second as new
    const answerHtml = textToHtml(r.answer);
    if (target) {
      touched.add(target.id);
      const upd = {};
      if (target.question !== r.question) upd.question = r.question;
      if ((target.category || 'General') !== r.category) upd.category = r.category;
      if (normQ(target.answer_html) !== normQ(answerHtml) || target.answer_html !== answerHtml) {
        // compare on meaning so old hand-written HTML does not count as a change every time
        if (htmlToText(target.answer_html) !== htmlToText(answerHtml)) upd.answer_html = answerHtml;
      }
      if (!!target.is_published !== r.published) upd.is_published = r.published;
      if (!!target.show_on_faq_page !== r.faq_page) upd.show_on_faq_page = r.faq_page;
      if (r.hasPageInfo && !samePages(pagesOf(target), r.pages)) upd.pages = r.pages;
      if (r.order !== null && r.order !== target.sort_order) upd.sort_order = r.order;
      if (replace && !anyOrder && target.sort_order !== idx + 1) upd.sort_order = idx + 1;
      if (Object.keys(upd).length) updates.push({ target, upd, row: r });
      else unchanged++;
    } else {
      const sort = r.order !== null ? r.order : (replace && !anyOrder ? idx + 1 : ++nextOrder);
      creates.push({
        row: r,
        data: {
          category: r.category, question: r.question, answer_html: answerHtml, sort_order: sort,
          is_published: r.published, show_on_faq_page: r.faq_page, show_on_home: false, home_order: 0, pages: r.pages
        }
      });
    }
  });

  // Replace: what is on the FAQ page but not in the file
  const removals = [];
  const offPage = [];
  if (replace) {
    existing.forEach(f => {
      if (touched.has(f.id) || !f.show_on_faq_page) return;
      if (f.show_on_home) offPage.push(f); // keep it for the homepage, only take it off the FAQ page
      else removals.push(f);
    });
  }

  const FIELD_LABELS = { question: 'question', category: 'category', answer_html: 'answer', is_published: 'show on website', show_on_faq_page: 'FAQ page', pages: 'pages', sort_order: 'order' };
  const summary = {
    sheet: parsed.sheet,
    columns: parsed.columns,
    strategy: replace ? 'replace' : 'merge',
    rows_read: parsed.rows.length + parsed.errors.filter(e => !/Same question/.test(e.message)).length,
    empty_rows: parsed.empty,
    example_rows: parsed.examples,
    create: creates.length,
    update: updates.length,
    unchanged,
    remove: removals.length,
    off_faq_page: offPage.length,
    errors: parsed.errors.slice(0, 200),
    error_count: parsed.errors.length,
    warnings: warnings.slice(0, 100),
    pages_in_file: parsed.hasPageInfo,
    samples: {
      create: creates.slice(0, 6).map(c => ({ row: c.row.line, question: c.row.question, category: c.row.category, pages: c.row.pages })),
      update: updates.slice(0, 6).map(u => ({ row: u.row.line, question: u.row.question, changes: Object.keys(u.upd).map(k => FIELD_LABELS[k] || k) })),
      remove: removals.slice(0, 6).map(f => ({ id: f.id, question: f.question }))
    }
  };
  if (mode !== 'apply') return { ...summary, saved: false };

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < creates.length; i += 200) {
      await Faq.bulkCreate(creates.slice(i, i + 200).map(c => c.data), { transaction: t });
    }
    for (const u of updates) await u.target.update(u.upd, { transaction: t });
    if (removals.length) await Faq.destroy({ where: { id: { [Op.in]: removals.map(f => f.id) } }, transaction: t });
    for (const f of offPage) await f.update({ show_on_faq_page: false }, { transaction: t });
  });
  invalidateChat();
  return { ...summary, saved: true };
}

module.exports = {
  listPublic,
  listAdmin,
  meta,
  save,
  remove,
  bulk,
  reorder,
  exportXlsx,
  templateXlsx,
  importFile,
  textToHtml,
  htmlToText,
  normQ,
  publicAnswer,
  pagesOf
};
