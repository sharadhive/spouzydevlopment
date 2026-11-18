/**
 * SPOUZY 2026 — Modern UI/UX Interactive Controller
 * Problem Solver Group (PSG) Specialist Wing
 */

// ---------------------------------------------------------------------------
// 0. UNIFIED SPOUZY TEDDY HUG ANIMATED LOADER & PAGE TRANSITION CONTROLLER
// ---------------------------------------------------------------------------
(function initSpouzyPageTransition() {
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
    if (/wa.me|api.whatsapp.com/i.test(targetUrl.href)) return false;

    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/index.htm';
    const targetPath = targetUrl.pathname.replace(/\/+$/, '') || '/index.htm';
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

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. STICKY HEADER & SCROLL BEHAVIOR
  // -------------------------------------------------------------------------
  const headerWrapper = document.querySelector('.sp-header-sticky-wrapper');
  const header = document.querySelector('.sp-header-modern');
  if (headerWrapper || header) {
    window.addEventListener('scroll', function () {
      const isScrolled = window.scrollY > 20;
      if (headerWrapper) headerWrapper.classList.toggle('is-scrolled', isScrolled);
      if (header) header.classList.toggle('sp-header-scrolled', isScrolled);
    }, { passive: true });
  }

  // -------------------------------------------------------------------------
  // 1B. NAVIGATION DROPDOWNS (MEGA-MENU & SIMPLE DROPDOWNS)
  // -------------------------------------------------------------------------
  const menus = Array.from(document.querySelectorAll('.guide-menu'));
  function toggleMenu(active) {
    menus.forEach(menu => {
      const open = menu === active;
      menu.querySelector('button').setAttribute('aria-expanded', String(open));
      menu.querySelector('.guide-links').hidden = !open;
      menu.classList.toggle('is-open', open);
      if (open) {
        const panel = menu.querySelector('.guide-links');
        panel.style.translate = '';
        const box = panel.getBoundingClientRect();
        const shift = Math.max(8 - box.left, Math.min(0, document.documentElement.clientWidth - 8 - box.right));
        panel.style.translate = shift + 'px 0';
      }
    });
  }
  menus.forEach(menu => {
    const button = menu.querySelector('button');
    const visuals = [...menu.querySelectorAll('.nav-visual')];
    const options = [...menu.querySelectorAll(".nav-options a, .nav-options .sp-submenu-trigger")];
    const policyTrigger = menu.querySelector('#sp-policy-trigger');
    const policySubmenu = menu.querySelector('#sp-policy-submenu');

    function closePolicySubmenu() {
      if (!policySubmenu) return;
      policySubmenu.hidden = true;
      policySubmenu.classList.remove('is-active');
      if (policyTrigger) {
        policyTrigger.setAttribute('aria-expanded', 'false');
        policyTrigger.removeAttribute('data-preview-active');
      }
    }

    function openPolicySubmenu() {
      if (!policySubmenu || !policyTrigger) return;
      options.forEach(item => item.removeAttribute('data-preview-active'));
      visuals.forEach(visual => visual.classList.remove('selected'));
      policyTrigger.setAttribute('aria-expanded', 'true');
      policyTrigger.setAttribute('data-preview-active', '');
      policySubmenu.hidden = false;
      policySubmenu.classList.add('is-active');
    }

    function showOption(index) {
      if (options[index] === policyTrigger) {
        openPolicySubmenu();
        return;
      }
      closePolicySubmenu();
      options.forEach((item, i) => item.toggleAttribute("data-preview-active", i === index));
      visuals.forEach((visual, i) => visual.classList.toggle('selected', i === index));
    }

    options.forEach((item, index) => {
      item.addEventListener('pointerenter', () => showOption(index));
      item.addEventListener('focus', () => showOption(index));
    });

    if (policyTrigger) {
      policyTrigger.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (policySubmenu && !policySubmenu.hidden && policySubmenu.classList.contains('is-active')) {
          closePolicySubmenu();
          showOption(0);
        } else {
          openPolicySubmenu();
        }
      });
      policyTrigger.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          openPolicySubmenu();
          const firstSublink = policySubmenu ? policySubmenu.querySelector('a') : null;
          if (firstSublink) firstSublink.focus();
        }
      });
    }

    if (policySubmenu) {
      policySubmenu.addEventListener('pointerenter', () => {
        openPolicySubmenu();
      });
      policySubmenu.addEventListener('keydown', event => {
        if (event.key === 'Escape' || event.key === 'ArrowLeft') {
          event.preventDefault();
          event.stopPropagation();
          closePolicySubmenu();
          if (policyTrigger) policyTrigger.focus();
        }
      });
    }

    button.addEventListener('pointerenter', () => showOption(0));
    button.addEventListener('focus', () => showOption(0));
    button.addEventListener('click', event => {
      const closing = event.detail === 0 && button.getAttribute('aria-expanded') === 'true';
      toggleMenu(closing ? null : menu);
      if (!closing) showOption(0);
    });
    menu.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && !menu.matches(':focus-within')) {
        toggleMenu(menu);
      }
    });
    menu.addEventListener('pointerleave', () => {
      if (!menu.matches(':focus-within')) {
        closePolicySubmenu();
        toggleMenu(null);
      }
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (policySubmenu && !policySubmenu.hidden && policySubmenu.contains(document.activeElement)) {
          event.preventDefault();
          closePolicySubmenu();
          if (policyTrigger) policyTrigger.focus();
          return;
        }
        closePolicySubmenu();
        button.focus();
        toggleMenu(null);
      }
      if (event.key === 'ArrowDown' && event.target === button) {
        event.preventDefault();
        toggleMenu(menu);
        const firstOpt = menu.querySelector('.nav-options a, .nav-options button');
        if (firstOpt) firstOpt.focus();
      }
    });
    menu.addEventListener('focusout', event => {
      if (!menu.contains(event.relatedTarget)) {
        closePolicySubmenu();
        toggleMenu(null);
      }
    });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.guide-menu')) toggleMenu(null);
  });
  // 2. GRAND HERO LARGE-BANNER SLIDER WITH SYNCHRONIZED AUTO-TEXT
  // -------------------------------------------------------------------------
  const bannerSlides = document.querySelectorAll('.sp-hero-banner-slide');
  const bannerTabs = document.querySelectorAll('.sp-banner-tab-item');
  const bannerTimerFill = document.querySelector('.sp-banner-timer-fill');
  const bannerPrev = document.querySelector('.sp-banner-prev');
  const bannerNext = document.querySelector('.sp-banner-next');
  const bannerFrame = document.querySelector('.sp-hero-banner-frame');

  let currentBannerIdx = 0;
  const totalBanners = bannerSlides.length;
  const BANNER_DURATION = 5500; // 5.5 seconds per slide
  let bannerTimer = null;
  let bannerProgressInterval = null;
  let bannerProgressStart = 0;
  let isBannerHovered = false;

  function switchBanner(index) {
    if (!bannerSlides.length) return;
    currentBannerIdx = (index + totalBanners) % totalBanners;

    // Update Banner Slides (both background image and text on top transition together)
    bannerSlides.forEach((slide, i) => {
      if (i === currentBannerIdx) {
        slide.classList.add('is-active');
      } else {
        slide.classList.remove('is-active');
      }
    });

    // Update Bottom Tabs
    bannerTabs.forEach((tab, i) => {
      if (i === currentBannerIdx) {
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('is-active');
        tab.setAttribute('aria-selected', 'false');
      }
    });

    restartBannerTimer();
  }

  function restartBannerTimer() {
    clearInterval(bannerProgressInterval);
    clearTimeout(bannerTimer);

    if (bannerTimerFill) {
      bannerTimerFill.style.width = '0%';
    }

    if (isBannerHovered || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    bannerProgressStart = Date.now();
    bannerProgressInterval = setInterval(() => {
      if (isBannerHovered || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const elapsed = Date.now() - bannerProgressStart;
      const pct = Math.min((elapsed / BANNER_DURATION) * 100, 100);
      if (bannerTimerFill) bannerTimerFill.style.width = pct + '%';
    }, 40);

    bannerTimer = setTimeout(() => {
      if (!isBannerHovered) {
        switchBanner(currentBannerIdx + 1);
      }
    }, BANNER_DURATION);
  }

  if (bannerSlides.length) {
    bannerTabs.forEach((tab, idx) => {
      tab.addEventListener('click', function () {
        switchBanner(idx);
      });
    });

    if (bannerPrev) {
      bannerPrev.addEventListener('click', function () {
        switchBanner(currentBannerIdx - 1);
      });
    }

    if (bannerNext) {
      bannerNext.addEventListener('click', function () {
        switchBanner(currentBannerIdx + 1);
      });
    }

    if (bannerFrame) {
      bannerFrame.addEventListener('mouseenter', function () {
        isBannerHovered = true;
      });
      bannerFrame.addEventListener('mouseleave', function () {
        isBannerHovered = false;
        restartBannerTimer();
      });
    }

    // Start with slide 0
    switchBanner(0);
  }

  // -------------------------------------------------------------------------
  // 3. HERO CARE MATCHER WIDGET INTERACTION
  // -------------------------------------------------------------------------
  const matcherBtn = document.querySelector('.sp-matcher-btn');
  const careSelect = document.querySelector('#sp-care-select');
  const formatSelect = document.querySelector('#sp-format-select');

  if (matcherBtn && careSelect) {
    matcherBtn.addEventListener('click', function (e) {
      e.preventDefault();
      const careVal = careSelect.value;
      const formatVal = formatSelect ? formatSelect.value : 'video';
      
      // Store in sessionStorage to pre-fill appointment page
      try {
        sessionStorage.setItem('spouzy_care_choice', careVal);
        sessionStorage.setItem('spouzy_format_choice', formatVal);
      } catch (err) {}

      // Smoothly navigate to book-appoinment.htm with parameters
      window.location.href = 'book-appoinment.htm?service=' + encodeURIComponent(careVal) + '&mode=' + encodeURIComponent(formatVal);
    });
  }

  // -------------------------------------------------------------------------
  // 4. INTERACTIVE 60-SEC RELATIONSHIP & CARE FINDER QUIZ
  // -------------------------------------------------------------------------
  const quizOptions = document.querySelectorAll('.sp-quiz-opt-btn');
  const quizResultBox = document.querySelector('.sp-quiz-result-box');
  const quizResultTitle = document.querySelector('#sp-quiz-res-title');
  const quizResultDesc = document.querySelector('#sp-quiz-res-desc');
  const quizResultLink = document.querySelector('#sp-quiz-res-link');

  const quizRecommendations = {
    'communication': {
      title: 'Recommended: Couples Communication & Conflict Resolution Therapy',
      desc: 'Our senior marital counsellors guide couples through structured exercises to de-escalate tension, restore emotional security, and build enduring understanding.',
      link: 'book-appoinment.htm?service=couples-therapy'
    },
    'premarital': {
      title: 'Recommended: Pre-Marital Alignment & Readiness Program',
      desc: 'Explore expectations, lifestyle habits, family integration, and financial harmony in a constructive, non-judgmental environment before making lifelong commitments.',
      link: 'book-appoinment.htm?service=premarital'
    },
    'intimacy': {
      title: 'Recommended: Confidential Intimacy & Medical Specialist Consultation',
      desc: 'Private, 1-on-1 or couples consultation with certified doctors and intimacy specialists adhering to strict clinical discretion and zero judgment.',
      link: 'book-appoinment.htm?service=intimacy-clinic'
    },
    'separation': {
      title: 'Recommended: Amicable Divorce & Dispute Mediation (PSG)',
      desc: 'Leverage Problem Solver Group’s 40-year multi-disciplinary dispute resolution expertise for respectful, amicable settlements prioritizing dignity and emotional wellbeing.',
      link: 'book-appoinment.htm?service=mediation'
    }
  };

  if (quizOptions.length && quizResultBox) {
    quizOptions.forEach(opt => {
      opt.addEventListener('click', function () {
        quizOptions.forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');

        const key = this.getAttribute('data-concern');
        if (quizRecommendations[key]) {
          const rec = quizRecommendations[key];
          if (quizResultTitle) quizResultTitle.textContent = rec.title;
          if (quizResultDesc) quizResultDesc.textContent = rec.desc;
          if (quizResultLink) quizResultLink.href = rec.link;

          quizResultBox.style.display = 'flex';
          quizResultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // 5. SPOTLIGHT LIVE SEARCH MODAL (SHARED MAINTAINABLE SEARCH INDEX)
  // -------------------------------------------------------------------------
  const SPOUZY_SEARCH_INDEX = [
    // 1. Company & Heritage
    {
      title: 'About Us',
      url: 'about-us.htm',
      desc: 'Overview of SPOUZY, multidisciplinary relationship & intimate care wing of PSG.',
      keywords: ['about us', 'who we are', 'about spouzy', 'psg', 'overview', 'counselling practice', 'practice'],
      aliases: ['about', 'who we are']
    },
    {
      title: 'Background',
      url: 'about-profile.htm',
      desc: 'Heritage of Problem Solver Group (PSG), established in 2004 by Neilesh Jethmal.',
      keywords: ['background', 'heritage', 'history', 'founder', 'neilesh jethmal', 'psg', 'story', 'credentials'],
      aliases: ['history', 'heritage', 'founder']
    },
    {
      title: 'Mission & Vision',
      url: 'mission-vision.htm',
      desc: 'Practical empathy, clinical ethics, patient dignity & sustainable conflict resolution.',
      keywords: ['mission & vision', 'mission', 'vision', 'values', 'ethics', 'commitments', 'principles'],
      aliases: ['mission', 'vision', 'values']
    },
    {
      title: 'Team',
      url: 'team.htm',
      desc: 'Multidisciplinary team of physicians, clinical psychologists & accredited mediators.',
      keywords: ['team', 'doctors', 'counsellors', 'specialists', 'practitioners', 'psychologists', 'mediators'],
      aliases: ['staff', 'specialists', 'faculty']
    },

    // 2. Services ("What We Do")
    {
      title: 'Pre-Marriage Guidance',
      url: 'pre-marriage.htm',
      desc: 'Premarital alignment, expectations, communication clarity & PSG charter before marriage.',
      keywords: ['pre-marriage', 'premarriage', 'premarital', 'pre-marital', 'before marriage', 'engagement', 'alignment', 'couples preparation'],
      aliases: ['premarital', 'pre marriage', 'premarital counselling']
    },
    {
      title: 'Post-Marriage Counselling',
      url: 'post-marriage.htm',
      desc: 'De-escalating recurring conflict, rebuilding trust, intimacy renewal & long-term marital therapy.',
      keywords: ['post-marriage', 'postmarriage', 'couples counselling', 'marriage counselling', 'marital therapy', 'couples', 'marriage', 'trust repair'],
      aliases: ['marriage counselling', 'couples therapy', 'couples counselling']
    },
    {
      title: 'Relationship Guidance',
      url: 'relationships.htm',
      desc: 'Constructive communication, emotional boundaries, life transitions & relational growth.',
      keywords: ['relationship guidance', 'relationships', 'relationship', 'partnership', 'communication', 'boundaries', 'guidance', 'emotional intimacy'],
      aliases: ['relationship', 'relationships', 'partnership']
    },
    {
      title: 'Intimate Health Care',
      url: 'intimate-health.htm',
      desc: 'Confidential clinical care for sexual health, discomfort, physical intimacy & well-being.',
      keywords: ['intimate health care', 'intimacy', 'sexual health', 'intimate wellness', 'andrology', 'endocrinology', 'physical intimacy'],
      aliases: ['intimacy', 'sexual health', 'intimate health']
    },
    {
      title: 'Intimate Aesthetics Treatment',
      url: 'intimate-aesthetics-treatment.htm',
      desc: 'Breast & genital specialized clinical practice: physical wellness examinations, symptom evaluation & discreet corrective care.',
      keywords: ['intimate aesthetics', 'intimate aesthetics treatment', 'breast and genital clinic', 'breast & genital clinic', 'breast clinic', 'genital clinic', 'corrective clinical care', 'intimate clinical practice'],
      aliases: ['breast and genital clinic', 'breast clinic', 'genital clinic', 'intimate aesthetics']
    },
    {
      title: 'Divorce Mediation',
      url: 'divorce-mediation.htm',
      desc: 'Dignified, confidential dispute mediation and amicable separation without court bitterness.',
      keywords: ['divorce mediation', 'divorce', 'mediation', 'amicable separation', 'dispute resolution', 'family dispute', 'separation', 'psg mediation'],
      aliases: ['divorce', 'mediation', 'separation']
    },
    {
      title: 'Prevent Sexual Violence',
      url: 'harassment-support.htm',
      desc: 'Workplace PoSH advisory, survivor support, harassment response & corporate sensitization.',
      keywords: ['prevent sexual violence', 'sexual harassment', 'posh', 'workplace harassment', 'harassment support', 'harassment', 'posh training', 'safety'],
      aliases: ['sexual harassment', 'posh', 'harassment']
    },

    // 3. No Cost Resources
    {
      title: 'For Students',
      url: 'students.htm',
      desc: 'Self-guided relationship check-ins, study pressure management & setting healthy boundaries.',
      keywords: ['for students', 'students', 'student', 'campus', 'youth', 'study pressure', 'three line check in', 'free exercises', 'free resources'],
      aliases: ['students', 'student']
    },
    {
      title: 'For Ex-Servicemen Families',
      url: 'military-families.htm',
      desc: 'Guidance for armed forces veterans and families navigating postings, transition & reunion.',
      keywords: ['for ex-servicemen families', 'military families', 'ex servicemen', 'veterans', 'defence families', 'armed forces', 'reconnecting', 'military'],
      aliases: ['military families', 'ex servicemen', 'veterans']
    },
    {
      title: 'Do’s and Don’ts',
      url: 'faq.htm',
      desc: 'Common questions, session guidelines, constructive communication principles & FAQ.',
      keywords: ['dos and donts', "do's and don'ts", 'faq', 'frequently asked questions', 'questions', 'preparation', 'answers', 'guidelines'],
      aliases: ['faq', 'dos and donts', "do's and don'ts", 'frequently asked questions']
    },
    {
      title: 'Blog',
      url: 'blog.htm',
      desc: 'Evidence-based relationship essays, clinical insights, communication frameworks & articles.',
      keywords: ['blog', 'articles', 'essays', 'guides', 'insights', 'reading', 'relationship advice', 'publications'],
      aliases: ['blog', 'articles']
    },
    {
      title: 'Gen Z Kama Sutra',
      url: 'gen-z-kama-sutra.htm',
      desc: 'Modern perspectives on consent, emotional safety, intimacy & respectful communication.',
      keywords: ['gen z kama sutra', 'gen z', 'kama sutra', 'modern intimacy', 'consent', 'emotional safety', 'communication', 'youth intimacy'],
      aliases: ['gen z', 'kama sutra', 'gen z intimacy']
    },
    {
      title: 'Corporate Kamasutra',
      url: 'corporate-kamasutra.htm',
      desc: 'Guidance for working professionals on balancing career demands, communication under stress & personal relationships.',
      keywords: ['corporate kamasutra', 'corporate kama sutra', 'working professionals', 'work-life balance', 'relationships', 'workplace boundaries', 'corporate intimacy', 'stress communication'],
      aliases: ['corporate kamasutra', 'corporate kama sutra', 'work-life intimacy']
    },

    // 4. Recruitment
    {
      title: 'Join as a Doctor',
      url: 'join-doctor.htm',
      desc: 'Opportunities for MD specialists, andrologists & intimacy clinicians in the SPOUZY network.',
      keywords: ['join as a doctor', 'doctor', 'careers', 'medical recruitment', 'clinical careers', 'md', 'physician', 'specialist'],
      aliases: ['doctor', 'join doctor']
    },
    {
      title: 'Join as a Counsellor',
      url: 'join-counsellor.htm',
      desc: 'Openings for licensed psychologists, marriage counsellors & dispute resolution mediators.',
      keywords: ['join as a counsellor', 'counsellor', 'therapist', 'psychologist', 'counselling careers', 'mediator', 'join team'],
      aliases: ['counsellor', 'join counsellor', 'therapist']
    },
    {
      title: 'Careers at SPOUZY',
      url: 'careers.htm',
      desc: 'Explore non-clinical career opportunities in sales coordination, digital marketing & performance marketing.',
      keywords: ['careers', 'careers at spouzy', 'jobs', 'hiring', 'work with us', 'openings', 'vacancies', 'employment'],
      aliases: ['careers', 'jobs', 'hiring']
    },
    {
      title: 'Careers: Sales Coordinator',
      url: 'careers.htm#role-sales-coordinator',
      desc: 'Sales & Client Coordination: coordinate incoming enquiries, client scheduling & consultation care.',
      keywords: ['sales coordinator', 'client coordination', 'sales', 'careers sales', 'front desk', 'client support'],
      aliases: ['sales coordinator', 'sales']
    },
    {
      title: 'Careers: Digital Marketing Executive',
      url: 'careers.htm#role-digital-marketing',
      desc: 'Marketing: educational social media, content creation, copywriting, basic SEO & community engagement.',
      keywords: ['digital marketing executive', 'digital marketing', 'content marketing', 'social media', 'marketing', 'copywriting', 'seo'],
      aliases: ['digital marketing', 'marketing']
    },
    {
      title: 'Careers: Performance Marketing Specialist',
      url: 'careers.htm#role-performance-marketing',
      desc: 'Growth & Paid Media: Google Ads, Meta Ads campaigns, conversion tracking, analytics & lead generation.',
      keywords: ['performance marketing specialist', 'performance marketing', 'paid ads', 'google ads', 'meta ads', 'growth', 'ppc'],
      aliases: ['performance marketing', 'google ads', 'paid marketing']
    },

    // 5. Appointments & Contact
    {
      title: 'Practitioner Directory',
      url: 'appointment.htm',
      desc: 'Verified directory of medical doctors, psychologists & dispute mediators across pan-India centers.',
      keywords: ['practitioner directory', 'directory', 'doctors', 'specialists directory', 'practitioners', 'clinicians', 'consultation desk'],
      aliases: ['practitioner directory', 'doctor directory', 'directory']
    },
    {
      title: 'Request an Appointment',
      url: 'book-appoinment.htm',
      desc: 'Schedule a private consultation with custom duration, date, mode & specialist selection.',
      keywords: ['request an appointment', 'book appointment', 'booking', 'schedule consultation', 'scheduler', 'book session', 'consultation'],
      aliases: ['appointment', 'book appointment', 'booking']
    },
    {
      title: 'Contact & Clinics',
      url: 'contactus.htm',
      desc: 'Pan-India clinic addresses (Mumbai, Pune, Delhi, Bengaluru), helpline & contact desk.',
      keywords: ['contact & clinics', 'contact us', 'contact', 'clinics', 'mulund', 'mumbai', 'pune', 'delhi', 'bengaluru', 'helpline', 'directions'],
      aliases: ['contact', 'clinics', 'directions', 'phone']
    },

    // 6. Policies & Legal
    {
      title: 'Privacy Policy',
      url: 'privacy-policy.htm',
      desc: 'Patient confidentiality standards, data encryption & non-disclosure compliance.',
      keywords: ['privacy policy', 'privacy', 'confidentiality', 'data protection', 'gdpr', 'dpdp', 'security'],
      aliases: ['privacy', 'privacy policy']
    },
    {
      title: 'Terms of Use',
      url: 'terms.htm',
      desc: 'Terms and conditions governing clinical consultations, dispute mediation & digital services.',
      keywords: ['terms of use', 'terms', 'terms and conditions', 'legal', 'agreement', 'user terms'],
      aliases: ['terms', 'terms of use']
    },
    {
      title: 'Confidentiality Pledge',
      url: 'confidentiality.htm',
      desc: 'Absolute clinical discretion, doctor-patient privilege & strict privacy protocols.',
      keywords: ['confidentiality pledge', 'confidentiality', 'discretion', 'doctor-patient privilege', 'privacy pledge'],
      aliases: ['confidentiality', 'pledge']
    },
    {
      title: 'Refund & Cancellation Policy',
      url: 'refund-policy.htm',
      desc: 'Transparent guidelines for session rescheduling, cancellations & refunds.',
      keywords: ['refund & cancellation policy', 'refund policy', 'cancellation', 'refund', 'rescheduling', 'fees'],
      aliases: ['refund', 'cancellation']
    },
    {
      title: 'Teleconsultation Policy',
      url: 'teleconsultation-policy.htm',
      desc: 'Telemedicine Practice Guidelines compliance for online audio & video consultations.',
      keywords: ['teleconsultation policy', 'teleconsultation', 'telehealth', 'online consultation', 'telemedicine'],
      aliases: ['telehealth', 'teleconsultation']
    },
    {
      title: 'Solution Guarantee Terms',
      url: 'solution-guarantee.htm',
      desc: 'Care commitment and professional resolution standards under the SPOUZY guarantee.',
      keywords: ['solution guarantee terms', 'solution guarantee', 'guarantee', 'resolution guarantee', 'commitment'],
      aliases: ['guarantee', 'solution guarantee']
    },
    {
      title: 'Informed Consent',
      url: 'informed-consent.htm',
      desc: 'Informed consent standards for counselling, intimate health examinations & mediation.',
      keywords: ['informed consent', 'consent', 'clinical consent', 'patient consent', 'agreement'],
      aliases: ['consent', 'informed consent']
    },
    {
      title: 'Medical & Legal Disclaimer',
      url: 'disclaimer.htm',
      desc: 'Boundaries between clinical health guidance, legal dispute mediation & medical care.',
      keywords: ['medical & legal disclaimer', 'disclaimer', 'medical disclaimer', 'legal disclaimer', 'advice limits'],
      aliases: ['disclaimer']
    },
    {
      title: 'Payment & Billing Policy',
      url: 'payment-policy.htm',
      desc: 'Fee schedules, accepted payment methods, invoicing & transparent billing rules.',
      keywords: ['payment & billing policy', 'payment policy', 'billing', 'fees', 'pricing', 'invoicing'],
      aliases: ['payment', 'billing', 'fees']
    },
    {
      title: 'Digital Products Delivery Policy',
      url: 'delivery-policy.htm',
      desc: 'Instant delivery terms for webinars, downloadable guides & digital materials.',
      keywords: ['digital products delivery policy', 'delivery policy', 'digital products', 'ebook delivery', 'downloads'],
      aliases: ['delivery', 'digital delivery']
    },
    {
      title: 'Cookie Policy',
      url: 'cookie-policy.htm',
      desc: 'Essential website cookies and privacy-preserving analytics disclosure.',
      keywords: ['cookie policy', 'cookies', 'cookie', 'tracking', 'browser storage'],
      aliases: ['cookies', 'cookie policy']
    },
    {
      title: 'Grievance Redressal Policy',
      url: 'grievance-redressal.htm',
      desc: 'Dedicated officer, procedure and timeline for resolving client grievances.',
      keywords: ['grievance redressal policy', 'grievance redressal', 'grievance', 'complaints', 'ombudsman', 'redressal'],
      aliases: ['grievance', 'complaints']
    },
    {
      title: 'Reviews & Testimonials Policy',
      url: 'testimonials-policy.htm',
      desc: 'Ethical testimonial standards without compromising patient privacy or doctor privilege.',
      keywords: ['reviews & testimonials policy', 'testimonials policy', 'reviews', 'testimonials', 'patient feedback'],
      aliases: ['reviews', 'testimonials']
    },

    // 7. Additional Guides & Resources
    {
      title: 'Reconnecting After Time Apart',
      url: 'reconnecting-after-time-apart.htm',
      desc: 'Practical guide to rebuilding intimacy and trust after long-distance, deployment or time apart.',
      keywords: ['reconnecting after time apart', 'reconnecting', 'time apart', 'long distance', 'reunion', 'rebuilding trust'],
      aliases: ['reconnecting', 'time apart']
    },
    {
      title: 'Before a Shared Decision',
      url: 'before-a-shared-decision.htm',
      desc: 'Structured reflection for couples facing major life, career or relationship crossroads.',
      keywords: ['before a shared decision', 'shared decision', 'decisions', 'crossroads', 'couples planning'],
      aliases: ['decision', 'shared decision']
    },
    {
      title: 'Counselling Overview',
      url: 'counselling.htm',
      desc: 'Comprehensive approach to SPOUZY relationship counselling, methodology & care plans.',
      keywords: ['counselling overview', 'counselling', 'therapy', 'counseling', 'sessions', 'approach'],
      aliases: ['counselling', 'therapy']
    },
    {
      title: 'Coaching & Personal Guidance',
      url: 'coaching.htm',
      desc: 'Individual coaching for emotional resilience, communication agility & personal clarity.',
      keywords: ['coaching & personal guidance', 'coaching', 'personal guidance', 'clarity', 'coaching sessions'],
      aliases: ['coaching']
    },
    {
      title: 'Treatment & Clinical Overview',
      url: 'treatment.htm',
      desc: 'Clinical questions and guidelines when medical concerns overlap with relationship dynamics.',
      keywords: ['treatment & clinical overview', 'treatment', 'clinical', 'medical concerns', 'clinical care'],
      aliases: ['treatment', 'clinical']
    },
    {
      title: 'Corporate Training & PoSH',
      url: 'training.htm',
      desc: 'Executive wellness workshops, anti-harassment training & corporate PoSH compliance.',
      keywords: ['corporate training & posh', 'training', 'posh training', 'corporate workshops', 'sensitization'],
      aliases: ['training', 'corporate training']
    },
    {
      title: 'Webinars & E-books',
      url: 'webinar-ebook.htm',
      desc: 'Digital educational resources, relationship webinars & downloadable guides.',
      keywords: ['webinars & e-books', 'webinar', 'ebook', 'e-books', 'guides', 'downloads'],
      aliases: ['webinar', 'ebook']
    },

    // 8. Account Destinations (Honest navigation)
    {
      title: 'Patient Portal Login',
      url: 'register.htm',
      desc: 'Patient portal access desk (online self-service in development; direct booking available).',
      keywords: ['patient portal login', 'login', 'sign in', 'portal', 'account', 'patient access'],
      aliases: ['login', 'sign in', 'portal']
    },
    {
      title: 'Create Patient Account',
      url: 'create-account.htm',
      desc: 'Patient record creation status (online registration in testing; appointments booked directly).',
      keywords: ['create patient account', 'create account', 'register', 'sign up', 'new patient', 'account registration'],
      aliases: ['register', 'create account', 'sign up']
    }
  ];

  function normalizeSearchText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[\u2018\u2019']/g, '') // remove straight & smart apostrophes
      .replace(/[\u2013\u2014-]/g, ' ') // convert hyphens & dashes to spaces
      .replace(/[^\w\s]/g, ' ') // remove other punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scoreSearchItem(item, queryNorm, queryTokens) {
    const titleNorm = normalizeSearchText(item.title);
    if (!queryNorm) return 1;

    // Exact title match gets highest priority
    if (titleNorm === queryNorm) return 1000;

    // Separation of Pre-Marriage and Post-Marriage:
    if (queryNorm.startsWith('pre') && titleNorm.startsWith('post')) return 0;
    if (queryNorm.startsWith('post') && titleNorm.startsWith('pre')) return 0;

    let score = 0;

    // Title starts with query
    if (titleNorm.startsWith(queryNorm)) {
      score += 500;
    } else if (titleNorm.includes(queryNorm)) {
      const wordRegex = new RegExp('\\b' + queryNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (wordRegex.test(titleNorm)) {
        score += 350;
      } else {
        score += 200;
      }
    }

    // Aliases match
    if (item.aliases && item.aliases.length) {
      for (const alias of item.aliases) {
        const aliasNorm = normalizeSearchText(alias);
        if (aliasNorm === queryNorm) {
          score += 400;
          break;
        } else if (aliasNorm.startsWith(queryNorm)) {
          score += 250;
          break;
        } else if (aliasNorm.includes(queryNorm)) {
          score += 150;
          break;
        }
      }
    }

    // Keywords match
    if (item.keywords && item.keywords.length) {
      for (const kw of item.keywords) {
        const kwNorm = normalizeSearchText(kw);
        if (kwNorm === queryNorm) {
          score += 300;
          break;
        } else if (kwNorm.startsWith(queryNorm)) {
          score += 180;
          break;
        } else if (kwNorm.includes(queryNorm)) {
          score += 120;
          break;
        }
      }
    }

    // Description match
    const descNorm = normalizeSearchText(item.desc);
    if (descNorm.includes(queryNorm)) {
      score += 60;
    }

    // Multi-token match across all fields
    if (queryTokens.length > 1) {
      const combined = titleNorm + ' ' + descNorm + ' ' + (item.keywords || []).map(normalizeSearchText).join(' ');
      const allTokensMatch = queryTokens.every(tok => combined.includes(tok));
      if (allTokensMatch) {
        score += 100;
      }
    }

    return score;
  }

  const searchTriggers = document.querySelectorAll('.sp-search-trigger, .sp-search-btn');
  const searchModal = document.querySelector('.sp-search-modal');
  const searchField = document.querySelector('.sp-search-field');
  const searchClose = document.querySelector('.sp-search-close');
  const drawerSearchInput = document.querySelector('.sp-drawer-search-input');
  const activeMobileDrawer = document.querySelector('.sp-mobile-drawer');

  let lastActiveElement = null;
  let restoreFocusToTrigger = true;

  function renderSearchResults(query = '') {
    if (!searchModal) return;
    const resultsList = searchModal.querySelector('.sp-search-results-list, .sp-search-results');
    if (!resultsList) return;

    resultsList.innerHTML = '';

    const queryNorm = normalizeSearchText(query);
    const queryTokens = queryNorm ? queryNorm.split(' ').filter(Boolean) : [];

    let matched = [];
    if (!queryNorm) {
      // Default: top 21 primary pages in order
      matched = SPOUZY_SEARCH_INDEX.slice(0, 21);
    } else {
      const scored = [];
      for (const item of SPOUZY_SEARCH_INDEX) {
        const score = scoreSearchItem(item, queryNorm, queryTokens);
        if (score > 0) {
          scored.push({ item, score });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      matched = scored.map(s => s.item);
    }

    if (!matched.length) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'sp-search-no-results';
      emptyLi.style.padding = '24px 16px';
      emptyLi.style.textAlign = 'center';
      emptyLi.style.color = '#8a737a';
      emptyLi.style.fontSize = '14px';
      emptyLi.textContent = 'No matching pages or resources found for "' + query + '".';
      resultsList.appendChild(emptyLi);
      return;
    }

    matched.forEach(item => {
      const li = document.createElement('li');
      li.className = 'sp-search-result-item';

      const a = document.createElement('a');
      a.setAttribute('href', item.url);

      const contentWrap = document.createElement('div');
      contentWrap.style.display = 'flex';
      contentWrap.style.flexDirection = 'column';
      contentWrap.style.gap = '2px';
      contentWrap.style.textAlign = 'left';

      const titleSpan = document.createElement('span');
      titleSpan.style.fontWeight = '650';
      titleSpan.style.color = 'var(--sp-wine, #5b1a29)';
      titleSpan.style.fontSize = '14px';
      titleSpan.textContent = item.title;

      const descSpan = document.createElement('span');
      descSpan.style.fontSize = '12px';
      descSpan.style.color = 'var(--sp-text-muted, #735960)';
      descSpan.style.fontWeight = '400';
      descSpan.style.lineHeight = '1.3';
      descSpan.textContent = item.desc;

      contentWrap.appendChild(titleSpan);
      contentWrap.appendChild(descSpan);

      const arrowSpan = document.createElement('span');
      arrowSpan.setAttribute('aria-hidden', 'true');
      arrowSpan.style.color = 'var(--sp-copper, #bf674f)';
      arrowSpan.style.fontWeight = '700';
      arrowSpan.style.marginLeft = '12px';
      arrowSpan.textContent = '↗';

      a.appendChild(contentWrap);
      a.appendChild(arrowSpan);

      a.addEventListener('click', function (e) {
        handleSearchResultActivation(e, item.url, a);
      });

      li.appendChild(a);
      resultsList.appendChild(li);
    });
  }

  function handleSearchResultActivation(e, href, anchorEl) {
    restoreFocusToTrigger = false;
    closeSearch();

    const currentPath = window.location.pathname.split('/').pop() || 'index.htm';
    const targetUrl = new URL(href, window.location.href);
    const targetPath = targetUrl.pathname.split('/').pop() || 'index.htm';
    const targetHash = targetUrl.hash;

    if (targetPath === currentPath && targetHash) {
      e.preventDefault();
      const targetElement = document.querySelector(targetHash);
      if (targetElement) {
        const stickyHeader = document.querySelector('.sp-header-sticky-wrapper, .sp-header-modern');
        const headerHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 90;
        const targetRect = targetElement.getBoundingClientRect();
        const offsetPosition = window.pageYOffset + targetRect.top - headerHeight - 16;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth'
        });
        targetElement.focus({ preventScroll: true });
        window.history.pushState(null, '', targetHash);
      }
    }
  }

  function openSearch() {
    if (!searchModal) return;
    lastActiveElement = document.activeElement;
    restoreFocusToTrigger = true;

    if (activeMobileDrawer && activeMobileDrawer.classList.contains('is-open')) {
      activeMobileDrawer.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    searchModal.classList.add('is-open');
    renderSearchResults(searchField ? searchField.value : '');

    setTimeout(() => {
      if (searchField) searchField.focus();
    }, 100);
  }

  function closeSearch() {
    if (!searchModal) return;
    searchModal.classList.remove('is-open');
    if (searchField) searchField.value = '';

    if (restoreFocusToTrigger && lastActiveElement && typeof lastActiveElement.focus === 'function') {
      lastActiveElement.focus();
    }
    restoreFocusToTrigger = true;
  }

  searchTriggers.forEach(trigger => {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      openSearch();
    });
  });

  if (drawerSearchInput) {
    drawerSearchInput.addEventListener('click', function (e) {
      e.preventDefault();
      openSearch();
    });
    drawerSearchInput.addEventListener('focus', function (e) {
      e.preventDefault();
      openSearch();
    });
  }

  if (searchClose) {
    searchClose.addEventListener('click', closeSearch);
  }

  if (searchModal) {
    searchModal.addEventListener('click', function (e) {
      if (e.target === searchModal) {
        closeSearch();
      }
    });
  }

  // Keyboard shortcut Ctrl+K or / to open search
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchModal && searchModal.classList.contains('is-open')) {
        closeSearch();
      } else {
        openSearch();
      }
    } else if (e.key === 'Escape' && searchModal && searchModal.classList.contains('is-open')) {
      closeSearch();
    }
  });

  if (searchField) {
    searchField.addEventListener('input', function () {
      renderSearchResults(this.value);
    });
  }

  // 6. MOBILE DRAWER NAVIGATION
  // -------------------------------------------------------------------------
  const mobileToggle = document.querySelector('.sp-mobile-toggle');
  const mobileDrawer = document.querySelector('.sp-mobile-drawer');
  const mobileClose = document.querySelector('.sp-mobile-drawer-close');

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', function () {
      mobileDrawer.classList.toggle('is-open');
      document.body.style.overflow = mobileDrawer.classList.contains('is-open') ? 'hidden' : '';
    });

    if (mobileClose) {
      mobileClose.addEventListener('click', function () {
        mobileDrawer.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    }

    mobileDrawer.addEventListener('click', function (e) {
      if (e.target === mobileDrawer) {
        mobileDrawer.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }

  // -------------------------------------------------------------------------
  // 7. SMOOTH IN-PAGE ANCHOR JUMPS
  // -------------------------------------------------------------------------
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. SCROLL-TRIGGERED REVEAL ANIMATION ENGINE
  // -------------------------------------------------------------------------
  const revealElements = document.querySelectorAll('.sp-reveal, .sp-reveal-left, .sp-reveal-right, .sp-reveal-scale');
  if ('IntersectionObserver' in window && revealElements.length) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('sp-in-view');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    // Fallback if IntersectionObserver not supported
    revealElements.forEach(el => el.classList.add('sp-in-view'));
  }

  // -------------------------------------------------------------------------
  // 9. DYNAMIC NUMBER COUNT-UP ANIMATION
  // -------------------------------------------------------------------------
  const counters = document.querySelectorAll('.sp-count-up');
  if ('IntersectionObserver' in window && counters.length) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const targetNum = parseInt(el.getAttribute('data-target'), 10) || 0;
          const suffix = el.getAttribute('data-suffix') || '';
          const prefix = el.getAttribute('data-prefix') || '';
          const duration = 2000; // 2 seconds
          const startTime = performance.now();

          function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentVal = Math.floor(easeOut * targetNum);

            el.textContent = prefix + currentVal.toLocaleString() + suffix;

            if (progress < 1) {
              requestAnimationFrame(updateCounter);
            } else {
              el.textContent = prefix + targetNum.toLocaleString() + suffix;
              el.classList.add('is-counted');
            }
          }

          requestAnimationFrame(updateCounter);
          observer.unobserve(el);
        }
      });
    }, {
      threshold: 0.3
    });

    counters.forEach(c => counterObserver.observe(c));
  }

  // -------------------------------------------------------------------------
  // 10. ROTATING KINETIC WORD ANIMATION
  // -------------------------------------------------------------------------
  const rotatingWords = document.querySelectorAll('.sp-rotating-word');
  if (rotatingWords.length > 1) {
    let activeWordIdx = 0;
    setInterval(() => {
      rotatingWords[activeWordIdx].classList.remove('is-active');
      rotatingWords[activeWordIdx].classList.add('is-exit');

      const prevIdx = activeWordIdx;
      setTimeout(() => {
        rotatingWords[prevIdx].classList.remove('is-exit');
      }, 600);

      activeWordIdx = (activeWordIdx + 1) % rotatingWords.length;
      rotatingWords[activeWordIdx].classList.add('is-active');
    }, 2800);
  }

  // -------------------------------------------------------------------------
  // 11. SUBPAGE INTERACTIVE CONTROLLERS (BOOKING, SLOTS, FILTERS, FEEDBACK)
  // -------------------------------------------------------------------------

  // A. Time Slot Selector
  document.querySelectorAll('.sp-slot-pill').forEach(pill => {
    pill.addEventListener('click', function () {
      const parent = this.closest('.sp-slots-grid');
      if (parent) {
        parent.querySelectorAll('.sp-slot-pill').forEach(p => p.classList.remove('is-selected'));
      }
      this.classList.add('is-selected');
      const hiddenInput = document.getElementById('selectedTimeSlot');
      if (hiddenInput) {
        hiddenInput.value = this.textContent.trim();
      }
    });
  });

  // B. Doctor "Quick Book" click: Auto-select doctor in form & scroll smoothly
  document.querySelectorAll('[data-book-doctor]').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const doctorName = this.getAttribute('data-book-doctor');
      const doctorSelect = document.getElementById('spDoctorSelect');
      if (doctorSelect) {
        for (let i = 0; i < doctorSelect.options.length; i++) {
          if (doctorSelect.options[i].text.includes(doctorName) || doctorSelect.options[i].value.includes(doctorName)) {
            doctorSelect.selectedIndex = i;
            break;
          }
        }
      }
      const bookingCard = document.querySelector('.sp-booking-card-modern');
      if (bookingCard) {
        bookingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        bookingCard.style.boxShadow = '0 0 0 4px rgba(191, 103, 79, 0.4)';
        setTimeout(() => {
          bookingCard.style.boxShadow = '';
        }, 1200);
      }
    });
  });

  // C. Specialty Filter in Doctor Directory
  document.querySelectorAll('.sp-filter-pill').forEach(pill => {
    pill.addEventListener('click', function () {
      const parent = this.closest('.sp-filter-bar');
      if (parent) {
        parent.querySelectorAll('.sp-filter-pill').forEach(p => p.classList.remove('is-active'));
      }
      this.classList.add('is-active');
      const filter = this.getAttribute('data-filter');
      const doctorCards = document.querySelectorAll('.sp-doctor-card-modern');
      doctorCards.forEach(card => {
        if (!filter || filter === 'all') {
          card.style.display = 'grid';
        } else {
          const category = card.getAttribute('data-category') || '';
          if (category.toLowerCase().includes(filter.toLowerCase())) {
            card.style.display = 'grid';
          } else {
            card.style.display = 'none';
          }
        }
      });
    });
  });

  // D. Mode Tabs (All Modes, Virtual, Clinic)
  document.querySelectorAll('.sp-mode-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const parent = this.closest('.sp-booking-modes');
      if (parent) {
        parent.querySelectorAll('.sp-mode-btn').forEach(b => b.classList.remove('is-active'));
      }
      this.classList.add('is-active');
      const mode = this.getAttribute('data-mode');
      const doctorCards = document.querySelectorAll('.sp-doctor-card-modern');
      doctorCards.forEach(card => {
        if (!mode || mode === 'all') {
          card.style.display = 'grid';
        } else {
          const cardModes = card.getAttribute('data-modes') || '';
          if (cardModes.toLowerCase().includes(mode.toLowerCase())) {
            card.style.display = 'grid';
          } else {
            card.style.display = 'none';
          }
        }
      });
    });
  });

  // =========================================================================
  // 16. SHARED SPOUZY CONTACT & WHATSAPP CONFIGURATION
  // =========================================================================
  const SPOUZY_CONTACT_CONFIG = {
    phoneDisplay: '+91 85919 45055',
    phoneTel: 'tel:+918591945055',
    whatsappNumber: '918591945055',
    whatsappBaseUrl: 'https://wa.me/918591945055'
  };

  // Safe WhatsApp Navigation & Fallback Handoff Function
  function openWhatsAppHandoff(phone, messageText, feedbackContainer) {
    const encodedMsg = encodeURIComponent(messageText);
    const waUrl = 'https://wa.me/' + phone + '?text=' + encodedMsg;

    // Direct navigation without delayed timers to prevent browser popup blocking
    try {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {}

    // Safe DOM construction for feedback and fallback
    if (feedbackContainer) {
      feedbackContainer.innerHTML = '';
      feedbackContainer.style.display = 'block';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'sp-form-handoff-title';
      titleDiv.innerHTML = '<i class="fa fa-whatsapp" style="color: #25D366; font-size: 20px;" aria-hidden="true"></i> Continue in WhatsApp and press Send to complete your enquiry.';

      const textP = document.createElement('p');
      textP.className = 'sp-form-handoff-text';
      textP.textContent = 'Your form details have been prepared for SPOUZY at +91 85919 45055. Please review the prefilled message in WhatsApp and tap Send to dispatch.';

      const btnWrap = document.createElement('div');
      btnWrap.style.display = 'flex';
      btnWrap.style.flexWrap = 'wrap';
      btnWrap.style.gap = '10px';
      btnWrap.style.marginTop = '12px';

      const fallbackLink = document.createElement('a');
      fallbackLink.href = waUrl;
      fallbackLink.target = '_blank';
      fallbackLink.rel = 'noopener noreferrer';
      fallbackLink.className = 'sp-form-handoff-btn';
      fallbackLink.innerHTML = '<i class="fa fa-whatsapp" aria-hidden="true"></i> Open WhatsApp with my enquiry ↗';
      btnWrap.appendChild(fallbackLink);

      if (messageText.length > 1800) {
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'sp-form-copy-btn';
        copyBtn.innerHTML = '<i class="fa fa-clone" aria-hidden="true"></i> Copy Enquiry Text';
        copyBtn.addEventListener('click', function () {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(messageText).then(() => {
              copyBtn.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i> Copied to Clipboard';
              setTimeout(() => { copyBtn.innerHTML = '<i class="fa fa-clone" aria-hidden="true"></i> Copy Enquiry Text'; }, 2000);
            });
          }
        });
        btnWrap.appendChild(copyBtn);
      }

      feedbackContainer.appendChild(titleDiv);
      feedbackContainer.appendChild(textP);
      feedbackContainer.appendChild(btnWrap);
      feedbackContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // =========================================================================
  // 16A. FLOATING CONTACT WIDGET (PULSING LAUNCHER, 5S/3S/2S AUTOMATIC TOOLTIP & PANEL)
  // =========================================================================
  function initSpouzyFloatingWidget() {
    if (window.__spouzyFloatingWidgetInitialized) return;
    window.__spouzyFloatingWidgetInitialized = true;

    let widget = document.getElementById('spFloatingWidget');
    if (!widget) {
      widget = document.createElement('div');
      widget.className = 'sp-floating-widget';
      widget.id = 'spFloatingWidget';
      widget.setAttribute('aria-label', 'Instant Chat & Talk - Contact SPOUZY');
      widget.innerHTML = 
        '<div class="sp-floating-panel" id="spFloatingPanel" role="dialog" aria-modal="false" aria-labelledby="spPanelHeading" hidden>' +
          '<div class="sp-floating-panel-header">' +
            '<div class="sp-floating-panel-title-wrap">' +
              '<span class="sp-floating-wa-badge"><i class="fa fa-whatsapp" aria-hidden="true"></i></span>' +
              '<div>' +
                '<h3 class="sp-floating-panel-title" id="spPanelHeading">Talk to SPOUZY</h3>' +
                '<p class="sp-floating-panel-sub"><i class="fa fa-bolt" aria-hidden="true" style="color: var(--sp-copper-light); margin-right: 3px;"></i>Instant Chat &amp; Talk</p>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="sp-floating-close-btn" id="spCloseWidgetBtn" aria-label="Close contact options">&times;</button>' +
          '</div>' +
          '<div class="sp-floating-panel-body">' +
            '<p class="sp-floating-panel-text">Instant chat and talk support with our team on WhatsApp or direct call.</p>' +
            '<div class="sp-floating-number-pill">' +
              '<i class="fa fa-phone" aria-hidden="true"></i> +91 85919 45055' +
            '</div>' +
            '<div class="sp-floating-actions">' +
              '<a href="https://wa.me/918591945055?text=Hello%20SPOUZY%2C%20I%20would%20like%20to%20know%20more%20about%20your%20services.%20Please%20help%20me%20with%20my%20enquiry." ' +
                 'class="sp-floating-btn sp-floating-btn-wa" target="_blank" rel="noopener noreferrer">' +
                '<i class="fa fa-whatsapp" aria-hidden="true"></i> Chat on WhatsApp' +
              '</a>' +
              '<a href="tel:+918591945055" class="sp-floating-btn sp-floating-btn-call">' +
                '<i class="fa fa-phone" aria-hidden="true"></i> Call Now' +
              '</a>' +
            '</div>' +
            '<div class="sp-floating-anim-toggle-wrap">' +
              '<button type="button" class="sp-floating-anim-toggle-btn" id="spPauseAnimBtn" aria-pressed="false">' +
                '<i class="fa fa-pause-circle" aria-hidden="true"></i> <span>Pause animations</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" class="sp-floating-launcher" id="spWidgetLauncher" aria-expanded="false" aria-controls="spFloatingPanel" aria-label="Instant Chat &amp; Talk - Open SPOUZY contact options">' +
          '<span class="sp-floating-launcher-inner">' +
            '<i class="fa fa-whatsapp sp-floating-launcher-icon" aria-hidden="true"></i>' +
          '</span>' +
        '</button>' +
        '<div class="sp-floating-hover-label" id="spFloatingHoverLabel" aria-hidden="true">Instant Chat &amp; Talk</div>';
      document.body.appendChild(widget);
    }

    const launcher = widget.querySelector('#spWidgetLauncher');
    const panel = widget.querySelector('#spFloatingPanel');
    const closeBtn = widget.querySelector('#spCloseWidgetBtn');
    const tooltip = widget.querySelector('#spFloatingHoverLabel');
    const pauseBtn = widget.querySelector('#spPauseAnimBtn');

    let showTimeout = null;
    let hideTimeout = null;
    let isPanelOpen = false;
    let isHoveredOrFocused = false;
    let isPausedByUser = false;

    try {
      isPausedByUser = localStorage.getItem('spouzy_pause_widget_anim') === 'true';
    } catch (e) {
      isPausedByUser = false;
    }

    const prefersReducedMotion = () => {
      try {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) {
        return false;
      }
    };

    function updatePauseButtonUI() {
      if (!pauseBtn) return;
      pauseBtn.setAttribute('aria-pressed', isPausedByUser ? 'true' : 'false');
      const span = pauseBtn.querySelector('span');
      const icon = pauseBtn.querySelector('i');
      if (span) {
        span.textContent = isPausedByUser ? 'Resume animations' : 'Pause animations';
      }
      if (icon) {
        icon.className = isPausedByUser ? 'fa fa-play-circle' : 'fa fa-pause-circle';
      }
      if (isPausedByUser) {
        widget.classList.add('is-anim-paused');
      } else {
        widget.classList.remove('is-anim-paused');
      }
    }
    updatePauseButtonUI();

    function clearTimers() {
      if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
      }
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    }

    function hideTooltipAuto() {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      // While hovered or focused, keep tooltip visible instead of letting automatic timer hide it
      if (isHoveredOrFocused) {
        return;
      }
      if (tooltip) {
        tooltip.classList.remove('is-visible');
      }

      // Schedule next show after 2 seconds (3s visible + 2s hidden = 5s start-to-start)
      if (!isPanelOpen && !isPausedByUser && !prefersReducedMotion() && !document.hidden) {
        showTimeout = setTimeout(showTooltipAuto, 2000);
      }
    }

    function showTooltipAuto() {
      if (showTimeout) {
        clearTimeout(showTimeout);
        showTimeout = null;
      }
      if (isPanelOpen || isPausedByUser || prefersReducedMotion() || document.hidden) {
        return;
      }

      if (tooltip) {
        tooltip.classList.add('is-visible');
      }

      // Tooltip remains visible for exactly 3 seconds
      hideTimeout = setTimeout(hideTooltipAuto, 3000);
    }

    function startAutoCycle(initialDelay = 5000) {
      clearTimers();
      if (isPanelOpen || isPausedByUser || prefersReducedMotion() || document.hidden) {
        return;
      }
      showTimeout = setTimeout(showTooltipAuto, initialDelay);
    }

    function stopAutoCycle() {
      clearTimers();
      if (tooltip && !isHoveredOrFocused) {
        tooltip.classList.remove('is-visible');
      }
    }

    // Start 5-second initial countdown on page load
    startAutoCycle(5000);

    function openPanel() {
      if (!panel || !launcher) return;
      isPanelOpen = true;
      stopAutoCycle();
      if (tooltip) {
        tooltip.classList.remove('is-visible');
      }
      widget.classList.add('panel-open');
      panel.hidden = false;
      panel.classList.add('is-open');
      launcher.setAttribute('aria-expanded', 'true');
      launcher.setAttribute('aria-label', 'Close SPOUZY contact options');
      const firstAction = panel.querySelector('.sp-floating-btn-wa, button');
      if (firstAction) firstAction.focus();
    }

    function closePanel(returnFocus = true) {
      if (!panel || !launcher) return;
      isPanelOpen = false;
      panel.classList.remove('is-open');
      widget.classList.remove('panel-open');
      launcher.setAttribute('aria-expanded', 'false');
      launcher.setAttribute('aria-label', 'Instant Chat & Talk - Open SPOUZY contact options');
      setTimeout(() => {
        if (!panel.classList.contains('is-open')) {
          panel.hidden = true;
        }
      }, 240);
      if (returnFocus) launcher.focus();

      // When panel closes, start a fresh 5-second wait before next automatic appearance
      startAutoCycle(5000);
    }

    if (launcher) {
      launcher.addEventListener('click', function (e) {
        e.stopPropagation();
        if (panel && panel.classList.contains('is-open')) {
          closePanel();
        } else {
          openPanel();
        }
      });

      launcher.addEventListener('pointerenter', function () {
        isHoveredOrFocused = true;
        widget.classList.add('is-launcher-hovered');
        if (tooltip && !isPanelOpen) {
          tooltip.classList.add('is-visible');
        }
      });

      launcher.addEventListener('pointerleave', function () {
        isHoveredOrFocused = false;
        widget.classList.remove('is-launcher-hovered');
        // Return to automatic behavior without flicker
        if (!isPanelOpen && !isPausedByUser && !prefersReducedMotion() && !document.hidden) {
          if (tooltip) {
            tooltip.classList.remove('is-visible');
          }
          // Resume automatic cycle: 2 seconds hidden before next appearance
          clearTimers();
          showTimeout = setTimeout(showTooltipAuto, 2000);
        } else {
          if (tooltip) tooltip.classList.remove('is-visible');
        }
      });

      launcher.addEventListener('focus', function () {
        isHoveredOrFocused = true;
        widget.classList.add('is-launcher-hovered');
        if (tooltip && !isPanelOpen) {
          tooltip.classList.add('is-visible');
        }
      });

      launcher.addEventListener('blur', function () {
        isHoveredOrFocused = false;
        widget.classList.remove('is-launcher-hovered');
        if (!isPanelOpen && !isPausedByUser && !prefersReducedMotion() && !document.hidden) {
          if (tooltip) {
            tooltip.classList.remove('is-visible');
          }
          clearTimers();
          showTimeout = setTimeout(showTooltipAuto, 2000);
        } else {
          if (tooltip) tooltip.classList.remove('is-visible');
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closePanel();
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        isPausedByUser = !isPausedByUser;
        try {
          localStorage.setItem('spouzy_pause_widget_anim', isPausedByUser ? 'true' : 'false');
        } catch (err) {}
        updatePauseButtonUI();
        if (isPausedByUser) {
          stopAutoCycle();
        } else {
          startAutoCycle(5000);
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel && panel.classList.contains('is-open')) {
        closePanel();
      }
    });

    document.addEventListener('click', function (e) {
      if (panel && panel.classList.contains('is-open') && !widget.contains(e.target)) {
        closePanel(false);
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopAutoCycle();
      } else {
        if (!isPanelOpen && !isPausedByUser) {
          // When visible again, start a fresh 5-second wait. Do not replay missed cycles.
          startAutoCycle(5000);
        }
      }
    });

    try {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (motionQuery.addEventListener) {
        motionQuery.addEventListener('change', function (e) {
          if (e.matches) {
            stopAutoCycle();
          } else {
            if (!isPanelOpen && !isPausedByUser) {
              startAutoCycle(5000);
            }
          }
        });
      }
    } catch (err) {}
  }

  // =========================================================================
  // 16B. CONTACT FORM HANDLER (contactus.htm)
  // =========================================================================
  function initSpouzyContactForm() {
    const form = document.getElementById('spContactForm');
    if (!form) return;

    const validationError = document.getElementById('spContactValidationError');
    const feedbackContainer = document.getElementById('spContactFeedback');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (validationError) validationError.style.display = 'none';

      const firstNameInput = document.getElementById('cfFirstName');
      const lastNameInput = document.getElementById('cfLastName');
      const phoneInput = document.getElementById('cfPhone');
      const emailInput = document.getElementById('cfEmail');
      const serviceSelect = document.getElementById('cfService');
      const contactMethodSelect = document.getElementById('cfPreferredContact');
      const messageInput = document.getElementById('cfMessage');

      const firstName = firstNameInput ? firstNameInput.value.trim() : '';
      const lastName = lastNameInput ? lastNameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const service = serviceSelect && serviceSelect.selectedIndex > 0 ? serviceSelect.options[serviceSelect.selectedIndex].text.trim() : '';
      const preferredContact = contactMethodSelect && contactMethodSelect.selectedIndex >= 0 ? contactMethodSelect.options[contactMethodSelect.selectedIndex].text.trim() : '';
      const message = messageInput ? messageInput.value.trim() : '';

      if (!firstName) {
        showContactError('Please provide your first name or alias.');
        if (firstNameInput) firstNameInput.focus();
        return;
      }

      if (!phone) {
        showContactError('Please provide your contact phone or WhatsApp number.');
        if (phoneInput) phoneInput.focus();
        return;
      }

      if (!email || !email.includes('@')) {
        showContactError('Please provide a valid email address.');
        if (emailInput) emailInput.focus();
        return;
      }

      if (!service) {
        showContactError('Please select your area of concern / service.');
        if (serviceSelect) serviceSelect.focus();
        return;
      }

      const fullName = (firstName + (lastName ? ' ' + lastName : '')).trim();

      const lines = [
        'Hello SPOUZY, I have an enquiry.',
        '',
        'Name / Alias: ' + fullName,
        'Phone: ' + phone,
        'Email: ' + email,
        'Subject / Service: ' + service,
      ];

      if (preferredContact) {
        lines.push('Preferred Contact Method: ' + preferredContact);
      }

      lines.push('Message: ' + (message || 'Not provided'));
      lines.push('');
      lines.push('Please let me know the next steps.');

      const fullMessage = lines.join('\n');
      openWhatsAppHandoff('918591945055', fullMessage, feedbackContainer);
    });

    function showContactError(msg) {
      if (validationError) {
        validationError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        validationError.style.display = 'block';
        validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }
  }

  // =========================================================================
  // 16C. QUICK BOOKING FORM HANDLER (appointment.htm)
  // =========================================================================
  function initSpouzyQuickBookingForm() {
    const form = document.getElementById('spBookingForm');
    // Only target appointment.htm (which has spConsultDate and does not have spTimePickerTrigger)
    if (!form || !document.getElementById('spConsultDate') || document.getElementById('spSchedulerBlock')) return;

    const validationError = document.getElementById('spQuickBookingValidationError');
    const feedbackContainer = document.getElementById('spQuickBookingFeedback');

    // Preselect mode or doctor from URL query parameters if present
    try {
      const qParams = new URLSearchParams(window.location.search);
      const qMode = qParams.get('mode');
      const qModeSelect = document.getElementById('spConsultMode');
      if (qMode && qModeSelect) {
        const normQMode = qMode.trim().toLowerCase();
        const quickModeMap = {
          'virtual': 'virtual', 'online': 'virtual', 'video': 'virtual', 'telehealth': 'virtual',
          'mumbai': 'mumbai', 'mulund': 'mumbai', 'pune': 'pune', 'delhi': 'delhi', 'bengaluru': 'bengaluru'
        };
        if (Object.prototype.hasOwnProperty.call(quickModeMap, normQMode)) {
          const matched = quickModeMap[normQMode];
          for (let i = 0; i < qModeSelect.options.length; i++) {
            if (qModeSelect.options[i].value === matched) {
              qModeSelect.selectedIndex = i;
              break;
            }
          }
        }
      }
    } catch (e) {}

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (validationError) validationError.style.display = 'none';

      const consultTypeSelect = document.getElementById('spConsultType');
      const consultModeSelect = document.getElementById('spConsultMode');
      const doctorSelect = document.getElementById('spDoctorSelect');
      const patientNameInput = document.getElementById('spPatientName');
      const patientPhoneInput = document.getElementById('spPatientPhone');
      const patientEmailInput = document.getElementById('spPatientEmail');
      const consultDateInput = document.getElementById('spConsultDate');
      const selectedSlotEl = form.querySelector('.sp-slot-pill.is-selected');

      const patientName = patientNameInput ? patientNameInput.value.trim() : '';
      const patientPhone = patientPhoneInput ? patientPhoneInput.value.trim() : '';
      const patientEmail = patientEmailInput ? patientEmailInput.value.trim() : '';
      const dateVal = consultDateInput ? consultDateInput.value.trim() : '';
      const slotVal = selectedSlotEl ? selectedSlotEl.textContent.trim() : '';

      const service = consultTypeSelect && consultTypeSelect.selectedIndex >= 0 ? consultTypeSelect.options[consultTypeSelect.selectedIndex].text.trim() : '';
      const mode = consultModeSelect && consultModeSelect.selectedIndex >= 0 ? consultModeSelect.options[consultModeSelect.selectedIndex].text.trim() : '';
      const doctor = doctorSelect && doctorSelect.selectedIndex >= 0 ? doctorSelect.options[doctorSelect.selectedIndex].text.trim() : '';

      if (!patientName) {
        showQuickError('Please provide your name or alias.');
        if (patientNameInput) patientNameInput.focus();
        return;
      }

      if (!patientPhone) {
        showQuickError('Please provide your mobile / WhatsApp number.');
        if (patientPhoneInput) patientPhoneInput.focus();
        return;
      }

      if (!patientEmail || !patientEmail.includes('@')) {
        showQuickError('Please provide a valid email address.');
        if (patientEmailInput) patientEmailInput.focus();
        return;
      }

      if (!dateVal) {
        showQuickError('Please select a preferred date.');
        if (consultDateInput) consultDateInput.focus();
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (dateVal < todayStr) {
        showQuickError('Past dates cannot be selected. Please choose today or a future date.');
        if (consultDateInput) consultDateInput.focus();
        return;
      }

      if (!slotVal) {
        showQuickError('Please select a time slot.');
        return;
      }

      let readableDate = dateVal;
      try {
        const [y, m, d] = dateVal.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        readableDate = weekdays[dt.getDay()] + ', ' + d + ' ' + months[m - 1] + ' ' + y;
      } catch (e) {}

      const lines = [
        'Hello SPOUZY, I would like to request an appointment.',
        '',
        'Name / Alias: ' + patientName,
        'Phone: ' + patientPhone,
        'Email: ' + patientEmail,
        'Service: ' + (service || 'Relationship Guidance'),
      ];

      if (doctor && !doctor.toLowerCase().includes('first available')) {
        lines.push('Practitioner: ' + doctor);
      }

      lines.push('Consultation Mode: ' + (mode || 'Encrypted Video'));
      lines.push('Requested Date: ' + readableDate);
      lines.push('Requested Time: ' + slotVal + ' (IST)');
      lines.push('Duration: Standard Consultation');
      lines.push('');
      lines.push('Please confirm availability and the next steps.');

      const fullMessage = lines.join('\n');
      openWhatsAppHandoff('918591945055', fullMessage, feedbackContainer);
    });

    function showQuickError(msg) {
      if (validationError) {
        validationError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        validationError.style.display = 'block';
        validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }
  }

  // =========================================================================
  // 16D. ADVANCED SCHEDULER & BOOKING HANDLER (book-appoinment.htm)
  // =========================================================================
  function initSpouzyScheduler() {
    const form = document.getElementById('spBookingForm');
    // Only target pages with the scheduler block
    if (!form || !document.getElementById('spSchedulerBlock')) return;

    // -------------------------------------------------------------------------
    // 1. AVAILABILITY PROVIDER (Modular Demo Source - Real API swappable)
    // -------------------------------------------------------------------------
    const SpouzyAvailabilityProvider = {
      timezone: 'Asia/Kolkata',
      notice: 'Demo availability — appointment times are confirmed by our team.',
      operatingHours: {
        start: 9 * 60,   // 9:00 AM (540 min)
        end: 21 * 60     // 9:00 PM (1260 min)
      },

      /**
       * Returns array of booked intervals { start, end } in minutes from midnight.
       * Deterministic based on calendar date difference from today in IST.
       */
      getBookedIntervals(dateStr, todayStr) {
        const d1 = new Date(dateStr + 'T00:00:00');
        const d2 = new Date(todayStr + 'T00:00:00');
        const diffDays = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Today: Partially booked (e.g. 10:30-11:00 AM, 2:00-2:30 PM, 4:30-5:30 PM, 7:00-7:30 PM)
          return [
            { start: 10 * 60 + 30, end: 11 * 60 },
            { start: 14 * 60, end: 14 * 60 + 30 },
            { start: 16 * 60 + 30, end: 17 * 60 + 30 },
            { start: 19 * 60, end: 19 * 60 + 30 }
          ];
        } else if (diffDays === 1) {
          // Tomorrow: Partially booked (e.g. 11:00 AM - 12:00 PM, 3:30 - 4:00 PM, 6:00 - 6:30 PM)
          return [
            { start: 11 * 60, end: 12 * 60 },
            { start: 15 * 60 + 30, end: 16 * 60 },
            { start: 18 * 60, end: 18 * 60 + 30 }
          ];
        } else if (diffDays === 2) {
          // Day 2: FULLY BOOKED DAY demo (all 30-min slots from 9:00 AM to 9:00 PM are booked)
          const booked = [];
          for (let t = 9 * 60; t < 21 * 60; t += 30) {
            booked.push({ start: t, end: t + 30 });
          }
          return booked;
        } else if (diffDays === 3) {
          // Day 3: Widely available (only 1 midday slot booked)
          return [
            { start: 12 * 60, end: 12 * 60 + 30 }
          ];
        } else if (diffDays === 4) {
          // Day 4: Partially booked
          return [
            { start: 10 * 60, end: 10 * 60 + 30 },
            { start: 13 * 60, end: 14 * 60 },
            { start: 17 * 60, end: 18 * 60 }
          ];
        } else {
          // Deterministic hash based on date string (predictable, never random on re-render)
          const hash = dateStr.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          const booked = [];
          if (hash % 2 === 0) booked.push({ start: 10 * 60, end: 10 * 60 + 30 });
          if (hash % 3 === 0) booked.push({ start: 11 * 60 + 30, end: 12 * 60 + 30 });
          if (hash % 5 === 0) booked.push({ start: 14 * 60 + 30, end: 15 * 60 });
          if (hash % 7 === 0) booked.push({ start: 16 * 60, end: 17 * 60 });
          if (hash % 4 === 0) booked.push({ start: 18 * 60 + 30, end: 19 * 60 });
          return booked;
        }
      }
    };

    // -------------------------------------------------------------------------
    // 2. DOM ELEMENTS
    // -------------------------------------------------------------------------
    const dateInput = document.getElementById('spBookingDate');
    const calendarTriggerBtn = document.getElementById('spCalendarTriggerBtn');
    const dateTabsTrack = document.getElementById('spDateTabsTrack');
    const datePrevBtn = document.getElementById('spDatePrevBtn');
    const dateNextBtn = document.getElementById('spDateNextBtn');
    const selectedDateTitle = document.getElementById('spSelectedDateTitle');
    const availableCountNum = document.getElementById('spAvailableCountNum');
    const dateSlotCountBadge = document.getElementById('spDateSlotCountBadge');

    const durationInput = document.getElementById('spBookingDuration');
    const durationBtns = document.querySelectorAll('.sp-duration-btn');

    const slotsGridWrapper = document.getElementById('spSlotsGridWrapper');
    const slotNotice = document.getElementById('spSlotNotice');
    const selectedSlotInput = document.getElementById('spSelectedTimeSlot');

    const serviceSelect = document.getElementById('spServiceSelect');
    const consultModeSelect = document.getElementById('spConsultMode');
    const summaryBox = document.getElementById('spAppointmentSummaryBox');
    const summaryContent = document.getElementById('spSummaryContent');
    const summarySubContent = document.getElementById('spSummarySubContent');
    const validationError = document.getElementById('spBookingValidationError');
    const feedbackContainer = document.getElementById('spBookingFeedback');

    // -------------------------------------------------------------------------
    // 3. DATE & TIME HELPERS (Asia/Kolkata IST)
    // -------------------------------------------------------------------------
    function getNowIST() {
      const now = new Date();
      const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      return new Date(istString);
    }

    function getISTDateString(d = getNowIST()) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    function parseDateString(dateStr) {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    function formatFullDateIST(dateStr) {
      const dt = parseDateString(dateStr);
      if (!dt) return '';
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return weekdays[dt.getDay()] + ', ' + dt.getDate() + ' ' + months[dt.getMonth()] + ' ' + dt.getFullYear();
    }

    function formatShortDate(dateStr) {
      const dt = parseDateString(dateStr);
      if (!dt) return '';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return dt.getDate() + ' ' + months[dt.getMonth()];
    }

    function getDayLabel(dateStr, todayStr) {
      if (dateStr === todayStr) return 'Today';
      const dtToday = parseDateString(todayStr);
      const tomorrow = new Date(dtToday);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = getISTDateString(tomorrow);
      if (dateStr === tomorrowStr) return 'Tomorrow';
      const dt = parseDateString(dateStr);
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return weekdays[dt.getDay()];
    }

    function formatMinutesTo12h(mins) {
      let h = Math.floor(mins / 60);
      const m = mins % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }

    const todayIST = getISTDateString();
    let activeDateStr = todayIST;
    let windowStartDate = todayIST;

    if (dateInput) {
      dateInput.min = todayIST;
      if (!dateInput.value) {
        dateInput.value = todayIST;
      }
      activeDateStr = dateInput.value;
    }

    // -------------------------------------------------------------------------
    // 4. SLOT GENERATION & COLLISION LOGIC
    // -------------------------------------------------------------------------
    function calculateSlots(dateStr, durationMinutes) {
      const bookedIntervals = SpouzyAvailabilityProvider.getBookedIntervals(dateStr, todayIST);
      const openMin = SpouzyAvailabilityProvider.operatingHours.start;  // 540 (9:00 AM)
      const closeMin = SpouzyAvailabilityProvider.operatingHours.end; // 1260 (9:00 PM)

      const isToday = dateStr === todayIST;
      const istNow = getNowIST();
      const currentIstMinutes = istNow.getHours() * 60 + istNow.getMinutes();

      const slots = [];
      // Start times every 30 minutes. Every appointment must FINISH by closeMin (9:00 PM)
      for (let start = openMin; start + durationMinutes <= closeMin; start += 30) {
        const end = start + durationMinutes;
        const label = formatMinutesTo12h(start) + ' – ' + formatMinutesTo12h(end);
        let status = 'available';
        let statusText = 'Available';

        // Check passed slots on today
        if (isToday && start <= currentIstMinutes) {
          status = 'passed';
          statusText = 'Passed';
        }

        // Collision rule: proposedStart < bookedEnd AND proposedEnd > bookedStart
        if (status === 'available') {
          for (const booked of bookedIntervals) {
            if (start < booked.end && end > booked.start) {
              status = 'booked';
              statusText = 'Booked';
              break;
            }
          }
        }

        // Grouping: Morning (< 12:00 PM), Afternoon (12:00 PM to < 4:00 PM), Evening (>= 4:00 PM)
        let period = 'evening';
        if (start < 12 * 60) {
          period = 'morning';
        } else if (start < 16 * 60) {
          period = 'afternoon';
        }

        slots.push({
          start,
          end,
          duration: durationMinutes,
          label,
          status,
          statusText,
          period
        });
      }

      const availableCount = slots.filter(s => s.status === 'available').length;
      return { slots, availableCount };
    }

    // -------------------------------------------------------------------------
    // 5. RENDER DATE TABS
    // -------------------------------------------------------------------------
    function renderDateTabs() {
      if (!dateTabsTrack) return;
      dateTabsTrack.innerHTML = '';

      const durationVal = parseInt(durationInput ? durationInput.value : '30', 10) || 30;
      const baseDt = parseDateString(windowStartDate) || parseDateString(todayIST);

      const NUM_TABS = 7;
      for (let i = 0; i < NUM_TABS; i++) {
        const dt = new Date(baseDt);
        dt.setDate(dt.getDate() + i);
        const dStr = getISTDateString(dt);

        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'sp-date-tab';
        tabBtn.setAttribute('role', 'tab');
        tabBtn.setAttribute('data-date', dStr);

        const isCurrentActive = dStr === activeDateStr;
        if (isCurrentActive) {
          tabBtn.classList.add('is-active');
          tabBtn.setAttribute('aria-selected', 'true');
        } else {
          tabBtn.setAttribute('aria-selected', 'false');
        }

        const dayLabel = getDayLabel(dStr, todayIST);
        const shortDate = formatShortDate(dStr);

        // Pre-calculate available slot count for this tab
        const slotData = calculateSlots(dStr, durationVal);
        const count = slotData.availableCount;

        let badgeText = count + (count === 1 ? ' slot' : ' slots');
        if (count === 0) {
          badgeText = 'Fully Booked';
          tabBtn.classList.add('is-fully-booked');
        }

        tabBtn.innerHTML =
          '<span class="sp-tab-day-label">' + dayLabel + '</span>' +
          '<span class="sp-tab-date-num">' + shortDate + '</span>' +
          '<span class="sp-tab-slots-badge">' + badgeText + '</span>';

        tabBtn.addEventListener('click', function () {
          selectDate(dStr);
        });

        dateTabsTrack.appendChild(tabBtn);
      }

      // Update Prev Button state
      if (datePrevBtn) {
        datePrevBtn.disabled = windowStartDate <= todayIST;
      }
    }

    // -------------------------------------------------------------------------
    // 6. SELECT DATE & SYNCHRONIZE
    // -------------------------------------------------------------------------
    function selectDate(dStr) {
      if (dStr < todayIST) return;

      activeDateStr = dStr;
      if (dateInput) {
        dateInput.value = dStr;
      }

      // Ensure activeDateStr is inside windowStartDate .. windowStartDate + 6
      const dtActive = parseDateString(activeDateStr);
      const dtWin = parseDateString(windowStartDate);
      const diff = Math.round((dtActive - dtWin) / (1000 * 60 * 60 * 24));
      if (diff < 0 || diff >= 7) {
        windowStartDate = activeDateStr;
      }

      renderDateTabs();
      updateSelectedDateBanner();
      renderSlotGrid();
      updateSummary();
    }

    function updateSelectedDateBanner() {
      if (selectedDateTitle) {
        selectedDateTitle.textContent = formatFullDateIST(activeDateStr);
      }
      const durationVal = parseInt(durationInput ? durationInput.value : '30', 10) || 30;
      const data = calculateSlots(activeDateStr, durationVal);
      if (availableCountNum) {
        availableCountNum.textContent = data.availableCount;
      }
      if (dateSlotCountBadge) {
        if (data.availableCount === 0) {
          dateSlotCountBadge.classList.add('is-fully-booked');
          dateSlotCountBadge.innerHTML = '<span class="sp-count-num">0</span> slots · Fully Booked';
        } else {
          dateSlotCountBadge.classList.remove('is-fully-booked');
          dateSlotCountBadge.innerHTML = '<span class="sp-count-num">' + data.availableCount + '</span> ' + (data.availableCount === 1 ? 'slot' : 'slots') + ' available';
        }
      }
    }

    // -------------------------------------------------------------------------
    // 7. RENDER SLOTS GRID (Grouped into Morning, Afternoon, Evening)
    // -------------------------------------------------------------------------
    function renderSlotGrid() {
      if (!slotsGridWrapper) return;
      slotsGridWrapper.innerHTML = '';

      const durationVal = parseInt(durationInput ? durationInput.value : '30', 10) || 30;
      const result = calculateSlots(activeDateStr, durationVal);
      const slots = result.slots;

      // Check if previously selected slot is still valid
      if (selectedSlotInput && selectedSlotInput.value) {
        const currentlySelectedLabel = selectedSlotInput.value;
        const matchingSlot = slots.find(s => s.label === currentlySelectedLabel);
        if (!matchingSlot || matchingSlot.status !== 'available') {
          // Invalidate
          selectedSlotInput.value = '';
          if (slotNotice) {
            slotNotice.innerHTML = '<i class="fa fa-info-circle" style="color: var(--sp-copper); margin-right: 6px;"></i> The previously selected slot is not available for this ' + (durationVal === 60 ? '1-hour' : '30-minute') + ' selection or date. Please choose another available slot.';
            slotNotice.style.display = 'block';
          }
        } else {
          if (slotNotice) slotNotice.style.display = 'none';
        }
      }

      const periods = [
        {
          id: 'morning',
          title: 'Morning',
          icon: 'fa-sun-o',
          range: '9:00 AM – 11:30 AM starts',
          items: slots.filter(s => s.period === 'morning')
        },
        {
          id: 'afternoon',
          title: 'Afternoon',
          icon: 'fa-clock-o',
          range: '12:00 PM – 3:30 PM starts',
          items: slots.filter(s => s.period === 'afternoon')
        },
        {
          id: 'evening',
          title: 'Evening',
          icon: 'fa-moon-o',
          range: (durationVal === 60 ? '4:00 PM – 8:00 PM starts' : '4:00 PM – 8:30 PM starts'),
          items: slots.filter(s => s.period === 'evening')
        }
      ];

      periods.forEach(p => {
        if (!p.items.length) return;

        const sec = document.createElement('div');
        sec.className = 'sp-period-section';

        const hdr = document.createElement('div');
        hdr.className = 'sp-period-header';
        hdr.innerHTML =
          '<div class="sp-period-title"><i class="fa ' + p.icon + '" style="color: var(--sp-copper);"></i> ' + p.title + '</div>' +
          '<div class="sp-period-time-range">' + p.range + '</div>';
        sec.appendChild(hdr);

        const grid = document.createElement('div');
        grid.className = 'sp-period-slots-grid';

        p.items.forEach(slot => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sp-slot-card';
          btn.setAttribute('data-slot', slot.label);
          btn.setAttribute('aria-label', slot.label + ' ' + slot.statusText);

          if (slot.status === 'passed') {
            btn.classList.add('is-passed');
            btn.disabled = true;
            btn.innerHTML =
              '<span class="sp-slot-time-text">' + slot.label + '</span>' +
              '<span class="sp-slot-status-text"><i class="fa fa-history"></i> Passed</span>';
          } else if (slot.status === 'booked') {
            btn.classList.add('is-booked');
            btn.disabled = true;
            btn.innerHTML =
              '<span class="sp-slot-time-text">' + slot.label + '</span>' +
              '<span class="sp-slot-status-text"><i class="fa fa-lock"></i> Booked</span>';
          } else {
            btn.classList.add('is-available');
            const isSelected = selectedSlotInput && selectedSlotInput.value === slot.label;
            if (isSelected) {
              btn.classList.add('is-selected');
              btn.setAttribute('aria-pressed', 'true');
              btn.innerHTML =
                '<span class="sp-slot-time-text">' + slot.label + '</span>' +
                '<span class="sp-slot-status-text"><i class="fa fa-check"></i> Selected</span>';
            } else {
              btn.setAttribute('aria-pressed', 'false');
              btn.innerHTML =
                '<span class="sp-slot-time-text">' + slot.label + '</span>' +
                '<span class="sp-slot-status-text" style="font-size: 10px; opacity: 0.85;">Available</span>';
            }

            btn.addEventListener('click', function () {
              selectedSlotInput.value = slot.label;
              if (slotNotice) slotNotice.style.display = 'none';
              if (validationError) validationError.style.display = 'none';

              renderSlotGrid();
              updateSummary();
            });
          }

          grid.appendChild(btn);
        });

        sec.appendChild(grid);
        slotsGridWrapper.appendChild(sec);
      });
    }

    // -------------------------------------------------------------------------
    // 8. UPDATE APPOINTMENT SUMMARY
    // -------------------------------------------------------------------------
    function updateSummary() {
      if (!summaryContent) return;
      const durationVal = durationInput ? durationInput.value : '30';
      const slotVal = selectedSlotInput ? selectedSlotInput.value : '';
      const durationText = durationVal === '60' ? '1 hour' : '30 minutes';

      const serviceText = serviceSelect && serviceSelect.selectedIndex >= 0 ? 
        serviceSelect.options[serviceSelect.selectedIndex].text.split('(')[0].trim() : 'Clinical Consultation';
      const modeText = consultModeSelect && consultModeSelect.selectedIndex >= 0 ? 
        consultModeSelect.options[consultModeSelect.selectedIndex].text.split('(')[0].trim() : 'Encrypted Video';

      if (activeDateStr && slotVal) {
        const fullDate = formatFullDateIST(activeDateStr);
        summaryContent.className = 'sp-summary-text is-ready';
        summaryContent.innerHTML = 
          '<span class="sp-summary-highlight"><i class="fa fa-calendar-check-o"></i> ' + fullDate + '</span>' +
          '<span class="sp-summary-dot">·</span>' +
          '<span class="sp-summary-highlight"><i class="fa fa-clock-o"></i> ' + slotVal + ' IST</span>' +
          '<span class="sp-summary-dot">·</span>' +
          '<span class="sp-summary-highlight"><i class="fa fa-hourglass-half"></i> ' + durationText + '</span>';
        
        if (summarySubContent) {
          summarySubContent.style.display = 'block';
          summarySubContent.innerHTML = '<strong>' + serviceText + '</strong> · ' + modeText + '<br><small style="color: var(--sp-copper); font-weight: 600;">Subject to confirmation by SPOUZY clinical team</small>';
        }
      } else {
        summaryContent.className = 'sp-summary-text is-placeholder';
        if (activeDateStr) {
          summaryContent.textContent = 'Date: ' + formatFullDateIST(activeDateStr) + ' (' + durationText + '). Please select an available time slot above.';
        } else {
          summaryContent.textContent = 'Please choose a session duration, date, and available time slot above.';
        }
        if (summarySubContent) {
          summarySubContent.style.display = 'none';
        }
      }
    }

    // -------------------------------------------------------------------------
    // 9. EVENT LISTENERS
    // -------------------------------------------------------------------------
    // Duration toggle
    if (durationBtns.length) {
      durationBtns.forEach(btn => {
        btn.addEventListener('click', function () {
          durationBtns.forEach(b => {
            b.classList.remove('is-active');
            b.setAttribute('aria-checked', 'false');
          });
          this.classList.add('is-active');
          this.setAttribute('aria-checked', 'true');

          const chosenDuration = this.getAttribute('data-duration') || '30';
          if (durationInput) durationInput.value = chosenDuration;

          renderDateTabs();
          updateSelectedDateBanner();
          renderSlotGrid();
          updateSummary();
        });
      });
    }

    // Native Date Picker Synchronization
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        if (!this.value) return;
        if (this.value < todayIST) {
          this.value = todayIST;
        }
        selectDate(this.value);
      });
    }

    // Previous Date Range Navigation
    if (datePrevBtn) {
      datePrevBtn.addEventListener('click', function () {
        const dt = parseDateString(windowStartDate);
        dt.setDate(dt.getDate() - 7);
        let newStart = getISTDateString(dt);
        if (newStart < todayIST) newStart = todayIST;
        windowStartDate = newStart;
        renderDateTabs();
      });
    }

    // Next Date Range Navigation
    if (dateNextBtn) {
      dateNextBtn.addEventListener('click', function () {
        const dt = parseDateString(windowStartDate);
        dt.setDate(dt.getDate() + 7);
        windowStartDate = getISTDateString(dt);
        renderDateTabs();
      });
    }

    if (serviceSelect) {
      serviceSelect.addEventListener('change', updateSummary);
    }

    if (consultModeSelect) {
      consultModeSelect.addEventListener('change', updateSummary);
    }

    // -------------------------------------------------------------------------
    // 10. SUBMISSION HANDLER -> WHATSAPP
    // -------------------------------------------------------------------------
    function showBookingError(msg) {
      if (validationError) {
        validationError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        validationError.style.display = 'block';
        validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (validationError) validationError.style.display = 'none';

      const dateVal = dateInput ? dateInput.value : activeDateStr;
      const slotVal = selectedSlotInput ? selectedSlotInput.value : '';
      const durationVal = durationInput ? durationInput.value : '30';
      const durationText = durationVal === '60' ? '1 hour' : '30 minutes';

      const patientNameInput = document.getElementById('spPatientName');
      const patientPhoneInput = document.getElementById('spPatientPhone');
      const patientEmailInput = document.getElementById('spPatientEmail');
      const patientNotesInput = document.getElementById('spPatientNotes');

      const patientName = patientNameInput ? patientNameInput.value.trim() : '';
      const patientPhone = patientPhoneInput ? patientPhoneInput.value.trim() : '';
      const patientEmail = patientEmailInput ? patientEmailInput.value.trim() : '';
      const patientNotes = patientNotesInput ? patientNotesInput.value.trim() : '';

      if (!dateVal) {
        showBookingError('Please choose an appointment date.');
        return;
      }

      if (dateVal < todayIST) {
        showBookingError('Past dates cannot be selected. Please choose today or a future date.');
        return;
      }

      if (!slotVal) {
        showBookingError('Please select an available appointment time slot.');
        if (slotsGridWrapper) slotsGridWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Revalidate slot availability before submitting
      const currentSlotData = calculateSlots(dateVal, parseInt(durationVal, 10));
      const matchingSlot = currentSlotData.slots.find(s => s.label === slotVal);
      if (!matchingSlot || matchingSlot.status !== 'available') {
        showBookingError('The requested time slot (' + slotVal + ') is no longer available. Please choose another slot.');
        renderSlotGrid();
        return;
      }

      if (!patientName) {
        showBookingError('Please provide your name or discreet alias.');
        if (patientNameInput) patientNameInput.focus();
        return;
      }

      if (!patientPhone) {
        showBookingError('Please provide your mobile / WhatsApp number.');
        if (patientPhoneInput) patientPhoneInput.focus();
        return;
      }

      if (!patientEmail || !patientEmail.includes('@')) {
        showBookingError('Please provide a valid confidential email ID.');
        if (patientEmailInput) patientEmailInput.focus();
        return;
      }

      const fullDate = formatFullDateIST(dateVal);
      const serviceText = serviceSelect && serviceSelect.selectedIndex >= 0 ? serviceSelect.options[serviceSelect.selectedIndex].text.trim() : 'Guidance Consultation';
      const modeText = consultModeSelect && consultModeSelect.selectedIndex >= 0 ? consultModeSelect.options[consultModeSelect.selectedIndex].text.trim() : 'Encrypted Video';

      const lines = [
        'Hello SPOUZY, I would like to request an appointment.',
        '',
        'Name / Alias: ' + patientName,
        'Phone: ' + patientPhone,
        'Email: ' + patientEmail,
        'Service: ' + serviceText,
        'Consultation Mode: ' + modeText,
        'Requested Date: ' + fullDate,
        'Requested Time: ' + slotVal + ' (IST)',
        'Duration: ' + durationText,
        'Timezone: Asia/Kolkata (IST)',
        'Additional Information: ' + (patientNotes || 'Not provided'),
        '',
        'Please confirm availability and next steps. (Subject to confirmation)'
      ];

      const fullMessage = lines.join('\n');
      openWhatsAppHandoff('918591945055', fullMessage, feedbackContainer);
    });

    // -------------------------------------------------------------------------
    // 11. URL QUERY PARAMETER PRE-SELECTION
    // -------------------------------------------------------------------------
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rawService = urlParams.get('service');
      const rawMode = urlParams.get('mode');

      if (rawService && serviceSelect) {
        const normService = rawService.trim().toLowerCase();
        for (let i = 0; i < serviceSelect.options.length; i++) {
          if (serviceSelect.options[i].value.toLowerCase().includes(normService)) {
            serviceSelect.selectedIndex = i;
            break;
          }
        }
      }

      if (rawMode && consultModeSelect) {
        const normMode = rawMode.trim().toLowerCase();
        for (let i = 0; i < consultModeSelect.options.length; i++) {
          if (consultModeSelect.options[i].value.toLowerCase().includes(normMode)) {
            consultModeSelect.selectedIndex = i;
            break;
          }
        }
      }
    } catch (e) {}

    // Initial render
    renderDateTabs();
    updateSelectedDateBanner();
    renderSlotGrid();
    updateSummary();
  }

  // Initialize form and widget handlers
  initSpouzyFloatingWidget();
  initSpouzyContactForm();
  initSpouzyQuickBookingForm();
  initSpouzyScheduler();

  // -------------------------------------------------------------------------
  // 17. INFINITE TICKER PAUSE/RESUME TOGGLE
  // -------------------------------------------------------------------------
  const tickerSections = document.querySelectorAll('.sp-ticker-section');
  tickerSections.forEach(section => {
    const toggleBtn = section.querySelector('.sp-ticker-toggle');
    if (!toggleBtn) return;
    const pauseIcon = toggleBtn.querySelector('.sp-ticker-icon-pause');
    const playIcon = toggleBtn.querySelector('.sp-ticker-icon-play');

    toggleBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const isPaused = section.classList.toggle('is-paused');
      section.setAttribute('data-paused', isPaused ? 'true' : 'false');
      toggleBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', isPaused ? 'Resume ticker' : 'Pause ticker');
      toggleBtn.setAttribute('title', isPaused ? 'Resume ticker' : 'Pause ticker');
      if (pauseIcon && playIcon) {
        pauseIcon.style.display = isPaused ? 'none' : 'block';
        playIcon.style.display = isPaused ? 'block' : 'none';
      }
    });
  });

  // -------------------------------------------------------------------------
  // 18. FOOTER TEDDY DANCE ANIMATION CONTROLLER (AUTOPLAY LOOP, GROUNDED)
  // -------------------------------------------------------------------------
  function initSpouzyFooterTeddy() {
    const teddyContainers = document.querySelectorAll('.sp-footer-teddy');
    if (!teddyContainers.length) return;

    const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    teddyContainers.forEach(container => {
      const video = container.querySelector('.sp-footer-teddy-video');
      const staticFallback = container.querySelector('.sp-footer-teddy-static');

      if (!video) return;

      // Strict audio muting & infinite loop guarantee
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.loop = true;

      let isIntersecting = false;

      function checkReducedMotion() {
        if (motionQuery && motionQuery.matches) {
          container.classList.add('is-fallback');
          try { video.pause(); } catch (e) {}
          return true;
        } else {
          container.classList.remove('is-fallback');
          return false;
        }
      }

      if (checkReducedMotion()) return;

      if (motionQuery && motionQuery.addEventListener) {
        motionQuery.addEventListener('change', () => {
          if (checkReducedMotion()) {
            try { video.pause(); } catch (e) {}
          } else if (isIntersecting && !document.hidden) {
            safePlay();
          }
        });
      }

      function safePlay() {
        if (!isIntersecting || document.hidden) return;
        if (container.classList.contains('is-fallback')) return;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay prevented or aborted; handled gracefully
          });
        }
      }

      function safePause() {
        try {
          video.pause();
        } catch (e) {}
      }

      // Fallback on video error
      video.addEventListener('error', function () {
        container.classList.add('is-fallback');
        if (staticFallback) staticFallback.style.display = 'block';
        video.style.display = 'none';
      });

      // Tab visibility change: pause when hidden, resume when visible
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          safePause();
        } else {
          if (isIntersecting) {
            safePlay();
          }
        }
      });

      // IntersectionObserver for preloading on approach and playing when visible
      if ('IntersectionObserver' in window) {
        const approachObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              if (video.preload !== 'auto') {
                video.preload = 'auto';
              }
            }
          });
        }, { rootMargin: '200px 0px', threshold: 0.01 });
        approachObserver.observe(container);

        const playbackObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              isIntersecting = true;
              if (!document.hidden) {
                safePlay();
              }
            } else {
              isIntersecting = false;
              safePause();
            }
          });
        }, { threshold: 0.05 });
        playbackObserver.observe(container);
      } else {
        video.preload = 'auto';
        isIntersecting = true;
        safePlay();
      }
    });
  }

  initSpouzyFooterTeddy();
});

