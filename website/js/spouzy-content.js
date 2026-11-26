/**
 * SPOUZY Website Content Loader
 * Applies what staff edit in the admin panel to the public pages:
 *   - announcement bar, phone, WhatsApp and email links, cursors   (all pages)
 *   - footer social profile links                                    (all pages)
 *   - hero banners and homepage section headings                     (index.htm)
 *   - loads js/spouzy-faqs.js (FAQ page, homepage questions, What We Do pages)
 *     and js/spouzy-stories.js (client stories: homepage, testimonials page, My account)
 *   - career openings                                                (careers.htm)
 *
 * The HTML already on each page is the fallback: if the API is unreachable or a value
 * is empty, nothing is changed. Exposes window.SpouzySiteSettings for other scripts.
 */
(function () {
  'use strict';

  const API = '/api';
  const DEFAULT_WA_DIGITS = '918591945055';
  const DEFAULT_PHONE_TEXTS = ['+91 85919 45055', '+91 8591945055', '+918591945055', '85919 45055'];

  function getJson(path) {
    return fetch(API + path, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.success !== false ? j.data : null))
      .catch(() => null);
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function digitsOf(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function formatIndianNumber(raw) {
    const d = digitsOf(raw);
    if (d.length === 12 && d.startsWith('91')) return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
    return String(raw || '').trim();
  }

  // Replace the default number in visible text (header, footer, widgets) only
  function replaceTextEverywhere(oldTexts, newText) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest('form')) return NodeFilter.FILTER_REJECT;
        return oldTexts.some(t => node.nodeValue.includes(t)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      let v = n.nodeValue;
      oldTexts.forEach(t => { v = v.split(t).join(newText); });
      n.nodeValue = v;
    });
  }

  // ---------------------------------------------------------------------------
  // Site settings (all pages)
  // ---------------------------------------------------------------------------
  function applySettings(settings) {
    if (!settings) return;
    window.SpouzySiteSettings = settings;

    if (settings.announcement_text && settings.announcement_text.trim()) {
      document.querySelectorAll('.sp-topbar-sentence').forEach(el => { el.textContent = settings.announcement_text.trim(); });
    }

    const waDigits = digitsOf(settings.whatsapp_number);
    if (waDigits.length >= 10 && waDigits !== DEFAULT_WA_DIGITS) {
      document.querySelectorAll('a[href*="wa.me/"]').forEach(a => {
        a.href = a.href.replace(/wa\.me\/\d+/, 'wa.me/' + waDigits);
      });
    }

    const phoneDigits = digitsOf(settings.contact_phone);
    if (phoneDigits.length >= 10 && phoneDigits !== DEFAULT_WA_DIGITS) {
      document.querySelectorAll('a[href^="tel:"]').forEach(a => { a.href = 'tel:+' + phoneDigits; });
      replaceTextEverywhere(DEFAULT_PHONE_TEXTS, formatIndianNumber(settings.contact_phone));
    }

    const email = (settings.support_email || '').trim();
    if (email && /@/.test(email)) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
        const wasEmailText = /@/.test(a.textContent);
        a.href = 'mailto:' + email;
        if (wasEmailText) a.textContent = email;
      });
    }

    if (String(settings.cursor_enabled).toLowerCase() === 'false') {
      const style = document.createElement('style');
      style.textContent = 'html, body, body * { cursor: auto !important; } a, button, [role="button"], label, select, summary { cursor: pointer !important; } input, textarea { cursor: text !important; }';
      document.head.appendChild(style);
    }

    document.dispatchEvent(new CustomEvent('spouzy:settings', { detail: settings }));
  }

  // ---------------------------------------------------------------------------
  // Footer social links (all pages)
  // ---------------------------------------------------------------------------
  function applySocialLinks(links) {
    if (!links) return;
    const map = { facebook: '.sp-social-fb', x: '.sp-social-x', linkedin: '.sp-social-li', instagram: '.sp-social-ig' };
    const names = { facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn', instagram: 'Instagram' };
    Object.keys(map).forEach(key => {
      const url = links[key];
      if (!url || !/^https:\/\//i.test(url)) return;
      document.querySelectorAll(map[key]).forEach(el => {
        if (el.tagName === 'A') {
          el.href = url;
          el.setAttribute('aria-label', 'Visit SPOUZY on ' + names[key]);
        } else {
          // Placeholder <span> (e.g. Instagram before a profile existed) → real link
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = el.className.replace('sp-social-placeholder', '').trim();
          a.setAttribute('aria-label', 'Visit SPOUZY on ' + names[key]);
          a.innerHTML = el.innerHTML;
          el.replaceWith(a);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Homepage: hero banners (updates the existing slides in place)
  // ---------------------------------------------------------------------------
  function applyHeroBanners(banners) {
    const container = document.querySelector('.sp-hero-banner-slides');
    let slides = Array.from(document.querySelectorAll('.sp-hero-banner-slides .sp-hero-banner-slide'));
    if (!container || !slides.length || !Array.isArray(banners) || !banners.length) return;
    // Match the number of slides to the published banners: copy the last slide for extra
    // banners, hide built-in slides that have no banner.
    const MAX_SLIDES = 8;
    banners = banners.slice(0, MAX_SLIDES);
    while (slides.length < banners.length) {
      const copy = slides[slides.length - 1].cloneNode(true);
      copy.classList.remove('is-active');
      copy.setAttribute('data-slide', String(slides.length));
      copy.querySelectorAll('h1').forEach(h1 => {
        const h2 = document.createElement('h2');
        h2.className = h1.className;
        h2.innerHTML = h1.innerHTML;
        h1.replaceWith(h2);
      });
      container.appendChild(copy);
      slides.push(copy);
    }
    slides.forEach((slide, i) => {
      if (i < banners.length) slide.removeAttribute('hidden');
      else { slide.setAttribute('hidden', ''); slide.classList.remove('is-active'); }
    });
    if (!slides.slice(0, banners.length).some(s => s.classList.contains('is-active'))) slides[0].classList.add('is-active');
    const total = String(banners.length).padStart(2, '0');
    banners.forEach((b, i) => {
      const slide = slides[i];
      const num = String(i + 1).padStart(2, '0');
      const img = slide.querySelector('img.sp-banner-bg-img');
      const useMobile = b.mobile_image_path && window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      const chosen = useMobile ? b.mobile_image_path : b.image_path;
      if (img && chosen) {
        const src = /^(https?:)?\//.test(chosen) ? chosen : chosen.replace(/^\.?\//, '');
        // Keep the slide's built-in photo as a fallback: a missing file never shows a broken image
        if (!img.dataset.fallbackSrc) img.dataset.fallbackSrc = img.getAttribute('src') || '';
        if (!img.dataset.fallbackBound) {
          img.dataset.fallbackBound = '1';
          img.addEventListener('error', () => {
            const fb = img.dataset.fallbackSrc;
            if (fb && img.getAttribute('src') !== fb) img.setAttribute('src', fb);
          });
        }
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
        if (b.alt_text) img.alt = b.alt_text;
      }
      const tag = slide.querySelector('.sp-banner-eyebrow-tag');
      if (tag && b.tag_eyebrow) tag.textContent = num + ' / ' + total + ' • ' + b.tag_eyebrow.replace(/^\d+\s*\/\s*\d+\s*•\s*/, '');
      const sub = slide.querySelector('.sp-banner-eyebrow-sub');
      if (sub && b.category_sub) sub.innerHTML = '<span class="sp-pulse-dot"></span> ' + esc(b.category_sub);
      const h = slide.querySelector('.sp-banner-headline');
      if (h && b.headline) {
        h.innerHTML = esc(b.headline) + (b.headline_emphasis ? '<br><em class="sp-text-shimmer">' + esc(b.headline_emphasis) + '</em>' : '');
      }
      const desc = slide.querySelector('.sp-banner-desc');
      if (desc && b.description) desc.textContent = b.description;
      const pillsWrap = slide.querySelector('.sp-banner-pills');
      let pills = b.pills;
      if (typeof pills === 'string') { try { pills = JSON.parse(pills); } catch (e) { pills = []; } }
      if (pillsWrap && Array.isArray(pills)) {
        pillsWrap.innerHTML = pills.map(p => '<span class="sp-banner-pill-item">• ' + esc(p) + '</span>').join('');
        pillsWrap.style.display = pills.length ? '' : 'none';
      }
      const primary = slide.querySelector('.sp-banner-btn-primary');
      if (primary && b.cta_label) { primary.textContent = b.cta_label; if (b.cta_url) primary.setAttribute('href', b.cta_url); }
      const secondary = slide.querySelector('.sp-banner-btn-secondary');
      if (secondary) {
        if (b.secondary_cta_label) {
          secondary.textContent = b.secondary_cta_label;
          if (b.secondary_cta_url) secondary.setAttribute('href', b.secondary_cta_url);
          secondary.style.display = '';
        } else {
          secondary.style.display = 'none';
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Homepage: section headings
  // ---------------------------------------------------------------------------
  function applyHomepageSections(sections) {
    if (!Array.isArray(sections)) return;
    sections.forEach(sec => {
      const el = document.querySelector('[data-section-key="' + sec.section_key + '"]');
      if (!el) return;
      if (sec.is_visible === false || sec.is_visible === 0) { el.style.display = 'none'; return; }
      let extra = sec.content_json;
      if (typeof extra === 'string') { try { extra = JSON.parse(extra); } catch (e) { extra = {}; } }
      extra = extra || {};
      const kicker = el.querySelector('.sp-section-kicker');
      if (kicker && extra.kicker) kicker.textContent = extra.kicker;
      const title = el.querySelector('.sp-section-title');
      if (title && sec.headline) {
        title.innerHTML = esc(sec.headline) + (extra.emphasis ? ' <span class="sp-text-shimmer">' + esc(extra.emphasis) + '</span>' : '');
      }
      const subtitle = el.querySelector('.sp-section-subtitle');
      if (subtitle && sec.subheadline) subtitle.textContent = sec.subheadline;
    });
  }

  // FAQs (faq.htm, homepage, What We Do pages): js/spouzy-faqs.js
  // Client stories (homepage, testimonials page, account): js/spouzy-stories.js

  function normalise(t) {
    return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // ---------------------------------------------------------------------------
  // Careers page: job cards follow the openings managed in the admin panel
  // ---------------------------------------------------------------------------
  function listHtml(items) {
    let arr = items;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
    return Array.isArray(arr) ? arr.map(i => '<li>' + esc(i) + '</li>').join('') : '';
  }

  function slugify(t) {
    return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function wireCard(card, opening) {
    const toggle = card.querySelector('.sp-role-toggle-btn');
    const panel = card.querySelector('.sp-role-detail-panel');
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
        const txt = toggle.querySelector('.sp-toggle-text');
        if (txt) txt.textContent = open ? 'View Role Details' : 'Hide Role Details';
      });
    }
    const apply = card.querySelector('.sp-role-apply-btn');
    if (apply) {
      apply.addEventListener('click', function () {
        const select = document.getElementById('spCareerRole');
        if (select) {
          const opt = Array.from(select.options).find(o => o.value === opening.title);
          if (opt) select.value = opt.value;
        }
      });
    }
  }

  function applyOpenings(openings) {
    const cards = Array.from(document.querySelectorAll('article.sp-job-card'));
    if (!cards.length || !Array.isArray(openings) || !openings.length) return;
    const template = cards[0];
    const byTitle = {};
    cards.forEach(c => {
      const t = c.querySelector('.sp-job-card-title');
      if (t) byTitle[normalise(t.textContent)] = c;
    });

    const keep = new Set();
    let insertAfter = cards[cards.length - 1];
    openings.forEach(op => {
      let card = byTitle[normalise(op.title)];
      if (!card) {
        card = template.cloneNode(true);
        const slug = op.slug || slugify(op.title);
        card.id = 'role-' + slug;
        const panel = card.querySelector('.sp-role-detail-panel');
        if (panel) { panel.id = 'details-' + slug; panel.hidden = true; }
        const toggle = card.querySelector('.sp-role-toggle-btn');
        if (toggle) { toggle.setAttribute('aria-controls', 'details-' + slug); toggle.setAttribute('aria-expanded', 'false'); }
        insertAfter.after(card);
        insertAfter = card;
        card.dataset.fromApi = '1';
        wireCard(card, op);
      }
      keep.add(card);
      const dept = card.querySelector('.sp-job-dept-badge');
      if (dept && op.department) dept.textContent = op.department;
      const title = card.querySelector('.sp-job-card-title');
      if (title) title.textContent = op.title;
      const summary = card.querySelector('.sp-job-card-summary');
      if (summary && op.summary) summary.textContent = op.summary;
      const apply = card.querySelector('.sp-role-apply-btn');
      if (apply) apply.setAttribute('data-role-select', op.title);
      const lists = card.querySelectorAll('.sp-role-detail-panel .sp-role-list');
      const fields = [op.responsibilities, op.required_skills, op.preferred_background];
      lists.forEach((ul, i) => {
        const html = listHtml(fields[i]);
        if (html) ul.innerHTML = html;
      });
      const terms = card.querySelector('.sp-role-terms-notice span');
      if (terms && op.salary_notes) terms.textContent = op.salary_notes;
    });

    // Hide roles that are no longer open
    cards.forEach(c => { if (!keep.has(c)) c.style.display = 'none'; });
  }

  // ---------------------------------------------------------------------------
  // Floating widget: "Request a discreet callback" (saved as an enquiry)
  // ---------------------------------------------------------------------------
  function initCallbackForm() {
    const body = document.querySelector('#spFloatingPanel .sp-floating-panel-body');
    if (!body || document.getElementById('spFloatingQuickEnquiry')) return;
    const wrap = document.createElement('details');
    wrap.className = 'sp-floating-callback';
    wrap.style.cssText = 'margin:12px 0 4px 0;border-top:1px solid rgba(138,64,47,0.2);padding-top:10px;';
    wrap.innerHTML =
      '<summary style="cursor:pointer;font-weight:700;font-size:13.5px;color:#4B2030;">Request a discreet callback</summary>' +
      '<form id="spFloatingQuickEnquiry" novalidate style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">' +
      '<input name="name" type="text" maxlength="100" required placeholder="Name or alias" aria-label="Name or alias" style="padding:9px 10px;border:1px solid #d9c3b8;border-radius:8px;font-size:14px;">' +
      '<input name="phone" type="tel" required placeholder="+91 98XXX XXXXX" aria-label="Phone number" style="padding:9px 10px;border:1px solid #d9c3b8;border-radius:8px;font-size:14px;">' +
      '<select name="time" aria-label="Preferred time" style="padding:9px 10px;border:1px solid #d9c3b8;border-radius:8px;font-size:14px;">' +
      '<option value="Any time">Any time</option><option value="Morning (9am–12pm)">Morning (9am–12pm)</option>' +
      '<option value="Afternoon (12pm–4pm)">Afternoon (12pm–4pm)</option><option value="Evening (4pm–9pm)">Evening (4pm–9pm)</option></select>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.45;color:#5b3a44;">' +
      '<input type="checkbox" name="consent" required style="margin-top:3px;"> <span>I agree that SPOUZY may call me, as described in the <a href="privacy-policy.htm" style="color:#8A402F;text-decoration:underline;">Privacy Policy</a>.</span></label>' +
      '<button type="submit" class="sp-floating-btn sp-floating-btn-call" style="justify-content:center;border:none;cursor:pointer;"><i class="fa fa-phone" aria-hidden="true"></i> Request Callback</button>' +
      '<div class="sp-floating-callback-result" role="status" style="font-size:13px;line-height:1.5;"></div>' +
      '</form>';
    const anchor = body.querySelector('.sp-floating-anim-toggle-wrap');
    if (anchor) body.insertBefore(wrap, anchor); else body.appendChild(wrap);

    const form = wrap.querySelector('form');
    const result = wrap.querySelector('.sp-floating-callback-result');
    let busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      const name = form.elements.name.value.trim();
      const phone = form.elements.phone.value.trim();
      const time = form.elements.time.value;
      if (!name || digitsOf(phone).length < 10) {
        result.style.color = '#c02a2a';
        result.textContent = 'Please enter your name and a phone number with country code.';
        return;
      }
      if (!form.elements.consent.checked) {
        result.style.color = '#c02a2a';
        result.textContent = 'Please tick the consent box so we may call you.';
        return;
      }
      busy = true;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      result.style.color = '#5b3a44';
      result.textContent = 'Sending...';
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const m = document.cookie.match(/(?:^|;\s*)spouzy_csrf=([^;]+)/);
      if (m) headers['X-CSRF-Token'] = decodeURIComponent(m[1]);
      fetch(API + '/enquiries', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          name,
          phone,
          whatsapp: phone,
          subject: 'Callback request',
          service_interest: 'Callback request',
          preferred_contact_method: 'Phone callback — ' + time,
          message: 'Callback requested from ' + (document.title || 'website') + '. Preferred time: ' + time,
          consent: true,
          source: 'floating_widget'
        })
      })
        .then(r => r.json().then(j => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (ok && j && j.success) {
            result.style.color = '#1b5e20';
            result.innerHTML = 'Thank you. We will call you ' + esc(time.toLowerCase()) + '. Reference: <strong>' + esc(j.data.referenceNo) + '</strong>';
            form.reset();
          } else {
            result.style.color = '#c02a2a';
            const errs = j && j.errors ? Object.values(j.errors).join(' ') : '';
            result.textContent = (j && j.message ? j.message : 'Could not send your request.') + ' ' + errs;
          }
        })
        .catch(() => {
          result.style.color = '#c02a2a';
          result.textContent = 'Network error. Please use WhatsApp or call us.';
        })
        .finally(() => { busy = false; btn.disabled = false; });
    });
  }

  // Blog (blog.htm list, sliding banner and article pages): js/spouzy-blog.js

  // ---------------------------------------------------------------------------
  // Customer account state in the header (Login → My Account, cart count)
  // ---------------------------------------------------------------------------
  function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function setLinkLabel(a, from, to) {
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.indexOf(from) !== -1) {
        node.nodeValue = node.nodeValue.replace(from, to);
        return;
      }
    }
  }

  function setCartCount(count) {
    document.querySelectorAll('a[href="cart.htm"]').forEach(a => {
      let badge = a.querySelector('.sp-cart-count');
      if (!count) { if (badge) badge.remove(); return; }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sp-cart-count';
        a.appendChild(badge);
      }
      badge.textContent = String(count);
      badge.setAttribute('aria-label', count + ' in cart');
    });
  }

  function applyLoggedInHeader(u) {
    window.SpouzyCustomer = u;
    const skip = '.sp-auth-tab, .sp-auth-secondary, [data-keep-next]';
    document.querySelectorAll('a[href^="register.htm"]').forEach(a => {
      if (a.matches(skip)) return;
      setLinkLabel(a, 'Login', 'My Account');
      a.setAttribute('href', 'account.htm');
    });
    document.querySelectorAll('a[href^="create-account.htm"]').forEach(a => {
      if (a.matches(skip)) return;
      setLinkLabel(a, 'Create Account', 'Log out');
      a.setAttribute('href', '#logout');
      a.addEventListener('click', ev => {
        ev.preventDefault();
        const token = readCookie('spouzy_csrf');
        fetch(API + '/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
          body: '{}'
        }).finally(() => {
          document.cookie = 'spouzy_customer=; Max-Age=0; path=/';
          window.location.href = 'index.htm';
        });
      });
    });
    fetch(API + '/customer/cart', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(c => { if (c && c.data) setCartCount(c.data.count); })
      .catch(() => {});
  }

  function initAccountHeader() {
    document.addEventListener('spouzy:cart', e => setCartCount(e.detail && e.detail.count));
    // Logged in through the popup (e.g. on the booking page): update the header without a reload
    document.addEventListener('spouzy:login', e => { if (e.detail && e.detail.user) applyLoggedInHeader(e.detail.user); });
    if (readCookie('spouzy_customer') !== '1') return;
    fetch(API + '/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const u = j && j.user;
        if (!u || !u.role || u.role.slug !== 'customer') {
          document.cookie = 'spouzy_customer=; Max-Age=0; path=/';
          return;
        }
        applyLoggedInHeader(u);
      })
      .catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Activity trail for logged-in customers (pages opened, buttons pressed).
  // Steps taken before logging in on this visit are kept in this tab only and
  // sent once the visitor logs in. Typed form contents are never recorded.
  // ---------------------------------------------------------------------------
  const Tracker = (function () {
    const KEY = 'spouzyTrail';
    const MAX = 40;
    let queue = [];
    let timer = null;
    const loggedIn = () => readCookie('spouzy_customer') === '1';
    const here = () => (window.location.pathname.split('/').pop() || 'index.htm') + window.location.search;

    function buffer(ev) {
      try {
        const arr = JSON.parse(window.sessionStorage.getItem(KEY) || '[]');
        arr.push(ev);
        while (arr.length > MAX) arr.shift();
        window.sessionStorage.setItem(KEY, JSON.stringify(arr));
      } catch (e) { /* storage blocked */ }
    }
    function send(events, keepalive) {
      if (!events.length) return Promise.resolve();
      return fetch(API + '/customer/activity', {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: !!keepalive,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': readCookie('spouzy_csrf') },
        body: JSON.stringify({ events })
      }).catch(() => {});
    }
    function flush(keepalive) {
      clearTimeout(timer);
      timer = null;
      if (!queue.length || !loggedIn()) return Promise.resolve();
      return send(queue.splice(0, MAX), keepalive);
    }
    function push(ev) {
      ev.at = new Date().toISOString();
      ev.page = here();
      if (loggedIn()) {
        queue.push(ev);
        if (!timer) timer = setTimeout(flush, 4000);
      } else {
        buffer(ev);
      }
    }
    function flushPreLogin() {
      let arr = [];
      try {
        arr = JSON.parse(window.sessionStorage.getItem(KEY) || '[]');
        window.sessionStorage.removeItem(KEY);
      } catch (e) { arr = []; }
      arr.forEach(ev => { ev.beforeLogin = true; });
      return send(arr.slice(-MAX), false);
    }
    function labelOf(el) {
      const raw = el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || '';
      return String(raw).replace(/\s+/g, ' ').trim().slice(0, 80);
    }
    function hrefOf(el) {
      if (!el.href) return '';
      try {
        const u = new URL(el.href, window.location.href);
        if (u.origin === window.location.origin) return u.pathname.split('/').pop() + u.search + (u.hash || '');
        return u.hostname + u.pathname; // external: no query string (may hold personal text)
      } catch (e) { return ''; }
    }
    function start() {
      push({ event: 'page_view', title: document.title });
      document.addEventListener('click', e => {
        const el = e.target && e.target.closest ? e.target.closest('a, button, summary, [role="button"], input[type="submit"], input[type="button"]') : null;
        if (!el || el.closest('[data-no-track]')) return;
        const label = labelOf(el);
        if (!label) return;
        push({ event: 'click', label, href: hrefOf(el) });
      }, true);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
      window.addEventListener('pagehide', () => flush(true));
    }
    return { start, push, flush, flushPreLogin };
  })();
  window.SpouzyTracker = Tracker;

  /** Header Login / Create Account links bring the visitor back to this page afterwards */
  function addReturnLinks() {
    const page = (window.location.pathname.split('/').pop() || 'index.htm');
    if (/^(register|create-account|account)\.htm$/.test(page)) return;
    const next = encodeURIComponent(page + window.location.search);
    document.querySelectorAll('a[href="register.htm"], a[href="create-account.htm"]').forEach(a => {
      if (a.matches('.sp-auth-tab, .sp-auth-secondary, [data-keep-next]')) return;
      a.setAttribute('href', a.getAttribute('href') + '?next=' + next);
    });
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  /** The chat window (js/spouzy-chat.js) is loaded on every page from here */
  function loadChat() {
    if (document.querySelector('script[src$="spouzy-chat.js"]')) return;
    const s = document.createElement('script');
    s.src = 'js/spouzy-chat.js';
    s.defer = true;
    document.body.appendChild(s);
  }

  /** Offers popup and homepage package cards (js/spouzy-offers.js), loaded on every page from here */
  function loadOffers() {
    if (document.querySelector('script[src$="spouzy-offers.js"]')) return;
    const s = document.createElement('script');
    s.src = 'js/spouzy-offers.js';
    s.defer = true;
    document.body.appendChild(s);
  }

  function loadScript(src) {
    if (document.querySelector('script[src$="' + src + '"]')) return;
    const s = document.createElement('script');
    s.src = 'js/' + src;
    s.defer = true;
    document.body.appendChild(s);
  }

  /** FAQs and client stories are loaded only on the pages that show them */
  function loadFaqsAndStories() {
    if (document.querySelector('#spFaqSection, [data-faq-list], [data-faq-page]')) loadScript('spouzy-faqs.js');
    if (document.querySelector('[data-live-stories], #spStoriesList, #spShareStorySection, #spAccountApp')) loadScript('spouzy-stories.js');
    if (document.querySelector('[data-blog-list]')) loadScript('spouzy-blog.js');
    if (document.querySelector('#spSignupForm, #spAccountApp')) loadScript('spouzy-verify.js');
  }

  function boot() {
    loadScript('spouzy-guard.js');
    initCallbackForm();
    loadChat();
    loadOffers();
    addReturnLinks();
    initAccountHeader();
    Tracker.start();
    getJson('/content/settings').then(applySettings);
    if (document.querySelector('.sp-footer-social')) getJson('/content/social-links').then(applySocialLinks);
    if (document.querySelector('.sp-hero-banner-slides')) getJson('/content/hero-banners').then(applyHeroBanners);
    if (document.querySelector('[data-section-key]')) getJson('/content/homepage-sections').then(applyHomepageSections);
    loadFaqsAndStories();
    if (document.querySelector('article.sp-job-card')) getJson('/careers/openings').then(applyOpenings);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
