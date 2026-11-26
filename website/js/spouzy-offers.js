/**
 * SPOUZY offers popup and homepage package cards (loaded on every page by spouzy-content.js).
 *
 * Offers (GET /api/offers, uploaded in Admin → Packages & Orders → Offers)
 *  - With no live offer nothing appears: no popup, no tab.
 *  - The popup opens by itself once, after the first-visit intro, about 6 seconds after the page
 *    loads (or earlier when the visitor scrolls). Never on the packages, cart, login, account or
 *    booking pages. Closing it keeps it closed for 24 hours, until a new offer is added.
 *  - A small "Offers" tab at the bottom left reopens it at any time.
 *  - Several offers show as slides. "Claim this offer" puts the package in the cart
 *    (or asks the visitor to log in first and then adds it).
 *  - ?offers=1 in the address opens the popup straight away (handy for checking a new offer).
 *
 * Homepage (the "Specialized Care" section, [data-live-packages])
 *  - The cards are filled with the live packages (first six, same card design); a package with
 *    a live offer shows the offer on its card. Without the server the original cards stay.
 */
(function () {
  'use strict';

  if (window.SpouzyOffers) return;

  const API = '/api';
  const PENDING_KEY = 'spouzyPendingAdd';
  const DISMISS_KEY = 'spouzy_offers_dismissed';
  const DISMISS_MS = 24 * 60 * 60 * 1000;
  const OPEN_AFTER_MS = 6000;
  const page = (window.location.pathname.split('/').pop() || 'index.htm').toLowerCase();
  const NO_AUTO = ['packages.htm', 'cart.htm', 'register.htm', 'create-account.htm', 'account.htm', 'book-appoinment.htm', 'appointment.htm', 'under-construction.htm'];
  const NO_TAB = ['cart.htm', 'register.htm', 'create-account.htm', 'book-appoinment.htm', 'appointment.htm', 'under-construction.htm'];
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function inr(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }
  function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function niceDate(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd + 'T12:00:00+05:30');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }
  function shortDate(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd + 'T12:00:00+05:30');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  }
  /** Image paths from the admin: "image/..." or "/media/public/..." or https://... */
  function imgSrc(p) {
    const v = String(p || '').trim();
    if (!v || /^(javascript|data|vbscript):/i.test(v)) return '';
    return v;
  }
  /** Links from the admin: our own pages or https://... */
  function safeHref(u) {
    const v = String(u || '').trim();
    return /^(https:\/\/|\/?[a-z0-9][a-z0-9\-/]*\.html?([?#].*)?$|#[a-z0-9-]+$)/i.test(v) ? v : 'packages.htm';
  }
  function store(kind, fn) {
    try { return fn(kind === 'local' ? window.localStorage : window.sessionStorage); } catch (e) { return null; }
  }
  async function getJson(path) {
    try {
      const res = await fetch(API + path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const json = await res.json();
      return json && json.success !== false ? json.data : null;
    } catch (e) {
      return null; // static copy of the website (no server): keep the page as it is
    }
  }
  async function ensureCsrf() {
    if (!readCookie('spouzy_csrf')) {
      try { await fetch(API + '/health', { credentials: 'same-origin' }); } catch (e) { /* ignore */ }
    }
  }
  function goLogin(slug) {
    store('session', s => s.setItem(PENDING_KEY, slug));
    window.location.href = 'register.htm?next=cart.htm';
  }
  /** Put a package in the cart: 'added', or the visitor is sent to log in first */
  async function addToCart(slug) {
    if (readCookie('spouzy_customer') !== '1') { goLogin(slug); return 'redirect'; }
    await ensureCsrf();
    const res = await fetch(API + '/customer/cart', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': readCookie('spouzy_csrf') },
      body: JSON.stringify({ packageSlug: slug })
    });
    if (res.status === 401) { goLogin(slug); return 'redirect'; }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || 'Could not add the package. Please try again.');
    try { document.dispatchEvent(new CustomEvent('spouzy:cart', { detail: { count: json.data && json.data.count } })); } catch (e) { /* old browsers */ }
    return 'added';
  }

  const ICONS = {
    tag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    gift: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14h4"/></svg>',
    hearts: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 15 11c0 .5-.1 1-.3 1.5"/><path d="M17 21s-4-2.4-4-5.3a2.2 2.2 0 0 1 4-1.2 2.2 2.2 0 0 1 4 1.2C21 18.6 17 21 17 21Z"/></svg>',
    care: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c2.5 2.4 5.6 3.6 8 4v5.5c0 4.6-3.4 7.6-8 9.5-4.6-1.9-8-4.9-8-9.5V7c2.4-.4 5.5-1.6 8-4Z"/><path d="M12 9v6M9 12h6"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/></svg>'
  };

  // ---------------------------------------------------------------------------
  // Offers popup
  // ---------------------------------------------------------------------------
  const Popup = (function () {
    let offers = [];
    let root = null;
    let tab = null;
    let index = 0;
    let lastFocus = null;
    let sig = '';

    function signature(list) {
      return list.map(o => o.id + ':' + (o.end_date || '')).join('|');
    }
    function dismissedRecently() {
      const d = store('local', s => JSON.parse(s.getItem(DISMISS_KEY) || 'null'));
      return !!(d && d.sig === sig && Date.now() - d.at < DISMISS_MS);
    }
    function rememberDismiss() {
      store('local', s => s.setItem(DISMISS_KEY, JSON.stringify({ sig, at: Date.now() })));
    }

    function slideHtml(o, i, total) {
      const pkg = o.package;
      const offerPrice = pkg && pkg.offer_price_inr;
      const titleId = 'spOfferTitle' + o.id;
      const cta = o.cta_label || (pkg ? 'View package' : 'Learn more');
      const ctaAttrs = pkg
        ? 'type="button" data-offer-claim="' + esc(pkg.slug) + '"'
        : 'href="' + esc(safeHref(o.cta_url)) + '"' + (/^https:/i.test(o.cta_url || '') ? ' target="_blank" rel="noopener"' : '');
      const ctaTag = pkg ? 'button' : 'a';
      return '<article class="sp-offer-slide" data-slide="' + i + '" role="group" aria-roledescription="offer" aria-label="Offer ' + (i + 1) + ' of ' + total + '" aria-labelledby="' + titleId + '"' + (i === index ? '' : ' hidden') + '>' +
        '<div class="sp-offer-media">' +
          '<img src="' + esc(imgSrc(o.image_url)) + '" alt="' + esc(o.image_alt || o.title) + '" decoding="async">' +
        '</div>' +
        '<div class="sp-offer-body">' +
          '<div class="sp-offer-kicker">' + (o.badge_text ? '<span class="sp-offer-badge">' + esc(o.badge_text) + '</span>' : '') + '<span class="sp-offer-kicker-text">' + ICONS.tag + ' SPOUZY offer</span></div>' +
          '<h2 class="sp-offer-title" id="' + titleId + '">' + esc(o.title) + '</h2>' +
          (o.description ? '<p class="sp-offer-text">' + esc(o.description) + '</p>' : '') +
          (pkg ? '<div class="sp-offer-price">' +
            (offerPrice
              ? '<strong>' + inr(offerPrice) + '</strong><s aria-label="Normal price ' + inr(pkg.price_inr) + '">' + inr(pkg.price_inr) + '</s><span class="sp-offer-save">Save ' + inr(pkg.price_inr - offerPrice) + '</span>'
              : '<strong>' + (pkg.is_free ? 'Free' : inr(pkg.price_inr)) + '</strong>') +
            '<small>' + esc(pkg.name) + '</small></div>' : '') +
          (o.end_date ? '<p class="sp-offer-valid">Offer valid till ' + esc(niceDate(o.end_date)) + '</p>' : '') +
          '<div class="sp-offer-actions">' +
            '<' + ctaTag + ' class="sp-offer-cta" ' + ctaAttrs + ' aria-label="' + esc(o.title + ': ' + cta) + '">' + esc(cta) + '</' + ctaTag + '>' +
            '<button type="button" class="sp-offer-later" data-offers-close>Maybe later</button>' +
          '</div>' +
          (pkg ? '<a class="sp-offer-details" href="packages.htm#pkg-' + esc(pkg.slug) + '">See what the package includes</a>' : '') +
          '<p class="sp-offer-error" role="alert" hidden></p>' +
          (o.terms ? '<p class="sp-offer-terms">' + esc(o.terms) + '</p>' : '') +
        '</div>' +
      '</article>';
    }

    function build() {
      if (root) return;
      root = document.createElement('div');
      root.className = 'sp-offers';
      root.hidden = true;
      const total = offers.length;
      root.innerHTML =
        '<div class="sp-offers-backdrop" data-offers-close></div>' +
        '<div class="sp-offers-dialog" role="dialog" aria-modal="true" aria-label="Current offers" tabindex="-1">' +
          '<button type="button" class="sp-offers-close" data-offers-close aria-label="Close offers">' + ICONS.close + '</button>' +
          '<div class="sp-offers-track">' + offers.map((o, i) => slideHtml(o, i, total)).join('') + '</div>' +
          (total > 1
            ? '<div class="sp-offers-nav">' +
                '<button type="button" class="sp-offers-arrow" data-offers-step="-1" aria-label="Previous offer">' + ICONS.prev + '</button>' +
                '<div class="sp-offers-dots" role="tablist" aria-label="Choose an offer">' +
                  offers.map((o, i) => '<button type="button" role="tab" class="sp-offers-dot" data-offers-go="' + i + '" aria-label="Offer ' + (i + 1) + ': ' + esc(o.title) + '"></button>').join('') +
                '</div>' +
                '<button type="button" class="sp-offers-arrow" data-offers-step="1" aria-label="Next offer">' + ICONS.next + '</button>' +
              '</div>'
            : '') +
        '</div>';
      document.body.appendChild(root);

      root.addEventListener('click', e => {
        const closeBtn = e.target.closest('[data-offers-close]');
        if (closeBtn) { close(); return; }
        const step = e.target.closest('[data-offers-step]');
        if (step) { show(index + Number(step.getAttribute('data-offers-step'))); return; }
        const go = e.target.closest('[data-offers-go]');
        if (go) { show(Number(go.getAttribute('data-offers-go'))); return; }
        const claim = e.target.closest('[data-offer-claim]');
        if (claim) { claimOffer(claim); return; }
        if (e.target.closest('.sp-offer-cta, .sp-offer-details')) rememberDismiss();
      });
      // Keys work wherever the focus is while the popup is open
      document.addEventListener('keydown', e => {
        if (!root || root.hidden) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === 'ArrowRight' && offers.length > 1) { show(index + 1); return; }
        if (e.key === 'ArrowLeft' && offers.length > 1) { show(index - 1); return; }
        if (e.key === 'Tab') trapFocus(e);
      });
      // Swipe between offers on touch screens
      let startX = null;
      const track = root.querySelector('.sp-offers-track');
      track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
      track.addEventListener('touchend', e => {
        if (startX === null || offers.length < 2) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
        startX = null;
      }, { passive: true });
      // An offer whose image fails to load is left out
      root.querySelectorAll('.sp-offer-media img').forEach(img => {
        img.addEventListener('error', () => {
          const slide = img.closest('.sp-offer-slide');
          if (slide) slide.classList.add('is-noimage');
        });
      });
    }

    function trapFocus(e) {
      const items = Array.from(root.querySelectorAll('.sp-offers-dialog button, .sp-offers-dialog a[href]'))
        .filter(el => !el.closest('[hidden]') && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!root.contains(document.activeElement) || document.activeElement === root.querySelector('.sp-offers-dialog')) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function show(i) {
      const n = offers.length;
      index = ((i % n) + n) % n;
      root.querySelectorAll('.sp-offer-slide').forEach(s => {
        const on = Number(s.getAttribute('data-slide')) === index;
        s.hidden = !on;
        if (on && !reduceMotion) { s.classList.remove('is-in'); void s.offsetWidth; s.classList.add('is-in'); }
      });
      root.querySelectorAll('.sp-offers-dot').forEach((d, k) => {
        d.classList.toggle('is-active', k === index);
        d.setAttribute('aria-selected', k === index ? 'true' : 'false');
      });
      // Focus was on a button of the slide that is now hidden: keep it inside the popup
      const active = document.activeElement;
      if (!root.hidden && (!active || active === document.body || active.closest('.sp-offer-slide[hidden]'))) {
        const dialog = root.querySelector('.sp-offers-dialog');
        try { dialog.focus({ preventScroll: true }); } catch (e) { dialog.focus(); }
      }
    }

    async function claimOffer(btn) {
      const slug = btn.getAttribute('data-offer-claim');
      const slide = btn.closest('.sp-offer-slide');
      const err = slide && slide.querySelector('.sp-offer-error');
      rememberDismiss();
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = 'Adding…';
      try {
        const result = await addToCart(slug);
        if (result === 'added') {
          btn.textContent = 'Added · opening cart';
          window.location.href = 'cart.htm';
        }
      } catch (ex) {
        btn.disabled = false;
        btn.textContent = label;
        if (err) { err.textContent = ex.message; err.hidden = false; }
      }
    }

    function open(atId, auto) {
      if (!offers.length) return;
      build();
      const at = atId ? offers.findIndex(o => String(o.id) === String(atId)) : 0;
      index = at >= 0 ? at : 0;
      show(index);
      lastFocus = document.activeElement;
      root.hidden = false;
      document.documentElement.classList.add('sp-offers-open');
      requestAnimationFrame(() => root.classList.add('is-open'));
      if (tab) tab.classList.add('is-hidden');
      const dialog = root.querySelector('.sp-offers-dialog');
      setTimeout(() => {
        const first = root.querySelector('.sp-offer-slide:not([hidden]) .sp-offer-cta') || dialog;
        try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      }, auto ? 350 : 60);
    }

    function close() {
      if (!root || root.hidden) return;
      rememberDismiss();
      root.classList.remove('is-open');
      document.documentElement.classList.remove('sp-offers-open');
      const finish = () => { root.hidden = true; };
      if (reduceMotion) finish(); else setTimeout(finish, 260);
      if (tab) tab.classList.remove('is-hidden');
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }

    function makeTab() {
      if (NO_TAB.includes(page) || tab) return;
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'sp-offers-tab';
      tab.setAttribute('aria-label', 'See current offers (' + offers.length + ')');
      tab.innerHTML = ICONS.tag + '<span class="sp-offers-tab-text">Offers</span><span class="sp-offers-tab-count">' + offers.length + '</span>';
      tab.addEventListener('click', () => open(null, false));
      document.body.appendChild(tab);
      requestAnimationFrame(() => tab.classList.add('is-in'));
    }

    /** Something else is on screen (first-visit intro, chat, login popup, menu): wait */
    function busy() {
      const html = document.documentElement;
      if (html.classList.contains('sp-intro-on') || document.getElementById('sp-intro')) return true;
      if (document.body.classList.contains('sp-chat-open')) return true;
      const chat = document.querySelector('.sp-chat');
      if (chat && !chat.hidden && chat.offsetParent !== null) return true;
      if (document.querySelector('.sp-gate-backdrop:not([hidden]), .sp-search-modal.is-open, .sp-mobile-drawer.is-open, .modal.in')) return true;
      return false;
    }

    function preload(src) {
      return new Promise(resolve => {
        if (!src) return resolve(false);
        const img = new Image();
        const t = setTimeout(() => resolve(true), 4000);
        img.onload = () => { clearTimeout(t); resolve(true); };
        img.onerror = () => { clearTimeout(t); resolve(false); };
        img.src = src;
      });
    }

    function scheduleAuto(force) {
      const auto = offers.filter(o => o.show_popup);
      if (!auto.length) return;
      if (!force && (NO_AUTO.includes(page) || dismissedRecently())) return;
      const started = Date.now();
      let done = false;
      const tryOpen = async () => {
        if (done) return;
        if (busy()) { setTimeout(tryOpen, 1200); return; }
        done = true;
        window.removeEventListener('scroll', onScroll);
        const ok = await preload(imgSrc(auto[0].image_url));
        if (!ok && auto.length === 1) return;
        open(auto[0].id, true);
      };
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0 && window.scrollY / max > 0.35 && Date.now() - started > 2500) tryOpen();
      };
      if (force) { setTimeout(tryOpen, 300); return; }
      window.addEventListener('scroll', onScroll, { passive: true });
      setTimeout(tryOpen, OPEN_AFTER_MS);
    }

    async function init() {
      const data = await getJson('/offers');
      offers = (data && Array.isArray(data.offers) ? data.offers : []).filter(o => imgSrc(o.image_url));
      if (!offers.length) return; // no live offer: no popup, no tab
      sig = signature(offers);
      makeTab();
      scheduleAuto(/[?&]offers=1\b/.test(window.location.search));
      document.addEventListener('click', e => {
        const opener = e.target.closest('[data-offer-open]');
        if (!opener) return;
        e.preventDefault();
        open(opener.getAttribute('data-offer-open'), false);
      });
    }

    return { init, open, has: id => offers.some(o => String(o.id) === String(id)), count: () => offers.length };
  })();

  // ---------------------------------------------------------------------------
  // Homepage: package cards in the "Specialized Care" section
  // ---------------------------------------------------------------------------
  function iconFor(p) {
    const key = (p.slug + ' ' + p.name).toLowerCase();
    if (p.is_free) return ICONS.gift;
    if (/couple|marri|relation/.test(key)) return ICONS.hearts;
    if (/complete|program|care|intima|doctor|clinic/.test(key)) return ICONS.care;
    if (p.sessions_included === 1 || /single|session|consult/.test(key)) return ICONS.chat;
    return ICONS.spark;
  }

  function cardInner(p) {
    const offer = p.offer;
    const tagText = p.badge || (p.is_free ? 'Free' : offer && offer.has_price ? 'On offer' : p.sessions_included + (p.sessions_included === 1 ? ' session' : ' sessions'));
    const highlight = !!(p.badge || (offer && offer.has_price));
    const detailUrl = 'packages.htm#pkg-' + encodeURIComponent(p.slug);
    const meta = p.sessions_included + (p.sessions_included === 1 ? ' session' : ' sessions') + ' × ' + p.session_minutes + ' min' + (p.validity_days ? ' · valid ' + p.validity_days + ' days' : '');
    const text = p.tagline || p.description || '';
    const features = (p.features || []).slice(0, 3);
    const offerLine = offer
      ? '<button type="button" class="sp-pkg-offer" data-offer-open="' + offer.id + '" aria-label="' + esc('Offer: ' + offer.title + (offer.end_date ? ', valid till ' + niceDate(offer.end_date) : '')) + '">' +
          ICONS.tag + '<b>' + esc(offer.badge_text || 'Offer') + '</b><span>' + esc(offer.title) + (offer.end_date ? ' · till ' + esc(shortDate(offer.end_date)) : '') + '</span></button>'
      : '';
    const price = p.is_free
      ? '<strong>Free</strong>'
      : '<strong>' + inr(p.price_inr) + '</strong>' +
        (p.compare_at_inr && p.compare_at_inr > p.price_inr ? '<s aria-label="Normal price ' + inr(p.compare_at_inr) + '">' + inr(p.compare_at_inr) + '</s>' : '') +
        (offer && offer.has_price && offer.save_inr ? '<span class="sp-pkg-save">Save ' + inr(offer.save_inr) + '</span>' : '');
    return '<div class="sp-card-badge-row">' +
        '<div class="sp-card-icon-modern">' + iconFor(p) + '</div>' +
        '<span class="sp-card-tag' + (highlight ? ' highlight' : '') + '">' + esc(tagText) + '</span>' +
      '</div>' +
      offerLine +
      '<h3 class="sp-card-title"><a href="' + detailUrl + '">' + esc(p.name) + '</a></h3>' +
      '<div class="sp-pkg-price">' + price + '</div>' +
      '<p class="sp-pkg-meta">' + esc(meta) + '</p>' +
      '<p class="sp-card-text">' + esc(text) + '</p>' +
      (features.length ? '<ul class="sp-card-bullets">' + features.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') +
      '<div class="sp-card-action-row">' +
        '<a href="' + detailUrl + '" class="sp-card-link-btn" data-home-add="' + esc(p.slug) + '" aria-label="' + esc((p.is_free ? 'Claim ' : 'Add to cart: ') + p.name) + '">' + (p.is_free ? 'Claim free' : 'Add to cart') + ' →</a>' +
        '<a href="' + detailUrl + '" class="sp-pkg-more">Details</a>' +
      '</div>';
  }

  async function initHomePackages() {
    const grid = document.querySelector('[data-live-packages]');
    if (!grid) return;
    const data = await getJson('/packages');
    const list = data && Array.isArray(data.packages) ? data.packages.slice(0, 6) : [];
    if (!list.length) return; // no server or no packages: keep the original cards
    const cards = Array.from(grid.children).filter(el => el.classList.contains('sp-service-card-modern'));
    if (!cards.length) return;
    grid.classList.add('is-packages', 'is-swapping');
    list.forEach((p, i) => {
      let card = cards[i];
      if (!card) { card = cards[0].cloneNode(false); grid.appendChild(card); }
      card.hidden = false;
      card.classList.add('sp-pkg-card');
      card.classList.toggle('has-offer', !!p.offer);
      card.id = 'home-pkg-' + p.slug;
      card.innerHTML = cardInner(p);
    });
    cards.slice(list.length).forEach(c => { c.hidden = true; });
    grid.setAttribute('aria-label', 'Packages and prices');
    requestAnimationFrame(() => grid.classList.remove('is-swapping'));

    // Under the cards: link to compare everything
    const section = grid.closest('section');
    if (section && !section.querySelector('.sp-pkg-home-foot')) {
      const foot = document.createElement('div');
      foot.className = 'sp-pkg-home-foot';
      foot.innerHTML = '<a href="packages.htm" class="sp-pkg-all">Compare all packages and what they include →</a>';
      grid.after(foot);
    }

    grid.addEventListener('click', async e => {
      const btn = e.target.closest('[data-home-add]');
      if (!btn) return;
      e.preventDefault();
      if (btn.classList.contains('is-added')) { window.location.href = 'cart.htm'; return; }
      const slug = btn.getAttribute('data-home-add');
      const before = btn.textContent;
      btn.textContent = 'Adding…';
      try {
        const r = await addToCart(slug);
        if (r === 'added') { btn.classList.add('is-added'); btn.textContent = 'Added · View cart →'; }
      } catch (ex) {
        btn.textContent = before;
        btn.title = ex.message;
      }
    });
    // An offer on a card that is not in the popup list (e.g. popup switched off) opens the package instead
    grid.querySelectorAll('[data-offer-open]').forEach(b => {
      b.addEventListener('click', e => {
        if (Popup.has(b.getAttribute('data-offer-open'))) return;
        e.preventDefault();
        e.stopPropagation();
        const card = b.closest('.sp-pkg-card');
        const link = card && card.querySelector('.sp-card-title a');
        if (link) window.location.href = link.getAttribute('href');
      }, true);
    });
  }

  function boot() {
    Popup.init();
    initHomePackages();
  }
  window.SpouzyOffers = { open: (id) => Popup.open(id, false) };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
