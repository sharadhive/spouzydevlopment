/**
 * SPOUZY website chat assistant.
 *
 * A rule-based assistant (no outside AI service): it understands common questions in English and
 * everyday Hinglish, including spelling mistakes, and answers from live data:
 *  - prices of services and packages (database, edited in the admin panel)
 *  - what each package contains (database)
 *  - offers running right now (database, uploaded in Admin → Packages & Orders → Offers)
 *  - phone, WhatsApp and email (site settings)
 *  - FAQs added in the admin panel and the questions on faq.htm
 *  - clinic addresses and hours, page links (config/chat-knowledge.js, taken from the website)
 * Questions it cannot answer are flagged so staff can add an FAQ, which the assistant uses immediately.
 */
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const models = require('../models');
const { CLINICS, SERVICE_TOPICS, PAGES, TYPOS, CRISIS_WORDS } = require('../config/chat-knowledge');
const { todayIST } = require('../config/time');

const WEBSITE_DIR = path.resolve(__dirname, '../../../website');
const CACHE_MS = 60 * 1000;
const MAX_TEXT = 500;

// ----------------------------------------------------------------------------
// Text helpers
// ----------------------------------------------------------------------------
const STOP = new Set(('a an the is are am was were be been being i me my mine we our you your yours it its this that these those to of in on at for from by with about as and or but if so do does did can could will would should shall may might must ' +
  'what which who whom whose when where why how please pls plz kindly tell know want need get give show let us more any some there here have has had ' +
  'hai hain ka ki ke ko me mein se aur bhi kya kaise kab kaha kahan tha thi the ho hona chahiye karna krna batao bataiye bata dijiye do de mujhe muje hum ham aap ap apka apki ' +
  'sir madam mam maam hello hi hey ok okay yes no').split(' '));

