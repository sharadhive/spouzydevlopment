/**
 * SPOUZY FAQs on the website (loaded by spouzy-content.js where needed)
 *   - faq.htm:            topics -> the topic's questions -> the answer opens in a popup, one at a time
 *                         (answers are loaded one by one; the FAQ area cannot be selected or copied)
 *   - index.htm:          the homepage questions chosen in the admin ([data-faq-list="home"])
 *   - What We Do pages:   the questions ticked for that page ([data-faq-page="pre-marriage"] …)
 * The questions already in the HTML stay as the fallback when the server cannot be reached.
 */
(function () {
  'use strict';

  const API = '/api';
  const PAGES = [
    { key: 'pre-marriage', label: 'Pre-Marriage' },
    { key: 'post-marriage', label: 'Post-Marriage' },
    { key: 'relationships', label: 'Relationship Guidance' },
    { key: 'intimate-health', label: 'Intimate Health Care' },
    { key: 'intimate-aesthetics', label: 'Intimate Aesthetics' },
    { key: 'divorce-mediation', label: 'Divorce Mediation' },
    { key: 'harassment-support', label: 'Prevent Sexual Violence' }
  ];

  function getJson(path) {
    return fetch(API + path, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.success !== false ? j.data : null))
      .catch(() => null);
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function track(label) {
    try { if (window.SpouzyTracker) window.SpouzyTracker.push({ event: 'click', label: label.slice(0, 120), href: location.pathname.split('/').pop() }); } catch (e) { /* optional */ }
  }

  /** One question as an accessible <details> accordion */
  function item(f, opts) {
    opts = opts || {};
    return '<details class="sp-faq-item" id="faq-' + f.id + '"' + (opts.open ? ' open' : '') + '>' +
      '<summary><span class="sp-faq-q">' + esc(f.question) + '</span><span class="sp-faq-toggle" aria-hidden="true"></span></summary>' +
      '<div class="sp-faq-answer">' + (f.answer_html || '') +
      (opts.share ? '<a class="sp-faq-link" href="faq.htm#faq-' + f.id + '" data-copy-faq="' + f.id + '">Link to this answer</a>' : '') +
      '</div></details>';
  }

  // ---------------------------------------------------------------------------
  // FAQ page: choose a topic -> list of questions -> tap a question -> the answer opens in a popup.
  // Only questions are loaded; each answer is fetched when it is opened and only one is on screen
  // at a time, so the whole set cannot be selected and copied in one go.
  // ---------------------------------------------------------------------------
  const TOPIC_ICONS = [
    [/pregnan|fertil|family|baby|concept/i, 'fa-child'],
    [/female|women|woman|vagin|menstru/i, 'fa-female'],
    [/\bmale\b|\bmen\b|erect|penis|sperm|ejacul/i, 'fa-male'],
    [/hiv|aids|sti\b|std|infection/i, 'fa-medkit'],
    [/orientation|anal|safety|safe/i, 'fa-shield'],
    [/relationship|emotion|couple|marri|communicat/i, 'fa-comments'],
    [/orgasm|response|desire|libido/i, 'fa-heartbeat'],
    [/aphrodis|enhanc|supplement|food/i, 'fa-leaf'],
    [/position|kama/i, 'fa-venus-mars'],
    [/medical|condition|disease|health|doctor/i, 'fa-stethoscope'],
    [/privacy|confiden/i, 'fa-lock'],
    [/book|appoint|session|price|payment/i, 'fa-calendar']
  ];
  function topicIcon(name) {
    const hit = TOPIC_ICONS.find(x => x[0].test(name));
    return hit ? hit[1] : 'fa-question-circle';
  }

  function initFaqPage(section, faqs) {
    if (!Array.isArray(faqs) || !faqs.length) return; // keep the questions written in the page
    const params = new URLSearchParams(location.search);
    const state = { q: params.get('q') || '', cat: params.get('category') || '', page: params.get('for') || '', shown: 25, openId: null };
    if (state.page && !PAGES.some(p => p.key === state.page)) state.page = '';
    const answers = new Map();

    function pool() { return state.page ? faqs.filter(f => (f.pages || []).includes(state.page)) : faqs; }
    function topics() {
      const counts = {};
      pool().forEach(f => { const c = f.category || 'General'; counts[c] = (counts[c] || 0) + 1; });
      return Object.keys(counts).sort((x, y) => counts[y] - counts[x] || x.localeCompare(y)).map(name => ({ name, count: counts[name] }));
    }
    if (state.cat && !topics().some(tp => tp.name === state.cat)) state.cat = '';
    const pageLabel = () => (PAGES.find(p => p.key === state.page) || {}).label || '';

    section.classList.add('sp-faq-browser', 'sp-faqx', 'sp-protect');
    section.removeAttribute('style');
    section.innerHTML =
      '<div class="sp-faq-browser-head">' +
        '<h2 id="spFaqTitle">Frequently Asked Questions</h2>' +
        '<p class="sp-faqx-intro"></p>' +
      '</div>' +
      '<div class="sp-faq-search-box" role="search">' +
        '<i class="fa fa-search" aria-hidden="true"></i>' +
        '<label class="sp-sr-only" for="spFaqSearch">Search the questions</label>' +
        '<input type="search" id="spFaqSearch" placeholder="Search a question, e.g. “pregnancy” or “privacy”" autocomplete="off" value="' + esc(state.q) + '">' +
        '<button type="button" class="sp-faq-clear" aria-label="Clear search" hidden>&times;</button>' +
      '</div>' +
      '<div class="sp-faqx-filter" hidden></div>' +
      '<div class="sp-faqx-topics" role="list" aria-label="FAQ topics"></div>' +
      '<div class="sp-faqx-body" hidden>' +
        '<div class="sp-faqx-listcol">' +
          '<div class="sp-faqx-list-head"><h3></h3><span></span></div>' +
          '<ol class="sp-faqx-list"></ol>' +
          '<div class="sp-faq-more-wrap"><button type="button" class="sp-faq-more"></button></div>' +
          '<div class="sp-faq-none" hidden><p>No question matches yet.</p><p>Ask our team below — your question is confidential — or <a href="book-appoinment.htm?type=free">book a free consultation</a>.</p></div>' +
        '</div>' +
        '<div class="sp-faqx-popcol">' +
          '<div class="sp-faqx-placeholder"><i class="fa fa-comment-o" aria-hidden="true"></i><p>Tap a question to read its answer here.</p></div>' +
          '<div class="sp-faqx-pop" role="dialog" aria-modal="false" aria-labelledby="spFaqxPopQ" hidden></div>' +
        '</div>' +
      '</div>';

    const intro = section.querySelector('.sp-faqx-intro');
    const input = section.querySelector('#spFaqSearch');
    const clear = section.querySelector('.sp-faq-clear');
    const filterNote = section.querySelector('.sp-faqx-filter');
    const topicsEl = section.querySelector('.sp-faqx-topics');
    const body = section.querySelector('.sp-faqx-body');
    const listHead = section.querySelector('.sp-faqx-list-head');
    const list = section.querySelector('.sp-faqx-list');
    const more = section.querySelector('.sp-faq-more');
    const moreWrap = section.querySelector('.sp-faq-more-wrap');
    const none = section.querySelector('.sp-faq-none');
    const placeholder = section.querySelector('.sp-faqx-placeholder');
    const pop = section.querySelector('.sp-faqx-pop');

    function current() {
      const words = state.q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      if (words.length) return pool().filter(f => { const hay = (f.question + ' ' + (f.category || '')).toLowerCase(); return words.every(w => hay.includes(w)); });
      return state.cat ? pool().filter(f => (f.category || 'General') === state.cat) : [];
    }

    function highlight(text) {
      const safe = esc(text);
      const words = state.q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (!words.length) return safe;
      const re = new RegExp('(' + words.map(w => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
      return safe.replace(re, '<mark>$1</mark>');
    }

    function renderTopics() {
      const tps = topics();
      const total = pool().length;
      intro.textContent = total + ' questions in ' + tps.length + (tps.length === 1 ? ' topic' : ' topics') + '. Choose a topic, then tap a question to read its answer.';
      topicsEl.innerHTML = tps.map(tp =>
        '<button type="button" role="listitem" class="sp-faqx-topic' + (tp.name === state.cat && !state.q ? ' is-active' : '') + '" data-cat="' + esc(tp.name) + '" aria-pressed="' + (tp.name === state.cat && !state.q) + '">' +
          '<span class="sp-faqx-topic-icon"><i class="fa ' + topicIcon(tp.name) + '" aria-hidden="true"></i></span>' +
          '<span class="sp-faqx-topic-text"><strong>' + esc(tp.name) + '</strong><small>' + tp.count + (tp.count === 1 ? ' question' : ' questions') + '</small></span>' +
          '<i class="fa fa-angle-right sp-faqx-topic-go" aria-hidden="true"></i>' +
        '</button>').join('');
      filterNote.hidden = !state.page;
      if (state.page) filterNote.innerHTML = 'Showing questions about <strong>' + esc(pageLabel()) + '</strong>. <button type="button" class="sp-faqx-linkbtn" data-clear-page>Show all topics</button>';
    }

    function renderList(keepShown) {
      const found = current();
      const active = !!(state.q || state.cat);
      body.hidden = !active;
      clear.hidden = !state.q;
      if (!active) { closePop(); return; }
      if (!keepShown) state.shown = 25;
      listHead.querySelector('h3').textContent = state.q ? 'Questions matching “' + state.q + '”' : state.cat;
      listHead.querySelector('span').textContent = found.length + (found.length === 1 ? ' question' : ' questions');
      const slice = found.slice(0, state.shown);
      list.innerHTML = slice.map((f, i) =>
        '<li><button type="button" class="sp-faqx-q' + (f.id === state.openId ? ' is-open' : '') + '" data-id="' + f.id + '" aria-expanded="' + (f.id === state.openId) + '">' +
          '<span class="sp-faqx-n">' + (i + 1) + '</span>' +
          '<span class="sp-faqx-qt">' + highlight(f.question) + (state.q ? '<small>' + esc(f.category || 'General') + '</small>' : '') + '</span>' +
          '<i class="fa fa-angle-right" aria-hidden="true"></i>' +
        '</button></li>').join('');
      moreWrap.hidden = found.length <= state.shown;
      more.textContent = 'Show more questions (' + (found.length - state.shown) + ' more)';
      none.hidden = found.length > 0;
    }

    function updateUrl() {
      const p = new URLSearchParams(location.search);
      ['q', 'category', 'for'].forEach(k => p.delete(k));
      if (state.q) p.set('q', state.q);
      if (state.cat) p.set('category', state.cat);
      if (state.page) p.set('for', state.page);
      const qs = p.toString();
      const hash = state.openId ? '#faq-' + state.openId : '';
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + hash); } catch (e) { /* ignore */ }
    }

    // ---- the answer popup (one at a time) ----
    let popToken = 0;
    function closePop(byVisitor) {
      state.openId = null;
      pop.classList.remove('is-in');
      pop.hidden = true;
      pop.innerHTML = '';
      placeholder.hidden = false;
      section.classList.remove('sp-faqx-has-pop');
      list.querySelectorAll('.sp-faqx-q.is-open').forEach(b => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
      if (byVisitor) updateUrl();
    }

    function neighbours(id) {
      const found = current();
      const i = found.findIndex(f => f.id === id);
      return { prev: i > 0 ? found[i - 1] : null, next: i >= 0 && i < found.length - 1 ? found[i + 1] : null };
    }

    function popHtml(f, a, failed) {
      const nb = neighbours(f.id);
      return '<div class="sp-faqx-pop-head">' +
          '<span class="sp-faqx-pop-cat"><i class="fa ' + topicIcon(f.category || '') + '" aria-hidden="true"></i> ' + esc(f.category || 'General') + '</span>' +
          '<button type="button" class="sp-faqx-x" data-close aria-label="Close the answer">&times;</button>' +
        '</div>' +
        '<h4 id="spFaqxPopQ">' + esc(f.question) + '</h4>' +
        '<div class="sp-faqx-answer">' + (a ? a.answer_html : failed ? '<p class="sp-faqx-err">' + esc(failed) + '</p>' : '<p class="sp-faqx-loading"><i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Loading the answer…</p>') + '</div>' +
        '<div class="sp-faqx-pop-foot">' +
          '<a class="sp-faqx-cta" href="book-appoinment.htm?type=free">Talk to a specialist ↗</a>' +
          '<span class="sp-faqx-nav">' +
            '<button type="button" data-go="' + (nb.prev ? nb.prev.id : '') + '"' + (nb.prev ? '' : ' disabled') + ' aria-label="Previous question"><i class="fa fa-angle-left" aria-hidden="true"></i></button>' +
            '<button type="button" data-go="' + (nb.next ? nb.next.id : '') + '"' + (nb.next ? '' : ' disabled') + ' aria-label="Next question"><i class="fa fa-angle-right" aria-hidden="true"></i></button>' +
          '</span>' +
        '</div>';
    }

    async function openAnswer(id, opts) {
      opts = opts || {};
      const f = faqs.find(x => x.id === id);
      if (!f) return;
      const token = ++popToken;
      state.openId = id;
      list.querySelectorAll('.sp-faqx-q').forEach(b => {
        const on = parseInt(b.getAttribute('data-id'), 10) === id;
        b.classList.toggle('is-open', on);
        b.setAttribute('aria-expanded', String(on));
      });
      // the previous answer vanishes, the new one pops in
      pop.classList.remove('is-in');
      pop.hidden = false;
      placeholder.hidden = true;
      section.classList.add('sp-faqx-has-pop');
      pop.innerHTML = popHtml(f, answers.get(id) || null);
      void pop.offsetWidth;
      pop.classList.add('is-in');
      updateUrl();
      track('FAQ: ' + f.question);
      if (!answers.has(id)) {
        let a = null;
        let failed = '';
        try {
          const r = await fetch(API + '/content/faqs/' + id, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
          const j = await r.json().catch(() => null);
          if (r.ok && j && j.data) a = j.data;
          else if (f.answer_html) a = f; // an older server sent the answers with the list
          else if (r.status === 429) failed = (j && j.message) || 'You have opened many answers in a short time. Please wait a few minutes and try again.';
          else failed = 'This answer could not be loaded right now. Please refresh the page and try again.';
        } catch (e) {
          if (f.answer_html) a = f;
          else failed = 'This answer could not be loaded. Please check your internet connection and try again.';
        }
        if (token !== popToken) return; // another question was opened meanwhile
        if (a) answers.set(id, a);
        pop.innerHTML = popHtml(f, a, failed);
      }
      if (opts.scroll !== false && window.matchMedia && window.matchMedia('(max-width: 899px)').matches) {
        // keep the tapped question just below the site header, above the answer popup
        const btn = list.querySelector('.sp-faqx-q[data-id="' + id + '"]');
        const header = document.querySelector('.sp-header-sticky-wrapper') || document.querySelector('.sp-header-modern');
        const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
        if (btn) window.scrollTo({ top: window.pageYOffset + btn.getBoundingClientRect().top - headerBottom - 12, behavior: 'smooth' });
      }
      if (opts.focus) { const x = pop.querySelector('[data-close]'); if (x) x.focus({ preventScroll: true }); }
    }

    // ---- events ----
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = input.value.trim(); closePop(); renderTopics(); renderList(); updateUrl(); }, 160);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { input.value = ''; state.q = ''; renderTopics(); renderList(); updateUrl(); } });
    clear.addEventListener('click', () => { input.value = ''; state.q = ''; closePop(); renderTopics(); renderList(); updateUrl(); input.focus(); });
    topicsEl.addEventListener('click', e => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      state.cat = b.getAttribute('data-cat');
      if (state.q) { state.q = ''; input.value = ''; }
      closePop();
      renderTopics();
      renderList();
      updateUrl();
      track('FAQ topic: ' + state.cat);
      setTimeout(() => body.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    });
    filterNote.addEventListener('click', e => {
      if (!e.target.closest('[data-clear-page]')) return;
      state.page = '';
      renderTopics(); renderList(); updateUrl();
    });
    list.addEventListener('click', e => {
      const b = e.target.closest('.sp-faqx-q');
      if (!b) return;
      const id = parseInt(b.getAttribute('data-id'), 10);
      if (id === state.openId) { closePop(true); return; }
      openAnswer(id, { focus: false });
    });
    pop.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { closePop(true); return; }
      const go = e.target.closest('[data-go]');
      if (go && go.getAttribute('data-go')) {
        const id = parseInt(go.getAttribute('data-go'), 10);
        const found = current();
        const pos = found.findIndex(f => f.id === id);
        if (pos >= state.shown) { state.shown = pos + 1; renderList(true); }
        openAnswer(id, { scroll: false });
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.openId) closePop(true); });
    more.addEventListener('click', () => { state.shown += 50; renderList(true); });

    renderTopics();
    renderList();

    // Opened with #faq-123 (from the chat, a shared link or a service page): show that question's topic and its answer
    function openHash() {
      const m = /^#faq-(\d+)$/.exec(location.hash || '');
      if (!m) return;
      const id = parseInt(m[1], 10);
      if (id === state.openId) return;
      const f = faqs.find(x => x.id === id);
      if (!f) return;
      if (state.page && !(f.pages || []).includes(state.page)) state.page = '';
      state.q = '';
      input.value = '';
      state.cat = f.category || 'General';
      renderTopics();
      const pos = pool().filter(x => (x.category || 'General') === state.cat).findIndex(x => x.id === id);
      if (pos >= state.shown) state.shown = pos + 1;
      renderList(true);
      openAnswer(id, { scroll: false });
      setTimeout(() => body.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
    openHash();
    window.addEventListener('hashchange', openHash);

    // A shortcut near the top of the page
    const heading = document.querySelector('.guide-heading');
    if (heading && !document.querySelector('.sp-faq-jump')) {
      const a = document.createElement('a');
      a.className = 'sp-faq-jump';
      a.href = '#spFaqSection';
      a.innerHTML = '<i class="fa fa-question-circle" aria-hidden="true"></i> Browse ' + faqs.length + ' FAQs by topic';
      a.addEventListener('click', e => { e.preventDefault(); section.scrollIntoView({ behavior: 'smooth' }); });
      heading.appendChild(a);
    }
  }

  // ---------------------------------------------------------------------------
  // Homepage questions
  // ---------------------------------------------------------------------------
  function initHome(box, faqs) {
    if (!Array.isArray(faqs)) return; // server not reachable: keep the questions in the page
    const section = box.closest('section');
    if (!faqs.length) { if (section) section.style.display = 'none'; return; }
    box.innerHTML = faqs.map(f => item(f)).join('') +
      '<p class="sp-home-faq-more"><a href="faq.htm#spFaqSection">More questions and answers ↗</a></p>';
    box.classList.add('sp-home-faqs');
  }

  // ---------------------------------------------------------------------------
  // "What We Do" pages
  // ---------------------------------------------------------------------------
  function initServicePage(sec, res) {
    const faqs = res && Array.isArray(res.data) ? res.data : null;
    if (!faqs || !faqs.length) return; // stays hidden
    const list = sec.querySelector('.sp-page-faq-list');
    if (!list) return;
    const first = faqs.slice(0, 8);
    const total = Math.max(res.total || 0, faqs.length);
    list.innerHTML = first.map((f, i) => item(f, { open: i === 0 })).join('');
    const more = sec.querySelector('.sp-page-faq-more a');
    if (more && total > first.length) more.textContent = 'See all ' + total + ' questions ↗';
    sec.hidden = false;
  }

  /** Like getJson, but keeps the list total that the server sends next to the data */
  function getWithTotal(path) {
    return fetch(API + path, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.success !== false ? { data: j.data, total: j.total } : null))
      .catch(() => null);
  }

  function boot() {
    const faqSection = document.getElementById('spFaqSection');
    if (faqSection) getJson('/content/faqs').then(d => initFaqPage(faqSection, d));
    const home = document.querySelector('[data-faq-list="home"]');
    if (home) getJson('/content/faqs?for=home').then(d => initHome(home, d));
    document.querySelectorAll('[data-faq-page]').forEach(sec => {
      const key = sec.getAttribute('data-faq-page');
      getWithTotal('/content/faqs?for=' + encodeURIComponent(key)).then(d => initServicePage(sec, d));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
