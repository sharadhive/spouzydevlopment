const fs = require('fs');

let js = fs.readFileSync('js/spouzy-modern.js', 'utf8');
const start = js.indexOf('(function initSpouzyPageTransition() {');
const end = js.indexOf('document.addEventListener(\'DOMContentLoaded\', function () {');

if (start === -1 || end === -1) {
  console.error('Boundaries not found!', { start, end });
  process.exit(1);
}

const replacement = `(function initSpouzyPageTransition() {
  'use strict';

  const OVERLAY_ID = 'sp-transition-overlay';
  const HUG_VIDEO_SRC = 'image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm';
  const HARD_FAILSAFE_MS = 1600; // Failsafe timeout so animation can never trap the visitor

  let isNavigating = false;
  let safetyTimer = null;
  let activeVideo = null;
  let rVfcId = null;

  // Clear any legacy arrival/pending flags from previous sessions
  try {
    sessionStorage.removeItem('sp_transition_pending');
    sessionStorage.removeItem('spouzy_session_active');
    sessionStorage.removeItem('sp-arrival');
    document.documentElement.classList.remove('sp-loader-pending');
  } catch (e) {}

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  // Preload video early into browser cache for instantaneous transition response
  try {
    if (document.head && !prefersReducedMotion()) {
      let existingPreload = document.querySelector('link[rel="preload"][href*="SPOUZY_Teddy_Hug_Loader_1s.webm"]');
      if (!existingPreload) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'video';
        link.href = HUG_VIDEO_SRC;
        link.type = 'video/webm';
        document.head.appendChild(link);
      }
    }
  } catch (e) {}

  function cleanupOverlay() {
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    if (rVfcId && activeVideo && typeof activeVideo.cancelVideoFrameCallback === 'function') {
      try { activeVideo.cancelVideoFrameCallback(rVfcId); } catch (e) {}
      rVfcId = null;
    }
    const existing = document.getElementById(OVERLAY_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    activeVideo = null;
    isNavigating = false;
  }

  function executeNavigation(targetHref) {
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    // If destination loading takes longer, keep the video looping over outgoing page
    if (activeVideo) {
      activeVideo.loop = true;
      if (activeVideo.paused) {
        activeVideo.play().catch(function () {});
      }
    }
    window.location.assign(targetHref);
  }

  function startTransition(targetHref) {
    if (isNavigating) return;
    isNavigating = true;

    // Respect reduced-motion preferences: navigate immediately without animation delay
    if (prefersReducedMotion()) {
      window.location.assign(targetHref);
      return;
    }

    // Safety failsafe: if video fails to complete or stalls, navigate promptly
    safetyTimer = setTimeout(function () {
      executeNavigation(targetHref);
    }, HARD_FAILSAFE_MS);

    // Build floating transparent overlay directly over CURRENT page
    const container = document.body || document.documentElement;
    if (!container) {
      executeNavigation(targetHref);
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'sp-transition-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');

    const stage = document.createElement('div');
    stage.className = 'sp-transition-stage';

    const video = document.createElement('video');
    video.className = 'sp-transition-video';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = false;
    video.preload = 'auto';

    const source = document.createElement('source');
    source.src = HUG_VIDEO_SRC;
    source.type = 'video/webm';
    video.appendChild(source);
    video.src = HUG_VIDEO_SRC;

    stage.appendChild(video);
    overlay.appendChild(stage);
    container.appendChild(overlay);

    activeVideo = video;

    let frameRendered = false;
    function revealWhenFrameReady() {
      if (frameRendered) return;
      frameRendered = true;
      stage.classList.add('is-visible');
    }

    // Detect actual moving video frame before revealing to avoid paused-frame flash
    if (typeof video.requestVideoFrameCallback === 'function') {
      rVfcId = video.requestVideoFrameCallback(function () {
        revealWhenFrameReady();
      });
    } else {
      video.addEventListener('timeupdate', function onTime() {
        if (video.currentTime > 0.02) {
          video.removeEventListener('timeupdate', onTime);
          revealWhenFrameReady();
        }
      });
    }

    // Guarded reveal fallback: if frame callback delayed by > 250ms, reveal smoothly
    setTimeout(revealWhenFrameReady, 250);

    // After one complete hug cycle (1.0s), navigate to requested destination
    video.addEventListener('ended', function onVideoEnded() {
      executeNavigation(targetHref);
    }, { once: true });

    // On error or playback rejection, navigate immediately
    video.addEventListener('error', function () {
      executeNavigation(targetHref);
    }, { once: true });

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(function () {
        executeNavigation(targetHref);
      });
    }
  }

  // --- NAVIGATION LINK ELIGIBILITY CHECK ---
  function isEligibleLink(anchor, event) {
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;

    const rawHref = anchor.getAttribute('href');
    if (!rawHref) return false;

    const trimmedHref = rawHref.trim();
    if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('javascript:')) return false;
    if (/^(tel:|mailto:|javascript:|sms:|whatsapp:)/i.test(trimmedHref)) return false;

    let targetUrl;
    try {
      targetUrl = new URL(anchor.href, window.location.href);
    } catch (e) {
      return false;
    }

    if (!['http:', 'https:', 'file:'].includes(targetUrl.protocol)) return false;
    if (targetUrl.origin !== window.location.origin) return false;
    if (/wa\.me|api\.whatsapp\.com/i.test(targetUrl.href)) return false;

    const currentPath = window.location.pathname.replace(/\\/+$/, '') || '/index.htm';
    const targetPath = targetUrl.pathname.replace(/\\/+$/, '') || '/index.htm';
    const currentSearch = window.location.search || '';
    const targetSearch = targetUrl.search || '';

    // Same-page anchor click
    if (currentPath === targetPath && currentSearch === targetSearch && targetUrl.hash) {
      return false;
    }

    // Current page reload without hash
    if (currentPath === targetPath && currentSearch === targetSearch && !targetUrl.hash) {
      return false;
    }

    // Internal page navigation (.htm, .html, or extensionless path)
    const parts = targetPath.split('.');
    if (parts.length > 1) {
      const ext = parts[parts.length - 1].toLowerCase();
      if (!['htm', 'html'].includes(ext)) {
        return false;
      }
    }

    return true;
  }

  // --- INTERCEPT INTERNAL PAGE NAVIGATION ---
  document.addEventListener('click', function (e) {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    if (!isEligibleLink(anchor, e)) return;

    if (isNavigating) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    startTransition(anchor.href);
  });

  // --- CLEAN UP ON BFCACHE RESTORATION / PAGESHOW ---
  window.addEventListener('pageshow', function () {
    cleanupOverlay();
  });

  window.addEventListener('pagehide', function () {
    // Keep isNavigating state clean
  });
})();

`;

js = js.slice(0, start) + replacement + js.slice(end);
fs.writeFileSync('js/spouzy-modern.js', js, 'utf8');
console.log('Successfully updated initSpouzyPageTransition in js/spouzy-modern.js');
