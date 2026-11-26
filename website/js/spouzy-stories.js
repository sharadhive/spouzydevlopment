/**
 * SPOUZY client stories (loaded by spouzy-content.js where needed)
 *   - index.htm:                the "Real Transformations" carousel shows approved stories only
 *   - testimonials-policy.htm:  all approved stories + "Share your story"
 *   - account.htm:              My stories (share, see the status, edit, withdraw)
 * Sharing needs a customer login. The website shows only the first and last letters of the name
 * ("Rohit & Priya S." -> "R***t & P***a S."), or "Anonymous". Every story is read by the team first.
 */
(function () {
  'use strict';

  const API = '/api';
  const MIN = 40;
  const MAX = 3000;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
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
      const t = readCookie('spouzy_csrf');
      if (t) opts.headers['X-CSRF-Token'] = t;
    }
    try {
      const res = await fetch(API + path, opts);
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok && json.success !== false, status: res.status, data: json.data, message: json.message || '', errors: json.errors || null };
    } catch (e) {
      return { ok: false, status: 0, data: null, message: 'Network error. Please check your connection and try again.', errors: null };
    }
  }

  // Same rule as the server (story.service.js): first and last letter, stars in between
  function maskWord(word) {
    const m = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}\p{M}'’-]+)([^\p{L}\p{N}]*)$/u);
    if (!m) return word;
    const chars = Array.from(m[2].replace(/[’']/g, ''));
    if (chars.length <= 1) return m[1] + m[2] + m[3];
    if (chars.length === 2) return m[1] + chars[0] + '*' + m[3];
    return m[1] + chars[0] + '*'.repeat(Math.min(4, chars.length - 2)) + chars[chars.length - 1] + m[3];
  }
  function shownName(name, anonymous) {
    const n = String(name || '').replace(/\s+/g, ' ').trim();
    if (anonymous || !n) return 'Anonymous';
    return n.split(' ').map(w => (/^(&|and|aur|\+|\/|-)$/i.test(w) ? w : maskWord(w))).join(' ');
  }

  function stars(n) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += '<i class="fa ' + (i <= n ? 'fa-star' : 'fa-star-o') + '" aria-hidden="true"></i>';
    return '<div class="sp-testi-stars" aria-label="' + n + ' out of 5 stars">' + h + '</div>';
  }

  function cardHtml(s, i) {
    return '<div class="sp-testimonial-card" data-index="' + i + '">' +
      '<div class="sp-quote-watermark" aria-hidden="true"><i class="fa fa-quote-right"></i></div>' +
      stars(s.rating) +
      '<p class="sp-testi-quote">“' + esc(s.quote) + '”</p>' +
      '<div class="sp-testi-footer"><div class="sp-testi-author-info">' +
        '<span class="sp-testi-author">' + esc(s.name) + '</span>' +
        (s.badge ? '<span class="sp-testi-badge"><i class="fa fa-check-circle" aria-hidden="true"></i> ' + esc(s.badge) + '</span>' : '') +
      '</div>' + (s.tag ? '<span class="sp-testi-tag">' + esc(s.tag) + '</span>' : '') + '</div></div>';
  }

  function inviteCard(i, first) {
    return '<div class="sp-testimonial-card sp-story-invite-card" data-index="' + i + '">' +
      '<div class="sp-story-invite-icon" aria-hidden="true"><i class="fa fa-heart"></i></div>' +
      '<h3>' + (first ? 'Be the first to share your SPOUZY story' : 'Your story can give someone hope') + '</h3>' +
      '<div class="sp-story-invite-text">Did our counselling, clinic or mediation help you? Share a few lines. Our team reads every story before it appears, and only the first and last letters of your name are shown.</div>' +
      '<button type="button" class="sp-story-invite-btn" data-share-story><i class="fa fa-pencil" aria-hidden="true"></i> Share your story</button>' +
      '</div>';
  }

  // ---------------------------------------------------------------------------
  // Homepage carousel
  // ---------------------------------------------------------------------------
  async function initHome(section) {
    const track = section.querySelector('.sp-testimonials-track');
    const dots = section.querySelector('.sp-testi-dots');
    if (!track) return;
    const r = await api('GET', '/content/stories?home=1');
    const stories = r.ok && Array.isArray(r.data) ? r.data : [];
    const cards = stories.map(cardHtml);
    cards.push(inviteCard(stories.length, !stories.length));
    track.innerHTML = cards.join('');
    if (dots) {
      dots.innerHTML = cards.map((c, i) => '<button type="button" class="sp-testi-dot' + (i === 0 ? ' active' : '') + '" role="tab" aria-selected="' + (i === 0) + '" aria-label="Show story ' + (i + 1) + '"></button>').join('');
    }
    const nav = section.querySelector('.sp-testimonials-nav');
    if (nav) nav.hidden = cards.length < 2;
    section.classList.add('has-live-stories');
    document.dispatchEvent(new CustomEvent('spouzy:testimonials-updated'));
  }

  // ---------------------------------------------------------------------------
  // Testimonials page: all approved stories
  // ---------------------------------------------------------------------------
  async function initStoriesPage() {
    const wrap = document.getElementById('spStoriesSection');
    const list = document.getElementById('spStoriesList');
    if (wrap && list) {
      const r = await api('GET', '/content/stories');
      const stories = r.ok && Array.isArray(r.data) ? r.data : [];
      if (stories.length) {
        list.innerHTML = '<div class="sp-story-grid">' + stories.map(s =>
          '<article class="sp-story-tile">' + stars(s.rating) +
            '<p>“' + esc(s.quote) + '”</p>' +
            '<footer><strong>' + esc(s.name) + '</strong>' +
            (s.badge ? '<span class="sp-testi-badge"><i class="fa fa-check-circle" aria-hidden="true"></i> ' + esc(s.badge) + '</span>' : '') +
            (s.tag ? '<small>' + esc(s.tag) + '</small>' : '') + '</footer></article>').join('') + '</div>';
        wrap.style.display = '';
      }
    }
    const share = document.getElementById('spShareStorySection');
    if (share) {
      share.innerHTML =
        '<h2 class="sp-share-title">Share your story</h2>' +
        '<p>Did SPOUZY help you or your family? Your experience can give hope to someone facing the same situation.</p>' +
        '<ul class="sp-share-points">' +
          '<li><i class="fa fa-lock" aria-hidden="true"></i> Log in or create a free account first, so every story comes from a real person.</li>' +
          '<li><i class="fa fa-user-secret" aria-hidden="true"></i> Only the first and last letters of your name are shown (for example R***t & P***a S.), or choose Anonymous.</li>' +
          '<li><i class="fa fa-check" aria-hidden="true"></i> Our team reads every story before it appears. You can edit or withdraw it any time from My account.</li>' +
        '</ul>' +
        '<button type="button" class="sp-cta-primary" data-share-story><span>Share your story</span><span class="arrow">↗</span></button>';
    }
  }

  // ---------------------------------------------------------------------------
  // Login, then the story form in a popup
  // ---------------------------------------------------------------------------
  function loadShop() {
    if (window.SpouzyAccount) return Promise.resolve(window.SpouzyAccount);
    return new Promise(resolve => {
      let s = document.querySelector('script[src$="spouzy-shop.js"]');
      const done = () => resolve(window.SpouzyAccount || null);
      if (!s) {
        s = document.createElement('script');
        s.src = 'js/spouzy-shop.js';
        s.onload = done;
        s.onerror = () => resolve(null);
        document.body.appendChild(s);
      } else {
        s.addEventListener('load', done);
        setTimeout(done, 1500);
      }
    });
  }

  async function ensureLogin() {
    const mine = await api('GET', '/customer/stories');
    if (mine.ok) return mine.data;
    const acc = await loadShop();
    if (!acc) {
      window.location.href = 'register.htm?next=' + encodeURIComponent('account.htm#stories');
      return null;
    }
    const user = await acc.requireLogin({}, { context: 'story' });
    if (!user) return null;
    const again = await api('GET', '/customer/stories');
    return again.ok ? again.data : null;
  }

  let modal = null;
  function modalShell() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'sp-gate-backdrop sp-story-modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="sp-gate sp-story-dialog" role="dialog" aria-modal="true" aria-labelledby="spStoryTitle">' +
      '<button type="button" class="sp-gate-close" aria-label="Close">&times;</button><div class="sp-story-dialog-body"></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('.sp-gate-close').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal && !modal.hidden) closeModal(); });
    return modal;
  }
  let lastFocus = null;
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('sp-gate-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /** Open the form. `existing` = a story from My stories to edit */
  async function openShare(existing, onDone) {
    lastFocus = document.activeElement;
    const info = await ensureLogin();
    if (!info) return;
    const el = modalShell();
    const body = el.querySelector('.sp-story-dialog-body');
    const s = existing || {};
    const services = info.services || [];
    const name = s.id ? (s.is_anonymous ? '' : s.display_name) : (info.suggested_name || '');
    const rating = s.rating || 5;
    body.innerHTML =
      '<div class="sp-gate-icon" aria-hidden="true"><i class="fa fa-heart"></i></div>' +
      '<h2 id="spStoryTitle">' + (s.id ? 'Edit your story' : 'Share your story') + '</h2>' +
      '<p class="sp-gate-sub">' + (s.id ? 'After you save, our team reads it again before it shows on the website.' : 'Our team reads every story before it appears on the website.') + '</p>' +
      '<form class="sp-story-form" novalidate>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spStService">Which SPOUZY care did you use? <span class="sp-req">*</span></label>' +
          '<select class="sp-form-input-modern" id="spStService" name="service_key" required><option value="">Choose…</option>' +
          services.map(x => '<option value="' + esc(x.key) + '"' + (s.service_key === x.key ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select></div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spStText">Your story <span class="sp-req">*</span></label>' +
          '<textarea class="sp-form-textarea-modern" id="spStText" name="story_text" rows="6" minlength="' + MIN + '" maxlength="' + MAX + '" required placeholder="What was difficult before, how the sessions helped, how things are now…">' + esc(s.story_text || '') + '</textarea>' +
          '<small class="sp-story-count"></small></div>' +
        '<div class="sp-form-group-modern"><span class="sp-form-label-modern">Your rating</span><div class="sp-story-rate" role="radiogroup" aria-label="Rating">' +
          [1, 2, 3, 4, 5].map(i => '<button type="button" role="radio" aria-checked="' + (i === rating) + '" data-rate="' + i + '" aria-label="' + i + ' star' + (i > 1 ? 's' : '') + '"><span aria-hidden="true">★</span></button>').join('') +
          '</div></div>' +
        '<div class="sp-story-two">' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spStName">Name to show</label>' +
            '<input class="sp-form-input-modern" id="spStName" name="display_name" maxlength="100" value="' + esc(name) + '" placeholder="e.g. Rohit &amp; Priya S."></div>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spStCity">City <span class="sp-opt">(optional)</span></label>' +
            '<input class="sp-form-input-modern" id="spStCity" name="city" maxlength="80" value="' + esc(s.city || '') + '" placeholder="e.g. Pune"></div>' +
        '</div>' +
        '<label class="sp-story-check"><input type="checkbox" name="is_anonymous"' + (s.is_anonymous ? ' checked' : '') + '><span>Stay anonymous (no letters of my name)</span></label>' +
        '<p class="sp-story-shown">Shown on the website as: <strong data-shown></strong></p>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="spStTag">A short detail <span class="sp-opt">(optional)</span></label>' +
          '<input class="sp-form-input-modern" id="spStTag" name="tag_line" maxlength="120" value="' + esc(s.tag_line || '') + '" placeholder="e.g. Married 6 years, or Engaged couple"></div>' +
        (s.id ? '' : '<label class="sp-story-check sp-story-consent"><input type="checkbox" name="consent" required><span>I give SPOUZY permission to publish my story as described in the <a href="testimonials-policy.htm" target="_blank" rel="noopener">Reviews &amp; Testimonials Policy</a>. I can edit or withdraw it any time. <span class="sp-req">*</span></span></label>') +
        '<p class="sp-form-error" data-story-error hidden></p>' +
        '<button type="submit" class="sp-cta-primary sp-auth-submit"><span>' + (s.id ? 'Save and send for review' : 'Send my story') + '</span><span class="arrow">↗</span></button>' +
        '<p class="sp-auth-help">Please do not name a doctor or share medical details you would not want others to read.</p>' +
      '</form>';
    el.hidden = false;
    document.body.classList.add('sp-gate-open');

    const form = body.querySelector('form');
    const text = form.querySelector('[name="story_text"]');
    const count = form.querySelector('.sp-story-count');
    const nameIn = form.querySelector('[name="display_name"]');
    const anon = form.querySelector('[name="is_anonymous"]');
    const shown = form.querySelector('[data-shown]');
    const err = form.querySelector('[data-story-error]');
    let rate = rating;

    function update() {
      const n = text.value.trim().length;
      count.textContent = n < MIN ? (MIN - n) + ' more characters needed' : n + ' / ' + MAX;
      count.classList.toggle('is-ok', n >= MIN);
      shown.textContent = shownName(nameIn.value, anon.checked);
      nameIn.disabled = anon.checked;
    }
    text.addEventListener('input', update);
    nameIn.addEventListener('input', update);
    anon.addEventListener('change', update);
    form.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
      rate = parseInt(b.getAttribute('data-rate'), 10);
      form.querySelectorAll('[data-rate]').forEach(x => {
        const v = parseInt(x.getAttribute('data-rate'), 10);
        x.classList.toggle('is-on', v <= rate);
        x.setAttribute('aria-checked', String(v === rate));
      });
    }));
    form.querySelectorAll('[data-rate]').forEach(x => x.classList.toggle('is-on', parseInt(x.getAttribute('data-rate'), 10) <= rate));
    update();
    setTimeout(() => (s.id ? text : form.querySelector('select')).focus(), 40);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        service_key: form.querySelector('[name="service_key"]').value,
        story_text: text.value.trim(),
        rating: rate,
        display_name: anon.checked ? '' : nameIn.value.trim(),
        is_anonymous: anon.checked,
        city: form.querySelector('[name="city"]').value.trim(),
        tag_line: form.querySelector('[name="tag_line"]').value.trim()
      };
      const consent = form.querySelector('[name="consent"]');
      if (!payload.service_key) return showErr('Please choose which SPOUZY care you used.');
      if (payload.story_text.length < MIN) return showErr('Please write at least ' + MIN + ' characters.');
      if (!payload.is_anonymous && !payload.display_name) return showErr('Please enter the name to show, or tick “Stay anonymous”.');
      if (consent && !consent.checked) return showErr('Please tick the box to give permission to publish your story.');
      if (consent) payload.consent = true;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const old = btn.innerHTML;
      btn.innerHTML = '<span><i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Sending…</span>';
      const r = s.id ? await api('PUT', '/customer/stories/' + s.id, payload) : await api('POST', '/customer/stories', payload);
      btn.disabled = false;
      btn.innerHTML = old;
      if (!r.ok) {
        const list = r.errors ? Object.values(r.errors).filter(Boolean) : [];
        return showErr(esc(list.length ? list.join(' ') : r.message || 'Could not send your story. Please try again.'));
      }
      body.innerHTML =
        '<div class="sp-story-thanks">' +
          '<div class="sp-gate-icon" aria-hidden="true"><i class="fa fa-check"></i></div>' +
          '<h2 id="spStoryTitle">Thank you for sharing</h2>' +
          '<p class="sp-gate-sub">Our team will read your story and publish it soon. It will show as <strong>' + esc(r.data.shown_as) + '</strong>. You can see its status, edit it or withdraw it in <a href="account.htm#stories">My account → My stories</a>.</p>' +
          '<button type="button" class="sp-cta-primary sp-auth-submit" data-close><span>Done</span><span class="arrow">↗</span></button>' +
        '</div>';
      body.querySelector('[data-close]').addEventListener('click', closeModal);
      if (onDone) onDone(r.data);
      document.dispatchEvent(new CustomEvent('spouzy:story-saved'));
    });

    function showErr(msg) {
      err.innerHTML = msg;
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ---------------------------------------------------------------------------
  // My account: My stories
  // ---------------------------------------------------------------------------
  const STATE = {
    pending: { label: 'Waiting for review', cls: 'is-pending', note: 'Our team will read it soon.' },
    live: { label: 'Live on the website', cls: 'is-live', note: 'Thank you! It is shown on the homepage and the stories page.' },
    hidden: { label: 'Not shown right now', cls: 'is-hidden', note: 'Our team has paused it for now.' },
    rejected: { label: 'Not published', cls: 'is-rejected', note: 'It was not published. You can edit it and send it again.' }
  };

  async function mountMyStories(box) {
    if (!box || box.dataset.mounted === '1') return;
    box.dataset.mounted = '1';
    async function load() {
      const r = await api('GET', '/customer/stories');
      if (!r.ok) { box.innerHTML = '<p>Your stories could not be loaded. Please refresh the page.</p>'; return; }
      const stories = r.data.stories || [];
      const shortcut = document.querySelector('[data-my-stories-count]');
      if (shortcut) shortcut.textContent = stories.length ? stories.length + (stories.length === 1 ? ' story' : ' stories') : 'Share your experience';
      box.innerHTML =
        (stories.length ? '<div class="sp-my-stories">' + stories.map(s => {
          const st = STATE[s.state] || STATE.pending;
          return '<article class="sp-my-story ' + st.cls + '">' +
            '<header><span class="sp-my-story-state">' + st.label + '</span><small>' + esc(new Date(s.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })) + (s.service_label ? ' · ' + esc(s.service_label) : '') + '</small></header>' +
            '<p>“' + esc(s.story_text.length > 320 ? s.story_text.slice(0, 320) + '…' : s.story_text) + '”</p>' +
            '<div class="sp-my-story-meta">Shown as <strong>' + esc(s.shown_as) + '</strong> · ' + s.rating + '/5' + (s.edited_by_team ? ' · lightly edited by our team' : '') + '</div>' +
            '<div class="sp-my-story-note">' + esc(st.note) + (s.customer_message ? ' <em>Message from SPOUZY: ' + esc(s.customer_message) + '</em>' : '') + '</div>' +
            '<div class="sp-my-story-actions"><button type="button" class="sp-auth-secondary" data-edit="' + s.id + '">Edit</button>' +
            '<button type="button" class="sp-link-danger" data-withdraw="' + s.id + '">Withdraw</button></div>' +
            '</article>';
        }).join('') + '</div>' : '<p>You have not shared a story yet. If SPOUZY helped you, a few lines can give hope to someone else.</p>') +
        '<div class="sp-shop-actions"><button type="button" class="sp-cta-primary" data-share-story><span>' + (stories.length ? 'Share another story' : 'Share your story') + '</span><span class="arrow">↗</span></button></div>' +
        '<p class="sp-my-story-privacy"><i class="fa fa-user-secret" aria-hidden="true"></i> The website shows only the first and last letters of the name (or Anonymous). Your email, phone and account are never shown.</p>';
      box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
        const s = stories.find(x => String(x.id) === b.getAttribute('data-edit'));
        if (s) openShare(s, load);
      }));
      box.querySelectorAll('[data-withdraw]').forEach(b => b.addEventListener('click', async () => {
        if (!window.confirm('Withdraw this story? It is removed from the website and deleted. This cannot be undone.')) return;
        const r2 = await api('DELETE', '/customer/stories/' + b.getAttribute('data-withdraw'));
        if (r2.ok) load(); else window.alert(r2.message || 'Could not withdraw the story.');
      }));
    }
    document.addEventListener('spouzy:story-saved', load);
    await load();
    if (/[?&]share=1/.test(location.search) || location.hash === '#share-story') openShare(null, load);
    if (location.hash === '#stories') setTimeout(() => { const sec = document.getElementById('stories'); if (sec) sec.scrollIntoView({ behavior: 'smooth' }); }, 200);
  }

  // ---------------------------------------------------------------------------
  function boot() {
    const home = document.querySelector('[data-live-stories]');
    if (home) initHome(home);
    if (document.getElementById('spStoriesList') || document.getElementById('spShareStorySection')) initStoriesPage();
    const mine = document.getElementById('spMyStories');
    if (mine) mountMyStories(mine);
    document.addEventListener('spouzy:account-ready', () => mountMyStories(document.getElementById('spMyStories')));
    // any "Share your story" button on the page
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-share-story]');
      if (!b) return;
      e.preventDefault();
      openShare(null, null);
    });
    if (!mine && /[?&]share=1/.test(location.search)) openShare(null, null);
  }

  window.SpouzyStories = { open: openShare, maskName: shownName };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
