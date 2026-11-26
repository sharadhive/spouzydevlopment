/**
 * SPOUZY chat window (opens from the round chat button on every page).
 * - Logged-in customers chat with the SPOUZY assistant (answers come from /api/customer/chat).
 * - Visitors are asked to log in or create an account first — both can be done inside the chat,
 *   step by step, and the visitor is then logged in automatically.
 * - The chat ends after the idle time set in Admin → Settings (default 30 seconds without a reply).
 */
(function () {
  'use strict';
  if (window.__spouzyChat) return;
  window.__spouzyChat = true;

  const API = '/api';
  const STORE = 'spouzyChatState';
  const AUTH_IDLE_SECONDS = 120; // more time while typing account details
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  let cfg = { enabled: true, idleSeconds: 30, phone: '+91 85919 45055', whatsapp: '+91 85919 45055' };
  let state = { mode: 'guest', conversationId: null, messages: [], lastActivity: 0, pendingQuestion: '' };
  let flow = {};           // values collected during in-chat login / sign-up (never stored)
  let idleTimer = null;
  let busy = false;
  let el = {};

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function loggedIn() { return readCookie('spouzy_customer') === '1'; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function waUrl(text) { return 'https://wa.me/' + digits(cfg.whatsapp) + (text ? '?text=' + encodeURIComponent(text) : ''); }
  function telUrl() { return 'tel:+' + digits(cfg.phone); }

  async function api(method, path, body) {
    if (method !== 'GET' && !readCookie('spouzy_csrf')) {
      try { await fetch(API + '/health', { credentials: 'same-origin' }); } catch (e) { /* ignore */ }
    }
    const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (method !== 'GET') opts.headers['X-CSRF-Token'] = readCookie('spouzy_csrf');
    try {
      const res = await fetch(API + path, opts);
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok && json.success !== false, status: res.status, data: json.data, raw: json, message: json.message || '', errors: json.errors || null };
    } catch (e) {
      return { ok: false, status: 0, message: 'Network problem — please check your connection and try again.' };
    }
  }

  function save() {
    try {
      const keep = ['chat', 'ended'].includes(state.mode) ? state.mode : 'guest';
      window.sessionStorage.setItem(STORE, JSON.stringify({ ...state, mode: keep, messages: state.messages.slice(-40) }));
    } catch (e) { /* storage blocked */ }
  }
  function load() {
    try {
      const s = JSON.parse(window.sessionStorage.getItem(STORE) || 'null');
      if (s && Array.isArray(s.messages)) state = { ...state, ...s };
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Window
  // ---------------------------------------------------------------------------
  function build() {
    const box = document.createElement('div');
    box.className = 'sp-chat';
    box.id = 'spChat';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Chat with SPOUZY');
    box.innerHTML =
      '<div class="sp-chat-head">' +
        '<div class="sp-chat-avatar" aria-hidden="true">S</div>' +
        '<div class="sp-chat-title"><strong>SPOUZY Assistant</strong><span><i class="sp-chat-dot"></i> Replies instantly · Confidential</span></div>' +
        '<a class="sp-chat-head-btn" data-chat-wa target="_blank" rel="noopener" title="WhatsApp our team" aria-label="WhatsApp our team"><i class="fa fa-whatsapp" aria-hidden="true"></i></a>' +
        '<a class="sp-chat-head-btn" data-chat-call title="Call us" aria-label="Call us"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg></a>' +
        '<button type="button" class="sp-chat-head-btn" data-chat-close aria-label="Close chat">&times;</button>' +
      '</div>' +
      '<div class="sp-chat-body" aria-live="polite"></div>' +
      '<div class="sp-chat-chips"></div>' +
      '<form class="sp-chat-form" autocomplete="off">' +
        '<input class="sp-chat-input" type="text" maxlength="500" placeholder="Type your question…" aria-label="Type your message">' +
        '<button type="button" class="sp-chat-eye" hidden aria-label="Show password">Show</button>' +
        '<button type="submit" class="sp-chat-send" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg></button>' +
      '</form>' +
      '<div class="sp-chat-foot">Automated assistant · general information, not medical advice · <a href="privacy-policy.htm">Privacy</a></div>';
    document.body.appendChild(box);
    el = {
      box,
      body: box.querySelector('.sp-chat-body'),
      chips: box.querySelector('.sp-chat-chips'),
      form: box.querySelector('.sp-chat-form'),
      input: box.querySelector('.sp-chat-input'),
      eye: box.querySelector('.sp-chat-eye')
    };
    box.querySelector('[data-chat-close]').addEventListener('click', close);
    el.form.addEventListener('submit', e => { e.preventDefault(); submit(el.input.value); });
    el.input.addEventListener('input', touch);
    el.eye.addEventListener('click', () => {
      const show = el.input.type === 'password';
      el.input.type = show ? 'text' : 'password';
      el.eye.textContent = show ? 'Hide' : 'Show';
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
    updateContactLinks();
  }

  function updateContactLinks() {
    if (!el.box) return;
    el.box.querySelector('[data-chat-wa]').href = waUrl('Hello SPOUZY, I have a question.');
    el.box.querySelector('[data-chat-call]').href = telUrl();
  }

  function setLauncher() {
    const launcher = document.getElementById('spWidgetLauncher');
    if (!launcher) return null;
    const icon = launcher.querySelector('.sp-floating-launcher-icon');
    // Chat-bubble icon drawn inline so it shows even if the icon font is slow to load
    if (icon) { icon.className = 'sp-floating-launcher-icon'; icon.innerHTML = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>'; }
    launcher.setAttribute('aria-label', 'Chat with SPOUZY');
    launcher.setAttribute('aria-controls', 'spChat');
    const label = document.getElementById('spFloatingHoverLabel');
    if (label) label.textContent = 'Chat with us';
    // Take over the button: the chat window replaces the old contact panel
    launcher.addEventListener('click', e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (el.box && !el.box.hidden) close(); else open();
    }, true);
    return launcher;
  }

  function open() {
    if (!el.box) build();
    el.box.hidden = false;
    document.body.classList.add('sp-chat-open');
    const launcher = document.getElementById('spWidgetLauncher');
    if (launcher) launcher.setAttribute('aria-expanded', 'true');
    render();
    begin();
    setTimeout(() => el.input.focus(), 50);
  }

  function close() {
    if (!el.box) return;
    el.box.hidden = true;
    document.body.classList.remove('sp-chat-open');
    const launcher = document.getElementById('spWidgetLauncher');
    if (launcher) launcher.setAttribute('aria-expanded', 'false');
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  function linkHtml(l) {
    const url = String(l.url || '');
    if (!/^(https?:|tel:|mailto:|[a-z0-9-]+\.htm)/i.test(url)) return '';
    const external = /^https?:/i.test(url);
    return '<a class="sp-chat-link" href="' + esc(url) + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.label) + ' ↗</a>';
  }

  function bubbleHtml(m) {
    if (m.divider) return '<div class="sp-chat-divider"><span>' + esc(m.divider) + '</span></div>';
    const text = esc(m.text).replace(/\n/g, '<br>');
    const links = (m.links || []).map(linkHtml).join('');
    return '<div class="sp-chat-msg is-' + (m.from === 'user' ? 'user' : 'bot') + '"><div class="sp-chat-bubble">' + text +
      (links ? '<div class="sp-chat-links">' + links + '</div>' : '') + '</div></div>';
  }

  function render() {
    if (!el.body) return;
    el.body.innerHTML = state.messages.map(bubbleHtml).join('');
    const last = [...state.messages].reverse().find(m => m.from === 'bot');
    showChips(last && last.chips ? last.chips : []);
    el.body.scrollTop = el.body.scrollHeight;
  }

  function showChips(chips) {
    el.chips.innerHTML = (chips || []).map(c => '<button type="button" class="sp-chat-chip">' + esc(c) + '</button>').join('');
    el.chips.querySelectorAll('.sp-chat-chip').forEach(b => b.addEventListener('click', () => submit(b.textContent)));
  }

  function push(m) {
    state.messages.push(m);
    state.lastActivity = Date.now();
    save();
    if (el.body) {
      el.body.insertAdjacentHTML('beforeend', bubbleHtml(m));
      if (m.from === 'bot' || m.divider) showChips(m.chips || []);
      el.body.scrollTop = el.body.scrollHeight;
    }
  }

  function bot(text, links, chips) {
    push({ from: 'bot', text, links: links || [], chips: chips || [] });
  }

  function typing(on) {
    const t = el.body && el.body.querySelector('.sp-chat-typing');
    if (on && !t && el.body) {
      el.body.insertAdjacentHTML('beforeend', '<div class="sp-chat-msg is-bot sp-chat-typing"><div class="sp-chat-bubble"><span></span><span></span><span></span></div></div>');
      el.body.scrollTop = el.body.scrollHeight;
    }
    if (!on && t) t.remove();
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function setInputMode(kind) {
    const pw = kind === 'password';
    el.input.type = pw ? 'password' : (kind === 'email' ? 'email' : (kind === 'tel' ? 'tel' : 'text'));
    el.input.setAttribute('autocomplete', pw ? (flow.kind === 'signup' ? 'new-password' : 'current-password') : 'off');
    el.eye.hidden = !pw;
    el.eye.textContent = 'Show';
    const placeholders = {
      password: 'Type your password', email: 'you@example.com', tel: '+91 98765 43210', name: 'Your full name', identifier: 'Email or mobile number'
    };
    el.input.placeholder = placeholders[kind] || 'Type your question…';
  }

  // ---------------------------------------------------------------------------
  // Idle handling: end the chat when nobody replies
  // ---------------------------------------------------------------------------
  function touch() {
    state.lastActivity = Date.now();
    armIdle();
  }

  function armIdle() {
    clearTimeout(idleTimer);
    if (state.mode === 'chat') {
      idleTimer = setTimeout(endForIdle, cfg.idleSeconds * 1000);
    } else if (state.mode !== 'guest' && state.mode !== 'ended') {
      idleTimer = setTimeout(() => {
        flow = {};
        state.mode = 'guest';
        setInputMode('text');
        bot('No problem — you can log in or create your account whenever you are ready.', [], ['Log in', 'Create account']);
      }, AUTH_IDLE_SECONDS * 1000);
    }
  }

  async function endForIdle() {
    if (state.mode !== 'chat' || !state.conversationId) return;
    const r = await api('POST', '/customer/chat/end', { conversationId: state.conversationId, reason: 'idle' });
    state.mode = 'ended';
    const m = r.ok && r.data && r.data.messages && r.data.messages[0];
    bot(m ? m.text : 'Thank you for chatting with SPOUZY. If you have any other question, just type it here.', [], ['Start a new chat']);
    push({ divider: 'Chat ended' });
    showChips(['Start a new chat', 'Prices', 'Packages']);
  }

  // ---------------------------------------------------------------------------
  // Conversation with the assistant (logged in)
  // ---------------------------------------------------------------------------
  async function startConversation(isNew) {
    const r = await api('POST', '/customer/chat/start', { page: window.location.pathname.split('/').pop() + window.location.search, conversationId: isNew ? null : state.conversationId });
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) { document.cookie = 'spouzy_customer=; Max-Age=0; path=/'; return guestWelcome(); }
      bot(r.message || 'The chat is not available right now. Please WhatsApp or call us.', [{ label: 'WhatsApp us', url: waUrl() }, { label: 'Call us', url: telUrl() }]);
      return false;
    }
    cfg.idleSeconds = r.data.idleSeconds || cfg.idleSeconds;
    state.conversationId = r.data.conversationId;
    state.mode = 'chat';
    if (!r.data.resumed) (r.data.messages || []).forEach(m => bot(m.text, m.links, m.chips));
    save();
    armIdle();
    return true;
  }

  async function ask(text) {
    busy = true;
    typing(true);
    const [r] = await Promise.all([
      api('POST', '/customer/chat/message', { conversationId: state.conversationId, text }),
      wait(450)
    ]);
    typing(false);
    busy = false;
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        document.cookie = 'spouzy_customer=; Max-Age=0; path=/';
        state.mode = 'guest';
        state.pendingQuestion = text;
        return bot('Your login has expired. Please log in again and I will answer straight away.', [], ['Log in', 'Create account']);
      }
      return bot(r.message || 'Sorry, something went wrong. Please try again.', [{ label: 'WhatsApp us', url: waUrl(text) }], []);
    }
    if (r.data.restarted) push({ divider: 'New chat' });
    state.conversationId = r.data.conversationId;
    (r.data.messages || []).forEach(m => bot(m.text, m.links, m.chips));
    if (r.data.ended) {
      state.mode = 'ended';
      push({ divider: 'Chat ended' });
      showChips(['Start a new chat']);
      clearTimeout(idleTimer);
    } else {
      state.mode = 'chat';
      armIdle();
    }
    save();
  }

  // ---------------------------------------------------------------------------
  // Guest: log in or create the account inside the chat
  // ---------------------------------------------------------------------------
  function guestWelcome() {
    state.mode = 'guest';
    setInputMode('text');
    bot("Hi! I'm the SPOUZY assistant. Please log in or create a free account to chat with me — it keeps your conversation private. Then I can help with prices, packages, bookings and more.",
      [], ['Log in', 'Create account', 'WhatsApp us', 'Call us']);
    return false;
  }

  function startLogin(identifier) {
    flow = { kind: 'login', identifier: identifier || '' };
    if (identifier) {
      state.mode = 'login_pw';
      setInputMode('password');
      bot('Please enter your password.', [], ['Forgot password', 'Cancel']);
    } else {
      state.mode = 'login_id';
      setInputMode('identifier');
      bot('Sure. Please type the email or mobile number of your account.', [], ['Create account instead', 'Cancel']);
    }
    armIdle();
  }

  function startSignup() {
    flow = { kind: 'signup' };
    state.mode = 'signup_name';
    setInputMode('name');
    bot("Let's create your free account — it takes about a minute.\nWhat's your full name?", [], ['Cancel']);
    armIdle();
  }

  async function afterAuth(welcome) {
    flow = {};
    setInputMode('text');
    const me = await api('GET', '/auth/me');
    const user = me.raw && me.raw.user;
    if (window.SpouzyTracker) await window.SpouzyTracker.flushPreLogin();
    try { document.dispatchEvent(new CustomEvent('spouzy:login', { detail: { user } })); } catch (e) { /* old browser */ }
    bot(welcome, [{ label: 'Go to My Account', url: 'account.htm' }], []);
    const pending = state.pendingQuestion;
    state.pendingQuestion = '';
    const ok = await startConversation(true);
    if (ok && pending) {
      push({ from: 'user', text: pending });
      await ask(pending);
    }
  }

  async function handleAuthStep(raw) {
    const text = String(raw || '').trim();
    const lower = text.toLowerCase();
    if (/^(cancel|stop|exit)$/.test(lower)) {
      flow = {};
      state.mode = 'guest';
      setInputMode('text');
      return bot('Okay, cancelled. You can log in or create an account any time.', [], ['Log in', 'Create account']);
    }
    if (lower === 'create account instead') return startSignup();
    switch (state.mode) {
      case 'login_id': {
        if (lower === 'create account instead') return startSignup();
        if (!text) return bot('Please type your email or mobile number.');
        flow.identifier = text;
        state.mode = 'login_pw';
        setInputMode('password');
        return bot('Thanks. Now please enter your password.', [], ['Forgot password', 'Cancel']);
      }
      case 'login_pw': {
        if (lower === 'forgot password') {
          return bot('No problem — message our team on WhatsApp and we will reset your password.',
            [{ label: 'WhatsApp us', url: waUrl('Hello SPOUZY, please help me reset my account password. My email/mobile: ' + (flow.identifier || '')) }], ['Try again', 'Cancel']);
        }
        if (lower === 'try again') return bot('Please enter your password.');
        if (!text) return bot('Please enter your password.');
        typing(true);
        const r = await api('POST', '/auth/customer/login', { identifier: flow.identifier, password: text, source: 'Chat' });
        typing(false);
        if (r.ok) {
          const name = r.raw.user && (r.raw.user.first_name || r.raw.user.name);
          return afterAuth(`Welcome back${name ? ', ' + name : ''}! You are logged in.`);
        }
        return bot((r.message || 'Those details did not match.') + ' Please try your password again.', [], ['Forgot password', 'Create account instead', 'Cancel']);
      }
      case 'signup_name': {
        if (text.length < 2) return bot('Please type your full name.');
        flow.name = text;
        state.mode = 'signup_email';
        setInputMode('email');
        return bot(`Thanks, ${text.split(' ')[0]}. What's your email address?`, [], ['Cancel']);
      }
      case 'signup_email': {
        if (!EMAIL_RE.test(text)) return bot('That does not look like an email address. Please check and type it again.');
        typing(true);
        const r = await api('POST', '/auth/customer/check', { email: text });
        typing(false);
        if (r.ok && r.data && r.data.exists) {
          if (!r.data.can_login) return bot('This email cannot be used. Please type a different email address.');
          flow = { kind: 'login', identifier: text };
          state.mode = 'login_pw';
          setInputMode('password');
          return bot('You already have an account with this email. Please enter your password to log in.', [], ['Forgot password', 'Cancel']);
        }
        flow.email = text;
        state.mode = 'signup_phone';
        setInputMode('tel');
        return bot('Your mobile number (WhatsApp), with country code?', [], ['Cancel']);
      }
      case 'signup_phone': {
        const d = digits(text);
        if (d.length < 10 || d.length > 15) return bot('Please type a valid mobile number, for example +91 98765 43210.');
        typing(true);
        const r = await api('POST', '/auth/customer/check', { phone: text });
        typing(false);
        if (r.ok && r.data && r.data.exists) {
          flow = { kind: 'login', identifier: text };
          state.mode = 'login_pw';
          setInputMode('password');
          return bot(`This mobile number already has an account (${r.data.masked_email}). Please enter your password to log in.`, [], ['Forgot password', 'Cancel']);
        }
        flow.phone = text;
        state.mode = 'signup_pw';
        setInputMode('password');
        return bot('Now choose a password: at least 8 characters, with an upper-case letter, a lower-case letter and a number.', [], ['Cancel']);
      }
      case 'signup_pw': {
        if (!(text.length >= 8 && /[A-Z]/.test(text) && /[a-z]/.test(text) && /\d/.test(text))) {
          return bot('That password is too weak. Use at least 8 characters with an upper-case letter, a lower-case letter and a number.');
        }
        flow.password = text;
        state.mode = 'signup_terms';
        setInputMode('text');
        return bot('Last step: do you agree to our Terms of Use and Privacy Policy? While you are logged in, we keep a record of the pages you open and actions you take on this website (never what you type) so our team can help you.',
          [{ label: 'Terms of Use', url: 'terms.htm' }, { label: 'Privacy Policy', url: 'privacy-policy.htm' }], ['I agree', 'No']);
      }
      case 'signup_terms': {
        if (!/^(i agree|agree|yes|y|ok|okay|haan|ha|accept)$/.test(lower)) {
          flow = {};
          state.mode = 'guest';
          return bot('No problem — we need your agreement to create an account. You can still reach our team directly.', [{ label: 'WhatsApp us', url: waUrl() }, { label: 'Call us', url: telUrl() }], ['Create account', 'Log in']);
        }
        typing(true);
        const r = await api('POST', '/auth/customer/register', { name: flow.name, email: flow.email, phone: flow.phone, password: flow.password, consent: true, source: 'Chat' });
        typing(false);
        if (r.ok) {
          const first = String(flow.name || '').split(' ')[0];
          return afterAuth(`Your account is ready, ${first}! You are now logged in. You can see your bookings and orders in My Account.`);
        }
        const errs = r.errors ? Object.values(r.errors).join(' ') : '';
        if (r.status === 409) {
          flow = { kind: 'login', identifier: flow.email };
          state.mode = 'login_pw';
          setInputMode('password');
          return bot((r.message || 'You already have an account.') + ' Please enter your password to log in.', [], ['Forgot password', 'Cancel']);
        }
        flow = {};
        state.mode = 'guest';
        return bot((r.message || 'Could not create the account.') + (errs ? ' ' + errs : '') + ' Please try again.', [], ['Create account', 'Log in']);
      }
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  async function submit(raw) {
    const text = String(raw || '').trim();
    if (!text || busy) return;
    el.input.value = '';
    const masked = state.mode === 'login_pw' || state.mode === 'signup_pw';
    if (!(masked && ['Forgot password', 'Cancel', 'Try again'].includes(text))) {
      push({ from: 'user', text: masked && !['Forgot password', 'Cancel', 'Try again', 'Create account instead'].includes(text) ? '••••••••' : text });
    } else {
      push({ from: 'user', text });
    }
    touch();
    const lower = text.toLowerCase();

    if (lower === 'whatsapp us') { window.open(waUrl('Hello SPOUZY, I have a question.'), '_blank', 'noopener'); return bot('Opening WhatsApp…', [{ label: 'WhatsApp us', url: waUrl() }]); }
    if (lower === 'call us') { window.location.href = telUrl(); return bot(`Calling ${cfg.phone}…`, [{ label: `Call ${cfg.phone}`, url: telUrl() }]); }

    if (state.mode === 'guest') {
      if (lower === 'log in' || lower === 'login') return startLogin();
      if (lower === 'create account' || lower === 'sign up' || lower === 'signup') return startSignup();
      if (loggedIn()) return startConversation(true).then(ok => ok && ask(text));
      state.pendingQuestion = text;
      return bot('Please log in or create your free account first — then I will answer this straight away.', [], ['Log in', 'Create account']);
    }
    if (state.mode.startsWith('login_') || state.mode.startsWith('signup_')) {
      busy = true;
      try { await handleAuthStep(text); } finally { busy = false; }
      return;
    }
    if (state.mode === 'ended' && lower === 'start a new chat') {
      push({ divider: 'New chat' });
      return startConversation(true);
    }
    if (!state.conversationId) {
      const ok = await startConversation(true);
      if (!ok) return;
    }
    return ask(text);
  }

  async function begin() {
    if (state.messages.length) {
      // Returning to the chat on another page: end it if it has been idle too long
      if (state.mode === 'chat' && Date.now() - (state.lastActivity || 0) > cfg.idleSeconds * 1000) {
        await endForIdle();
      } else if (state.mode === 'chat') {
        armIdle();
      } else if (state.mode === 'guest' && loggedIn()) {
        return startConversation(true);
      }
      return;
    }
    if (loggedIn()) return startConversation(true);
    return guestWelcome();
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  async function init() {
    load();
    try {
      const r = await fetch(API + '/content/settings', { credentials: 'same-origin' }).then(x => x.json());
      const s = (r && r.data) || {};
      if (String(s.chat_enabled) === 'false') return; // chat switched off: keep the old contact panel
      const idle = parseInt(s.chat_idle_seconds, 10);
      if (idle >= 15 && idle <= 600) cfg.idleSeconds = idle;
      if (s.contact_phone) cfg.phone = s.contact_phone;
      if (s.whatsapp_number) cfg.whatsapp = s.whatsapp_number;
    } catch (e) { /* use defaults */ }
    // The round button may be created by spouzy-modern.js a moment later on some pages
    let launcher = setLauncher();
    for (let i = 0; !launcher && i < 10; i++) {
      await wait(300);
      launcher = setLauncher();
    }
    if (!launcher) return;
    // A user who logs out elsewhere starts again as a guest
    if (!loggedIn() && ['chat', 'ended'].includes(state.mode)) {
      state = { mode: 'guest', conversationId: null, messages: [], lastActivity: 0, pendingQuestion: '' };
      save();
    }
    window.SpouzyChat = { open, close };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
