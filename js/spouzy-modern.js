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

  // E. Confidential Booking & Contact Form Submission Feedback
  const bookingForm = document.getElementById('spBookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      const origText = submitBtn ? submitBtn.innerHTML : 'Submit';
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Confirming Discretion...';
        submitBtn.disabled = true;
      }
      setTimeout(() => {
        alert('Preview only. Your details stayed in this browser.');
        bookingForm.reset();
        if (submitBtn) {
          submitBtn.innerHTML = origText;
          submitBtn.disabled = false;
        }
      }, 900);
    });
  }

  const contactForm = document.getElementById('spContactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      const origText = submitBtn ? submitBtn.innerHTML : 'Submit';
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Encrypting &amp; Sending...';
        submitBtn.disabled = true;
      }
      setTimeout(() => {
        alert('Preview only. Your details stayed in this browser.');
        contactForm.reset();
        if (submitBtn) {
          submitBtn.innerHTML = origText;
          submitBtn.disabled = false;
        }
      }, 900);
    });
  }

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
