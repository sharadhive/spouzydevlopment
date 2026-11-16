/**
 * SPOUZY 2026 — Modern UI/UX Interactive Controller
 * Problem Solver Group (PSG) Specialist Wing
 */

// ---------------------------------------------------------------------------
// 0. FIRST-VISIT ANIMATED LOGO LOADER (Transparent, Non-blocking)
// ---------------------------------------------------------------------------
(function initFirstVisitLoader() {
  'use strict';

  // 1. Skip animation for reduced-motion users
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
  } catch (e) {}

  // 2. Show once per browser-tab session across any first page visited
  var SESSION_KEY = 'spouzy_loader_shown';
  try {
    if (sessionStorage.getItem(SESSION_KEY)) {
      return;
    }
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch (e) {
    // If storage is disabled or unavailable, exit gracefully without blocking
    return;
  }

  // 3. Mount transparent loader overlay
  function mountLoader() {
    if (!document.body || document.getElementById('sp-first-visit-loader')) return;

    var overlay = document.createElement('div');
    overlay.id = 'sp-first-visit-loader';
    overlay.className = 'sp-first-visit-loader';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'presentation');

    var img = document.createElement('img');
    img.className = 'sp-first-visit-loader-img';
    img.alt = '';
    img.setAttribute('role', 'presentation');
    img.src = 'image/SPOUZY-loader.webp';

    var removed = false;
    function removeLoader() {
      if (removed) return;
      removed = true;
      overlay.classList.add('sp-loader-fade-out');
      setTimeout(function () {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 160);
    }

    // If image fails to load, remove immediately without delay
    img.onerror = function () {
      if (img.src.indexOf('.webp') !== -1) {
        // Fallback to GIF if WebP format is unsupported
        img.src = 'image/SPOUZY-loader.gif';
      } else {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        removed = true;
      }
    };

    // Play once: the ribbon reveal animation is ~2.78-2.9s.
    // Start 150ms fade-out at ~2.65s so it finishes before the WebP/GIF loops.
    img.onload = function () {
      setTimeout(removeLoader, 2650);
    };

    // Fallback timer: ensure removal within 3.2s regardless of network or decode delays
    setTimeout(function () {
      if (!removed) removeLoader();
    }, 3200);

    overlay.appendChild(img);
    document.body.appendChild(overlay);
  }

  if (document.body) {
    mountLoader();
  } else {
    document.addEventListener('DOMContentLoaded', mountLoader);
  }
})();

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. STICKY HEADER & SCROLL BEHAVIOR
  // -------------------------------------------------------------------------
  const header = document.querySelector('.sp-header-modern');
  if (header) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 30) {
        header.classList.add('sp-header-scrolled');
      } else {
        header.classList.remove('sp-header-scrolled');
      }
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
  // 5. SPOTLIGHT LIVE SEARCH MODAL
  // -------------------------------------------------------------------------
  const searchTriggers = document.querySelectorAll('.sp-search-trigger, .sp-search-btn');
  const searchModal = document.querySelector('.sp-search-modal');
  const searchField = document.querySelector('.sp-search-field');
  const searchClose = document.querySelector('.sp-search-close');
  const searchResults = document.querySelectorAll('.sp-search-result-item');

  function openSearch() {
    if (searchModal) {
      searchModal.classList.add('is-open');
      setTimeout(() => {
        if (searchField) searchField.focus();
      }, 100);
    }
  }

  function closeSearch() {
    if (searchModal) {
      searchModal.classList.remove('is-open');
      if (searchField) searchField.value = '';
      if (searchResults) {
        searchResults.forEach(item => item.style.display = 'block');
      }
    }
  }

  searchTriggers.forEach(trigger => {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      openSearch();
    });
  });

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

  // Live filter results
  if (searchField && searchResults.length) {
    searchField.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      searchResults.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(q)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // -------------------------------------------------------------------------
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
    if (!form || !document.getElementById('spConsultDate') || document.getElementById('spTimePickerTrigger')) return;

    const validationError = document.getElementById('spQuickBookingValidationError');
    const feedbackContainer = document.getElementById('spQuickBookingFeedback');

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
    // Only target book-appoinment.htm (which has spTimePickerTrigger or spBookingDate)
    if (!form || !document.getElementById('spTimePickerTrigger')) return;

    const SPOUZY_SCHEDULE_CONFIG = {
      timezone: 'Asia/Kolkata',
      weeklyHours: {
        0: { open: '10:00', close: '14:00', mode: 'virtual' },
        1: { open: '10:00', close: '19:00' },
        2: { open: '10:00', close: '19:00' },
        3: { open: '10:00', close: '19:00' },
        4: { open: '10:00', close: '19:00' },
        5: { open: '10:00', close: '19:00' },
        6: { open: '10:00', close: '18:00' }
      },
      breakHours: [
        { start: '13:00', end: '14:00', reason: 'Intermission' }
      ],
      sampleBookedSlotsByDay: {
        1: ['10:30-11:00', '15:00-15:30', '15:30-16:00'],
        2: ['11:30-12:00', '16:00-16:30'],
        3: ['10:30-11:00', '14:30-15:00'],
        4: ['12:00-12:30', '16:30-17:00'],
        5: ['10:30-11:00', '17:00-17:30'],
        6: ['11:00-11:30', '15:30-16:00'],
        0: ['11:30-12:00']
      }
    };

    const dateInput = document.getElementById('spBookingDate');
    const formattedDateText = document.getElementById('spFormattedDateText');
    const durationInput = document.getElementById('spBookingDuration');
    const durationBtns = document.querySelectorAll('.sp-duration-btn');
    const timePickerTrigger = document.getElementById('spTimePickerTrigger');
    const timeDisplayVal = document.getElementById('spTimeDisplayVal');
    const timePickerPopover = document.getElementById('spTimePickerPopover');
    const popoverDateText = document.getElementById('spPopoverDateText');
    const popoverDurationBadge = document.getElementById('spPopoverDurationBadge');
    const closePopoverBtn = document.getElementById('spClosePopoverBtn');
    const pickerBackdrop = document.getElementById('spPickerBackdrop');
    const slotsContainer = document.getElementById('spSlotsContainer');
    const slotNotice = document.getElementById('spSlotNotice');
    const selectedSlotInput = document.getElementById('spSelectedTimeSlot');
    const serviceSelect = document.getElementById('spServiceSelect');
    const consultModeSelect = document.getElementById('spConsultMode');
    const summaryBox = document.getElementById('spAppointmentSummaryBox');
    const summaryContent = document.getElementById('spSummaryContent');
    const summarySubContent = document.getElementById('spSummarySubContent');
    const validationError = document.getElementById('spBookingValidationError');
    const feedbackContainer = document.getElementById('spBookingFeedback');

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

    function formatFullDateIST(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return '';
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m - 1, d);
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return weekdays[dt.getDay()] + ', ' + d + ' ' + months[m - 1] + ' ' + y;
    }

    function parseTimeToMinutes(t) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }

    function formatMinutesTo12h(mins) {
      let h = Math.floor(mins / 60);
      const m = mins % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }

    const todayISTString = getISTDateString();
    if (dateInput) {
      dateInput.min = todayISTString;
      if (!dateInput.value) {
        dateInput.value = todayISTString;
      }
      if (formattedDateText) {
        formattedDateText.textContent = formatFullDateIST(dateInput.value);
      }
    }

    function calculateSlots(dateStr, durationMinutes, mode) {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return { error: 'Invalid date format', slots: [] };
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = dateObj.getDay();

      const hoursConfig = SPOUZY_SCHEDULE_CONFIG.weeklyHours[dayOfWeek];
      if (!hoursConfig) {
        return { notice: 'Center is closed on this day. Please select another date.', slots: [] };
      }

      if (hoursConfig.mode === 'virtual' && mode && mode !== 'virtual') {
        return { notice: 'Sunday consultations operate exclusively via Encrypted Video/Audio Telehealth.', slots: [] };
      }

      const openMinutes = parseTimeToMinutes(hoursConfig.open);
      const closeMinutes = parseTimeToMinutes(hoursConfig.close);
      const bookedRanges = (SPOUZY_SCHEDULE_CONFIG.sampleBookedSlotsByDay[dayOfWeek] || []).map(r => {
        const [st, et] = r.split('-');
        return { start: parseTimeToMinutes(st), end: parseTimeToMinutes(et) };
      });

      const breakRanges = (SPOUZY_SCHEDULE_CONFIG.breakHours || []).map(b => ({
        start: parseTimeToMinutes(b.start),
        end: parseTimeToMinutes(b.end),
        reason: b.reason
      }));

      const isToday = dateStr === todayISTString;
      const nowIST = getNowIST();
      const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

      const slots = [];
      const interval = 30;

      for (let time = openMinutes; time + durationMinutes <= closeMinutes; time += interval) {
        const slotStart = time;
        const slotEnd = time + durationMinutes;
        const label = formatMinutesTo12h(slotStart) + ' – ' + formatMinutesTo12h(slotEnd);

        let status = 'available';
        let reason = '';

        if (isToday && slotStart <= currentMinutes + 30) {
          status = 'disabled';
          reason = 'Passed';
        }

        if (status === 'available') {
          for (const brk of breakRanges) {
            if (slotStart < brk.end && slotEnd > brk.start) {
              status = 'disabled';
              reason = brk.reason || 'Intermission';
              break;
            }
          }
        }

        if (status === 'available') {
          for (const booked of bookedRanges) {
            if (slotStart < booked.end && slotEnd > booked.start) {
              status = 'disabled';
              reason = 'Booked';
              break;
            }
          }
        }

        slots.push({ start: slotStart, end: slotEnd, label, status, reason });
      }

      return { slots };
    }

    function openTimePicker() {
      if (!timePickerPopover || !timePickerTrigger) return;
      if (timePickerTrigger.disabled) return;
      timePickerPopover.hidden = false;
      timePickerPopover.classList.add('is-open');
      timePickerTrigger.setAttribute('aria-expanded', 'true');
      if (pickerBackdrop) pickerBackdrop.classList.add('is-active');
      updatePopoverHeader();
      renderSlots();
    }

    function closeTimePicker() {
      if (!timePickerPopover || !timePickerTrigger) return;
      timePickerPopover.classList.remove('is-open');
      timePickerTrigger.setAttribute('aria-expanded', 'false');
      if (pickerBackdrop) pickerBackdrop.classList.remove('is-active');
      setTimeout(() => {
        if (!timePickerPopover.classList.contains('is-open')) {
          timePickerPopover.hidden = true;
        }
      }, 200);
    }

    function updatePopoverHeader() {
      if (popoverDateText && dateInput) {
        popoverDateText.textContent = formatFullDateIST(dateInput.value) || 'No date chosen';
      }
      if (popoverDurationBadge && durationInput) {
        const dur = durationInput.value === '60' ? '1 hour session' : '30 min session';
        popoverDurationBadge.textContent = dur;
      }
    }

    function updateTimeFieldState() {
      if (!timePickerTrigger || !timeDisplayVal) return;
      const dateVal = dateInput ? dateInput.value : '';
      if (!dateVal) {
        timePickerTrigger.disabled = true;
        timePickerTrigger.classList.add('is-disabled');
        timePickerTrigger.classList.remove('has-value');
        timeDisplayVal.textContent = 'Choose an appointment date first';
      } else {
        timePickerTrigger.disabled = false;
        timePickerTrigger.classList.remove('is-disabled');
        if (selectedSlotInput && selectedSlotInput.value) {
          timeDisplayVal.textContent = selectedSlotInput.value;
          timePickerTrigger.classList.add('has-value');
        } else {
          timeDisplayVal.textContent = 'Select appointment time';
          timePickerTrigger.classList.remove('has-value');
        }
      }
    }

    function renderSlots() {
      if (!slotsContainer || !dateInput) return;
      const dateVal = dateInput.value;
      const durationVal = parseInt(durationInput ? durationInput.value : '30', 10) || 30;
      const modeVal = consultModeSelect ? consultModeSelect.value : 'virtual';

      if (!dateVal) {
        slotsContainer.innerHTML = '';
        if (slotNotice) {
          slotNotice.innerHTML = '<i class="fa fa-info-circle"></i> Please choose an appointment date first.';
          slotNotice.style.display = 'block';
        }
        return;
      }

      if (dateVal < todayISTString) {
        slotsContainer.innerHTML = '';
        if (slotNotice) {
          slotNotice.innerHTML = '<i class="fa fa-exclamation-triangle"></i> Past dates cannot be selected. Please choose today or a future date.';
          slotNotice.style.display = 'block';
        }
        return;
      }

      const result = calculateSlots(dateVal, durationVal, modeVal);
      if (result.notice) {
        slotsContainer.innerHTML = '';
        if (slotNotice) {
          slotNotice.innerHTML = '<i class="fa fa-info-circle"></i> ' + result.notice;
          slotNotice.style.display = 'block';
        }
        updateSummary();
        return;
      }

      const slots = result.slots || [];
      slotsContainer.innerHTML = '';

      slots.forEach(slot => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sp-slot-range-btn';
        btn.setAttribute('data-slot', slot.label);

        if (slot.status === 'disabled') {
          btn.classList.add('is-disabled');
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
          btn.innerHTML = '<span class="sp-slot-time">' + slot.label + '</span>' +
                          '<span class="sp-slot-badge">' + (slot.reason || 'Unavailable') + '</span>';
        } else {
          btn.innerHTML = '<span class="sp-slot-time">' + slot.label + '</span>';
          if (selectedSlotInput && selectedSlotInput.value === slot.label) {
            btn.classList.add('is-selected');
          }

          btn.addEventListener('click', function () {
            const chosenSlot = slot.label;
            if (selectedSlotInput) selectedSlotInput.value = chosenSlot;
            if (timeDisplayVal) timeDisplayVal.textContent = chosenSlot;
            if (timePickerTrigger) {
              timePickerTrigger.classList.add('has-value');
              closeTimePicker();
              timePickerTrigger.focus();
            }
            if (validationError) validationError.style.display = 'none';
            updateSummary();
          });
        }
        slotsContainer.appendChild(btn);
      });

      if (slotNotice) slotNotice.style.display = 'none';
      updateSummary();
    }

    function updateSummary() {
      if (!summaryContent) return;
      const dateVal = dateInput ? dateInput.value : '';
      const durationVal = durationInput ? durationInput.value : '30';
      const slotVal = selectedSlotInput ? selectedSlotInput.value : '';
      const durationText = durationVal === '60' ? '1 hour' : '30 minutes';

      const serviceText = serviceSelect && serviceSelect.selectedIndex >= 0 ? 
        serviceSelect.options[serviceSelect.selectedIndex].text.split('(')[0].trim() : 'Guidance Consultation';
      const modeText = consultModeSelect && consultModeSelect.selectedIndex >= 0 ? 
        consultModeSelect.options[consultModeSelect.selectedIndex].text.split('(')[0].trim() : 'Encrypted Telehealth';

      if (dateVal && slotVal) {
        const fullDate = formatFullDateIST(dateVal);
        summaryContent.className = 'sp-summary-text is-ready';
        summaryContent.innerHTML = 
          '<span class="sp-summary-highlight"><i class="fa fa-calendar-check-o"></i> ' + fullDate + '</span>' +
          '<span class="sp-summary-dot">·</span>' +
          '<span class="sp-summary-highlight"><i class="fa fa-clock-o"></i> ' + slotVal + ' IST</span>' +
          '<span class="sp-summary-dot">·</span>' +
          '<span class="sp-summary-highlight"><i class="fa fa-hourglass-half"></i> ' + durationText + '</span>';
        
        if (summarySubContent) {
          summarySubContent.style.display = 'block';
          summarySubContent.innerHTML = '<strong>' + serviceText + '</strong> · ' + modeText;
        }
      } else {
        summaryContent.className = 'sp-summary-text is-placeholder';
        if (dateVal) {
          summaryContent.textContent = 'Date: ' + formatFullDateIST(dateVal) + ' (' + durationText + '). Please choose an available appointment time above.';
        } else {
          summaryContent.textContent = 'Please choose an appointment date, duration, and appointment time above.';
        }
        if (summarySubContent) {
          summarySubContent.style.display = 'none';
        }
      }
    }

    function showBookingError(msg) {
      if (validationError) {
        validationError.innerHTML = '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + msg;
        validationError.style.display = 'block';
        validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(msg);
      }
    }

    if (timePickerTrigger) {
      timePickerTrigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (timePickerPopover && timePickerPopover.classList.contains('is-open')) {
          closeTimePicker();
        } else {
          openTimePicker();
        }
      });
    }

    if (closePopoverBtn) {
      closePopoverBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeTimePicker();
      });
    }

    if (pickerBackdrop) {
      pickerBackdrop.addEventListener('click', function () {
        closeTimePicker();
      });
    }

    if (dateInput) {
      dateInput.addEventListener('change', function () {
        if (formattedDateText) {
          formattedDateText.textContent = formatFullDateIST(this.value) || 'Select date';
        }
        if (selectedSlotInput) selectedSlotInput.value = '';
        closeTimePicker();
        updateTimeFieldState();
        updatePopoverHeader();
        renderSlots();
        updateSummary();
      });
    }

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
          if (selectedSlotInput) selectedSlotInput.value = '';
          closeTimePicker();
          updateTimeFieldState();
          updatePopoverHeader();
          renderSlots();
          updateSummary();
        });
      });
    }

    if (serviceSelect) {
      serviceSelect.addEventListener('change', function () {
        if (selectedSlotInput) selectedSlotInput.value = '';
        closeTimePicker();
        updateTimeFieldState();
        renderSlots();
        updateSummary();
      });
    }

    if (consultModeSelect) {
      consultModeSelect.addEventListener('change', function () {
        if (selectedSlotInput) selectedSlotInput.value = '';
        closeTimePicker();
        updateTimeFieldState();
        renderSlots();
        updateSummary();
      });
    }

    // Form Submission: Hand off to WhatsApp
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (validationError) validationError.style.display = 'none';

      const dateVal = dateInput ? dateInput.value : '';
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
        if (dateInput) dateInput.focus();
        return;
      }

      if (dateVal < todayISTString) {
        showBookingError('Past dates cannot be selected. Please choose today or a future date.');
        if (dateInput) dateInput.focus();
        return;
      }

      if (!slotVal) {
        showBookingError('Please select an appointment time.');
        if (timePickerTrigger) {
          timePickerTrigger.focus();
          openTimePicker();
        }
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
        'Additional Information: ' + (patientNotes || 'Not provided'),
        '',
        'Please confirm availability and the next steps.'
      ];

      const fullMessage = lines.join('\n');
      openWhatsAppHandoff('918591945055', fullMessage, feedbackContainer);
    });

    updateTimeFieldState();
    updatePopoverHeader();
    renderSlots();
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