function inr(n) {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

function stripHtml(html) {
  return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function levenshtein1(a, b) {
  // true when a and b differ by at most one edit (insert, delete, substitute or swap)
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; }
    else { i++; j++; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

// ----------------------------------------------------------------------------
// Intents: phrase lists (longer phrases win; each part of the message is used once)
// ----------------------------------------------------------------------------
const INTENTS = {
  crisis: CRISIS_WORDS,
  greeting: ['hi', 'hii', 'hiii', 'hello', 'helo', 'hey', 'namaste', 'namaskar', 'good morning', 'good afternoon', 'good evening', 'hola'],
  thanks: ['thanks', 'thank you', 'thank u', 'thanku', 'thx', 'ty', 'shukriya', 'dhanyawad', 'dhanyavad'],
  bye: ['bye', 'goodbye', 'good bye', 'see you', 'exit', 'quit', 'end chat', 'close chat', 'thats all', 'that s all', 'that is all', 'nothing else', 'no thanks', 'no thank you'],
  myAppointments: ['my appointment', 'my appointments', 'my booking', 'my bookings', 'my session', 'my sessions', 'upcoming appointment', 'when is my appointment', 'booked appointment', 'my slot'],
  myOrders: ['my order', 'my orders', 'my package', 'my packages', 'my purchase', 'order status', 'what did i buy'],
  callback: ['call me', 'call back', 'callback', 'call me back', 'contact me', 'give me a call', 'phone me', 'request a call', 'request call back'],
  human: ['human', 'agent', 'real person', 'representative', 'talk to someone', 'speak to someone', 'talk to team', 'speak to team', 'customer care', 'support team', 'executive', 'live person'],
  price: ['price', 'prices', 'pricing', 'cost', 'costs', 'fee', 'fees', 'charge', 'charges', 'rate', 'rates', 'kitna', 'kitne', 'kitni', 'how much', 'paisa', 'paise', 'rupees', 'rupee', 'rs', 'inr', 'amount', 'tariff', 'expensive', 'cheap', 'afford', 'budget', 'kharcha'],
  includes: ['include', 'includes', 'included', 'including', 'what will i get', 'what do i get', 'what i get', 'what will get', 'contain', 'contains', 'cover', 'covers', 'benefit', 'benefits', 'features', 'kya milega', 'milega', 'milenge', 'whats in', 'what is in', 'details of', 'inside'],
  offers: ['offer', 'offers', 'any offer', 'any offers', 'special offer', 'special offers', 'festival offer', 'diwali offer', 'discount', 'discounts', 'deal', 'deals', 'sale', 'coupon', 'coupons', 'promo', 'promo code', 'promotion', 'cashback', 'chhoot', 'chhut', 'scheme'],
  packages: ['package', 'packages', 'plan', 'plans', 'bundle', 'combo', 'program', 'programme', 'membership'],
  sessionLength: ['how long', 'duration', 'minutes', 'mins', 'how many minutes', 'length of session', 'kitni der', 'how much time', 'session time', 'session length', 'how long is a session'],
  free: ['free', 'muft', 'no cost', 'complimentary', 'without paying', 'free consultation', 'free session', 'first consultation'],
  booking: ['book', 'booking', 'appointment', 'appointments', 'schedule', 'slot', 'slots', 'reserve', 'consultation', 'consult', 'meet doctor', 'meet counsellor', 'session'],
  timing: ['timing', 'timings', 'time', 'hours', 'open', 'opening', 'closing', 'when', 'kab', 'available', 'availability', 'days', 'sunday', 'saturday', 'weekend', 'today', 'tomorrow'],
  location: ['where', 'location', 'locations', 'address', 'clinic', 'clinics', 'branch', 'branches', 'centre', 'center', 'kaha', 'kahan', 'city', 'cities', 'near me', 'visit', 'directions', 'map', 'office']
    .concat(...CLINICS.map(c => c.words)),
  email: ['email', 'e mail', 'mail', 'email id', 'mail id', 'email address'],
  phone: ['phone', 'number', 'call', 'calling', 'contact number', 'mobile', 'helpline', 'whatsapp', 'whats app', 'contact', 'reach you', 'phone number'],
  payment: ['pay', 'payment', 'payments', 'upi', 'card', 'credit card', 'debit card', 'net banking', 'razorpay', 'online payment', 'gpay', 'paytm', 'phonepe', 'emi', 'invoice', 'receipt'],
  refund: ['refund', 'refunds', 'money back', 'cancel', 'cancellation', 'cancelled', 'reschedule', 'change date', 'change time', 'postpone'],
  privacy: ['private', 'privacy', 'confidential', 'confidentiality', 'secret', 'anonymous', 'discreet', 'data safe', 'share my', 'parents know', 'family know'],
  online: ['online', 'video', 'virtual', 'video call', 'zoom', 'remote', 'from home', 'phone consultation', 'tele', 'teleconsultation', 'audio call'],
  team: ['doctor', 'doctors', 'counsellor', 'counsellors', 'therapist', 'therapists', 'psychologist', 'psychiatrist', 'expert', 'experts', 'specialist', 'specialists', 'team', 'qualified', 'qualification', 'qualifications'],
  join: ['join as doctor', 'join as a doctor', 'join as counsellor', 'join as a counsellor', 'empanel', 'empanelment', 'register as doctor', 'register as counsellor', 'work as doctor', 'work as counsellor', 'join your team'],
  careers: ['job', 'jobs', 'career', 'careers', 'vacancy', 'vacancies', 'hiring', 'opening', 'openings', 'work with you', 'internship'],
  account: ['login', 'log in', 'sign in', 'account', 'password', 'forgot password', 'reset password', 'sign up', 'register', 'profile'],
  howItWorks: ['how does it work', 'how it works', 'process', 'steps', 'procedure', 'what happens'],
  blog: ['blog', 'article', 'articles', 'resources', 'guide', 'guides', 'ebook'],
  about: ['about you', 'about spouzy', 'who are you', 'what is spouzy', 'psg', 'problem solver', 'company', 'founder', 'since when']
};
// When two intents match equally, the earlier one wins
const PRIORITY = Object.keys(INTENTS);
const VOCAB = Array.from(new Set(Object.values(INTENTS).flat().concat(...Object.values(SERVICE_TOPICS).map(t => t.words))
  .flatMap(p => p.split(' ')).filter(w => w.length >= 5)));

function normalize(text) {
  let t = String(text || '').toLowerCase()
    .replace(/[₹]/g, ' rs ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = t.split(' ').filter(Boolean).map(w => {
    if (TYPOS[w]) return TYPOS[w];
    if (w.length >= 5 && !VOCAB.includes(w)) {
      const near = VOCAB.find(v => Math.abs(v.length - w.length) <= 1 && levenshtein1(w, v));
      if (near) return near;
    }
    return w;
  });
  return { norm: tokens.join(' '), tokens };
}

/** Match phrase lists against the text; longer phrases first, each word used once */
function matchPhrases(norm, groups) {
  const entries = [];
  Object.entries(groups).forEach(([key, list]) => list.forEach(p => entries.push([key, p])));
  entries.sort((a, b) => b[1].length - a[1].length);
  let work = ` ${norm} `;
  const scores = {};
  const order = [];
  for (const [key, phrase] of entries) {
    const needle = ` ${phrase} `;
    const idx = work.indexOf(needle);
    if (idx === -1) continue;
    scores[key] = (scores[key] || 0) + phrase.split(' ').length;
    if (!order.find(o => o.key === key)) order.push({ key, at: idx });
    work = work.slice(0, idx) + ' ' + '_'.repeat(needle.length - 2) + ' ' + work.slice(idx + needle.length);
  }
  order.sort((a, b) => a.at - b.at);
  return { scores, inOrder: order.map(o => o.key) };
}

function detectServices(norm) {
  const groups = {};
  Object.entries(SERVICE_TOPICS).forEach(([slug, t]) => { groups[slug] = t.words; });
  return matchPhrases(norm, groups).inOrder;
}

function detectIntents(norm) {
  const { scores } = matchPhrases(norm, INTENTS);
  return Object.keys(scores).sort((a, b) => (scores[b] - scores[a]) || (PRIORITY.indexOf(a) - PRIORITY.indexOf(b)));
}

// ----------------------------------------------------------------------------
// Live data (cached for a minute; FAQ changes clear the cache)
// ----------------------------------------------------------------------------
let cache = { at: 0 };

function parseSiteFaqs() {
  try {
    const html = fs.readFileSync(path.join(WEBSITE_DIR, 'faq.htm'), 'utf8');
    const out = [];
    const re = /<details[^>]*>\s*<summary([^>]*)>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
    let m;
    while ((m = re.exec(html))) {
      if (/sp-drawer/.test(m[1])) continue;
      const q = stripHtml(m[2]).replace(/\+\s*$/, '').trim();
      const a = stripHtml(m[3]);
      if (q.endsWith('?') && a.length > 20) out.push({ question: q, answer: a, source: 'faq.htm' });
    }
    return out;
  } catch (e) {
    return [];
  }
}

function parsePageIndex() {
  const out = [];
  try {
    fs.readdirSync(WEBSITE_DIR).filter(f => f.endsWith('.htm')).forEach(f => {
      const html = fs.readFileSync(path.join(WEBSITE_DIR, f), 'utf8');
      const title = stripHtml((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s*\|\s*SPOUZY.*$/i, '').replace(/^SPOUZY\s*\|\s*/i, '');
      const desc = stripHtml((html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '');
      if (title && desc && !/^(cart|register|create-account|account|under-construction|index)\.htm$/.test(f)) {
        out.push({ url: f, title, description: desc, tokens: normalize(`${title} ${desc} ${f.replace(/[-.]/g, ' ')}`).tokens.filter(w => !STOP.has(w)) });
      }
    });
  } catch (e) { /* website folder missing: page search disabled */ }
  return out;
}

async function data() {
  if (Date.now() - cache.at < CACHE_MS) return cache;
  const shopService = require('./shop.service');
  const offerService = require('./offer.service');
  const [services, pkgs, settingsRows, faqs, openings, offers] = await Promise.all([
    models.Service.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
    shopService.listPublicPackages({}),
    models.SiteSetting.findAll({ where: { is_public: true } }),
    models.Faq.findAll({ where: { is_published: true }, order: [['sort_order', 'ASC'], ['id', 'ASC']] }),
    models.CareerOpening.findAll({ where: { is_active: true }, attributes: ['title', 'slug'] }),
    offerService.listPublic()
  ]);
  const settings = {};
  settingsRows.forEach(s => { settings[s.setting_key] = s.setting_value; });
  const schedulingService = require('./scheduling.service');
  const freeWindow = schedulingService.getBookingWindow('free');
  cache = {
    at: Date.now(),
    services: services.map(s => ({ slug: s.slug, name: s.name, description: s.description, price30: s.price_30_minor / 100, price60: s.price_60_minor / 100 })),
    packages: pkgs.packages,
    offers,
    paymentEnabled: !!(pkgs.payment && pkgs.payment.enabled),
    phone: formatPhone(settings.contact_phone || '+91 85919 45055'),
    whatsapp: formatPhone(settings.whatsapp_number || settings.contact_phone || '+91 85919 45055'),
    email: settings.support_email || 'care@spouzy.com',
    // FAQs from the admin (copied from the website in migration 9); the page text is only a fallback
    faqs: (faqs.length ? faqs.map(f => ({ id: f.id, question: f.question, answer: stripHtml(f.answer_html), source: 'admin', pages: faqPages(f) })) : parseSiteFaqs())
      .map(f => ({ ...f, qTokens: new Set(normalize(f.question).tokens.filter(w => !STOP.has(w) && w.length > 2)) })),
    pages: cache.pages || parsePageIndex(),
    openings: openings.map(o => o.title),
    freeEarliest: freeWindow.earliest
  };
  return cache;
}

function formatPhone(number) {
  const d = String(number || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return String(number || '');
}

function waUrl(number, text) {
  const digits = String(number || '').replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

function telUrl(number) {
  return 'tel:+' + String(number || '').replace(/\D/g, '');
}

function formatDate(ymd) {
  const d = new Date(ymd + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function serviceName(d, slug) {
  const s = d.services.find(x => x.slug === slug);
  return s ? s.name : slug;
}

function packagesFor(d, slug) {
  return d.packages.filter(p => !p.service_slugs.length || p.service_slugs.includes(slug));
}

function packageLine(p) {
  const offer = p.offer && p.offer.has_price ? ` — ${p.offer.title}${p.offer.end_date ? `, until ${formatDate(p.offer.end_date)}` : ''}` : '';
  return `${p.name}: ${p.is_free ? 'Free' : inr(p.price_inr)}${p.compare_at_inr && p.compare_at_inr > p.price_inr ? ` (was ${inr(p.compare_at_inr)})` : ''}${offer} · ${p.sessions_included} ${p.sessions_included === 1 ? 'session' : 'sessions'} × ${p.session_minutes} min`;
}

function offerLine(o) {
  let line = `• ${o.title}`;
  if (o.package) {
    line += o.package.offer_price_inr
      ? `: ${o.package.name} for ${inr(o.package.offer_price_inr)} (normally ${inr(o.package.price_inr)})`
      : ` — on ${o.package.name}`;
  }
  if (o.description) line += `\n   ${o.description}`;
  if (o.end_date) line += `\n   Valid until ${formatDate(o.end_date)}.`;
  return line;
}

function detectPackage(d, norm) {
  const generic = new Set(['session', 'sessions', 'plan', 'program', 'programme', 'care', 'package', 'consultation', 'first', 'the', 'and']);
  let best = null;
  let bestScore = 0;
  d.packages.forEach(p => {
    const name = normalize(p.name).norm;
    if ((' ' + norm + ' ').includes(' ' + name + ' ')) { best = p; bestScore = 99; return; }
    const distinctive = name.split(' ').filter(w => !generic.has(w));
    const hits = distinctive.filter(w => (' ' + norm + ' ').includes(' ' + w + ' ')).length;
    if (hits && hits >= Math.ceil(distinctive.length / 2) && hits > bestScore) { best = p; bestScore = hits; }
  });
  return best;
}

// ----------------------------------------------------------------------------
// Answers
// ----------------------------------------------------------------------------
function reply(intent, text, links = [], chips = []) {
  return { intent, text, links, chips };
}

const H = {
  crisis(d) {
    return reply('crisis',
      "I'm really sorry you are going through this. If you are in immediate danger, please call 112 (emergency) right now.\n" +
      'For free, confidential mental-health support at any time, you can call Tele-MANAS on 14416.\n' +
      'Our team is also here for you — message or call us and we will respond as quickly as we can.',
      [{ label: 'Call SPOUZY', url: telUrl(d.phone) }, { label: 'WhatsApp us', url: waUrl(d.whatsapp, 'Hello SPOUZY, I need support.') }],
      []);
  },

  greeting(d, ctx) {
    return reply('greeting',
      `Hello${ctx.firstName ? ' ' + ctx.firstName : ''}! I'm the SPOUZY assistant. I can tell you about prices, packages and what they include, booking, timings, clinic locations and how to contact us. What would you like to know?`,
      [], ['Prices', 'Packages', 'Book a free consultation', 'Clinic locations']);
  },

  thanks() {
    return reply('thanks', "You're welcome! Is there anything else I can help you with?", [], ['Prices', 'Packages', 'Talk to the team']);
  },

  bye(d, ctx) {
    return reply('bye', `Thank you for chatting with SPOUZY${ctx.firstName ? ', ' + ctx.firstName : ''}. Take care — you can message me here any time.`, [], []);
  },

  price(d, ctx, q) {
    // Use the service from earlier in the chat only for short follow-ups ("and for 60 minutes?")
    const followUp = q.tokens.length <= 5 && !/\b(prices|all|every|list)\b/.test(q.norm);
    const slugs = q.services.length ? q.services : (ctx.lastService && followUp ? [ctx.lastService] : []);
    if (!slugs.length) {
      const lines = d.services.map(s => `• ${s.name}: ${inr(s.price30)} for 30 min · ${inr(s.price60)} for 60 min`);
      return reply('price',
        'Here are our consultation prices:\n' + lines.join('\n') +
        `\n\nA free first consultation (30 min) is also available, with dates from ${formatDate(d.freeEarliest)}. Packages with several sessions are on the Packages page.`,
        [PAGES.booking, PAGES.packages],
        ['Price of pre-marriage', 'Price of post-marriage', 'Price of divorce mediation', 'What do packages include?']);
    }
    const parts = [];
    const links = [];
    slugs.slice(0, 3).forEach(slug => {
      const s = d.services.find(x => x.slug === slug);
      if (!s) return;
      const pk = packagesFor(d, slug).filter(p => !p.is_free);
      parts.push(`${s.name}:\n• ${inr(s.price30)} for a 30-minute session\n• ${inr(s.price60)} for a 60-minute session` +
        (pk.length ? '\nPackages: ' + pk.map(p => `${p.name} ${inr(p.price_inr)}`).join(' · ') : ''));
      const topic = SERVICE_TOPICS[slug];
      if (topic) links.push({ label: `Read about ${topic.pageLabel}`, url: topic.page });
      links.push({ label: `Book ${topic ? topic.pageLabel.toLowerCase() : 'this service'}`, url: `book-appoinment.htm?service=${slug}` });
    });
    if (!parts.length) return H.price(d, { ...ctx, lastService: null }, { ...q, services: [] });
    ctx.lastService = slugs[0];
    return reply('price',
      parts.join('\n\n') + `\n\nYou can also start with a free 30-minute consultation (dates from ${formatDate(d.freeEarliest)}).`,
      links.concat([PAGES.packages]).slice(0, 4),
      ['What do packages include?', 'Book a free consultation', 'Clinic locations']);
  },

  includes(d, ctx, q) {
    const pkg = detectPackage(d, q.norm);
    if (pkg) {
      ctx.lastPackage = pkg.slug;
      const svc = pkg.service_slugs.map(sl => serviceName(d, sl)).filter(Boolean);
      return reply('includes',
        `${pkg.name} — ${pkg.is_free ? 'Free' : inr(pkg.price_inr)}${pkg.compare_at_inr && pkg.compare_at_inr > pkg.price_inr ? ` (was ${inr(pkg.compare_at_inr)})` : ''}\n` +
        'What you get:\n' + pkg.features.map(f => '• ' + f).join('\n') +
        `\n${pkg.sessions_included} ${pkg.sessions_included === 1 ? 'session' : 'sessions'} × ${pkg.session_minutes} min${pkg.validity_days ? ` · valid ${pkg.validity_days} days` : ''}` +
        (svc.length ? `\nFor: ${svc.join(', ')}` : ''),
        [{ label: pkg.is_free ? 'Claim it on the Packages page' : 'Add it on the Packages page', url: 'packages.htm' }, PAGES.cart],
        d.packages.filter(p => p.slug !== pkg.slug).slice(0, 3).map(p => `What's in ${p.name}?`));
    }
    return H.packages(d, ctx, q, true);
  },

  offers(d) {
    if (!d.offers || !d.offers.length) {
      return reply('offers',
        'There are no special offers running right now. You can still start with a free first consultation, and all our packages and prices are on the Packages page.',
        [PAGES.packages, PAGES.freeBooking], ['Packages', 'Book a free consultation']);
    }
    const list = d.offers.slice(0, 4);
    const links = list.map(o => ({ label: o.package ? `${o.cta_label}: ${o.package.name}` : o.cta_label, url: o.cta_url })).slice(0, 3);
    return reply('offers',
      `${list.length === 1 ? 'Here is the offer running right now' : 'Offers running right now'}:\n${list.map(offerLine).join('\n')}` +
      (list.some(o => o.terms) ? '\nTerms apply; the details are shown with each offer.' : '') +
      '\nOffer prices are applied automatically in your cart.',
      links.concat([PAGES.packages]).slice(0, 4), ['Packages', 'Book a free consultation']);
  },

  packages(d, ctx, q, detailed) {
    const slug = q.services[0] || null;
    const list = slug ? packagesFor(d, slug) : d.packages;
    if (!list.length) return reply('packages', 'There are no packages for that service right now, but you can book a single session.', [PAGES.booking], []);
    const lines = list.map(p => '• ' + packageLine(p) + (detailed || list.length <= 4 ? '\n   ' + p.features.slice(0, 2).join('; ') : ''));
    return reply('packages',
      `${slug ? `Packages for ${serviceName(d, slug)}` : 'Our packages'}:\n${lines.join('\n')}\n\nAsk me about any package to see everything it includes.` +
      (d.paymentEnabled ? '' : '\nOnline payment is coming soon; the free package can be claimed today.'),
      [PAGES.packages],
      list.slice(0, 4).map(p => `What's in ${p.name}?`));
  },

  sessionLength() {
    return reply('sessionLength', 'Paid sessions are 30 or 60 minutes — you choose when booking. The free first consultation is 30 minutes. Package sessions are usually 60 minutes.', [PAGES.booking], ['Prices', 'Book a free consultation']);
  },

  free(d) {
    const freePkg = d.packages.find(p => p.is_free);
    return reply('free',
      `Yes — your first consultation can be free (30 minutes, online or by phone). Free consultation dates open two months ahead, so the earliest date right now is ${formatDate(d.freeEarliest)}.` +
      (freePkg ? `\nYou can also claim the "${freePkg.name}" package from your account.` : '') +
      '\nIf you would like to talk sooner, paid sessions can be booked from today.',
      [PAGES.freeBooking, PAGES.packages], ['Prices', 'How does it work?']);
  },

  booking(d, ctx, q) {
    const slug = q.services[0] || ctx.lastService;
    return reply('booking',
      'Booking takes about a minute:\n1. Choose the service, free or paid, and online / phone / clinic.\n2. Pick a date and an available time.\n3. Press Confirm — you are already logged in, so your details fill in automatically.\nYou get a reference number straight away, and the appointment appears in My Account.',
      [slug && SERVICE_TOPICS[slug] ? { label: `Book ${SERVICE_TOPICS[slug].pageLabel.toLowerCase()}`, url: `book-appoinment.htm?service=${slug}` } : PAGES.booking, PAGES.freeBooking, PAGES.appointments],
      ['Prices', 'Timings', 'Is it confidential?']);
  },

  timing(d, ctx, q) {
    const city = CLINICS.find(c => c.words.some(w => (' ' + q.norm + ' ').includes(' ' + w + ' ')));
    const clinicLines = (city ? [city] : CLINICS).map(c => `• ${c.city}: ${c.hours}`).join('\n');
    return reply('timing',
      'Online and phone consultations: time slots from 9:00 AM to 9:00 PM IST — the booking page shows live availability.\n' +
      `Clinic hours:\n${clinicLines}`,
      [PAGES.booking, PAGES.contact], ['Clinic locations', 'Book a free consultation']);
  },

  location(d, ctx, q) {
    const city = CLINICS.find(c => c.words.some(w => (' ' + q.norm + ' ').includes(' ' + w + ' ')));
    const list = city ? [city] : CLINICS;
    return reply('location',
      (city ? `Our ${city.city} clinic:` : 'We have clinics in four cities (and online sessions anywhere):') + '\n' +
      list.map(c => `• ${c.city} — ${c.name}, ${c.address}. Hours: ${c.hours}`).join('\n'),
      [PAGES.contact, { label: 'Book an in-clinic visit', url: 'book-appoinment.htm' }], city ? ['Other clinics', 'Phone number'] : ['Timings', 'Phone number']);
  },

  email(d) {
    return reply('email', `You can email us at ${d.email}. We reply within one working day.`, [{ label: `Email ${d.email}`, url: 'mailto:' + d.email }, PAGES.contact], ['Phone number', 'WhatsApp']);
  },

  phone(d) {
    return reply('phone', `Call us on ${d.phone} or message us on WhatsApp at ${d.whatsapp}.`,
      [{ label: `Call ${d.phone}`, url: telUrl(d.phone) }, { label: 'WhatsApp us', url: waUrl(d.whatsapp, 'Hello SPOUZY, I have a question.') }],
      ['Request a call back', 'Email address']);
  },

  payment(d) {
    return reply('payment',
      d.paymentEnabled
        ? 'You can pay securely online when booking or buying a package (UPI, cards and net banking through Razorpay). Free consultations need no payment.'
        : 'Online payment is coming soon. Until then you can reserve a paid slot, and our team will contact you to complete the payment. Free consultations need no payment.',
      [PAGES.payment, PAGES.packages], ['Refund policy', 'Prices']);
  },

  refund(d) {
    return reply('refund',
      'To reschedule or cancel, message us with your booking reference (you can find it in My Account → My appointments). Refunds follow our Refund & Cancellation Policy.',
      [PAGES.appointments, PAGES.refund, { label: 'WhatsApp us', url: waUrl(d.whatsapp, 'Hello SPOUZY, I want to reschedule/cancel my appointment. Reference: ') }], []);
  },

  privacy(d) {
    const faq = d.faqs.find(f => /confidential/i.test(f.question));
    return reply('privacy', (faq ? faq.answer : 'Yes. All sessions are strictly confidential.') + '\nYou may also use a discreet alias when booking.', [PAGES.confidentiality, PAGES.privacy], ['Online sessions', 'Prices']);
  },

  online(d) {
    const faq = d.faqs.find(f => /online|video/i.test(f.question));
    return reply('online', (faq ? faq.answer : 'Yes, sessions are available online by video or phone.') + '\nChoose "Video / audio" as the mode when booking.', [PAGES.booking, PAGES.tele], ['Prices', 'Timings']);
  },

  team(d) {
    const faq = d.faqs.find(f => /qualification/i.test(f.question));
    return reply('team', faq ? faq.answer : 'Our team includes certified doctors, licensed counsellors and trained mediators.', [PAGES.team, PAGES.booking], ['Prices', 'Book a free consultation']);
  },

  join() {
    return reply('join', 'Doctors and counsellors can apply to join SPOUZY with an online application (documents can be uploaded). You get a reference number as soon as you submit.', [PAGES.joinDoctor, PAGES.joinCounsellor, PAGES.careers], ['Open jobs']);
  },

  careers(d) {
    return reply('careers',
      d.openings.length ? `We are currently hiring for:\n${d.openings.map(t => '• ' + t).join('\n')}\nApply on the Careers page with your resume.` : 'There are no open positions right now — please check the Careers page later.',
      [PAGES.careers, PAGES.joinDoctor, PAGES.joinCounsellor], []);
  },

  account(d, ctx) {
    return reply('account',
      `You are logged in as ${ctx.fullName || 'a SPOUZY customer'}. You can update your name, mobile and password in My Account. Forgot your password? Message us on WhatsApp and we will reset it.`,
      [PAGES.account, { label: 'WhatsApp us', url: waUrl(d.whatsapp, 'Hello SPOUZY, I need help with my account.') }], ['My appointments', 'My orders']);
  },

  howItWorks() {
    return reply('howItWorks',
      'How it works:\n1. Choose a service — counselling, intimate health, pre-marriage or mediation.\n2. Book a free or paid session online, by phone or in a clinic.\n3. You get a reference number, and our team shares the session link or clinic details.\n4. Meet your specialist — everything stays confidential.',
      [PAGES.booking, PAGES.packages], ['Prices', 'Is it confidential?']);
  },

  blog() {
    return reply('blog', 'Our blog and free guides cover conversations, relationships and family life.', [PAGES.blog, PAGES.faq], []);
  },

  about(d) {
    const faq = d.faqs.find(f => /PSG/i.test(f.question));
    return reply('about', faq ? faq.answer : 'SPOUZY is the relationship and intimate-health wing of Problem Solver Group (PSG).', [PAGES.about, PAGES.team], ['Prices', 'Clinic locations']);
  },

  human(d) {
    return reply('human', `Our care team is happy to help. Message us on WhatsApp (${d.whatsapp}) or call ${d.phone}. I can also arrange a call back for you.`,
      [{ label: 'WhatsApp us', url: waUrl(d.whatsapp, 'Hello SPOUZY, I would like to talk to the team.') }, { label: `Call ${d.phone}`, url: telUrl(d.phone) }],
      ['Request a call back']);
  }
};

// Service mentioned without a question word → short introduction with links
function serviceIntro(d, slug) {
  const topic = SERVICE_TOPICS[slug];
  const s = d.services.find(x => x.slug === slug);
  const page = d.pages.find(p => p.url === topic.page);
  return reply('service',
    `${s ? s.name : topic.pageLabel}: ${page ? page.description : (s && s.description) || ''}` +
    (s ? `\nSessions cost ${inr(s.price30)} (30 min) or ${inr(s.price60)} (60 min), and you can start with a free consultation.` : ''),
    [{ label: `Read about ${topic.pageLabel}`, url: topic.page }, { label: 'Book now', url: `book-appoinment.htm?service=${slug}` }],
    ['Prices', 'Packages for this service', 'Is it confidential?']);
}

function faqPages(f) {
  let p = f.pages;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = []; } }
  return Array.isArray(p) ? p : [];
}

function searchFaqs(d, tokens) {
  const words = tokens.filter(w => !STOP.has(w) && w.length > 2);
  if (!words.length) return null;
  let best = null;
  let bestScore = 0;
  d.faqs.forEach(f => {
    const ft = f.qTokens || new Set(normalize(f.question).tokens.filter(w => !STOP.has(w) && w.length > 2));
    if (!ft.size) return;
    const hits = words.filter(w => ft.has(w)).length;
    const score = hits / Math.max(ft.size, words.length);
    if (hits >= 2 && score > bestScore) { best = f; bestScore = score; }
  });
  return best && bestScore >= 0.25 ? best : null;
}

function searchPages(d, tokens) {
  const words = tokens.filter(w => !STOP.has(w) && w.length > 3);
  if (!words.length) return [];
  return d.pages
    .map(p => ({ p, hits: words.filter(w => p.tokens.includes(w)).length }))
    .filter(x => x.hits >= Math.min(2, words.length))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map(x => x.p);
}

function merge(replies) {
  const links = [];
  const chips = [];
  replies.forEach(r => {
    r.links.forEach(l => { if (!links.find(x => x.url === l.url)) links.push(l); });
    r.chips.forEach(c => { if (!chips.includes(c)) chips.push(c); });
  });
  return { intent: replies.map(r => r.intent).join('+'), text: replies.map(r => r.text).join('\n\n'), links: links.slice(0, 4), chips: chips.slice(0, 4) };
}

// Quick-reply chips → the question they stand for
const CHIP_TEXT = {
  'prices': 'what are the prices',
  'packages': 'show packages',
  'timings': 'what are the timings',
  'clinic locations': 'clinic locations',
  'other clinics': 'all clinic locations',
  'phone number': 'phone number',
  'email address': 'email address',
  'whatsapp': 'whatsapp number',
  'talk to the team': 'talk to team',
  'request a call back': 'request a call back',
  'refund policy': 'refund policy',
  'open jobs': 'jobs',
  'online sessions': 'online video sessions',
  'is it confidential?': 'is it confidential',
  'how does it work?': 'how does it work',
  'what do packages include?': 'what do packages include',
  'packages for this service': 'packages for this service',
  'my appointments': 'my appointments',
  'my orders': 'my orders'
};

/**
 * Work out the answer for one message.
 * ctx is the conversation memory (last service, pending step); it is updated in place.
 */
async function answer(text, ctx, user) {
  const d = await data();
  const raw = String(text || '').slice(0, MAX_TEXT);
  const chipKey = raw.trim().toLowerCase();
  const q = normalize(CHIP_TEXT[chipKey] || raw);
  q.services = detectServices(q.norm);
  if (chipKey === 'packages for this service' && ctx.lastService) q.services = [ctx.lastService];
  ctx.firstName = user.first_name || '';
  ctx.fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

  // A pending call-back request: this message is the preferred time
  if (ctx.pending === 'callback_time') {
    ctx.pending = null;
    if (/^(cancel|no|stop|nahi|nahin)$/.test(chipKey)) return { ...reply('callback', 'No problem — I have not requested a call. Anything else?', [], ['Prices', 'Packages']), matched: true };
    const enquiryService = require('./enquiry.service');
    const preferred = raw.trim().slice(0, 60) || 'Any time';
    const result = await enquiryService.submitEnquiry({
      name: ctx.fullName || 'Website chat customer',
      email: user.email,
      phone: user.phone || '',
      message: `Call-back requested from the website chat. Preferred time: ${preferred}.${ctx.lastQuestion ? ' Last question: ' + ctx.lastQuestion : ''}`,
      service_interest: ctx.lastService ? serviceName(d, ctx.lastService) : null,
      preferred_contact_method: 'Phone call',
      consent: true,
      source: 'floating_widget'
    });
    const ref = result && (result.referenceNo || (result.enquiry && result.enquiry.reference_no) || result.reference_no);
    return { ...reply('callback', `Done! Our team will call you on ${user.phone || 'your registered number'} (${preferred}).${ref ? ` Your reference is ${ref}.` : ''}`, [], ['Prices', 'Packages']), matched: true };
  }

  let intents = detectIntents(q.norm);

  if (intents.includes('crisis')) return { ...H.crisis(d, ctx), matched: true };

  // Account-specific questions
  if (intents[0] === 'myAppointments' || (intents.includes('myAppointments') && !intents.includes('price'))) {
    const appts = await models.Appointment.findAll({
      where: { user_id: user.id, appointment_date: { [Op.gte]: todayIST() }, status: { [Op.in]: ['confirmed', 'hold', 'rescheduled'] } },
      include: [{ model: models.Service, as: 'service', attributes: ['name'] }],
      order: [['appointment_date', 'ASC'], ['start_time', 'ASC']],
      limit: 5
    });
    return {
      ...reply('myAppointments', appts.length
        ? 'Your upcoming appointments:\n' + appts.map(a => `• ${formatDate(a.appointment_date)} at ${a.start_time} — ${a.service ? a.service.name : 'Consultation'} (${a.reference_no})`).join('\n')
        : 'You have no upcoming appointments booked from this account.', [PAGES.appointments, PAGES.booking], ['Book a free consultation', 'Reschedule']),
      matched: true
    };
  }
  if (intents[0] === 'myOrders') {
    const orders = await models.PackageOrder.findAll({ where: { user_id: user.id }, order: [['id', 'DESC']], limit: 5 });
    const LABEL = { pending_payment: 'awaiting payment', paid: 'paid', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled' };
    return {
      ...reply('myOrders', orders.length
        ? 'Your recent orders:\n' + orders.map(o => {
          let items = o.items; if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
          return `• ${o.order_no} — ${(items || []).map(i => i.name).join(', ')} — ${o.total_minor ? inr(o.total_minor / 100) : 'Free'} (${LABEL[o.status] || o.status})`;
        }).join('\n')
        : 'You have no package orders yet.', [PAGES.orders, PAGES.packages], ['Packages']),
      matched: true
    };
  }
  if (intents[0] === 'callback' || chipKey === 'request a call back') {
    ctx.pending = 'callback_time';
    return { ...reply('callback', `Sure. When should our team call you on ${user.phone || 'your registered number'}?`, [], ['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–8)', 'Cancel']), matched: true };
  }

  // A short follow-up such as "and post marriage?" continues the last topic
  if (!intents.length && q.services.length && ['price', 'packages', 'includes', 'booking'].includes(ctx.lastIntent)) {
    intents = [ctx.lastIntent];
  }
  // "price of the couple care plan" is about a package
  if (intents.includes('price') && !q.services.length && detectPackage(d, q.norm)) intents = ['includes'];
  // "what is included in pre marriage" without the word package
  if (intents[0] === 'includes' && !detectPackage(d, q.norm) && !intents.includes('packages')) intents = ['packages'];

  const handled = [];
  const used = new Set();
  const CONTACT = ['email', 'phone', 'location', 'timing'];
  for (const intent of intents) {
    if (!H[intent] || used.has(intent)) continue;
    // greetings / thanks combined with a real question: answer the question
    if (['greeting', 'thanks'].includes(intent) && intents.length > 1) continue;
    if (intent === 'booking' && (used.has('price') || used.has('free') || used.has('includes') || used.has('packages') || used.has('sessionLength'))) continue;
    if (intent === 'packages' && used.has('includes')) continue;
    if (intent === 'about' && intents.length > 1) continue;
    if (intent === 'team' && (intents.includes('join') || q.services.length)) continue;
    if (intent === 'location' && used.has('timing') && !/\b(where|address|kaha|kahan|directions|map)\b/.test(q.norm)) continue;
    if (intent === 'timing' && used.has('location')) continue;
    handled.push(H[intent](d, ctx, q));
    used.add(intent);
    const contactCount = handled.filter(h => CONTACT.includes(h.intent)).length;
    if (handled.length >= 2 && !(CONTACT.includes(intent) && contactCount === handled.length && handled.length < 3)) break;
  }

  if (handled.length) {
    ctx.lastIntent = handled[0].intent;
    if (q.services.length) ctx.lastService = q.services[0];
    return { ...merge(handled), matched: true };
  }

  const faq = searchFaqs(d, q.tokens);
  if (faq) {
    const links = [faq.id ? { label: 'Open this answer', url: `faq.htm#faq-${faq.id}` } : PAGES.faq];
    const sp = require('../config/service-pages').SERVICE_PAGES.find(p => (faq.pages || []).includes(p.key));
    if (sp) links.push({ label: `Read about ${sp.label}`, url: sp.file });
    return { ...reply('faq', faq.answer, links, ['Prices', 'Book a free consultation']), matched: true };
  }

  if (q.services.length) {
    ctx.lastService = q.services[0];
    ctx.lastIntent = 'service';
    return { ...serviceIntro(d, q.services[0]), matched: true };
  }

  const pages = searchPages(d, q.tokens);
  if (pages.length) {
    return {
      ...reply('page', pages.map(p => `${p.title}: ${p.description}`).join('\n\n'), pages.map(p => ({ label: `Open ${p.title}`, url: p.url })), ['Prices', 'Talk to the team']),
      matched: true
    };
  }

  return {
    ...reply('fallback',
      "I'm sorry, I didn't quite get that. I can help with prices, packages, booking, timings, clinic locations and contact details — or our team can answer on WhatsApp.",
      [{ label: 'Ask our team on WhatsApp', url: waUrl(d.whatsapp, raw) }],
      ['Prices', 'Packages', 'Clinic locations', 'Request a call back']),
    matched: false
  };
}

// ----------------------------------------------------------------------------
// Conversations
// ----------------------------------------------------------------------------
function transcriptText(r) {
  return r.text + (r.links && r.links.length ? '\n' + r.links.map(l => `→ ${l.label} (${l.url})`).join('\n') : '');
}

async function settings() {
  const rows = await models.SiteSetting.findAll({ where: { setting_key: ['chat_enabled', 'chat_idle_seconds'] } });
  const map = {};
  rows.forEach(r => { map[r.setting_key] = r.setting_value; });
  const idle = parseInt(map.chat_idle_seconds, 10);
  return { enabled: String(map.chat_enabled || 'true') !== 'false', idleSeconds: idle >= 15 && idle <= 600 ? idle : 30 };
}

async function saveMessage(conv, sender, text, extra = {}) {
  await models.ChatMessage.create({ conversation_id: conv.id, sender, text: String(text).slice(0, 4000), sent_at: new Date(), ...extra });
}

class ChatService {
  invalidate() { cache = { at: 0, pages: cache.pages }; }

  async settings() { return settings(); }

  async start(user, { conversationId, page } = {}) {
    const cfg = await settings();
    if (!cfg.enabled) { const e = new Error('The chat is switched off at the moment.'); e.status = 403; throw e; }
    if (conversationId) {
      const existing = await models.ChatConversation.findOne({ where: { id: conversationId, user_id: user.id, status: 'open' } });
      if (existing) {
        const messages = await models.ChatMessage.findAll({ where: { conversation_id: existing.id }, order: [['sent_at', 'ASC'], ['id', 'ASC']] });
        return { conversationId: existing.id, resumed: true, idleSeconds: cfg.idleSeconds, history: messages.map(m => ({ sender: m.sender, text: m.text })) };
      }
    }
    const conv = await models.ChatConversation.create({ user_id: user.id, status: 'open', context: {}, page: page ? String(page).slice(0, 255) : null, last_message_at: new Date() });
    const d = await data();
    const greet = H.greeting(d, { firstName: user.first_name });
    await saveMessage(conv, 'bot', transcriptText(greet), { intent: 'greeting' });
    await conv.update({ message_count: 1 });
    return { conversationId: conv.id, resumed: false, idleSeconds: cfg.idleSeconds, messages: [greet] };
  }

  async message(user, conversationId, text, req) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!clean) { const e = new Error('Please type a message.'); e.status = 400; throw e; }
    let conv = await models.ChatConversation.findOne({ where: { id: conversationId, user_id: user.id } });
    let restarted = false;
    if (!conv || conv.status !== 'open') {
      const started = await this.start(user, {});
      conv = await models.ChatConversation.findByPk(started.conversationId);
      restarted = true;
    }
    let ctx = conv.context;
    if (typeof ctx === 'string') { try { ctx = JSON.parse(ctx); } catch (e) { ctx = {}; } }
    ctx = JSON.parse(JSON.stringify(ctx || {})); // work on a copy so the change is detected and saved

    const result = await answer(clean, ctx, user);
    ctx.lastQuestion = clean.slice(0, 200);
    await saveMessage(conv, 'user', clean, { intent: result.intent, matched: result.matched });
    await saveMessage(conv, 'bot', transcriptText(result), { intent: result.intent });
    await conv.update({
      context: { ...ctx },
      message_count: conv.message_count + 2,
      unanswered_count: conv.unanswered_count + (result.matched ? 0 : 1),
      last_message_at: new Date()
    });
    const activityService = require('./activity.service');
    await activityService.record(user.id, 'chat', { req, label: clean.slice(0, 200), details: { conversation_id: conv.id, understood: result.matched } });

    const ended = result.intent === 'bye';
    if (ended) await conv.update({ status: 'ended', ended_reason: 'user', ended_at: new Date() });
    return { conversationId: conv.id, restarted, ended, messages: [{ text: result.text, links: result.links, chips: result.chips }] };
  }

  async end(user, conversationId, reason) {
    const conv = await models.ChatConversation.findOne({ where: { id: conversationId, user_id: user.id } });
    if (!conv) return { ended: true, messages: [] };
    const d = await data();
    const msg = reply('end',
      `Thank you for chatting with SPOUZY${user.first_name ? ', ' + user.first_name : ''}. ` +
      (reason === 'idle' ? 'This chat was closed because there was no reply for a while. ' : '') +
      `If you have any other question, just type it here and I will help. You can also reach us on WhatsApp at ${d.whatsapp}.`,
      [], ['Prices', 'Packages']);
    if (conv.status === 'open') {
      await saveMessage(conv, 'bot', msg.text, { intent: 'end' });
      await conv.update({ status: 'ended', ended_reason: ['idle', 'closed', 'user'].includes(reason) ? reason : 'closed', ended_at: new Date(), message_count: conv.message_count + 1 });
    }
    return { ended: true, messages: [{ text: msg.text, links: [], chips: msg.chips }] };
  }

  // ------------------------------------------------------------------ admin
  async listConversations({ page = 1, limit = 25, unansweredOnly, search } = {}) {
    const where = {};
    if (unansweredOnly === true || unansweredOnly === 'true') where.unanswered_count = { [Op.gt]: 0 };
    const include = [{ model: models.User, as: 'customer', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }];
    if (search) {
      const qq = `%${String(search).trim()}%`;
      where[Op.or] = [{ '$customer.email$': { [Op.like]: qq } }, { '$customer.first_name$': { [Op.like]: qq } }, { '$customer.phone$': { [Op.like]: qq } }];
    }
    const lim = Math.min(100, parseInt(limit, 10) || 25);
    const { count, rows } = await models.ChatConversation.findAndCountAll({
      where, include, order: [['last_message_at', 'DESC'], ['id', 'DESC']], limit: lim, offset: (Math.max(1, parseInt(page, 10)) - 1) * lim, subQuery: false
    });
    const ids = rows.map(r => r.id);
    const firstQs = ids.length ? await models.ChatMessage.findAll({ where: { conversation_id: ids, sender: 'user' }, order: [['sent_at', 'ASC']], attributes: ['conversation_id', 'text'] }) : [];
    return {
      total: count,
      conversations: rows.map(c => {
        const fq = firstQs.find(m => m.conversation_id === c.id);
        return {
          id: c.id, status: c.status, ended_reason: c.ended_reason, page: c.page, message_count: c.message_count, unanswered_count: c.unanswered_count,
          started_at: c.createdAt, last_message_at: c.last_message_at, first_question: fq ? fq.text : null,
          customer: c.customer ? { id: c.customer.id, name: `${c.customer.first_name || ''} ${c.customer.last_name || ''}`.trim(), email: c.customer.email, phone: c.customer.phone } : null
        };
      })
    };
  }

  async getConversation(id) {
    const conv = await models.ChatConversation.findByPk(id, { include: [{ model: models.User, as: 'customer', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] }] });
    if (!conv) { const e = new Error('Conversation not found'); e.status = 404; throw e; }
    const messages = await models.ChatMessage.findAll({ where: { conversation_id: conv.id }, order: [['sent_at', 'ASC'], ['id', 'ASC']] });
    return {
      id: conv.id, status: conv.status, ended_reason: conv.ended_reason, page: conv.page, started_at: conv.createdAt, ended_at: conv.ended_at,
      customer: conv.customer ? { id: conv.customer.id, name: `${conv.customer.first_name || ''} ${conv.customer.last_name || ''}`.trim(), email: conv.customer.email, phone: conv.customer.phone } : null,
      messages: messages.map(m => ({ id: m.id, sender: m.sender, text: m.text, intent: m.intent, matched: m.matched, at: m.sent_at }))
    };
  }

  async unanswered({ days = 30, limit = 100 } = {}) {
    const since = new Date(Date.now() - Math.min(365, parseInt(days, 10) || 30) * 24 * 3600 * 1000);
    const rows = await models.ChatMessage.findAll({
      where: { sender: 'user', matched: false, sent_at: { [Op.gte]: since } },
      include: [{ model: models.ChatConversation, as: 'conversation', attributes: ['id', 'user_id'] }],
      order: [['sent_at', 'DESC']],
      limit: Math.min(500, parseInt(limit, 10) || 100)
    });
    return rows.map(m => ({ id: m.id, text: m.text, at: m.sent_at, conversation_id: m.conversation_id }));
  }

  async stats() {
    const today = new Date(Date.now() - 24 * 3600 * 1000);
    const [chatsToday, unanswered7] = await Promise.all([
      models.ChatConversation.count({ where: { createdAt: { [Op.gte]: today } } }),
      models.ChatMessage.count({ where: { sender: 'user', matched: false, sent_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } })
    ]);
    return { chatsLast24h: chatsToday, unansweredLast7Days: unanswered7 };
  }
}

const chatService = new ChatService();
chatService._answer = answer; // used by tests
chatService._normalize = normalize;
module.exports = chatService;
