/**
 * SPOUZY brand motion (loaded in <head>, before the page is drawn)
 *
 * 1. First-visit intro: a full-screen welcome with the large hugging teddies.
 *    The teddies walk in and hug, then fly into the navbar logo spot and the page opens.
 *    Shown once per visit (again after 30 minutes away), never with "reduce motion".
 * 2. Navbar logo swap: every 3 seconds the hugging teddies drop in from the top and push the
 *    SPOUZY logo down; 3 seconds later the logo comes up from below and pushes the teddies up.
 */
(function () {
  'use strict';

  var d = document;
  var root = d.documentElement;
  var VIDEO_SRC = 'image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm';
  var TEDDY_ICON = 'image/gif/spouzy-teddy-hug-icon.webp';
  var TEDDY_LARGE = 'image/gif/spouzy-teddy-hug-large.webp';
  var LOGO_SRC = 'image/spouzy.png';
  var SEEN_KEY = 'spouzy_intro_seen';
  var STAMP_KEY = 'spouzy_last_visit_at';
  var VISIT_GAP_MS = 30 * 60 * 1000;
  var SWAP_EVERY_MS = 3000;
  var HUG_HOLD_MS = 420;     // pause on the hug before leaving
  var MAX_INTRO_MS = 4200;   // the intro never keeps a visitor longer than this
  // In the video frame (960 x 540) the teddies stay between x = 120 and 840 (box = 4:3),
  // and the final hug fills x = 234 to 730: the same picture as the navbar teddy icon.
  var HUG_LEFT = (234 - 120) / 720;
  var HUG_WIDTH = (730 - 234) / 720;

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function getItem(kind, key) { try { return window[kind].getItem(key); } catch (e) { return null; } }
  function setItem(kind, key, value) { try { window[kind].setItem(key, value); } catch (e) { /* storage blocked */ } }

  function introWanted() {
    if (reducedMotion()) return false;
    if (/[?&]nointro(=|&|$)/.test(location.search)) return false;
    if (/[?&]intro=1(&|$)/.test(location.search)) return true;
    if (getItem('sessionStorage', SEEN_KEY)) return false;
    var last = parseInt(getItem('localStorage', STAMP_KEY), 10);
    return !(last && Date.now() - last < VISIT_GAP_MS);
  }

  // VP9 video with a transparent background plays in Chrome, Edge, Firefox and Android.
  // Safari and every iPhone/iPad browser show it on black, so they get the still picture instead.
  function canPlayAlphaVideo() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua)) return false;
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false; // iPad in desktop mode
    if (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/.test(ua)) return false;
    try { return !!d.createElement('video').canPlayType('video/webm; codecs="vp9"'); } catch (e) { return false; }
  }

  function whenBody(fn) {
    if (d.body) { fn(); return; }
    var done = false;
    function run() { if (!done && d.body) { done = true; fn(); } }
    try {
      var mo = new MutationObserver(function () { if (d.body) { mo.disconnect(); run(); } });
      mo.observe(root, { childList: true });
    } catch (e) { /* old browser */ }
    d.addEventListener('DOMContentLoaded', run);
  }

  function onReady(fn) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  var heartPath = 'M12 21s-7.2-4.4-9.6-9C.8 8.8 2.6 5 6.3 5c2.2 0 3.6 1.2 4.4 2.4h.6C12.1 6.2 13.5 5 15.7 5c3.7 0 5.5 3.8 3.9 7-2.4 4.6-9.6 9-9.6 9z';
  function heart(cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + heartPath + '"/></svg>';
  }

  // ---------------------------------------------------------------------------
  // Navbar logo swap
  // ---------------------------------------------------------------------------
  var Brand = (function () {
    var win = null;
    var teddy = null;
    var timer = null;
    var state = 'logo';
    var hovering = false;
    var holding = false; // true while the intro is running
    var broken = false;  // the teddy picture could not be loaded: keep showing the logo

    function setup() {
      if (win) return true;
      var logo = d.querySelector('.sp-nav-container .sp-brand-logo') || d.querySelector('.sp-brand-logo');
      if (!logo || !logo.parentNode) return false;
      win = d.createElement('span');
      win.className = 'sp-brand-swap is-logo';
      var track = d.createElement('span');
      track.className = 'sp-brand-track';
      var slotLogo = d.createElement('span');
      slotLogo.className = 'sp-brand-slot sp-brand-slot-logo';
      var slotTeddy = d.createElement('span');
      slotTeddy.className = 'sp-brand-slot sp-brand-slot-teddy';
      slotTeddy.setAttribute('aria-hidden', 'true');
      teddy = d.createElement('img');
      teddy.className = 'sp-brand-teddy';
      teddy.src = TEDDY_ICON;
      teddy.alt = '';
      teddy.decoding = 'async';
      teddy.draggable = false;
      teddy.addEventListener('error', function () {
        broken = true;
        clearTimeout(timer);
        show('logo', false);
      });
      slotTeddy.appendChild(teddy);
      logo.parentNode.insertBefore(win, logo);
      slotLogo.appendChild(logo);
      track.appendChild(slotTeddy);
      track.appendChild(slotLogo);
      win.appendChild(track);

      var link = win.closest ? win.closest('a') : null;
      if (link) {
        link.addEventListener('mouseenter', function () { hovering = true; });
        link.addEventListener('mouseleave', function () { hovering = false; });
      }
      d.addEventListener('visibilitychange', function () { if (!d.hidden) schedule(); });
      return true;
    }

    function show(next, animate) {
      if (!win) return;
      state = next;
      if (!animate) win.classList.add('no-anim');
      win.classList.toggle('is-teddy', next === 'teddy');
      win.classList.toggle('is-logo', next !== 'teddy');
      if (!animate) {
        void win.offsetWidth; // apply the jump before turning the animation back on
        win.classList.remove('no-anim');
      }
    }

    function isBroken() {
      if (!broken && teddy && teddy.complete && !teddy.naturalWidth) broken = true;
      return broken;
    }

    function schedule() {
      clearTimeout(timer);
      if (!win || holding || broken || reducedMotion()) return;
      timer = setTimeout(tick, SWAP_EVERY_MS);
    }

    function tick() {
      if (isBroken()) { show('logo', false); return; }
      // Wait while the tab is hidden or the visitor is pointing at the logo
      if (!d.hidden && !hovering) show(state === 'logo' ? 'teddy' : 'logo', true);
      schedule();
    }

    return {
      start: function () {
        if (holding) return;
        if (setup()) { show('logo', false); schedule(); }
      },
      hold: function () { holding = true; clearTimeout(timer); },
      // Intro is leaving: show the teddies in the navbar (hidden) so the flying teddies land on them
      prepareLanding: function () {
        holding = true;
        clearTimeout(timer);
        if (!setup() || isBroken()) return null;
        show('teddy', false);
        teddy.style.visibility = 'hidden';
        return teddy;
      },
      landed: function (withTeddy) {
        holding = false;
        if (!win) { this.start(); return; }
        teddy.style.visibility = '';
        if (!withTeddy || isBroken()) show('logo', false);
        schedule();
      }
    };
  })();

  // ---------------------------------------------------------------------------
  // First-visit intro
  // ---------------------------------------------------------------------------
  var introRunning = false;

  function startIntro() {
    introRunning = true;
    Brand.hold();
    setItem('sessionStorage', SEEN_KEY, '1');
    root.classList.add('sp-intro-on');

    // Cover the page from the very first paint, before the stylesheet arrives
    var cover = d.createElement('style');
    cover.id = 'sp-intro-cover';
    cover.textContent =
      'html.sp-intro-on{overflow:hidden!important;background:#FFF7E3!important}' +
      'html.sp-intro-on body{overflow:hidden!important}' +
      'html.sp-intro-on::before{content:"";position:fixed;inset:0;z-index:2147482000;' +
      'background:radial-gradient(120% 90% at 50% 38%,#FFFDF4 0%,#FFF4DA 55%,#F9E3CC 100%)}';
    (d.head || root).appendChild(cover);

    var useVideo = canPlayAlphaVideo();
    var startedAt = Date.now();
    var overlay = null;
    var teddyBox = null;
    var media = null;
    var hugged = false;
    var holdDone = false;
    var domReady = d.readyState !== 'loading';
    var leaving = false;
    var capTimer = null;

    // Fetch the navbar teddy now so it is ready when the intro hands over to it
    try { (new Image()).src = TEDDY_ICON; } catch (e) { /* ignore */ }

    function build() {
      overlay = d.createElement('div');
      overlay.id = 'sp-intro';
      overlay.className = 'sp-intro';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-label', 'Welcome to SPOUZY');
      var floaters = '';
      for (var i = 0; i < 10; i++) floaters += heart('sp-intro-float sp-intro-float-' + (i + 1));
      var burst = '';
      for (var j = 0; j < 6; j++) burst += heart('sp-intro-pop sp-intro-pop-' + (j + 1));
      overlay.innerHTML =
        '<div class="sp-intro-bg" aria-hidden="true">' + floaters + '</div>' +
        '<div class="sp-intro-stage">' +
          '<div class="sp-intro-teddy-wrap">' +
            '<div class="sp-intro-glow" aria-hidden="true"></div>' +
            '<div class="sp-intro-teddy ' + (useVideo ? 'is-video' : 'is-still') + '"></div>' +
            '<div class="sp-intro-burst" aria-hidden="true">' + burst + '</div>' +
          '</div>' +
          '<img class="sp-intro-logo" src="' + LOGO_SRC + '" alt="SPOUZY" decoding="async">' +
          '<p class="sp-intro-tagline">Pre- &amp; Post-Marriage <span>·</span> Intimate Healthcare <span>·</span> Divorce Mediation</p>' +
          '<div class="sp-intro-bar" aria-hidden="true"><span></span></div>' +
        '</div>' +
        '<button type="button" class="sp-intro-skip">Skip</button>';
      d.body.insertBefore(overlay, d.body.firstChild);
      teddyBox = overlay.querySelector('.sp-intro-teddy');
      overlay.querySelector('.sp-intro-skip').addEventListener('click', function () { leave(true); });
      d.addEventListener('keydown', onKey);

      if (useVideo) {
        media = d.createElement('video');
        media.className = 'sp-intro-video';
        media.muted = true;
        media.defaultMuted = true;
        media.setAttribute('muted', '');
        media.setAttribute('playsinline', '');
        media.setAttribute('aria-hidden', 'true');
        media.preload = 'auto';
        media.src = VIDEO_SRC;
        teddyBox.appendChild(media);
        var shown = false;
        var reveal = function () { if (!shown) { shown = true; overlay.classList.add('is-playing'); } };
        if (typeof media.requestVideoFrameCallback === 'function') media.requestVideoFrameCallback(reveal);
        media.addEventListener('playing', function () { setTimeout(reveal, 60); });
        media.addEventListener('ended', hug);
        media.addEventListener('error', fallbackToStill);
        // Slow the 1-second hug a little so it reads clearly at this size
        media.addEventListener('loadedmetadata', function () { try { media.playbackRate = 0.8; } catch (e) { /* ignore */ } });
        var p = media.play();
        if (p && p.catch) p.catch(fallbackToStill);
        // If the video has not started after 1.2 s (slow network), show the still picture
        setTimeout(function () { if (!shown && !hugged) fallbackToStill(); }, 1200);
      } else {
        showStill();
      }

      requestAnimationFrame(function () { overlay.classList.add('is-in'); });
    }

    function showStill() {
      teddyBox.className = 'sp-intro-teddy is-still';
      teddyBox.innerHTML = '<img class="sp-intro-still" src="' + TEDDY_LARGE + '" alt="" aria-hidden="true">';
      media = teddyBox.firstChild;
      media.onerror = function () { this.style.visibility = 'hidden'; }; // never show a broken picture
      overlay.classList.add('is-playing');
      setTimeout(hug, 1100);
    }

    function fallbackToStill() {
      if (hugged || leaving || !teddyBox || teddyBox.classList.contains('is-still')) return;
      if (media && media.pause) { try { media.pause(); } catch (e) { /* ignore */ } }
      showStill();
    }

    function hug() {
      if (hugged) return;
      hugged = true;
      overlay.classList.add('is-hugged');
      setTimeout(function () { holdDone = true; maybeLeave(); }, HUG_HOLD_MS);
    }

    function maybeLeave() {
      if (holdDone && domReady) leave(false);
    }

    function onKey(e) { if (e.key === 'Escape') leave(true); }

    // Where the hugging teddies are on screen right now
    function hugRect() {
      var r = teddyBox.getBoundingClientRect();
      if (teddyBox.classList.contains('is-video')) {
        return { left: r.left + r.width * HUG_LEFT, top: r.top, width: r.width * HUG_WIDTH, height: r.height, box: r };
      }
      var ir = media && media.getBoundingClientRect ? media.getBoundingClientRect() : r;
      return { left: ir.left, top: ir.top, width: ir.width, height: ir.height, box: r };
    }

    function leave(skipped) {
      if (leaving || !overlay) return;
      leaving = true;
      clearTimeout(capTimer);
      d.removeEventListener('keydown', onKey);

      var target = skipped ? null : Brand.prepareLanding();
      var t = target ? target.getBoundingClientRect() : null;
      var visible = t && t.width > 4 && t.height > 4 && t.bottom > 0 && t.top < window.innerHeight;

      root.classList.remove('sp-intro-on'); // the opaque overlay still covers the page
      overlay.classList.add('is-leaving');

      if (visible && hugged) {
        var h = hugRect();
        var scale = t.height / h.height;
        var dx = (t.left + t.width / 2) - (h.left + h.width / 2);
        var dy = (t.top + t.height / 2) - (h.top + h.height / 2);
        teddyBox.style.transformOrigin = (h.left + h.width / 2 - h.box.left) + 'px ' + (h.top + h.height / 2 - h.box.top) + 'px';
        overlay.classList.add('is-flying');
        void teddyBox.offsetWidth;
        teddyBox.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + scale.toFixed(4) + ')';
        setTimeout(function () { finish(true); }, 820);
      } else {
        overlay.classList.add('is-fading');
        setTimeout(function () { finish(false); }, skipped ? 380 : 620);
      }
    }

    function finish(withTeddy) {
      introRunning = false;
      Brand.landed(withTeddy);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (cover.parentNode) cover.parentNode.removeChild(cover);
      overlay = null;
      try { d.dispatchEvent(new CustomEvent('spouzy:intro-done')); } catch (e) { /* ignore */ }
    }

    whenBody(build);
    d.addEventListener('DOMContentLoaded', function () { domReady = true; maybeLeave(); });
    // Safety net: never keep the visitor waiting
    capTimer = setTimeout(function () {
      if (!overlay) { finish(false); return; }
      if (!hugged) { hugged = true; overlay.classList.add('is-hugged'); }
      leave(false);
    }, MAX_INTRO_MS - Math.max(0, Date.now() - startedAt));
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  try {
    if (introWanted()) startIntro();
  } catch (e) {
    root.classList.remove('sp-intro-on');
  }
  setItem('localStorage', STAMP_KEY, String(Date.now()));

  onReady(function () { if (!introRunning) Brand.start(); });
})();
