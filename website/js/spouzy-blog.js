/**
 * SPOUZY Blog (blog.htm), loaded by spouzy-content.js
 *   - a continuously sliding banner of article banners (16:9) at the top: pauses on hover, touch or keyboard focus,
 *     can be dragged / swiped, has arrows and a pause button, and stays still for visitors who prefer less motion
 *   - every article as a card with its 16:9 thumbnail (falls back to the banner, then the picture inside the article)
 *   - blog.htm?article=slug: the article with its 16:9 banner on top; the picture inside the article stays as before
 * Articles come from Admin → Content & Media → Blog. The cards already written in the page stay as they are.
 */
(function () {
  'use strict';

  const API = '/api';
  const SPEED = 38; // pixels per second

  function getJson(path) {
    return fetch(API + path, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && j.success !== false ? j.data : null))
      .catch(() => null);
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function safeImg(src) {
    const v = String(src || '').trim();
    return /^(https?:\/\/|\/|image\/|media\/)/i.test(v) && !/^javascript:/i.test(v) ? v : '';
  }
  function dateText(v) {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); } catch (e) { return ''; }
  }
  function readMinutes(html) {
    const words = String(html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const articleUrl = a => 'blog.htm?article=' + encodeURIComponent(a.slug);

  /** A picture that cannot be loaded turns into the soft SPOUZY artwork instead of a broken image */
  function guardImages(root) {
    root.querySelectorAll('img[data-guard]').forEach(img => {
      img.removeAttribute('data-guard');
      img.addEventListener('error', () => {
        const box = img.closest('.sp-blog-card-media, .sp-blog-slide-media, .sp-blog-hero');
        if (box) { box.classList.add('is-art'); box.innerHTML = '<span class="sp-blog-art-mark">' + esc((box.getAttribute('data-mark') || 'S')) + '</span>'; }
        else img.remove();
      }, { once: true });
    });
  }

  // ---------------------------------------------------------------------------
  // Article cards
  // ---------------------------------------------------------------------------
  function cardHtml(a) {
    const img = safeImg(a.thumbnail_image) || safeImg(a.banner_image) || safeImg(a.cover_image);
    const mark = esc((a.title || 'S').trim().charAt(0).toUpperCase());
    const cat = a.category && a.category.name ? a.category.name : '';
    const meta = [cat, a.published_at ? dateText(a.published_at) : '', readMinutes(a.body_html) + ' min read'].filter(Boolean).join(' · ');
    return '<article class="sp-blog-card" data-blog-slug="' + esc(a.slug) + '">' +
      '<a class="sp-blog-card-media' + (img ? '' : ' is-art') + '" href="' + articleUrl(a) + '" tabindex="-1" aria-hidden="true" data-mark="' + mark + '">' +
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" data-guard>' : '<span class="sp-blog-art-mark">' + mark + '</span>') +
      '</a>' +
      '<div class="sp-blog-card-body">' +
        '<p class="sp-blog-card-meta">' + esc(meta) + '</p>' +
        '<h2 class="sp-blog-card-title"><a href="' + articleUrl(a) + '">' + esc(a.title) + '</a></h2>' +
        '<p class="sp-blog-card-text">' + esc(a.excerpt) + '</p>' +
        '<a class="sp-blog-card-link" href="' + articleUrl(a) + '">Read article <span aria-hidden="true">↗</span></a>' +
      '</div></article>';
  }

  // ---------------------------------------------------------------------------
  // Continuous sliding banner
  // ---------------------------------------------------------------------------
  function slideHtml(a, clone) {
    const img = safeImg(a.banner_image);
    const cat = a.category && a.category.name ? a.category.name : 'Read';
    return '<a class="sp-blog-slide" href="' + articleUrl(a) + '"' + (clone ? ' tabindex="-1" aria-hidden="true"' : '') + ' draggable="false">' +
      '<span class="sp-blog-slide-media" data-mark="' + esc((a.title || 'S').charAt(0).toUpperCase()) + '"><img src="' + esc(img) + '" alt="' + (clone ? '' : esc(a.alt_text || a.title)) + '" ' + (clone ? 'loading="lazy" ' : '') + 'decoding="async" draggable="false" data-guard></span>' +
      '<span class="sp-blog-slide-shade" aria-hidden="true"></span>' +
      '<span class="sp-blog-slide-text"><span class="sp-blog-slide-cat">' + esc(cat) + '</span>' +
      '<span class="sp-blog-slide-title">' + esc(a.title) + '</span>' +
      '<span class="sp-blog-slide-go">Read article <span aria-hidden="true">→</span></span></span></a>';
  }

  function initMarquee(box, items) {
    if (!box || !items.length) return;
    box.hidden = false;
    // 1–2 banners: show them still and large; 3 or more: a continuous loop
    if (items.length < 3 || reduced) {
      box.classList.add(items.length < 3 ? 'is-static' : 'is-scroll');
      box.innerHTML = '<div class="sp-blog-marquee-row">' + items.map(a => slideHtml(a, false)).join('') + '</div>';
      guardImages(box);
      return;
    }
    box.innerHTML =
      '<div class="sp-blog-marquee-viewport"><div class="sp-blog-marquee-track"></div></div>' +
      '<div class="sp-blog-marquee-controls">' +
        '<button type="button" class="sp-blog-mq-btn" data-dir="-1" aria-label="Previous article"><span aria-hidden="true">‹</span></button>' +
        '<button type="button" class="sp-blog-mq-btn sp-blog-mq-pause" aria-label="Pause the moving banner" aria-pressed="false"><span aria-hidden="true">❚❚</span></button>' +
        '<button type="button" class="sp-blog-mq-btn" data-dir="1" aria-label="Next article"><span aria-hidden="true">›</span></button>' +
      '</div>';
    const viewport = box.querySelector('.sp-blog-marquee-viewport');
    const track = box.querySelector('.sp-blog-marquee-track');
    const pauseBtn = box.querySelector('.sp-blog-mq-pause');

    // one real set (reachable with the keyboard) + copies until the strip is at least twice the screen width
    track.innerHTML = items.map(a => slideHtml(a, false)).join('');
    const realCount = items.length;
    function fill() {
      // enough copies so that one full set plus a screen width is always covered
      const sets = () => track.children.length / realCount;
      const setW = () => track.scrollWidth / Math.max(1, sets());
      let guard = 0;
      while ((sets() < 2 || track.scrollWidth < setW() + viewport.clientWidth + 40) && guard < 20) {
        track.insertAdjacentHTML('beforeend', items.map(a => slideHtml(a, true)).join(''));
        guard++;
      }
    }
    fill();
    guardImages(track);

    function setWidth() {
      // width of one full set (first copy starts where the loop repeats)
      const first = track.children[0];
      const copy = track.children[realCount];
      return copy && first ? copy.offsetLeft - first.offsetLeft : track.scrollWidth / 2;
    }
    let loopWidth = setWidth();
    let offset = 0;
    let last = 0;
    let hover = false;
    let focus = false;
    let userPaused = false;
    let dragging = false;
    let visible = true;
    let nudge = null; // { from, to, start, dur }

    function wrap() {
      if (loopWidth <= 0) return;
      while (offset >= loopWidth) offset -= loopWidth;
      while (offset < 0) offset += loopWidth;
    }
    function paint() { track.style.transform = 'translate3d(' + (-offset).toFixed(2) + 'px,0,0)'; }

    function frame(t) {
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      if (nudge) {
        const p = Math.min(1, (t - nudge.start) / nudge.dur);
        const e = 1 - Math.pow(1 - p, 3);
        offset = nudge.from + (nudge.to - nudge.from) * e;
        if (p >= 1) nudge = null;
      } else if (!hover && !focus && !userPaused && !dragging && visible && !document.hidden) {
        offset += SPEED * dt / 1000;
      }
      wrap();
      paint();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function slideStep() {
      const a = track.children[0];
      const b = track.children[1];
      return a && b ? b.offsetLeft - a.offsetLeft : viewport.clientWidth * 0.8;
    }
    box.querySelectorAll('[data-dir]').forEach(btn => btn.addEventListener('click', () => {
      const dir = parseInt(btn.getAttribute('data-dir'), 10);
      const step = slideStep();
      // land on a whole slide
      const base = Math.round(offset / step) * step;
      nudge = { from: offset, to: base + dir * step, start: performance.now(), dur: 520 };
    }));
    pauseBtn.addEventListener('click', () => {
      userPaused = !userPaused;
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.setAttribute('aria-label', userPaused ? 'Play the moving banner' : 'Pause the moving banner');
      pauseBtn.innerHTML = '<span aria-hidden="true">' + (userPaused ? '▶' : '❚❚') + '</span>';
    });
    viewport.addEventListener('mouseenter', () => { hover = true; });
    viewport.addEventListener('mouseleave', () => { hover = false; });
    track.addEventListener('focusin', () => { focus = true; });
    track.addEventListener('focusout', () => { focus = false; });
    // keep the focused slide in view while tabbing
    track.addEventListener('focusin', e => {
      const a = e.target.closest('.sp-blog-slide');
      if (!a) return;
      const left = a.offsetLeft - track.children[0].offsetLeft;
      if (left - offset < 0 || left - offset + a.offsetWidth > viewport.clientWidth) {
        nudge = { from: offset, to: Math.max(0, left - 24), start: performance.now(), dur: 400 };
      }
    });

    // drag / swipe
    let startX = 0;
    let startOffset = 0;
    let moved = 0;
    let captured = false;
    viewport.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      dragging = true;
      captured = false;
      nudge = null;
      startX = e.clientX;
      startOffset = offset;
      moved = 0;
    });
    viewport.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      // only a real drag takes over the pointer, so a simple tap still opens the article
      if (moved > 6 && !captured && viewport.setPointerCapture) {
        try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        captured = true;
      }
      if (moved > 6) { offset = startOffset - dx; wrap(); }
    });
    const end = () => { dragging = false; };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
    viewport.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') end(); });
    // a drag must not open the article
    viewport.addEventListener('click', e => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); } }, true);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.05 }).observe(box);
    }
    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { fill(); guardImages(track); loopWidth = setWidth(); wrap(); }, 150);
    });
    // images change slide widths only if CSS has no fixed size; recalc once they load
    window.addEventListener('load', () => { loopWidth = setWidth(); });
  }

  // ---------------------------------------------------------------------------
  // List page
  // ---------------------------------------------------------------------------
  async function initList(body) {
    const res = await getJson('/content/blogs?limit=60');
    const list = (res && res.articles) || [];
    if (!list.length) return;
    const grid = body.querySelector('[data-blog-grid]');
    if (grid) {
      const html = list.filter(a => !grid.querySelector('[data-blog-slug="' + CSS.escape(a.slug) + '"]')).map(cardHtml).join('');
      grid.insertAdjacentHTML('afterbegin', html);
      guardImages(grid);
    }
    const bannerItems = list.filter(a => a.show_in_banner !== false && safeImg(a.banner_image));
    initMarquee(document.querySelector('[data-blog-banner]'), bannerItems.slice(0, 12));
  }

  // ---------------------------------------------------------------------------
  // One article (blog.htm?article=slug)
  // ---------------------------------------------------------------------------
  async function initArticle(body, slug) {
    const a = await getJson('/content/blogs/' + encodeURIComponent(slug));
    if (!a) {
      body.insertAdjacentHTML('afterbegin', '<p class="sp-blog-missing">This article is not available any more. Here are our other articles.</p>');
      initList(body);
      return;
    }
    document.body.classList.add('sp-blog-reading');
    const heading = document.querySelector('.guide-heading');
    const cat = a.category && a.category.name ? a.category.name : '';
    if (heading) {
      heading.innerHTML = '<p><a href="blog.htm" class="sp-blog-back">Blog</a>' + (cat ? ' · ' + esc(cat) : '') + '</p><h1>' + esc(a.title) + '</h1><p>' + esc(a.excerpt) + '</p>';
    }
    document.title = a.title + ' | SPOUZY';
    const banner = safeImg(a.banner_image);
    const cover = safeImg(a.cover_image);
    const when = dateText(a.published_at);
    const hero = document.createElement('figure');
    hero.className = 'sp-blog-hero';
    hero.setAttribute('data-mark', (a.title || 'S').charAt(0).toUpperCase());
    if (banner) {
      hero.innerHTML = '<img src="' + esc(banner) + '" alt="' + esc(a.alt_text || a.title) + '" decoding="async" fetchpriority="high" data-guard>';
      if (heading) heading.after(hero);
    }
    body.innerHTML =
      '<p class="sp-blog-byline">' + esc(a.author_name || 'SPOUZY') + (when ? ' · ' + esc(when) : '') + ' · ' + readMinutes(a.body_html) + ' min read</p>' +
      (cover ? '<img class="sp-blog-cover" src="' + esc(cover) + '" alt="' + esc(a.alt_text || a.title) + '" data-guard>' : '') +
      '<article class="sp-blog-article">' + (a.body_html || '') + '</article>' +
      '<div class="guide-actions"><a class="guide-action" href="blog.htm">← All articles</a><a class="guide-action" href="book-appoinment.htm?type=free">Book a free consultation ↗</a></div>' +
      '<section class="sp-blog-more" hidden><h2>More to read</h2><div class="sp-blog-grid" data-more-grid></div></section>';
    guardImages(document);
    body.querySelectorAll('.sp-blog-article img').forEach(im => im.addEventListener('error', () => { im.style.display = 'none'; }));
    // three more articles
    const res = await getJson('/content/blogs?limit=12');
    const more = ((res && res.articles) || []).filter(x => x.slug !== a.slug).slice(0, 3);
    if (more.length) {
      const sec = body.querySelector('.sp-blog-more');
      sec.querySelector('[data-more-grid]').innerHTML = more.map(cardHtml).join('');
      sec.hidden = false;
      guardImages(sec);
    }
  }

  function boot() {
    const body = document.querySelector('[data-blog-list]');
    if (!body) return;
    const slug = new URLSearchParams(window.location.search).get('article');
    if (slug) initArticle(body, slug);
    else initList(body);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