// Follow direct links into the resource directory and open the selected topic.
function showResourceTopic() {
  const panel = document.getElementById(location.hash.slice(1));
  if (panel && panel.matches('.ed-directory details')) panel.open = true;
}
window.addEventListener('hashchange', showResourceTopic);
showResourceTopic();
const enquiry = document.querySelector('#cfMessage');
const topic = new URLSearchParams(location.search).get('topic');
if (enquiry && topic && !enquiry.value) enquiry.value = 'I would like to ask about ' + topic + '.';

  // =========================================================================
  // 19. DOCTOR & COUNSELLOR REGISTRATION ENGINE (join-doctor.htm & join-counsellor.htm)
  // =========================================================================
  function initSpouzyJoinForm() {
    const form = document.getElementById('spJoinAppForm');
    if (!form) return;

    const role = form.getAttribute('data-role') || 'doctor';
    const isDoctor = role === 'doctor';

    // State for attached files in memory
    const attachedFiles = {
      photo: null,
      primaryCert: null,
      pgCert: null,
      councilCert: null
    };

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // -------------------------------------------------------------------------
    // 1. WhatsApp Number "Same as Mobile" Synchronization
    // -------------------------------------------------------------------------
    const mobileInput = document.getElementById('spMobile');
    const whatsappInput = document.getElementById('spWhatsapp');
    const sameAsMobileCheck = document.getElementById('spSameAsMobile');

    function syncWhatsapp() {
      if (sameAsMobileCheck && sameAsMobileCheck.checked && mobileInput && whatsappInput) {
        whatsappInput.value = mobileInput.value;
      }
    }

    if (sameAsMobileCheck && mobileInput && whatsappInput) {
      sameAsMobileCheck.addEventListener('change', function () {
        if (this.checked) {
          whatsappInput.value = mobileInput.value;
          whatsappInput.readOnly = true;
          whatsappInput.classList.add('is-synced');
        } else {
          whatsappInput.readOnly = false;
          whatsappInput.classList.remove('is-synced');
        }
      });
      mobileInput.addEventListener('input', syncWhatsapp);
    }

    // -------------------------------------------------------------------------
    // 2. Generic File Dropzone & Preview Handler with Inline Validation
    // -------------------------------------------------------------------------
    function setupFileUploader(dropzoneId, inputId, previewCardId, fileKey, maxBytes, allowedExtensions, errorElId) {
      const dropzone = document.getElementById(dropzoneId);
      const fileInput = document.getElementById(inputId);
      const previewCard = document.getElementById(previewCardId);
      const errorEl = errorElId ? document.getElementById(errorElId) : null;
      if (!dropzone || !fileInput || !previewCard) return;

      function setInlineError(msg) {
        if (errorEl) {
          if (msg) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
          } else {
            errorEl.style.display = 'none';
            errorEl.textContent = '';
          }
        }
      }

      function renderPreview(file) {
        if (!file) {
          dropzone.style.display = 'block';
          previewCard.style.display = 'none';
          attachedFiles[fileKey] = null;
          setInlineError('');
          return;
        }

        attachedFiles[fileKey] = file;
        dropzone.style.display = 'none';
        previewCard.style.display = 'flex';
        setInlineError('');

        const nameEl = previewCard.querySelector('.sp-file-name');
        const sizeEl = previewCard.querySelector('.sp-file-size');
        const thumbEl = previewCard.querySelector('.sp-file-thumb');

        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = formatBytes(file.size);

        if (thumbEl) {
          const ext = '.' + file.name.split('.').pop().toLowerCase();
          if (file.type.startsWith('image/') || ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') {
            const reader = new FileReader();
            reader.onload = function (e) {
              thumbEl.innerHTML = '<img src="' + e.target.result + '" alt="Preview" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';
            };
            reader.readAsDataURL(file);
          } else {
            thumbEl.innerHTML = '<i class="fa fa-file-pdf-o" style="color: #c02a2a; font-size: 20px;"></i>';
          }
        }
      }

      fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          const file = this.files[0];
          const ext = '.' + file.name.split('.').pop().toLowerCase();
          if (!allowedExtensions.includes(ext)) {
            const err = 'Unsupported file format (' + ext + '). Please select ' + allowedExtensions.join(', ') + '.';
            setInlineError(err);
            alert(err);
            this.value = '';
            return;
          }
          if (file.size > maxBytes) {
            const err = 'File exceeds maximum size of ' + formatBytes(maxBytes) + ' (Selected: ' + formatBytes(file.size) + ').';
            setInlineError(err);
            alert(err);
            this.value = '';
            return;
          }
          setInlineError('');
          renderPreview(file);
        }
      });

      // Drag and drop events
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.remove('is-dragover');
        });
      });
      dropzone.addEventListener('drop', e => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // Actions inside preview card (Replace & Remove)
      const replaceBtn = previewCard.querySelector('.is-replace');
      const removeBtn = previewCard.querySelector('.is-remove');

      if (replaceBtn) {
        replaceBtn.addEventListener('click', () => fileInput.click());
      }
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          fileInput.value = '';
          renderPreview(null);
        });
      }
    }

    // Photo: max 5MB (JPG, PNG, WebP)
    setupFileUploader('spPhotoDropzone', 'spPhotoInput', 'spPhotoPreview', 'photo', 5 * 1024 * 1024, ['.jpg', '.jpeg', '.png', '.webp'], 'spPhotoError');
    // Primary Cert: max 10MB (PDF, JPG, PNG)
    setupFileUploader('spPrimaryCertDropzone', 'spPrimaryCertInput', 'spPrimaryCertPreview', 'primaryCert', 10 * 1024 * 1024, ['.pdf', '.jpg', '.jpeg', '.png'], 'spPrimaryCertError');
    // PG Cert: max 10MB
    setupFileUploader('spPgCertDropzone', 'spPgCertInput', 'spPgCertPreview', 'pgCert', 10 * 1024 * 1024, ['.pdf', '.jpg', '.jpeg', '.png'], 'spPgCertError');
    // Council / Accreditation Cert: max 10MB (JPG, JPEG, PDF)
    setupFileUploader('spCouncilCertDropzone', 'spCouncilCertInput', 'spCouncilCertPreview', 'councilCert', 10 * 1024 * 1024, ['.jpg', '.jpeg', '.pdf'], 'spCouncilCertError');

    // -------------------------------------------------------------------------
    // 3. "Other" Qualification Textfield Toggles
    // -------------------------------------------------------------------------
    const primaryQualSelect = document.getElementById('spPrimaryQual');
    const primaryQualOtherWrap = document.getElementById('spPrimaryQualOtherWrap');
    if (primaryQualSelect && primaryQualOtherWrap) {
      primaryQualSelect.addEventListener('change', function () {
        if (this.value === 'Other') {
          primaryQualOtherWrap.style.display = 'block';
          const input = primaryQualOtherWrap.querySelector('input');
          if (input) input.required = true;
        } else {
          primaryQualOtherWrap.style.display = 'none';
          const input = primaryQualOtherWrap.querySelector('input');
          if (input) input.required = false;
        }
      });
    }

    // -------------------------------------------------------------------------
    // 4. Dynamic Additional Qualifications Repeater
    // -------------------------------------------------------------------------
    const addQualBtn = document.getElementById('spAddQualBtn');
    const additionalQualsContainer = document.getElementById('spAdditionalQualsContainer');
    let qualCount = 0;

    if (addQualBtn && additionalQualsContainer) {
      addQualBtn.addEventListener('click', function () {
        qualCount++;
        const qualIndex = qualCount;
        const card = document.createElement('div');
        card.className = 'sp-qual-card';
        card.setAttribute('data-qual-id', qualIndex);

        card.innerHTML = `
          <div class="sp-qual-header">
            <span class="sp-qual-title"><i class="fa fa-graduation-cap"></i> Additional Qualification #${qualIndex}</span>
            <button type="button" class="sp-remove-qual-btn" aria-label="Remove this qualification"><i class="fa fa-times"></i> Remove</button>
          </div>
          <div class="sp-form-grid-2col">
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">Degree / Certification Title <span class="sp-req">*</span></label>
              <input type="text" name="additionalDegree_${qualIndex}" class="sp-form-input-modern sp-add-degree" placeholder="e.g. Diploma in Psychosexual Medicine" required>
            </div>
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">College / Institute / University <span class="sp-req">*</span></label>
              <input type="text" name="additionalCollege_${qualIndex}" class="sp-form-input-modern sp-add-college" placeholder="e.g. King Edward Memorial Hospital" required>
            </div>
          </div>
          <div class="sp-form-grid-2col">
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">Completion Year <span class="sp-req">*</span></label>
              <input type="number" min="1960" max="2026" name="additionalYear_${qualIndex}" class="sp-form-input-modern sp-add-year" placeholder="YYYY" required>
            </div>
            <div class="sp-form-group-modern">
              <label class="sp-form-label-modern">Marks / Grade / Honors</label>
              <input type="text" name="additionalGrade_${qualIndex}" class="sp-form-input-modern sp-add-grade" placeholder="e.g. Distinction / Grade A">
            </div>
          </div>
          <div class="sp-form-group-modern" style="margin-bottom: 0;">
            <label class="sp-form-label-modern">Certificate Attachment <span class="sp-opt">(PDF, JPG, PNG up to 10 MB)</span></label>
            <div class="sp-file-dropzone" id="spAddCertDropzone_${qualIndex}">
              <input type="file" id="spAddCertInput_${qualIndex}" class="sp-file-hidden-input" accept=".pdf,.jpg,.jpeg,.png">
              <div class="sp-file-dropzone-icon"><i class="fa fa-cloud-upload"></i></div>
              <div class="sp-file-dropzone-text">Click or drag certificate here</div>
              <div class="sp-file-dropzone-hint">PDF, JPG, or PNG (Max 10 MB)</div>
            </div>
            <div class="sp-file-preview-card" id="spAddCertPreview_${qualIndex}" style="display: none;">
              <div class="sp-file-info-group">
                <div class="sp-file-thumb"><i class="fa fa-file-pdf-o" style="color: #c02a2a;"></i></div>
                <div class="sp-file-details">
                  <div class="sp-file-name">certificate.pdf</div>
                  <div class="sp-file-size">--</div>
                </div>
              </div>
              <div class="sp-file-actions">
                <button type="button" class="sp-file-action-btn is-replace"><i class="fa fa-refresh"></i> Replace</button>
                <button type="button" class="sp-file-action-btn is-remove"><i class="fa fa-trash"></i> Remove</button>
              </div>
            </div>
          </div>
        `;

        additionalQualsContainer.appendChild(card);

        // Setup dropzone for this dynamic qualification
        setupFileUploader(
          'spAddCertDropzone_' + qualIndex,
          'spAddCertInput_' + qualIndex,
          'spAddCertPreview_' + qualIndex,
          'addCert_' + qualIndex,
          10 * 1024 * 1024,
          ['.pdf', '.jpg', '.jpeg', '.png']
        );

        // Remove listener
        const removeBtn = card.querySelector('.sp-remove-qual-btn');
        removeBtn.addEventListener('click', function () {
          delete attachedFiles['addCert_' + qualIndex];
          card.remove();
        });
      });
    }

    // -------------------------------------------------------------------------
    // 5. Counsellor "Not Applicable" Registration Toggle & Field Sync
    // -------------------------------------------------------------------------
    const naRegCheck = document.getElementById('spNaRegCheck');
    const councilSelect = document.getElementById('spCouncilSelect');
    const regNumInput = document.getElementById('spRegNum');
    const regStateInput = document.getElementById('spRegState');
    const regYearInput = document.getElementById('spRegYear');
    const regValidInput = document.getElementById('spRegValid');
    const councilCertInput = document.getElementById('spCouncilCertInput');
    const councilCertDropzone = document.getElementById('spCouncilCertDropzone');
    const councilCertReq = document.getElementById('spCouncilCertReq');
    const councilCertError = document.getElementById('spCouncilCertError');

    if (naRegCheck) {
      naRegCheck.addEventListener('change', function () {
        const isNA = this.checked;
        if (regNumInput) {
          regNumInput.required = !isNA;
          regNumInput.disabled = isNA;
          if (isNA) regNumInput.value = 'Not Applicable';
          else regNumInput.value = '';
        }
        if (councilSelect) councilSelect.disabled = isNA;
        if (regStateInput) regStateInput.disabled = isNA;
        if (regYearInput) regYearInput.disabled = isNA;
        if (regValidInput) regValidInput.disabled = isNA;
        if (councilCertInput) councilCertInput.disabled = isNA;
        if (councilCertDropzone) {
          councilCertDropzone.style.opacity = isNA ? '0.45' : '1';
          councilCertDropzone.style.pointerEvents = isNA ? 'none' : 'auto';
        }
        if (councilCertReq) councilCertReq.style.display = isNA ? 'none' : 'inline';
        if (councilCertError) councilCertError.style.display = 'none';
      });
    }

    // -------------------------------------------------------------------------
    // 6. Interactive Signature Canvas Pad
    // -------------------------------------------------------------------------
    const sigCanvas = document.getElementById('spSigCanvas');
    const clearSigBtn = document.getElementById('spClearSigBtn');
    let isDrawing = false;
    let hasDrawnSignature = false;

    if (sigCanvas) {
      const ctx = sigCanvas.getContext('2d');
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4B2030';

      function resizeCanvas() {
        const rect = sigCanvas.getBoundingClientRect();
        sigCanvas.width = rect.width;
        sigCanvas.height = rect.height;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#4B2030';
      }
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      function getPos(e) {
        const rect = sigCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      }

      function startDraw(e) {
        isDrawing = true;
        hasDrawnSignature = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      }

      function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }

      function stopDraw() {
        isDrawing = false;
      }

      sigCanvas.addEventListener('mousedown', startDraw);
      sigCanvas.addEventListener('mousemove', draw);
      window.addEventListener('mouseup', stopDraw);

      sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
      sigCanvas.addEventListener('touchmove', draw, { passive: false });
      sigCanvas.addEventListener('touchend', stopDraw);

      if (clearSigBtn) {
        clearSigBtn.addEventListener('click', function () {
          ctx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
          hasDrawnSignature = false;
        });
      }
    }

    // -------------------------------------------------------------------------
    // 7. Time Range Validation (Preferred Timings)
    // -------------------------------------------------------------------------
    const timeFrom = document.getElementById('spTimeFrom');
    const timeTo = document.getElementById('spTimeTo');
    const timeError = document.getElementById('spTimeRangeError');

    function validateTimes() {
      if (!timeFrom || !timeTo || !timeFrom.value || !timeTo.value) {
        if (timeError) timeError.style.display = 'none';
        return true;
      }
      const [h1, m1] = timeFrom.value.split(':').map(Number);
      const [h2, m2] = timeTo.value.split(':').map(Number);
      const t1 = h1 * 60 + m1;
      const t2 = h2 * 60 + m2;
      if (t2 <= t1) {
        if (timeError) {
          timeError.textContent = 'Preferred "To Time" must be later than "From Time".';
          timeError.style.display = 'block';
        }
        return false;
      }
      if (timeError) timeError.style.display = 'none';
      return true;
    }

    if (timeFrom) timeFrom.addEventListener('change', validateTimes);
    if (timeTo) timeTo.addEventListener('change', validateTimes);

    // -------------------------------------------------------------------------
    // 8. Application Review Modal & Submission Handler
    // -------------------------------------------------------------------------
    const reviewModal = document.getElementById('spReviewModal');
    const reviewCloseBtn = document.getElementById('spReviewCloseBtn');
    const reviewEditBtn = document.getElementById('spReviewEditBtn');
    const reviewWhatsappBtn = document.getElementById('spReviewWhatsappBtn');
    const copyAppTextBtn = document.getElementById('spCopyAppTextBtn');
    const validationError = document.getElementById('spFormValidationError');

    function closeReview() {
      if (reviewModal) reviewModal.style.display = 'none';
    }

    if (reviewCloseBtn) reviewCloseBtn.addEventListener('click', closeReview);
    if (reviewEditBtn) reviewEditBtn.addEventListener('click', closeReview);

    let preparedWhatsAppMessage = '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (validationError) validationError.style.display = 'none';

      // 1. Validate Time Range
      if (!validateTimes()) {
        showError('Please check your preferred working hours. "To Time" must be later than "From Time".');
        if (timeTo) timeTo.focus();
        return;
      }

      // 2. Validate Required Photo
      if (!attachedFiles.photo) {
        showError('Please attach a recent colour photograph.');
        const drop = document.getElementById('spPhotoDropzone');
        if (drop) drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // 3. Validate Primary Marksheet / Certificate
      if (!attachedFiles.primaryCert) {
        showError('Please attach your Primary Qualification marksheet or certificate.');
        const drop = document.getElementById('spPrimaryCertDropzone');
        if (drop) drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // 4. Validate Council / Professional Registration Certificate
      const isNA = naRegCheck ? naRegCheck.checked : false;
      if (isDoctor || !isNA) {
        if (!attachedFiles.councilCert) {
          showError(isDoctor 
            ? 'Please attach your Council Registration Certificate (JPG or PDF, up to 10 MB).' 
            : 'Please attach your Professional Registration / Accreditation Certificate (JPG or PDF, up to 10 MB).');
          const drop = document.getElementById('spCouncilCertDropzone');
          if (drop) drop.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      // 5. Validate Declaration Checkbox
      const declarationCheck = document.getElementById('spDeclarationCheck');
      if (!declarationCheck || !declarationCheck.checked) {
        showError('Please read and accept the declaration by checking the declaration box.');
        if (declarationCheck) declarationCheck.focus();
        return;
      }

      // 6. Validate Typed Signature
      const typedSigInput = document.getElementById('spTypedSignature');
      if (!typedSigInput || !typedSigInput.value.trim()) {
        showError('Please provide your typed signature.');
        if (typedSigInput) typedSigInput.focus();
        return;
      }

      // Gather Form Data
      const title = document.getElementById('spTitle')?.value || '';
      const firstName = document.getElementById('spFirstName')?.value.trim() || '';
      const lastName = document.getElementById('spLastName')?.value.trim() || '';
      const fullName = (title ? title + ' ' : '') + firstName + ' ' + lastName;
      const gender = document.getElementById('spGender')?.value || '';
      const dob = document.getElementById('spDob')?.value || '';
      const mobile = document.getElementById('spMobile')?.value.trim() || '';
      const whatsapp = document.getElementById('spWhatsapp')?.value.trim() || '';
      const email = document.getElementById('spEmail')?.value.trim() || '';

      const practiceStatus = document.getElementById('spPracticeStatus')?.value || '';
      const experienceYears = document.getElementById('spExperienceYears')?.value || '';
      const institutionName = document.getElementById('spInstitutionName')?.value.trim() || '';
      const affiliations = document.getElementById('spAffiliations')?.value.trim() || 'None';
      const specialisation = document.getElementById('spSpecialisation')?.value.trim() || '';
      const objective = document.getElementById('spObjective')?.value.trim() || '';

      let primaryQual = primaryQualSelect?.value || '';
      if (primaryQual === 'Other') {
        const otherVal = document.getElementById('spPrimaryQualOther')?.value.trim();
        if (otherVal) primaryQual = 'Other: ' + otherVal;
      }
      const primaryCollege = document.getElementById('spPrimaryCollege')?.value.trim() || '';
      const primaryYear = document.getElementById('spPrimaryYear')?.value.trim() || '';
      const primaryGrade = document.getElementById('spPrimaryGrade')?.value.trim() || '';

      const pgQual = document.getElementById('spPgQual')?.value || '';
      const pgCollege = document.getElementById('spPgCollege')?.value.trim() || '';
      const pgYear = document.getElementById('spPgYear')?.value.trim() || '';
      const pgGrade = document.getElementById('spPgGrade')?.value.trim() || '';

      // Additional qualifications
      const addCards = additionalQualsContainer ? additionalQualsContainer.querySelectorAll('.sp-qual-card') : [];
      const additionalQualsList = [];
      addCards.forEach(c => {
        const deg = c.querySelector('.sp-add-degree')?.value.trim() || '';
        const col = c.querySelector('.sp-add-college')?.value.trim() || '';
        const yr = c.querySelector('.sp-add-year')?.value.trim() || '';
        const grd = c.querySelector('.sp-add-grade')?.value.trim() || '';
        const qId = c.getAttribute('data-qual-id');
        const certFile = attachedFiles['addCert_' + qId];
        if (deg && col) {
          additionalQualsList.push({
            degree: deg, college: col, year: yr, grade: grd, fileName: certFile ? certFile.name : 'Not attached'
          });
        }
      });

      const council = isNA ? 'Not Applicable (Independent Certified)' : (councilSelect?.value || 'N/A');
      const regNum = isNA ? 'Not Applicable' : (regNumInput?.value.trim() || 'N/A');
      const regState = isNA ? 'N/A' : (regStateInput?.value || 'N/A');
      const regYear = isNA ? 'N/A' : (regYearInput?.value.trim() || 'N/A');
      const regValid = isNA ? 'N/A' : (regValidInput?.value.trim() || 'N/A');

      const workMode = document.getElementById('spWorkMode')?.value || 'Both';
      const fromTime = timeFrom?.value || '';
      const toTime = timeTo?.value || '';
      const timingSummary = (fromTime && toTime) ? fromTime + ' to ' + toTime + ' IST' : 'Flexible';

      const declDate = document.getElementById('spDeclDate')?.value || new Date().toISOString().split('T')[0];
      const typedSig = typedSigInput.value.trim();

      // Compile Documents Checklist
      const docList = [];
      if (attachedFiles.photo) docList.push('1. Photograph: ' + attachedFiles.photo.name + ' (' + formatBytes(attachedFiles.photo.size) + ')');
      if (attachedFiles.primaryCert) docList.push('2. Primary Qualification Certificate: ' + attachedFiles.primaryCert.name + ' (' + formatBytes(attachedFiles.primaryCert.size) + ')');
      if (attachedFiles.pgCert) docList.push('3. Postgraduate Certificate: ' + attachedFiles.pgCert.name + ' (' + formatBytes(attachedFiles.pgCert.size) + ')');
      if (attachedFiles.councilCert) {
        docList.push((docList.length + 1) + '. ' + (isDoctor ? 'Council Registration Certificate: ' : 'Professional Registration / Accreditation Certificate: ') + attachedFiles.councilCert.name + ' (' + formatBytes(attachedFiles.councilCert.size) + ')');
      }
      additionalQualsList.forEach((q) => {
        docList.push((docList.length + 1) + '. Additional Cert (' + q.degree + '): ' + q.fileName);
      });
      if (hasDrawnSignature) {
        docList.push('Digital Drawing Pad Signature: Included');
      }

      // Populate Review Modal Content
      const reviewBody = document.getElementById('spReviewBody');
      if (reviewBody) {
        reviewBody.innerHTML = `
          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">Application Role</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Role:</span>
              <span class="sp-review-val"><strong>${isDoctor ? 'Doctor (Medical & Clinical Panel)' : 'Counsellor (Therapy & Advisory Panel)'}</strong></span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">1. Personal Details</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Full Name:</span><span class="sp-review-val">${fullName}</span>
              <span class="sp-review-key">Gender / DOB:</span><span class="sp-review-val">${gender} · ${dob}</span>
              <span class="sp-review-key">Mobile / WhatsApp:</span><span class="sp-review-val">${mobile} / ${whatsapp}</span>
              <span class="sp-review-key">Email ID:</span><span class="sp-review-val">${email}</span>
              <span class="sp-review-key">Photograph:</span><span class="sp-review-val">${attachedFiles.photo ? attachedFiles.photo.name + ' (' + formatBytes(attachedFiles.photo.size) + ')' : 'None'}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">2. Professional Details</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Practice Status:</span><span class="sp-review-val">${practiceStatus}</span>
              <span class="sp-review-key">Experience:</span><span class="sp-review-val">${experienceYears}</span>
              <span class="sp-review-key">Current Institution:</span><span class="sp-review-val">${institutionName}</span>
              <span class="sp-review-key">Affiliations:</span><span class="sp-review-val">${affiliations}</span>
              <span class="sp-review-key">Specialisation:</span><span class="sp-review-val">${specialisation}</span>
              <span class="sp-review-key">Objective:</span><span class="sp-review-val">${objective || 'None'}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">3. Qualifications</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Primary:</span><span class="sp-review-val"><strong>${primaryQual}</strong> (${primaryYear}) · ${primaryCollege} · Marks/Grade: ${primaryGrade} · Attached: ${attachedFiles.primaryCert ? attachedFiles.primaryCert.name : 'No'}</span>
              ${pgQual && pgQual !== 'None' ? `<span class="sp-review-key">Postgraduate:</span><span class="sp-review-val"><strong>${pgQual}</strong> (${pgYear}) · ${pgCollege} · Marks/Grade: ${pgGrade} · Attached: ${attachedFiles.pgCert ? attachedFiles.pgCert.name : 'No'}</span>` : ''}
              ${additionalQualsList.map(q => `<span class="sp-review-key">Additional:</span><span class="sp-review-val"><strong>${q.degree}</strong> (${q.year}) · ${q.college} · ${q.grade} · Attached: ${q.fileName}</span>`).join('')}
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">4. ${isDoctor ? 'Medical Council Registration' : 'Professional Registration / Accreditation'}</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Council / Body:</span><span class="sp-review-val">${council}</span>
              <span class="sp-review-key">Registration Number:</span><span class="sp-review-val">${regNum}</span>
              <span class="sp-review-key">State & Year:</span><span class="sp-review-val">${regState} · ${regYear}</span>
              <span class="sp-review-key">Valid Until:</span><span class="sp-review-val">${regValid}</span>
              <span class="sp-review-key">Registration Certificate:</span><span class="sp-review-val">${attachedFiles.councilCert ? attachedFiles.councilCert.name + ' (' + formatBytes(attachedFiles.councilCert.size) + ')' : (isNA ? 'Not Applicable' : 'Not attached')}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">5. Working Preferences</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Consultation Mode:</span><span class="sp-review-val">${workMode}</span>
              <span class="sp-review-key">Preferred Hours:</span><span class="sp-review-val">${timingSummary}</span>
            </div>
          </div>

          <div class="sp-review-section-block">
            <h4 class="sp-review-sec-title">6. Declaration & Verification</h4>
            <div class="sp-review-grid">
              <span class="sp-review-key">Declaration:</span><span class="sp-review-val">Agreed & Confirmed</span>
              <span class="sp-review-key">Date:</span><span class="sp-review-val">${declDate}</span>
              <span class="sp-review-key">Typed Signature:</span><span class="sp-review-val"><em>${typedSig}</em></span>
              <span class="sp-review-key">Canvas Signature:</span><span class="sp-review-val">${hasDrawnSignature ? 'Drawn signature recorded' : 'Not drawn (Typed signature provided)'}</span>
            </div>
          </div>

          <div class="sp-wa-notice-box">
            <i class="fa fa-info-circle"></i>
            <div>
              <strong>Important WhatsApp Document Notice:</strong> Files selected in this form are held in your browser memory for review and are not automatically uploaded to a server. When you tap <strong>Continue on WhatsApp</strong>, WhatsApp will open with your complete application text and document checklist. You must <strong>manually attach your photograph and certificates (including council registration certificate)</strong> directly in the WhatsApp chat with SPOUZY (+91 85919 45055) to complete your application.
            </div>
          </div>
        `;
      }

      // Build WhatsApp message
      const msgLines = [
        '*** SPOUZY ' + (isDoctor ? 'DOCTOR' : 'COUNSELLOR') + ' EMPANELMENT APPLICATION ***',
        '',
        'APPLICATION ROLE: ' + (isDoctor ? 'Doctor (Medical & Clinical Panel)' : 'Counsellor (Therapy & Advisory Panel)'),
        '',
        '1. PERSONAL DETAILS',
        'Full Name: ' + fullName,
        'Gender: ' + gender,
        'Date of Birth: ' + dob,
        'Mobile Number: ' + mobile,
        'WhatsApp Number: ' + whatsapp,
        'Email ID: ' + email,
        '',
        '2. PROFESSIONAL DETAILS',
        'Current Practice Status: ' + practiceStatus,
        'Years of Experience: ' + experienceYears,
        'Current Institution / Practice: ' + institutionName,
        'Affiliations: ' + affiliations,
        'Specialisations: ' + specialisation,
        'Objective for Joining: ' + (objective || 'Not provided'),
        '',
        '3. QUALIFICATIONS',
        'Primary: ' + primaryQual + ' (' + primaryYear + ') from ' + primaryCollege + ' [Marks: ' + primaryGrade + ']',
        pgQual && pgQual !== 'None' ? 'Postgraduate: ' + pgQual + ' (' + pgYear + ') from ' + pgCollege + ' [Marks: ' + pgGrade + ']' : '',
        additionalQualsList.length ? 'Additional Credentials:\n' + additionalQualsList.map(q => ' - ' + q.degree + ' (' + q.year + ') from ' + q.college).join('\n') : '',
        '',
        '4. REGISTRATION DETAILS',
        'Council / Professional Body: ' + council,
        'Registration Number: ' + regNum,
        'State / Jurisdiction: ' + regState,
        'Registration Year: ' + regYear,
        'Valid Until: ' + regValid,
        'Registration Certificate: ' + (attachedFiles.councilCert ? attachedFiles.councilCert.name + ' (' + formatBytes(attachedFiles.councilCert.size) + ')' : (isNA ? 'Not Applicable' : 'Not attached')),
        '',
        '5. WORKING PREFERENCES',
        'Consultation Mode: ' + workMode,
        'Preferred Working Hours: ' + timingSummary,
        '',
        '6. CHECKLIST OF DOCUMENTS TO ATTACH IN THIS CHAT',
        docList.join('\n'),
        '',
        '7. DECLARATION & SIGNATURE',
        '"I hereby declare that all information submitted is true and complete to the best of my knowledge and professional record."',
        'Date: ' + declDate,
        'Typed Signature: ' + typedSig,
        hasDrawnSignature ? 'Canvas Signature: Drawn on web form' : '',
        '',
        'Applicant note: I will now attach my photograph and credential certificates (including council registration certificate) in this chat for verification.'
      ].filter(l => l !== '');

      preparedWhatsAppMessage = msgLines.join('\n');

      // Open Modal
      if (reviewModal) {
        reviewModal.style.display = 'flex';
        reviewModal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    function showError(msg) {
      if (validationError) {
        validationError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        validationError.style.display = 'block';
        validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }

    // Continue on WhatsApp button
    if (reviewWhatsappBtn) {
      reviewWhatsappBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMessage) return;
        const encoded = encodeURIComponent(preparedWhatsAppMessage);
        const waUrl = 'https://wa.me/918591945055?text=' + encoded;
        try {
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {}
      });
    }

    // Copy Application Text Fallback
    if (copyAppTextBtn) {
      copyAppTextBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMessage) return;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(preparedWhatsAppMessage).then(() => {
            const originalText = copyAppTextBtn.innerHTML;
            copyAppTextBtn.innerHTML = '<i class="fa fa-check"></i> Copied to Clipboard!';
            setTimeout(() => { copyAppTextBtn.innerHTML = originalText; }, 2500);
          });
        } else {
          alert('Clipboard access unavailable. Please copy the text from WhatsApp.');
        }
      });
    }
  }

  // Auto-init on page load
  
  /* ==========================================================================
     SPOUZY CAREERS PAGE CONTROLLER
     Manages role detail accordions, apply pre-selection, resume dropzone,
     inline validation, review modal, and WhatsApp application handoff.
     ========================================================================== */
  function initSpouzyCareersPage() {
    const pageContainer = document.querySelector('.spouzy-careers-page');
    if (!pageContainer) return;

    // 1. Expand / Collapse Role Detail Panels
    const roleToggleBtns = document.querySelectorAll('.sp-role-toggle-btn');
    roleToggleBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const targetId = this.getAttribute('aria-controls');
        const targetPanel = document.getElementById(targetId);
        if (!targetPanel) return;

        const isExpanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', String(!isExpanded));
        targetPanel.hidden = isExpanded;

        const labelSpan = this.querySelector('.sp-toggle-text');
        if (labelSpan) {
          labelSpan.textContent = isExpanded ? 'View Role Details' : 'Hide Role Details';
        }
      });
    });

    // 2. "Apply Now" Card Buttons -> Preselect Dropdown, Scroll, and Focus
    const roleSelect = document.getElementById('spCareerRole');
    const formSection = document.getElementById('spCareersFormContainer');
    const applyBtns = document.querySelectorAll('.sp-role-apply-btn');

    applyBtns.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const roleToSelect = this.getAttribute('data-role-select');
        if (roleSelect && roleToSelect) {
          roleSelect.value = roleToSelect;
        }

        if (formSection) {
          formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        setTimeout(() => {
          if (roleSelect) {
            roleSelect.focus();
          }
        }, 400);
      });
    });

    // 3. WhatsApp "Same as Mobile" Synchronization
    const mobileInput = document.getElementById('spCareerMobile');
    const whatsappInput = document.getElementById('spCareerWhatsapp');
    const sameAsMobileCheck = document.getElementById('spCareerSameAsMobile');

    function syncWhatsapp() {
      if (sameAsMobileCheck && sameAsMobileCheck.checked && mobileInput && whatsappInput) {
        whatsappInput.value = mobileInput.value;
      }
    }

    if (sameAsMobileCheck && mobileInput && whatsappInput) {
      sameAsMobileCheck.addEventListener('change', function () {
        if (this.checked) {
          whatsappInput.value = mobileInput.value;
          whatsappInput.readOnly = true;
          whatsappInput.classList.add('is-synced');
        } else {
          whatsappInput.readOnly = false;
          whatsappInput.classList.remove('is-synced');
        }
      });
      mobileInput.addEventListener('input', syncWhatsapp);
    }

    // 4. In-Memory Resume File Uploader (PDF, DOC, DOCX up to 10 MB)
    let attachedResume = null;
    const maxResumeBytes = 10 * 1024 * 1024; // 10 MB
    const allowedExts = ['.pdf', '.doc', '.docx'];

    const resumeDropzone = document.getElementById('spResumeDropzone');
    const resumeInput = document.getElementById('spResumeInput');
    const resumePreview = document.getElementById('spResumePreviewCard');
    const resumeError = document.getElementById('spResumeError');

    function formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function setResumeError(msg) {
      if (resumeError) {
        if (msg) {
          resumeError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
          resumeError.style.display = 'block';
        } else {
          resumeError.style.display = 'none';
          resumeError.innerHTML = '';
        }
      }
    }

    function renderResumePreview(file) {
      if (!file) {
        if (resumeDropzone) resumeDropzone.style.display = 'block';
        if (resumePreview) resumePreview.style.display = 'none';
        attachedResume = null;
        setResumeError('');
        return;
      }

      attachedResume = file;
      if (resumeDropzone) resumeDropzone.style.display = 'none';
      if (resumePreview) resumePreview.style.display = 'flex';
      setResumeError('');

      const nameEl = resumePreview.querySelector('.sp-file-name');
      const sizeEl = resumePreview.querySelector('.sp-file-size');
      const iconEl = resumePreview.querySelector('.sp-file-thumb');

      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = formatBytes(file.size);
      if (iconEl) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (ext === '.pdf') {
          iconEl.innerHTML = '<i class="fa fa-file-pdf-o" style="color: #c02a2a; font-size: 24px;" aria-hidden="true"></i>';
        } else {
          iconEl.innerHTML = '<i class="fa fa-file-word-o" style="color: #2b579a; font-size: 24px;" aria-hidden="true"></i>';
        }
      }
    }

    if (resumeDropzone && resumeInput) {
      resumeDropzone.addEventListener('click', () => resumeInput.click());
      resumeDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resumeInput.click();
        }
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        resumeDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          resumeDropzone.classList.add('is-dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        resumeDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          resumeDropzone.classList.remove('is-dragover');
        });
      });

      resumeDropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length) {
          handleResumeFile(files[0]);
        }
      });

      resumeInput.addEventListener('change', function () {
        if (this.files && this.files.length) {
          handleResumeFile(this.files[0]);
        }
      });
    }

    function handleResumeFile(file) {
      if (!file) return;
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext)) {
        setResumeError('Unsupported file format (' + ext + '). Please attach a PDF, DOC, or DOCX document.');
        if (resumeInput) resumeInput.value = '';
        return;
      }
      if (file.size > maxResumeBytes) {
        setResumeError('Resume file exceeds maximum size limit of 10 MB (Selected: ' + formatBytes(file.size) + ').');
        if (resumeInput) resumeInput.value = '';
        return;
      }
      setResumeError('');
      renderResumePreview(file);
    }

    // Replace and Remove buttons
    const replaceResumeBtn = document.getElementById('spReplaceResumeBtn');
    const removeResumeBtn = document.getElementById('spRemoveResumeBtn');

    if (replaceResumeBtn && resumeInput) {
      replaceResumeBtn.addEventListener('click', () => resumeInput.click());
    }

    if (removeResumeBtn) {
      removeResumeBtn.addEventListener('click', () => {
        if (resumeInput) resumeInput.value = '';
        renderResumePreview(null);
      });
    }

    // 5. Careers Form Submission & Review Modal
    const form = document.getElementById('spCareersForm');
    const formError = document.getElementById('spCareerFormError');
    const reviewModal = document.getElementById('spCareerReviewModal');
    const reviewContent = document.getElementById('spCareerReviewContent');
    const reviewCloseBtn = document.getElementById('spCareerReviewCloseBtn');
    const reviewEditBtn = document.getElementById('spCareerReviewEditBtn');
    const reviewWhatsappBtn = document.getElementById('spCareerReviewWhatsappBtn');
    const copyAppTextBtn = document.getElementById('spCareerCopyTextBtn');

    let preparedWhatsAppMsg = '';

    function showFormError(msg) {
      if (formError) {
        formError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        formError.style.display = 'block';
        formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }

    function closeReviewModal() {
      if (reviewModal) reviewModal.style.display = 'none';
    }

    if (reviewCloseBtn) reviewCloseBtn.addEventListener('click', closeReviewModal);
    if (reviewEditBtn) reviewEditBtn.addEventListener('click', closeReviewModal);

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (formError) formError.style.display = 'none';

        // Read fields
        const role = roleSelect ? roleSelect.value.trim() : '';
        const fullName = (document.getElementById('spCareerFullName')?.value || '').trim();
        const email = (document.getElementById('spCareerEmail')?.value || '').trim();
        const mobileCode = document.getElementById('spCareerMobileCode')?.value || '+91';
        const mobile = (document.getElementById('spCareerMobile')?.value || '').trim();
        const waCode = document.getElementById('spCareerWaCode')?.value || '+91';
        const whatsapp = (document.getElementById('spCareerWhatsapp')?.value || '').trim();
        const city = (document.getElementById('spCareerCity')?.value || '').trim();
        const exp = (document.getElementById('spCareerExp')?.value || '').trim();
        const currentRole = (document.getElementById('spCareerCurrentRole')?.value || '').trim();
        const skills = (document.getElementById('spCareerSkills')?.value || '').trim();
        const highestQual = (document.getElementById('spCareerHighestQual')?.value || '').trim();
        const portfolio = (document.getElementById('spCareerPortfolio')?.value || '').trim();
        const notice = (document.getElementById('spCareerNotice')?.value || '').trim();
        const expectedComp = (document.getElementById('spCareerExpectedComp')?.value || '').trim();
        const why = (document.getElementById('spCareerWhy')?.value || '').trim();
        const consentCheck = document.getElementById('spCareerConsent');

        // Validations
        if (!role) {
          showFormError('Please select the position you are applying for.');
          if (roleSelect) roleSelect.focus();
          return;
        }
        if (!fullName) {
          showFormError('Please provide your full legal name.');
          document.getElementById('spCareerFullName')?.focus();
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          showFormError('Please provide a valid email address.');
          document.getElementById('spCareerEmail')?.focus();
          return;
        }
        const cleanMobile = mobile.replace(/[^0-9]/g, '');
        if (!cleanMobile || cleanMobile.length < 8) {
          showFormError('Please provide a valid mobile number (at least 8 digits).');
          document.getElementById('spCareerMobile')?.focus();
          return;
        }
        const cleanWa = whatsapp.replace(/[^0-9]/g, '');
        if (!cleanWa || cleanWa.length < 8) {
          showFormError('Please provide a valid WhatsApp number (at least 8 digits).');
          document.getElementById('spCareerWhatsapp')?.focus();
          return;
        }
        if (!city) {
          showFormError('Please provide your current city.');
          document.getElementById('spCareerCity')?.focus();
          return;
        }
        if (!exp) {
          showFormError('Please select your total relevant experience.');
          document.getElementById('spCareerExp')?.focus();
          return;
        }
        if (!skills) {
          showFormError('Please describe your key skills and strengths.');
          document.getElementById('spCareerSkills')?.focus();
          return;
        }
        if (!notice) {
          showFormError('Please select your notice period or availability.');
          document.getElementById('spCareerNotice')?.focus();
          return;
        }
        if (!why || why.length < 20) {
          showFormError('Please share a brief note on why you would like to join SPOUZY (minimum 20 characters).');
          document.getElementById('spCareerWhy')?.focus();
          return;
        }
        if (!attachedResume) {
          showFormError('Please attach your resume document (PDF, DOC, or DOCX, up to 10 MB).');
          if (resumeDropzone) resumeDropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if (!consentCheck || !consentCheck.checked) {
          showFormError('Please read and confirm the privacy policy and information accuracy declaration.');
          if (consentCheck) consentCheck.focus();
          return;
        }

        const fullMobile = mobileCode + ' ' + cleanMobile;
        const fullWa = waCode + ' ' + cleanWa;

        // Render Review Content
        if (reviewContent) {
          reviewContent.innerHTML = `
            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">Position Applied For</h4>
              <div class="sp-review-role-badge"><strong>${role}</strong></div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">1. Personal & Contact Information</h4>
              <div class="sp-review-grid">
                <span class="sp-review-key">Full Name:</span><span class="sp-review-val"><strong>${fullName}</strong></span>
                <span class="sp-review-key">Email:</span><span class="sp-review-val">${email}</span>
                <span class="sp-review-key">Mobile Number:</span><span class="sp-review-val">${fullMobile}</span>
                <span class="sp-review-key">WhatsApp Number:</span><span class="sp-review-val">${fullWa}</span>
                <span class="sp-review-key">Current City:</span><span class="sp-review-val">${city}</span>
              </div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">2. Professional Background</h4>
              <div class="sp-review-grid">
                <span class="sp-review-key">Total Experience:</span><span class="sp-review-val"><strong>${exp}</strong></span>
                <span class="sp-review-key">Current / Last Role:</span><span class="sp-review-val">${currentRole || 'Not specified'}</span>
                <span class="sp-review-key">Highest Qualification:</span><span class="sp-review-val">${highestQual || 'Not specified'}</span>
                <span class="sp-review-key">Key Skills:</span><span class="sp-review-val">${skills}</span>
                <span class="sp-review-key">Portfolio / LinkedIn:</span><span class="sp-review-val">${portfolio ? '<a href="' + portfolio + '" target="_blank" rel="noopener">' + portfolio + ' ↗</a>' : 'Not provided'}</span>
                <span class="sp-review-key">Notice Period:</span><span class="sp-review-val">${notice}</span>
                <span class="sp-review-key">Expected Compensation:</span><span class="sp-review-val">${expectedComp || 'Discussed during selection process'}</span>
              </div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">3. Statement of Purpose</h4>
              <div class="sp-review-text-block">${why}</div>
            </div>

            <div class="sp-review-section-block">
              <h4 class="sp-review-sec-title">4. Attached Resume</h4>
              <div class="sp-review-grid">
                <span class="sp-review-key">Resume File:</span><span class="sp-review-val"><strong>${attachedResume.name}</strong> (${formatBytes(attachedResume.size)})</span>
              </div>
            </div>

            <div class="sp-wa-notice-box">
              <i class="fa fa-info-circle"></i>
              <div>
                <strong>Important WhatsApp Document Notice:</strong> Your application details will open in WhatsApp. A WhatsApp link cannot attach a selected file automatically. <strong>Please attach your resume (${attachedResume.name}) manually in WhatsApp</strong> before sending your message to SPOUZY (+91 85919 45055).
              </div>
            </div>
          `;
        }

        // Build WhatsApp Message Text
        const msgLines = [
          'SPOUZY Careers Application — ' + role,
          '',
          '1. CANDIDATE DETAILS',
          'Full Name: ' + fullName,
          'Email ID: ' + email,
          'Mobile: ' + fullMobile,
          'WhatsApp: ' + fullWa,
          'Current City: ' + city,
          '',
          '2. PROFESSIONAL SUMMARY',
          'Role Applied For: ' + role,
          'Total Relevant Experience: ' + exp,
          'Current / Most Recent Role: ' + (currentRole || 'Not specified'),
          'Highest Qualification: ' + (highestQual || 'Not specified'),
          'Key Skills & Strengths: ' + skills,
          portfolio ? 'Portfolio / LinkedIn: ' + portfolio : '',
          'Notice Period / Availability: ' + notice,
          'Expected Compensation: ' + (expectedComp || 'Discussed during selection process'),
          '',
          '3. WHY I WANT TO JOIN SPOUZY',
          why,
          '',
          '4. RESUME ATTACHMENT',
          'Selected File: ' + attachedResume.name + ' (' + formatBytes(attachedResume.size) + ')',
          '',
          'Applicant Note: I have confirmed my details above and will now attach my resume (' + attachedResume.name + ') manually in this chat.'
        ].filter(line => line !== '');

        preparedWhatsAppMsg = msgLines.join('\n');

        // Open Modal
        if (reviewModal) {
          reviewModal.style.display = 'flex';
          reviewModal.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    // Continue on WhatsApp button
    if (reviewWhatsappBtn) {
      reviewWhatsappBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMsg) return;
        const encoded = encodeURIComponent(preparedWhatsAppMsg);
        const waUrl = 'https://wa.me/918591945055?text=' + encoded;
        try {
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {}
      });
    }

    // Copy Application Text Fallback
    if (copyAppTextBtn) {
      copyAppTextBtn.addEventListener('click', function () {
        if (!preparedWhatsAppMsg) return;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(preparedWhatsAppMsg).then(() => {
            const originalText = copyAppTextBtn.innerHTML;
            copyAppTextBtn.innerHTML = '<i class="fa fa-check"></i> Copied to Clipboard!';
            setTimeout(() => { copyAppTextBtn.innerHTML = originalText; }, 2500);
          });
        } else {
          alert('Clipboard access unavailable. Please copy the text from WhatsApp.');
        }
      });
    }
  }

  initSpouzyCareersPage();
  initSpouzyJoinForm();
