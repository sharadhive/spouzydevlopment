/**
 * SPOUZY customer accounts, packages, cart and checkout.
 * Pages: register.htm (login), create-account.htm (sign up), packages.htm, cart.htm, account.htm.
 * Prices always come from the server. Paid checkout opens only when the admin has switched on
 * the payment driver; until then the cart shows "Online payment coming soon".
 */
(function () {
  'use strict';

  const API = '/api';
  const PENDING_KEY = 'spouzyPendingAdd';
  const DEFAULT_WA = '918591945055';
  const ORDER_LABELS = {
    pending_payment: 'Awaiting payment',
    paid: 'Paid',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  /** Form control by name (form.name would return the form's own name attribute) */
  function field(form, name) {
    return form.elements.namedItem(name);
  }
  function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function inr(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }
  function storage(fn) {
    try { return fn(window.sessionStorage); } catch (e) { return null; }
  }
  function waDigits() {
    const s = window.SpouzySiteSettings && window.SpouzySiteSettings.whatsapp_number;
    const d = String(s || '').replace(/\D/g, '');
    return d.length >= 10 ? d : DEFAULT_WA;
  }
  function waLink(text) {
    return 'https://wa.me/' + waDigits() + '?text=' + encodeURIComponent(text);
  }
  function formatDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }
  function param(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  /** Only allow redirects to our own pages, e.g. "cart.htm" or "packages.htm?x=1" */
  function safeNext() {
    const n = param('next') || '';
    return /^[a-z0-9-]+\.htm(\?[a-z0-9=&_%.-]*)?(#[a-z0-9-]*)?$/i.test(n) ? n : '';
  }

  async function ensureCsrf() {
    if (!readCookie('spouzy_csrf')) {
      try { await fetch(API + '/health', { credentials: 'same-origin' }); } catch (e) { /* ignore */ }
    }
  }

  async function api(method, path, body) {
    const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (method !== 'GET') {
      await ensureCsrf();
      const token = readCookie('spouzy_csrf');
      if (token) opts.headers['X-CSRF-Token'] = token;
    }
    try {
      const res = await fetch(API + path, opts);
      const json = await res.json().catch(() => ({}));
      return {
        ok: res.ok && json.success !== false,
        status: res.status,
        data: json.data !== undefined ? json.data : json,
        raw: json,
        message: json.message || '',
        errors: json.errors || null
      };
    } catch (e) {
      return { ok: false, status: 0, data: null, raw: {}, message: 'Network error. Please check your connection and try again.', errors: null };
    }
  }

  let mePromise = null;
  function getMe(refresh) {
    if (refresh) mePromise = null;
    if (!mePromise) {
      mePromise = (async () => {
        if (readCookie('spouzy_customer') !== '1') return null;
        const r = await api('GET', '/auth/me');
        const u = r.ok && r.raw && r.raw.user;
        if (!u || !u.role || u.role.slug !== 'customer') {
          document.cookie = 'spouzy_customer=; Max-Age=0; path=/';
          return null;
        }
        return u;
      })();
    }
    return mePromise;
  }

  function announceCart(count) {
    try { document.dispatchEvent(new CustomEvent('spouzy:cart', { detail: { count } })); } catch (e) { /* old browsers */ }
  }

  function notice(el, html, tone) {
    if (!el) return;
    el.className = 'sp-shop-notice' + (tone ? ' is-' + tone : '');
    el.innerHTML = html;
    el.hidden = !html;
  }

  async function logout() {
    await api('POST', '/auth/logout', {});
    document.cookie = 'spouzy_customer=; Max-Age=0; path=/';
    window.location.href = 'index.htm';
  }
  window.SpouzyShopLogout = logout;

  function wirePasswordToggles(root) {
    (root || document).querySelectorAll('[data-toggle-password]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.getAttribute('data-toggle-password'));
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  function carryNext() {
    const next = safeNext();
    if (!next) return;
    document.querySelectorAll('[data-keep-next]').forEach(a => {
      const href = a.getAttribute('href').split('?')[0];
      a.setAttribute('href', href + '?next=' + encodeURIComponent(next));
    });
  }

  /** After login or sign-up: finish a pending "add to cart", then continue */
  async function afterAuth(isNewAccount) {
    if (window.SpouzyTracker) await window.SpouzyTracker.flushPreLogin();
    const pending = storage(s => s.getItem(PENDING_KEY));
    if (pending) {
      storage(s => s.removeItem(PENDING_KEY));
      await api('POST', '/customer/cart', { packageSlug: pending });
      window.location.href = 'cart.htm';
      return;
    }
    window.location.href = safeNext() || (isNewAccount ? 'packages.htm?welcome=1' : 'account.htm');
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.dataset.label || btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>' + esc(label || 'Please wait…') + '</span>';
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  function showFieldErrors(form, errors) {
    form.querySelectorAll('[data-error-for]').forEach(el => { el.textContent = ''; });
    Object.entries(errors || {}).forEach(([k, msg]) => {
      const el = form.querySelector('[data-error-for="' + k + '"]');
      if (el) el.textContent = msg;
    });
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  async function initLogin() {
    const form = document.getElementById('spLoginForm');
    if (!form) return;
    carryNext();
    wirePasswordToggles(form);
    const errorEl = document.getElementById('spLoginError');
    const noticeEl = document.getElementById('spAuthNotice');

    const forgot = document.getElementById('spForgotLink');
    if (forgot) {
      forgot.addEventListener('click', e => {
        e.preventDefault();
        const email = (document.getElementById('spLoginEmail').value || '').trim();
        window.open(waLink('Hello SPOUZY, I need help resetting my account password.' + (email ? ' My registered email is ' + email + '.' : '')), '_blank', 'noopener');
      });
    }

    if (storage(s => s.getItem(PENDING_KEY))) {
      notice(noticeEl, 'Log in or create an account to add the package to your cart.', 'info');
    }

    const me = await getMe();
    if (me) {
      notice(noticeEl, 'You are logged in as <strong>' + esc(me.name || me.email) + '</strong>. <a href="account.htm">Go to My Account</a> · <a href="packages.htm">View packages</a> · <a href="#" data-logout>Log out</a>', 'success');
      const lo = noticeEl.querySelector('[data-logout]');
      if (lo) lo.addEventListener('click', e => { e.preventDefault(); logout(); });
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errorEl.hidden = true;
      const email = field(form, 'email').value.trim();
      const password = field(form, 'password').value;
      if (!email || !password) {
        errorEl.textContent = 'Please enter your email or mobile number and your password.';
        errorEl.hidden = false;
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      setBusy(btn, true, 'Logging in…');
      const r = await api('POST', '/auth/customer/login', { identifier: email, password, source: 'Login page' });
      if (r.ok) {
        await afterAuth(false);
        return;
      }
      setBusy(btn, false);
      errorEl.textContent = r.message || 'Could not log in. Please try again.';
      errorEl.hidden = false;
    });
  }

  // ---------------------------------------------------------------------------
  // Sign up
  // ---------------------------------------------------------------------------
  function initSignup() {
    const form = document.getElementById('spSignupForm');
    if (!form) return;
    carryNext();
    wirePasswordToggles(form);
    const errorEl = document.getElementById('spSignupError');
    const noticeEl = document.getElementById('spAuthNotice');

    if (storage(s => s.getItem(PENDING_KEY))) {
      notice(noticeEl, 'Create your account and we will add the package to your cart.', 'info');
    }
    // Clear a field's message as soon as it is corrected
    ['input', 'change'].forEach(evt => form.addEventListener(evt, e => {
      const el = e.target && e.target.name ? form.querySelector('[data-error-for="' + e.target.name + '"]') : null;
      if (el) el.textContent = '';
    }));
    getMe().then(me => {
      if (me) notice(noticeEl, 'You already have an account and are logged in as <strong>' + esc(me.name || me.email) + '</strong>. <a href="account.htm">Go to My Account</a>', 'success');
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errorEl.hidden = true;
      const data = {
        name: field(form, 'name').value.trim(),
        email: field(form, 'email').value.trim(),
        phone: field(form, 'phone').value.trim(),
        password: field(form, 'password').value,
        confirm: field(form, 'confirm').value,
        consent: field(form, 'consent').checked
      };
      const errors = {};
      if (data.name.length < 2) errors.name = 'Please enter your full name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.email = 'Please enter a valid email address.';
      const digits = data.phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) errors.phone = 'Please enter a valid mobile number with country code.';
      if (!(data.password.length >= 8 && /[A-Z]/.test(data.password) && /[a-z]/.test(data.password) && /\d/.test(data.password))) {
        errors.password = 'Use at least 8 characters with an upper-case letter, a lower-case letter and a number.';
      }
      if (data.password !== data.confirm) errors.confirm = 'The two passwords do not match.';
      if (!data.consent) errors.consent = 'Please agree to the Terms of Use and Privacy Policy.';
      showFieldErrors(form, errors);
      // Optional student / ex-servicemen ID proof (js/spouzy-verify.js)
      const verify = window.SpouzyVerify && window.SpouzyVerify.signup;
      const withId = !!(verify && verify.category());
      const idOk = withId ? verify.validate() : true;
      if (Object.keys(errors).length) {
        const first = form.querySelector('[name="' + Object.keys(errors)[0] + '"]');
        if (first) first.focus();
        return;
      }
      if (!idOk) return;

      const btn = form.querySelector('button[type="submit"]');
      setBusy(btn, true, 'Creating your account…');
      const r = await api('POST', '/auth/customer/register', {
        name: data.name, email: data.email, phone: data.phone, password: data.password, consent: true
      });
      if (r.ok) {
        if (withId) {
          setBusy(btn, true, 'Uploading your ID proof…');
          const up = await verify.submit();
          storage(s => s.setItem(window.SpouzyVerify.NOTICE_KEY, JSON.stringify(up.ok ? { type: 'sent' } : { type: 'error', message: up.message })));
          // show the result on the account page (unless the customer is on the way to a cart or booking)
          if (!up.ok || (!safeNext() && !storage(s => s.getItem(PENDING_KEY)))) {
            if (window.SpouzyTracker) await window.SpouzyTracker.flushPreLogin();
            window.location.href = 'account.htm#id-verification';
            return;
          }
        }
        await afterAuth(true);
        return;
      }
      setBusy(btn, false);
      showFieldErrors(form, r.errors);
      errorEl.innerHTML = esc(r.message || 'Could not create the account. Please try again.') +
        (r.status === 409 ? ' <a href="register.htm' + (safeNext() ? '?next=' + encodeURIComponent(safeNext()) : '') + '">Log in instead</a>' : '');
      errorEl.hidden = false;
    });
  }

  // ---------------------------------------------------------------------------
  // Package cards (packages.htm and account.htm)
  // ---------------------------------------------------------------------------
  function packageMeta(p) {
    const parts = [];
    parts.push(p.sessions_included + (p.sessions_included === 1 ? ' session' : ' sessions') + ' × ' + p.session_minutes + ' min');
    if (p.validity_days) parts.push('valid ' + p.validity_days + ' days');
    return parts.join(' · ');
  }

  function packageCard(p, servicesBySlug, state) {
    const added = state.inCart && state.inCart.has(p.id);
    const forServices = (p.service_slugs || []).map(s => servicesBySlug[s]).filter(Boolean);
    const offer = p.offer;
    return '<article class="sp-package-card' + (p.badge ? ' is-featured' : '') + (offer ? ' has-offer' : '') + '" id="pkg-' + esc(p.slug) + '" data-services="' + esc((p.service_slugs || []).join(' ')) + '">' +
      (p.badge ? '<span class="sp-package-badge">' + esc(p.badge) + '</span>' : '') +
      (offer ? '<button type="button" class="sp-pkg-offer" data-offer-open="' + offer.id + '">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>' +
        '<b>' + esc(offer.badge_text || 'Offer') + '</b><span>' + esc(offer.title) + (offer.end_date ? ' · till ' + esc(formatDate(offer.end_date)) : '') + '</span></button>' : '') +
      '<h2 class="sp-package-name">' + esc(p.name) + '</h2>' +
      (p.tagline ? '<p class="sp-package-tagline">' + esc(p.tagline) + '</p>' : '') +
      '<div class="sp-package-price">' + (p.is_free ? '<strong>Free</strong>' : '<strong>' + inr(p.price_inr) + '</strong>') +
        (p.compare_at_inr && p.compare_at_inr > p.price_inr ? ' <s>' + inr(p.compare_at_inr) + '</s>' : '') +
        (offer && offer.has_price && offer.save_inr ? ' <span class="sp-pkg-save">Save ' + inr(offer.save_inr) + '</span>' : '') + '</div>' +
      '<p class="sp-package-meta">' + esc(packageMeta(p)) + '</p>' +
      (p.features && p.features.length ? '<ul class="sp-package-features">' + p.features.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') +
      (p.description ? '<p class="sp-package-desc">' + esc(p.description) + '</p>' : '') +
      (forServices.length ? '<p class="sp-package-services">For: ' + esc(forServices.join(', ')) + '</p>' : '') +
      '<button type="button" class="sp-package-btn' + (added ? ' is-added' : '') + '" data-add-package="' + esc(p.slug) + '" data-package-id="' + p.id + '">' +
        (added ? 'In your cart · View cart' : (p.is_free ? 'Claim free package' : 'Add to cart')) + '</button>' +
      (state.loggedIn ? '' : '<p class="sp-package-login-hint">Log in or create a free account to buy.</p>') +
      '</article>';
  }

  async function wireAddButtons(root, state) {
    root.querySelectorAll('[data-add-package]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-add-package');
        if (btn.classList.contains('is-added')) {
          window.location.href = 'cart.htm';
          return;
        }
        if (!state.loggedIn) {
          storage(s => s.setItem(PENDING_KEY, slug));
          window.location.href = 'register.htm?next=cart.htm';
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Adding…';
        const r = await api('POST', '/customer/cart', { packageSlug: slug });
        btn.disabled = false;
        if (r.ok) {
          btn.classList.add('is-added');
          btn.textContent = 'Added · View cart';
          announceCart(r.data.count);
          if (state.onAdded) state.onAdded(r.data);
        } else if (r.status === 401) {
          storage(s => s.setItem(PENDING_KEY, slug));
          window.location.href = 'register.htm?next=cart.htm';
        } else {
          btn.textContent = 'Try again';
          if (state.noticeEl) notice(state.noticeEl, esc(r.message || 'Could not add the package.'), 'error');
        }
      });
    });
  }

  function paymentBanner(payment) {
    if (payment && payment.enabled) return '';
    return '<div class="sp-shop-notice is-info"><strong>Online payment is coming soon.</strong> You can add packages to your cart now; ' +
      'paid checkout opens as soon as online payment goes live. The free package can be claimed today.</div>';
  }

  async function renderPackageGrid(container, opts) {
    const [list, me] = await Promise.all([api('GET', '/packages'), getMe()]);
    if (!list.ok) {
      container.innerHTML = '<div class="sp-shop-notice is-error">Packages could not be loaded. Please refresh the page or <a href="contactus.htm">contact us</a>.</div>';
      return;
    }
    const data = list.data;
    const state = { loggedIn: !!me, inCart: new Set() };
    if (me) {
      const cart = await api('GET', '/customer/cart');
      if (cart.ok) {
        cart.data.items.forEach(i => state.inCart.add(i.package.id));
        announceCart(cart.data.count);
      }
    }
    const servicesBySlug = {};
    (data.services || []).forEach(s => { servicesBySlug[s.slug] = s.name; });
    const used = new Set();
    data.packages.forEach(p => (p.service_slugs || []).forEach(s => used.add(s)));
    const filters = (data.services || []).filter(s => used.has(s.slug));

    let html = '';
    if (opts.welcome && me) {
      html += '<div class="sp-shop-notice is-success">Welcome, <strong>' + esc((me.first_name || me.name || '').trim()) + '</strong>. Your account is ready. Choose a package below.</div>';
    }
    html += paymentBanner(data.payment);
    html += '<div class="sp-shop-notice" data-shop-notice hidden></div>';
    if (opts.filters && filters.length > 1) {
      html += '<div class="sp-package-filters" role="group" aria-label="Filter packages by service">' +
        '<button type="button" class="is-active" data-filter="">All services</button>' +
        filters.map(s => '<button type="button" data-filter="' + esc(s.slug) + '">' + esc(s.name) + '</button>').join('') + '</div>';
    }
    if (!data.packages.length) {
      html += '<p>No packages are available right now. Please check back soon.</p>';
    } else {
      html += '<div class="sp-package-grid">' + data.packages.map(p => packageCard(p, servicesBySlug, state)).join('') + '</div>';
    }
    container.innerHTML = html;
    state.noticeEl = container.querySelector('[data-shop-notice]');

    container.querySelectorAll('[data-filter]').forEach(b => {
      b.addEventListener('click', () => {
        container.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('is-active', x === b));
        const f = b.getAttribute('data-filter');
        container.querySelectorAll('.sp-package-card').forEach(card => {
          const s = (card.getAttribute('data-services') || '').split(' ');
          card.hidden = !!f && !s.includes(f);
        });
      });
    });
    wireAddButtons(container, state);

    // packages.htm#pkg-<slug> (links from the homepage cards and offers): show and highlight that package
    const target = window.location.hash && window.location.hash.indexOf('#pkg-') === 0 ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
    if (target) {
      target.hidden = false;
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('is-flash');
        setTimeout(() => target.classList.remove('is-flash'), 2200);
      }, 150);
    }
    // An offer note on a card ([data-offer-open]) opens the offers popup: handled by js/spouzy-offers.js
  }

  function initPackages() {
    const el = document.getElementById('spPackagesApp');
    if (!el) return;
    renderPackageGrid(el, { filters: true, welcome: param('welcome') === '1' });
  }

  // ---------------------------------------------------------------------------
  // Cart & checkout
  // ---------------------------------------------------------------------------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const s = document.createElement('script');
      s.src = src || 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => (window.Razorpay ? resolve() : reject(new Error('not loaded')));
      s.onerror = () => reject(new Error('blocked'));
      document.head.appendChild(s);
    });
  }

  function orderItemsText(items) {
    return (items || []).map(i => i.name + (i.quantity > 1 ? ' × ' + i.quantity : '')).join(', ');
  }

  function renderSuccess(app, order, extra) {
    const free = order.total_minor === 0;
    const wa = waLink('Hello SPOUZY, my order ' + order.order_no + ' (' + orderItemsText(order.items) + ') is ' + (free ? 'confirmed' : 'paid') + '. Please help me schedule my sessions.');
    app.innerHTML = '<div class="sp-shop-success">' +
      '<div class="sp-shop-success-icon" aria-hidden="true">✓</div>' +
      '<h2>' + (free ? 'Your free package is confirmed' : 'Payment received — thank you!') + '</h2>' +
      '<p>Order <strong>' + esc(order.order_no) + '</strong> · ' + esc(orderItemsText(order.items)) + (free ? '' : ' · ' + inr(order.total_inr)) + '</p>' +
      '<p>Our care team will contact you on WhatsApp to schedule your sessions. You can also message us now.</p>' +
      (extra || '') +
      '<div class="sp-shop-actions">' +
        (free ? '<a class="sp-cta-primary" href="book-appoinment.htm?type=free"><span>Book your free consultation</span><span class="arrow">↗</span></a>' : '') +
        '<a class="sp-auth-secondary" href="' + esc(wa) + '" target="_blank" rel="noopener">Message us on WhatsApp ↗</a>' +
        '<a class="sp-auth-secondary" href="account.htm#orders">View my orders ↗</a>' +
      '</div></div>';
    announceCart(0);
    window.scrollTo({ top: app.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
  }

  async function initCart() {
    const app = document.getElementById('spCartApp');
    if (!app) return;
    const me = await getMe();
    if (!me) {
      app.innerHTML = '<div class="sp-shop-empty">' +
        '<h2>Log in to see your cart</h2>' +
        '<p>Your cart is saved to your account, so you can continue on any device.</p>' +
        '<div class="sp-shop-actions">' +
          '<a class="sp-cta-primary" href="register.htm?next=cart.htm"><span>Log in</span><span class="arrow">↗</span></a>' +
          '<a class="sp-auth-secondary" href="create-account.htm?next=cart.htm">Create a free account ↗</a>' +
          '<a class="sp-auth-secondary" href="packages.htm">Browse packages ↗</a>' +
        '</div></div>';
      return;
    }

    let note = '';
    let message = '';
    let messageTone = 'info';

    async function load() {
      const r = await api('GET', '/customer/cart');
      if (!r.ok) {
        app.innerHTML = '<div class="sp-shop-notice is-error">' + esc(r.message || 'Your cart could not be loaded.') + '</div>';
        return;
      }
      render(r.data);
    }

    function render(cart) {
      announceCart(cart.count);
      if (!cart.items.length) {
        app.innerHTML = (message ? '<div class="sp-shop-notice is-' + messageTone + '">' + message + '</div>' : '') +
          '<div class="sp-shop-empty"><h2>Your cart is empty</h2><p>Browse our care packages to get started.</p>' +
          '<div class="sp-shop-actions"><a class="sp-cta-primary" href="packages.htm"><span>View packages</span><span class="arrow">↗</span></a></div></div>';
        return;
      }
      const payOn = cart.payment && cart.payment.enabled;
      let actions = '';
      if (cart.total_minor === 0) {
        actions = '<button type="button" class="sp-cta-primary" data-checkout="all"><span>Confirm free package</span><span class="arrow">↗</span></button>';
      } else if (payOn) {
        actions = '<button type="button" class="sp-cta-primary" data-checkout="all"><span>Pay ' + inr(cart.total_inr) + ' securely</span><span class="arrow">↗</span></button>';
      } else {
        actions = '<button type="button" class="sp-cta-primary is-disabled" disabled aria-disabled="true"><span>Online payment coming soon</span></button>' +
          (cart.has_free ? '<button type="button" class="sp-auth-secondary" data-checkout="free">Claim the free package now ↗</button>' : '');
      }

      app.innerHTML =
        (message ? '<div class="sp-shop-notice is-' + messageTone + '">' + message + '</div>' : '') +
        (cart.removed_unavailable ? '<div class="sp-shop-notice is-info">Some packages are no longer available and were removed from your cart.</div>' : '') +
        '<div class="sp-cart-list">' +
        cart.items.map(i => {
          const p = i.package;
          const qty = p.is_free
            ? '<span class="sp-cart-qty-fixed">1</span>'
            : '<label class="sp-visually-hidden" for="spQty' + p.id + '">Quantity for ' + esc(p.name) + '</label><select id="spQty' + p.id + '" data-qty="' + p.id + '">' +
              [1, 2, 3, 4, 5].map(n => '<option value="' + n + '"' + (n === i.quantity ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
          return '<div class="sp-cart-row">' +
            '<div class="sp-cart-info"><strong>' + esc(p.name) + '</strong><small>' + esc(packageMeta(p)) + '</small></div>' +
            '<div class="sp-cart-qty">' + qty + '</div>' +
            '<div class="sp-cart-price">' + (p.is_free ? 'Free' : inr(i.line_total_inr)) + '</div>' +
            '<button type="button" class="sp-cart-remove" data-remove="' + p.id + '" aria-label="Remove ' + esc(p.name) + '">Remove</button>' +
            '</div>';
        }).join('') +
        '</div>' +
        '<div class="sp-cart-summary"><span>Total</span><strong>' + (cart.total_minor ? inr(cart.total_inr) : 'Free') + '</strong></div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spCartNote">Anything our care team should know? (optional)</label>' +
        '<textarea class="sp-form-textarea-modern" id="spCartNote" rows="2" maxlength="1000" placeholder="e.g. preferred days or times, language">' + esc(note) + '</textarea></div>' +
        (!payOn && cart.has_paid ? '<div class="sp-shop-notice is-info"><strong>Online payment is coming soon.</strong> Your cart is saved to your account; you can check out as soon as online payment goes live.' +
          (cart.has_free ? ' The free package can be claimed right away.' : '') + '</div>' : '') +
        '<div class="sp-shop-actions">' + actions + '<a class="sp-auth-secondary" href="packages.htm">Continue browsing ↗</a></div>';

      const noteEl = document.getElementById('spCartNote');
      noteEl.addEventListener('input', () => { note = noteEl.value; });
      app.querySelectorAll('[data-qty]').forEach(sel => sel.addEventListener('change', async () => {
        message = '';
        const r = await api('PATCH', '/customer/cart/' + sel.getAttribute('data-qty'), { quantity: parseInt(sel.value, 10) });
        if (r.ok) render(r.data); else load();
      }));
      app.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
        message = '';
        const r = await api('DELETE', '/customer/cart/' + b.getAttribute('data-remove'));
        if (r.ok) render(r.data); else load();
      }));
      app.querySelectorAll('[data-checkout]').forEach(b => b.addEventListener('click', () => checkout(b, b.getAttribute('data-checkout') === 'free', cart)));
    }

    async function checkout(btn, freeOnly, cart) {
      setBusy(btn, true, freeOnly || cart.total_minor === 0 ? 'Confirming…' : 'Opening secure payment…');
      const r = await api('POST', '/customer/checkout', { freeOnly, note });
      if (!r.ok) {
        setBusy(btn, false);
        message = esc(r.message || 'Checkout could not be completed.');
        messageTone = r.status === 409 ? 'info' : 'error';
        load();
        return;
      }
      if (!r.data.paymentRequired) {
        renderSuccess(app, r.data.order);
        return;
      }
      const pay = r.data.payment;
      try {
        await loadScript(cart.payment && cart.payment.checkoutScript);
      } catch (e) {
        setBusy(btn, false);
        message = 'The payment window could not be opened. Please check your internet connection and try again, or contact us on WhatsApp.';
        messageTone = 'error';
        load();
        return;
      }
      const rzp = new window.Razorpay({
        key: pay.keyId,
        amount: pay.amount,
        currency: pay.currency || 'INR',
        name: pay.name || 'SPOUZY',
        description: pay.description,
        order_id: pay.gatewayOrderId,
        prefill: pay.prefill || {},
        notes: { order_no: r.data.order.order_no },
        theme: { color: '#481e28' },
        handler: async (resp) => {
          app.innerHTML = '<div class="sp-shop-loading">Confirming your payment…</div>';
          const v = await api('POST', '/payments/verify', {
            gatewayOrderId: resp.razorpay_order_id,
            gatewayPaymentId: resp.razorpay_payment_id,
            gatewaySignature: resp.razorpay_signature
          });
          if (v.ok) {
            renderSuccess(app, { ...r.data.order, status: 'paid' });
          } else {
            message = 'We could not confirm the payment automatically. If money was deducted, please message us with order ' + esc(r.data.order.order_no) + ' and we will sort it out.';
            messageTone = 'error';
            load();
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(btn, false);
            message = 'Payment was not completed. Your cart is saved; you can try again whenever you are ready.';
            messageTone = 'info';
            load();
          }
        }
      });
      rzp.open();
    }

    load();
  }

  // ---------------------------------------------------------------------------
  // Login / create-account popup (used by the booking page)
  // ---------------------------------------------------------------------------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let gateEl = null;
  let gateResolve = null;
  let gateState = {};

  function closeGate(user) {
    if (!gateEl) return;
    gateEl.hidden = true;
    document.body.classList.remove('sp-gate-open');
    const done = gateResolve;
    gateResolve = null;
    if (done) done(user || null);
  }

  function gateShell() {
    if (gateEl) return gateEl;
    gateEl = document.createElement('div');
    gateEl.className = 'sp-gate-backdrop';
    gateEl.hidden = true;
    gateEl.innerHTML = '<div class="sp-gate" role="dialog" aria-modal="true" aria-labelledby="spGateTitle">' +
      '<button type="button" class="sp-gate-close" aria-label="Close">&times;</button>' +
      '<div class="sp-gate-icon" aria-hidden="true"><i class="fa fa-lock"></i></div>' +
      '<h2 id="spGateTitle"></h2><p class="sp-gate-sub"></p>' +
      '<div class="sp-gate-body"></div></div>';
    document.body.appendChild(gateEl);
    gateEl.querySelector('.sp-gate-close').addEventListener('click', () => closeGate(null));
    gateEl.addEventListener('click', e => { if (e.target === gateEl) closeGate(null); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && gateEl && !gateEl.hidden) closeGate(null); });
    return gateEl;
  }

  function gateRender(title, sub, bodyHtml) {
    const el = gateShell();
    el.querySelector('#spGateTitle').textContent = title;
    el.querySelector('.sp-gate-sub').innerHTML = sub;
    el.querySelector('.sp-gate-body').innerHTML = bodyHtml;
    el.hidden = false;
    document.body.classList.add('sp-gate-open');
    wirePasswordToggles(el);
    const first = el.querySelector('input:not([type=hidden]):not([readonly])');
    if (first) setTimeout(() => first.focus(), 30);
    return el.querySelector('.sp-gate-body');
  }

  function confirmLabel(plain) {
    return gateState.context === 'booking' ? plain + ' & confirm appointment' : plain;
  }

  function gateError(body, msg) {
    const el = body.querySelector('[data-gate-error]');
    if (!el) return;
    el.innerHTML = msg || '';
    el.hidden = !msg;
  }

  function gateIdentify() {
    const p = gateState.prefill || {};
    const body = gateRender(
      gateState.context === 'booking' ? 'Confirm your appointment' : gateState.context === 'story' ? 'Log in to share your story' : 'Log in or create an account',
      gateState.context === 'booking'
        ? 'Your selected time is kept. Enter your email or mobile number and we will check whether you already have an account.'
        : gateState.context === 'story'
          ? 'Stories come only from real SPOUZY clients. Enter your email or mobile number; a free account takes a minute. Your details are never shown with your story.'
          : 'Enter your email or mobile number and we will check whether you already have an account.',
      '<form data-gate-form novalidate>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGateEmail">Email</label>' +
        '<input class="sp-form-input-modern" type="email" id="spGateEmail" name="email" autocomplete="email" value="' + esc(p.email || '') + '"></div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGatePhone">Mobile number (WhatsApp)</label>' +
        '<input class="sp-form-input-modern" type="tel" id="spGatePhone" name="phone" autocomplete="tel" placeholder="+91 98765 43210" value="' + esc(p.phone || '') + '"></div>' +
        '<p class="sp-form-error" data-gate-error hidden></p>' +
        '<button type="submit" class="sp-cta-primary sp-auth-submit"><span>Continue</span><span class="arrow">↗</span></button>' +
        '<p class="sp-auth-help">Already have an account? <a href="#" data-gate-go="login">Log in</a></p>' +
      '</form>'
    );
    body.querySelector('[data-gate-go="login"]').addEventListener('click', e => { e.preventDefault(); gateLogin(); });
    const form = body.querySelector('[data-gate-form]');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = field(form, 'email').value.trim();
      const phone = field(form, 'phone').value.trim();
      const digits = phone.replace(/\D/g, '');
      if (!email && !phone) return gateError(body, 'Please enter your email or mobile number.');
      if (email && !EMAIL_RE.test(email)) return gateError(body, 'Please enter a valid email address.');
      if (phone && (digits.length < 10 || digits.length > 15)) return gateError(body, 'Please enter a valid mobile number with country code.');
      gateState.prefill = { ...p, email, phone };
      const btn = form.querySelector('button[type=submit]');
      setBusy(btn, true, 'Checking…');
      const r = await api('POST', '/auth/customer/check', { email, phone });
      setBusy(btn, false);
      if (!r.ok) return gateError(body, esc(r.message || 'Please try again.'));
      if (r.data.exists && !r.data.can_login) {
        return gateError(body, 'This email cannot be used for booking. Please use a different email or <a href="contactus.htm">contact us</a>.');
      }
      if (r.data.exists) {
        gateLogin({
          identifier: r.data.matched_by === 'phone' ? phone : email,
          message: 'Welcome back! An account already exists' + (r.data.matched_by === 'phone' ? ' for this mobile number (' + esc(r.data.masked_email) + ')' : ' for this email') + '. Enter your password to continue.'
        });
      } else {
        gateSignup();
      }
    });
  }

  function gateLogin(opts) {
    opts = opts || {};
    const p = gateState.prefill || {};
    const body = gateRender(
      'Log in',
      opts.message || (gateState.context === 'booking' ? 'Log in to confirm your appointment. Your details will be filled in from your account.' : 'Log in to your SPOUZY account.'),
      '<form data-gate-form novalidate>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGateId">Email or mobile number</label>' +
        '<input class="sp-form-input-modern" type="text" id="spGateId" name="identifier" autocomplete="username" value="' + esc(opts.identifier || p.email || '') + '"></div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGatePw">Password</label>' +
        '<div class="sp-password-row"><input class="sp-form-input-modern" type="password" id="spGatePw" name="password" autocomplete="current-password">' +
        '<button type="button" class="sp-password-toggle" data-toggle-password="spGatePw" aria-label="Show password">Show</button></div></div>' +
        '<p class="sp-form-error" data-gate-error hidden></p>' +
        '<button type="submit" class="sp-cta-primary sp-auth-submit"><span>' + esc(confirmLabel('Log in')) + '</span><span class="arrow">↗</span></button>' +
        '<p class="sp-auth-help">Forgot your password? <a href="#" data-gate-forgot>Ask us on WhatsApp</a></p>' +
        '<p class="sp-auth-help">New to SPOUZY? <a href="#" data-gate-go="signup">Create a free account</a></p>' +
      '</form>'
    );
    if (opts.identifier && body.querySelector('#spGatePw')) setTimeout(() => body.querySelector('#spGatePw').focus(), 40);
    body.querySelector('[data-gate-go="signup"]').addEventListener('click', e => { e.preventDefault(); gateSignup(); });
    body.querySelector('[data-gate-forgot]').addEventListener('click', e => {
      e.preventDefault();
      const id = body.querySelector('#spGateId').value.trim();
      window.open(waLink('Hello SPOUZY, I need help resetting my account password.' + (id ? ' My registered email/mobile is ' + id + '.' : '')), '_blank', 'noopener');
    });
    const form = body.querySelector('[data-gate-form]');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const identifier = field(form, 'identifier').value.trim();
      const password = field(form, 'password').value;
      if (!identifier || !password) return gateError(body, 'Please enter your email or mobile number and your password.');
      const btn = form.querySelector('button[type=submit]');
      setBusy(btn, true, 'Logging in…');
      const r = await api('POST', '/auth/customer/login', { identifier, password, source: gateState.context === 'booking' ? 'Booking page' : 'Login popup' });
      if (!r.ok) {
        setBusy(btn, false);
        return gateError(body, esc(r.message || 'Could not log in.'));
      }
      await gateSuccess();
    });
  }

  function gateSignup() {
    const p = gateState.prefill || {};
    const body = gateRender(
      'Create your free account',
      'It takes 30 seconds. Your appointments and packages are saved in your account.',
      '<form data-gate-form novalidate>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGateName">Full name</label>' +
        '<input class="sp-form-input-modern" type="text" id="spGateName" name="name" autocomplete="name" value="' + esc(p.name || '') + '"><small class="sp-field-error" data-error-for="name"></small></div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGateEmail2">Email</label>' +
        '<input class="sp-form-input-modern" type="email" id="spGateEmail2" name="email" autocomplete="email" value="' + esc(p.email || '') + '"><small class="sp-field-error" data-error-for="email"></small></div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGatePhone2">Mobile number (WhatsApp)</label>' +
        '<input class="sp-form-input-modern" type="tel" id="spGatePhone2" name="phone" autocomplete="tel" value="' + esc(p.phone || '') + '"><small class="sp-field-error" data-error-for="phone"></small></div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spGatePw2">Choose a password</label>' +
        '<div class="sp-password-row"><input class="sp-form-input-modern" type="password" id="spGatePw2" name="password" autocomplete="new-password">' +
        '<button type="button" class="sp-password-toggle" data-toggle-password="spGatePw2" aria-label="Show password">Show</button></div>' +
        '<small class="sp-field-hint">At least 8 characters, with an upper-case letter, a lower-case letter and a number.</small><small class="sp-field-error" data-error-for="password"></small></div>' +
        '<label class="sp-auth-consent"><input type="checkbox" name="consent"><span>I agree to the <a href="terms.htm" target="_blank">Terms of Use</a> and <a href="privacy-policy.htm" target="_blank">Privacy Policy</a>.</span></label>' +
        '<small class="sp-field-error" data-error-for="consent"></small>' +
        '<p class="sp-auth-help" style="text-align:left;margin:4px 0 12px;">While you are logged in we keep a record of the pages you open and the actions you take on this website (never what you type) so our care team can help you.</p>' +
        '<p class="sp-form-error" data-gate-error hidden></p>' +
        '<button type="submit" class="sp-cta-primary sp-auth-submit"><span>' + esc(confirmLabel('Create account')) + '</span><span class="arrow">↗</span></button>' +
        '<p class="sp-auth-help">Already have an account? <a href="#" data-gate-go="login">Log in</a></p>' +
      '</form>'
    );
    body.querySelector('[data-gate-go="login"]').addEventListener('click', e => { e.preventDefault(); gateLogin(); });
    const form = body.querySelector('[data-gate-form]');
    form.addEventListener('input', e => {
      const el = e.target && e.target.name ? form.querySelector('[data-error-for="' + e.target.name + '"]') : null;
      if (el) el.textContent = '';
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      gateError(body, '');
      const d = {
        name: field(form, 'name').value.trim(),
        email: field(form, 'email').value.trim(),
        phone: field(form, 'phone').value.trim(),
        password: field(form, 'password').value,
        consent: field(form, 'consent').checked
      };
      const errors = {};
      if (d.name.length < 2) errors.name = 'Please enter your full name.';
      if (!EMAIL_RE.test(d.email)) errors.email = 'Please enter a valid email address.';
      const digits = d.phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) errors.phone = 'Please enter a valid mobile number with country code.';
      if (!(d.password.length >= 8 && /[A-Z]/.test(d.password) && /[a-z]/.test(d.password) && /\d/.test(d.password))) errors.password = 'Use at least 8 characters with upper-case, lower-case and a number.';
      if (!d.consent) errors.consent = 'Please agree to the Terms of Use and Privacy Policy.';
      showFieldErrors(form, errors);
      if (Object.keys(errors).length) return;
      const btn = form.querySelector('button[type=submit]');
      setBusy(btn, true, 'Creating your account…');
      const r = await api('POST', '/auth/customer/register', { ...d, consent: true, source: gateState.context === 'booking' ? 'Booking page' : 'Sign-up popup' });
      if (!r.ok) {
        setBusy(btn, false);
        showFieldErrors(form, r.errors);
        if (r.status === 409) {
          gateState.prefill = { ...gateState.prefill, email: d.email, phone: d.phone };
          return gateLogin({ identifier: r.errors && r.errors.phone ? d.phone : d.email, message: esc(r.message) });
        }
        return gateError(body, esc(r.message || 'Could not create the account.'));
      }
      await gateSuccess();
    });
  }

  async function gateSuccess() {
    const user = await getMe(true);
    if (window.SpouzyTracker) await window.SpouzyTracker.flushPreLogin();
    document.dispatchEvent(new CustomEvent('spouzy:login', { detail: { user } }));
    closeGate(user);
  }

  /**
   * Resolve with the logged-in customer, showing the popup when needed.
   * prefill: { name, email, phone } typed on the page; context: 'booking' | 'general'; start: 'identify' | 'login' | 'signup'
   */
  async function requireLogin(prefill, opts) {
    const me = await getMe();
    if (me) return me;
    opts = opts || {};
    gateState = { prefill: prefill || {}, context: opts.context || 'general' };
    return new Promise(resolve => {
      gateResolve = resolve;
      if (opts.start === 'login') gateLogin();
      else if (opts.start === 'signup') gateSignup();
      else gateIdentify();
    });
  }

  window.SpouzyAccount = { getMe, requireLogin, logout };

  // ---------------------------------------------------------------------------
  // Booking page: account bar, auto-filled and locked contact details
  // ---------------------------------------------------------------------------
  function lockBookingFields(user) {
    const map = [
      ['spPatientName', (user.name || '').trim()],
      ['spPatientEmail', user.email],
      ['spPatientPhone', user.phone]
    ];
    map.forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (!input) return;
      if (value) {
        input.value = value;
        input.readOnly = true;
        input.classList.add('sp-input-locked');
        input.setAttribute('title', 'From your account. You can change it in My Account.');
      } else {
        input.readOnly = false;
        input.classList.remove('sp-input-locked');
      }
    });
  }

  function renderBookingBar(bar, user) {
    if (user) {
      bar.className = 'sp-booking-account is-in';
      bar.innerHTML = '<div><strong>Booking as ' + esc(user.name || user.email) + '</strong>' +
        '<span>Your name, email and mobile come from your account and are locked. <a href="account.htm">Change them in My Account</a>.</span></div>' +
        '<div class="sp-booking-account-actions"><a href="account.htm#appointments">My appointments</a><a href="#" data-booking-logout>Not you? Log out</a></div>';
      const lo = bar.querySelector('[data-booking-logout]');
      lo.addEventListener('click', async e => {
        e.preventDefault();
        await api('POST', '/auth/logout', {});
        document.cookie = 'spouzy_customer=; Max-Age=0; path=/';
        window.location.reload();
      });
    } else {
      bar.className = 'sp-booking-account';
      bar.innerHTML = '<div><strong>Log in to book</strong>' +
        '<span>Pick your date and time first if you like. When you confirm, log in or create your free account and your details fill in automatically.</span></div>' +
        '<div class="sp-booking-account-actions"><button type="button" class="sp-cta-primary" data-booking-login><span>Log in</span></button>' +
        '<button type="button" class="sp-auth-secondary" data-booking-signup>Create account</button></div>';
      const read = () => ({
        name: (document.getElementById('spPatientName') || {}).value || '',
        email: (document.getElementById('spPatientEmail') || {}).value || '',
        phone: (document.getElementById('spPatientPhone') || {}).value || ''
      });
      bar.querySelector('[data-booking-login]').addEventListener('click', () => requireLogin(read(), { context: 'general', start: 'login' }));
      bar.querySelector('[data-booking-signup]').addEventListener('click', () => requireLogin(read(), { context: 'general', start: 'signup' }));
    }
  }

  async function initBookingAccount() {
    const form = document.getElementById('spBookingForm');
    const nameInput = document.getElementById('spPatientName');
    if (!form || !nameInput) return;
    const row = nameInput.closest('.sp-form-row-2col') || nameInput.closest('.sp-form-group-modern');
    const bar = document.createElement('div');
    bar.id = 'spBookingAccountBar';
    row.parentNode.insertBefore(bar, row);
    const me = await getMe();
    renderBookingBar(bar, me);
    if (me) lockBookingFields(me);
    document.addEventListener('spouzy:login', e => {
      const user = e.detail && e.detail.user;
      if (!user) return;
      renderBookingBar(bar, user);
      lockBookingFields(user);
    });
  }

  // ---------------------------------------------------------------------------
  // My Account
  // ---------------------------------------------------------------------------
  async function initAccount() {
    const app = document.getElementById('spAccountApp');
    if (!app) return;
    const me = await getMe();
    if (!me) {
      window.location.replace('register.htm?next=account.htm');
      return;
    }
    const [profileRes, ordersRes, apptRes, billsRes] = await Promise.all([api('GET', '/customer/profile'), api('GET', '/customer/orders'), api('GET', '/customer/appointments'), api('GET', '/customer/invoices')]);
    const profile = profileRes.ok ? profileRes.data : { name: me.name, email: me.email, phone: me.phone };
    const orders = ordersRes.ok ? ordersRes.data : [];
    const bills = billsRes.ok && Array.isArray(billsRes.data) ? billsRes.data : [];
    const newBills = bills.filter(b => b.is_new).length;
    const billsHtml = bills.length
      ? '<div class="sp-order-list">' + bills.map(b =>
          '<div class="sp-order-row sp-bill-row' + (b.is_new ? ' is-new' : '') + '">' +
            '<div><strong>' + esc(b.invoice_no) + '</strong><small>' + esc(formatDate(b.sent_at || b.issued_at)) + '</small></div>' +
            '<div class="sp-order-items">' + esc((b.items || []).join(', ')) + (b.is_new ? ' <span class="sp-bill-new">New</span>' : '') + '</div>' +
            '<div class="sp-order-total">' + inr(b.total_inr) + '</div>' +
            '<div><a class="sp-bill-open" href="invoice.htm?id=' + encodeURIComponent(b.id) + '">View bill ↗</a></div>' +
          '</div>').join('') + '</div>'
      : '<p>No bills yet. After a payment, the SPOUZY team sends your bill here; you can view it, print it or save it as PDF.</p>';
    const appts = apptRes.ok ? apptRes.data : [];
    const title = document.getElementById('spAccountTitle');
    if (title) title.textContent = 'Hello, ' + ((profile.name || '').split(' ')[0] || 'there');

    const ordersHtml = orders.length
      ? '<div class="sp-order-list">' + orders.map(o =>
          '<div class="sp-order-row">' +
            '<div><strong>' + esc(o.order_no) + '</strong><small>' + esc(formatDate(o.created_at)) + '</small></div>' +
            '<div class="sp-order-items">' + esc(orderItemsText(o.items)) + '</div>' +
            '<div class="sp-order-total">' + (o.total_minor ? inr(o.total_inr) : 'Free') + '</div>' +
            '<div><span class="sp-order-status is-' + esc(o.status) + '">' + esc(ORDER_LABELS[o.status] || o.status) + '</span></div>' +
          '</div>').join('') + '</div>'
      : '<p>You have no orders yet. <a href="packages.htm">Browse packages</a> or <a href="book-appoinment.htm?type=free">book a free consultation</a>.</p>';

    const APPT_LABELS = { hold: 'Awaiting payment', confirmed: 'Confirmed', rescheduled: 'Rescheduled', completed: 'Completed', cancelled: 'Cancelled', no_show: 'Missed' };
    const MODE_LABELS = { video: 'Video / audio', phone: 'Phone', 'in-person': 'In person' };
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const upcoming = appts.filter(a => a.date >= todayKey && !['cancelled', 'completed', 'no_show'].includes(a.status)).reverse();
    const past = appts.filter(a => !upcoming.includes(a));
    const apptRow = (a, isUpcoming) =>
      '<div class="sp-order-row sp-appt-row">' +
        '<div><strong>' + esc(formatDate(a.date + 'T00:00:00+05:30')) + ' · ' + esc(a.start_time) + '</strong><small>' + esc(a.reference_no) + '</small></div>' +
        '<div class="sp-order-items">' + esc(a.service || 'Consultation') + (a.practitioner ? ' with ' + esc(a.practitioner) : '') +
          '<small>' + esc(MODE_LABELS[a.mode] || a.mode || '') + (a.clinic_location ? ' · ' + esc(a.clinic_location) : '') + ' · ' + (a.booking_type === 'free' ? 'Free' : (a.payment_status === 'paid' ? 'Paid' : 'Payment pending')) + '</small></div>' +
        '<div>' + (isUpcoming ? '<a class="sp-appt-help" target="_blank" rel="noopener" href="' + esc(waLink('Hello SPOUZY, I would like to reschedule or cancel my appointment ' + a.reference_no + ' on ' + a.date + ' at ' + a.start_time + '.')) + '">Reschedule / cancel</a>' : '') + '</div>' +
        '<div><span class="sp-order-status is-' + esc(a.status === 'hold' ? 'pending_payment' : a.status) + '">' + esc(APPT_LABELS[a.status] || a.status) + '</span></div>' +
      '</div>';
    const apptHtml = appts.length
      ? (upcoming.length ? '<h3 class="sp-account-sub">Upcoming</h3><div class="sp-order-list">' + upcoming.map(a => apptRow(a, true)).join('') + '</div>' : '<p>No upcoming appointments.</p>') +
        (past.length ? '<h3 class="sp-account-sub">Past and cancelled</h3><div class="sp-order-list">' + past.map(a => apptRow(a, false)).join('') + '</div>' : '')
      : '<p>You have not booked an appointment while logged in yet.</p>';

    app.innerHTML =
      '<div class="sp-account-shortcuts">' +
        '<a href="packages.htm"><strong>Packages</strong><span>Choose a care package</span></a>' +
        '<a href="cart.htm"><strong>Cart</strong><span data-cart-count-text>View your cart</span></a>' +
        '<a href="#stories"><strong>My stories</strong><span data-my-stories-count>Share your experience</span></a>' +
        '<a href="#bills"><strong>My bills</strong><span>' + (newBills ? newBills + ' new bill' + (newBills > 1 ? 's' : '') : (bills.length ? bills.length + ' bill' + (bills.length > 1 ? 's' : '') : 'Your payment bills')) + '</span></a>' +
        '<a href="book-appoinment.htm"><strong>Book a session</strong><span>Free or paid consultation</span></a>' +
        '<a href="' + esc(waLink('Hello SPOUZY, I have a question about my account (' + (profile.email || '') + ').')) + '" target="_blank" rel="noopener"><strong>WhatsApp us</strong><span>Talk to the care team</span></a>' +
      '</div>' +
      '<section id="appointments" class="sp-account-section"><h2>My appointments</h2>' + apptHtml +
        '<div class="sp-shop-actions"><a class="sp-cta-primary" href="book-appoinment.htm"><span>Book an appointment</span><span class="arrow">↗</span></a>' +
        '<a class="sp-auth-secondary" href="book-appoinment.htm?type=free">Book a free consultation ↗</a></div></section>' +
      '<section id="id-verification" class="sp-account-section"><h2>Student &amp; ex-servicemen benefit</h2><div id="spMyVerification"><div class="sp-shop-loading">Loading…</div></div></section>' +
      '<section id="orders" class="sp-account-section"><h2>My orders</h2>' + ordersHtml + '</section>' +
      '<section id="bills" class="sp-account-section"><h2>My bills' + (newBills ? ' <span class="sp-bill-new">' + newBills + ' new</span>' : '') + '</h2>' + billsHtml + '</section>' +
      '<section id="stories" class="sp-account-section"><h2>My stories</h2><div id="spMyStories"><div class="sp-shop-loading">Loading your stories…</div></div></section>' +
      '<section class="sp-account-section"><h2>Care packages</h2><div id="spAccountPackages"><div class="sp-shop-loading">Loading packages…</div></div></section>' +
      '<section class="sp-account-section sp-account-forms">' +
        '<form id="spProfileForm" novalidate><h2>My details</h2>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spProfileName">Full name</label><input class="sp-form-input-modern" id="spProfileName" name="name" value="' + esc(profile.name) + '" required><small class="sp-field-error" data-error-for="name"></small></div>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spProfileEmail">Email</label><input class="sp-form-input-modern" id="spProfileEmail" value="' + esc(profile.email) + '" disabled></div>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spProfilePhone">Mobile number</label><input class="sp-form-input-modern" id="spProfilePhone" name="phone" type="tel" value="' + esc(profile.phone || '') + '" required><small class="sp-field-error" data-error-for="phone"></small></div>' +
          '<p class="sp-form-msg" data-form-msg hidden></p>' +
          '<button type="submit" class="sp-auth-secondary">Save details</button>' +
        '</form>' +
        '<form id="spPasswordForm" novalidate><h2>Change password</h2>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spPwCurrent">Current password</label><input class="sp-form-input-modern" type="password" id="spPwCurrent" name="current" autocomplete="current-password" required></div>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spPwNew">New password</label><input class="sp-form-input-modern" type="password" id="spPwNew" name="next" autocomplete="new-password" required><small class="sp-field-hint">At least 8 characters, with upper-case, lower-case and a number.</small></div>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spPwRepeat">Repeat new password</label><input class="sp-form-input-modern" type="password" id="spPwRepeat" name="repeat" autocomplete="new-password" required></div>' +
          '<p class="sp-form-msg" data-form-msg hidden></p>' +
          '<button type="submit" class="sp-auth-secondary">Change password</button>' +
        '</form>' +
      '</section>' +
      '<div class="sp-shop-actions"><button type="button" class="sp-auth-secondary" id="spLogoutBtn">Log out ↗</button></div>';

    renderPackageGrid(document.getElementById('spAccountPackages'), { filters: false });
    api('GET', '/customer/cart').then(c => {
      if (c.ok) {
        const t = app.querySelector('[data-cart-count-text]');
        if (t) t.textContent = c.data.count ? c.data.count + (c.data.count === 1 ? ' item' : ' items') + ' · ' + (c.data.total_minor ? inr(c.data.total_inr) : 'Free') : 'Your cart is empty';
      }
    });

    document.getElementById('spLogoutBtn').addEventListener('click', logout);

    const pf = document.getElementById('spProfileForm');
    pf.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = pf.querySelector('[data-form-msg]');
      const r = await api('PUT', '/customer/profile', { name: field(pf, 'name').value.trim(), phone: field(pf, 'phone').value.trim() });
      showFieldErrors(pf, r.errors);
      msg.hidden = false;
      msg.className = 'sp-form-msg ' + (r.ok ? 'is-success' : 'is-error');
      msg.textContent = r.ok ? 'Your details have been saved.' : (r.message || 'Could not save your details.');
      if (r.ok && title) title.textContent = 'Hello, ' + (r.data.first_name || '');
    });

    const pw = document.getElementById('spPasswordForm');
    pw.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = pw.querySelector('[data-form-msg]');
      msg.hidden = false;
      if (field(pw, 'next').value !== field(pw, 'repeat').value) {
        msg.className = 'sp-form-msg is-error';
        msg.textContent = 'The two new passwords do not match.';
        return;
      }
      const r = await api('POST', '/auth/change-password', { currentPassword: field(pw, 'current').value, newPassword: field(pw, 'next').value });
      msg.className = 'sp-form-msg ' + (r.ok ? 'is-success' : 'is-error');
      msg.textContent = r.ok ? 'Password changed. You stay logged in on this device.' : (r.message || 'Could not change the password.');
      if (r.ok) pw.reset();
    });

    try { document.dispatchEvent(new CustomEvent('spouzy:account-ready')); } catch (e) { /* old browsers */ }
    if (window.location.hash === '#orders' || window.location.hash === '#appointments' || window.location.hash === '#bills') {
      const o = document.getElementById(window.location.hash.slice(1));
      if (o) o.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function boot() {
    initBookingAccount();
    initLogin();
    initSignup();
    initPackages();
    initCart();
    initAccount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
