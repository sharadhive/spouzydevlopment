/**
 * The "What We Do" pages of the website. Used for:
 *  - choosing on which service pages an FAQ is shown (admin, Excel upload, website)
 *  - the "Which care did you use?" choice when a customer shares a story
 * Keep the keys stable: they are stored in the database and in uploaded Excel files.
 */
const SERVICE_PAGES = [
  { key: 'pre-marriage', label: 'Pre-Marriage', file: 'pre-marriage.htm' },
  { key: 'post-marriage', label: 'Post-Marriage', file: 'post-marriage.htm' },
  { key: 'relationships', label: 'Relationship Guidance', file: 'relationships.htm' },
  { key: 'intimate-health', label: 'Intimate Health Care', file: 'intimate-health.htm' },
  { key: 'intimate-aesthetics', label: 'Intimate Aesthetics Treatment', file: 'intimate-aesthetics-treatment.htm' },
  { key: 'divorce-mediation', label: 'Divorce Mediation', file: 'divorce-mediation.htm' },
  { key: 'harassment-support', label: 'Prevent Sexual Violence', file: 'harassment-support.htm' }
];

const STORY_SERVICES = [...SERVICE_PAGES.map(p => ({ key: p.key, label: p.label })), { key: 'other', label: 'Other / general consultation' }];

const PAGE_KEYS = new Set(SERVICE_PAGES.map(p => p.key));

function simplify(t) {
  return String(t || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Accepts a key, a label or a file name ("Pre-Marriage", "pre marriage", "pre-marriage.htm") */
function findPage(value) {
  const v = simplify(String(value || '').replace(/\.html?$/i, ''));
  if (!v) return null;
  return SERVICE_PAGES.find(p => simplify(p.key) === v || simplify(p.label) === v || simplify(p.file.replace(/\.htm$/, '')) === v ||
    // a few natural spellings
    (p.key === 'relationships' && /^relationship( guidance| counselling)?$/.test(v)) ||
    (p.key === 'intimate-health' && /^intimate health( care)?$/.test(v)) ||
    (p.key === 'intimate-aesthetics' && /^(intimate )?aesthetics?( treatment)?$/.test(v)) ||
    (p.key === 'harassment-support' && /^(prevent sexual violence|harassment support|sexual violence)$/.test(v))) || null;
}

module.exports = { SERVICE_PAGES, STORY_SERVICES, PAGE_KEYS, findPage };
