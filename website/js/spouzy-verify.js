/**
 * SPOUZY student / ex-servicemen ID verification (website side)
 *   - create-account.htm: optional "Student or ex-serviceman / defence?" box in the sign-up form.
 *     The ID proof is uploaded right after the account is created (spouzy-shop.js calls SpouzyVerify.signup).
 *   - account.htm:        "Student & ex-servicemen benefit" section: status, the admin's message when an ID
 *     was not approved, upload again, valid-until date, yearly reminder for ex-servicemen.
 * The benefit (free consultation from today instead of 2 months ahead) starts only after the admin approves the ID.
 * Student benefits end on the valid-until date of the ID; ex-servicemen IDs do not expire.
 */
(function () {
  'use strict';

  const API = '/api';
  const MAX_BYTES = 8 * 1024 * 1024;
  const TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
  const BRANCHES = ['Army', 'Navy', 'Air Force', 'Coast Guard', 'Central Armed Police Forces (CAPF)', 'Other defence service'];
  const NOTICE_KEY = 'spouzy_verify_notice';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function readCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function storage(fn) {
    try { return fn(window.sessionStorage); } catch (e) { return null; }
  }
  async function ensureCsrf() {
    if (!readCookie('spouzy_csrf')) {
      try { await fetch(API + '/health', { credentials: 'same-origin' }); } catch (e) { /* ignore */ }
    }
  }
  async function api(method, path, body) {
    const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) {
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
      let message = json.message || '';
      if (res.status === 413) message = 'The file is too large. Please upload a photo or PDF of 8 MB or less.';
      if (res.status === 429) message = 'Too many uploads in a short time. Please wait a little and try again.';
      return { ok: res.ok && json.success !== false, status: res.status, data: json.data, message, errors: json.errors || null };
    } catch (e) {
      return { ok: false, status: 0, data: null, message: 'Network error. Please check your connection and try again.', errors: null };
    }
  }

  function todayYmd() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function formatDay(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd + 'T00:00:00+05:30');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }
  function sizeText(bytes) {
    if (!bytes) return '';
    return bytes > 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  /** Large phone photos are made smaller in the browser (max 2400 px) so the upload is quick */
  function shrinkImage(file) {
    return new Promise(resolve => {
      if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 2.5 * 1024 * 1024 || !window.HTMLCanvasElement) return resolve(file);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * scale);
          c.height = Math.round(img.naturalHeight * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(b => {
            URL.revokeObjectURL(url);
            if (!b || b.size >= file.size) return resolve(file);
            resolve(new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.86);
        } catch (e) { URL.revokeObjectURL(url); resolve(file); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // ---------------------------------------------------------------------------
  // The form (used in the sign-up form and on the account page)
  // ---------------------------------------------------------------------------
  let uid = 0;

  function fileBox(id, name, label, required, hint) {
    return '<div class="sp-ver-upload" data-upload="' + name + '">' +
      '<label class="sp-form-label-modern" for="' + id + '">' + esc(label) + (required ? ' <span class="sp-req">*</span>' : ' <small>(optional)</small>') + '</label>' +
      '<div class="sp-ver-drop">' +
        '<input type="file" id="' + id + '" data-file="' + name + '" accept="image/jpeg,image/png,.jpg,.jpeg,.png,application/pdf,.pdf">' +
        '<div class="sp-ver-drop-empty"><i class="fa fa-cloud-upload" aria-hidden="true"></i><strong>Choose a photo or PDF</strong><small>' + esc(hint || 'JPG, PNG or PDF · up to 8 MB · you can take a photo with your phone') + '</small></div>' +
        '<div class="sp-ver-drop-full" hidden></div>' +
      '</div>' +
      '<small class="sp-field-error" data-error-for="' + name + '"></small>' +
    '</div>';
  }

  function formHtml(p, opts) {
    const today = todayYmd();
    const pre = opts.prefill || {};
    const legendText = opts.legend || 'Special category (optional)';
    const helperText = opts.helper || 'If applicable, select a category to submit eligibility documents.';
    const helperId = p + 'helper';
    const switchHintId = p + 'switchHint';
    const choice = (value, suffix, icon, title, text) =>
      '<label class="sp-ver-choice" for="' + p + 'cat_' + suffix + '">' +
        '<input type="radio" id="' + p + 'cat_' + suffix + '" name="' + p + 'cat" value="' + value + '"' + ((opts.preset || '') === value ? ' checked' : '') + '>' +
        '<span>' +
          '<span class="sp-ver-choice-top"><i class="fa ' + icon + '" aria-hidden="true"></i><span class="sp-ver-radio-dot" aria-hidden="true"></span></span>' +
          '<strong>' + title + '</strong>' +
          (text ? '<small>' + text + '</small>' : '') +
        '</span>' +
      '</label>';
    return '<fieldset class="sp-ver-fieldset" aria-describedby="' + helperId + ' ' + switchHintId + '">' +
        '<legend class="sp-ver-legend">' + esc(legendText) + '</legend>' +
        '<div class="sp-ver-helper-row">' +
          '<p class="sp-ver-helper" id="' + helperId + '">' + esc(helperText) + '</p>' +
          '<button type="button" class="sp-ver-clear-btn" data-ver-clear hidden>Clear selection</button>' +
        '</div>' +
        '<div class="sp-ver-choices">' +
          choice('student', 'student', 'fa-graduation-cap', 'Student', 'College / institution ID') +
          choice('ex_servicemen', 'esm', 'fa-shield', 'Ex-serviceman / Defence', 'Army, Navy, Air Force…') +
        '</div>' +
        '<p class="sp-ver-switch-hint" id="' + switchHintId + '">Switching categories clears previously entered category details and uploaded documents.</p>' +
      '</fieldset>' +
      '<small class="sp-field-error" data-error-for="category"></small>' +
      '<div class="sp-ver-fields" data-fields hidden>' +
        '<div class="sp-ver-only-student" hidden>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="' + p + 'inst">College / institution name <span class="sp-req">*</span></label>' +
            '<input class="sp-form-input-modern" id="' + p + 'inst" data-name="institution_name" maxlength="150" autocomplete="organization" value="' + esc(pre.institution_name || '') + '" placeholder="e.g. Fergusson College, Pune">' +
            '<small class="sp-field-error" data-error-for="institution_name"></small></div>' +
        '</div>' +
        '<div class="sp-ver-only-esm" hidden>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="' + p + 'branch">Service <span class="sp-req">*</span></label>' +
            '<select class="sp-form-select-modern" id="' + p + 'branch" data-name="service_branch"><option value="">Choose…</option>' +
              BRANCHES.map(b => '<option' + (pre.service_branch === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') +
            '</select><small class="sp-field-error" data-error-for="service_branch"></small></div>' +
        '</div>' +
        '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="' + p + 'idno">ID number <small>(optional)</small></label>' +
          '<input class="sp-form-input-modern" id="' + p + 'idno" data-name="id_number" maxlength="60" value="' + esc(pre.id_number || '') + '" placeholder="As printed on your ID">' +
          '<small class="sp-field-error" data-error-for="id_number"></small></div>' +
        '<div class="sp-ver-uploads">' +
          fileBox(p + 'front', 'front', 'ID proof front', true) +
          fileBox(p + 'back', 'back', 'ID proof back', false, 'JPG, PNG or PDF · up to 8 MB · only if details continue on back') +
        '</div>' +
        '<div class="sp-ver-only-student" hidden>' +
          '<div class="sp-form-group-modern"><label class="sp-form-label-modern" for="' + p + 'exp">ID valid until <span class="sp-req">*</span></label>' +
            '<input class="sp-form-input-modern" type="date" id="' + p + 'exp" data-name="expiry_date" min="' + today + '" value="' + esc(pre.expiry_date && pre.expiry_date >= today ? pre.expiry_date : '') + '">' +
            '<small class="sp-field-hint">The expiry / valid-till date printed on your student ID. The student benefit is available until this date.</small>' +
            '<small class="sp-field-error" data-error-for="expiry_date"></small></div>' +
        '</div>' +
        '<div class="sp-ver-only-esm" hidden><p class="sp-ver-note"><i class="fa fa-info-circle" aria-hidden="true"></i> Upload your ESM identity card, service ID or discharge book. No expiry date is needed — the benefit stays, and we remind you every year to book your check-in.</p></div>' +
        '<p class="sp-ver-note"><i class="fa fa-lock" aria-hidden="true"></i> Your ID is stored privately and seen only by the SPOUZY admin for verification. Benefit eligibility starts only after admin approval; if something is unclear we tell you what to upload instead.</p>' +
      '</div>';
  }

  /**
   * Mount the form into `el`. Returns a controller:
   *   category(), validate() -> boolean (shows the errors), submit() -> API result, reset()
   */
  function mountForm(el, opts) {
    opts = opts || {};
    const p = 'spVer' + (++uid) + '_';
    el.innerHTML = formHtml(p, opts);
    const files = { front: null, back: null };
    const fieldsEl = el.querySelector('[data-fields]');
    const clearBtn = el.querySelector('[data-ver-clear]');
    const studentSections = el.querySelectorAll('.sp-ver-only-student');
    const esmSections = el.querySelectorAll('.sp-ver-only-esm');
    let prevCategory = opts.preset || '';

    function category() {
      const r = el.querySelector('input[name="' + p + 'cat"]:checked');
      return r ? r.value : '';
    }
    function setError(name, msg) {
      const e = el.querySelector('[data-error-for="' + name + '"]');
      if (e) e.textContent = msg || '';
    }
    function clearErrors() {
      el.querySelectorAll('[data-error-for]').forEach(e => { e.textContent = ''; });
      el.querySelectorAll('input, select, textarea').forEach(f => {
        if (typeof f.setCustomValidity === 'function') f.setCustomValidity('');
      });
    }
    function value(name) {
      const i = el.querySelector('[data-name="' + name + '"]');
      return i ? i.value.trim() : '';
    }
    function revokeFileUrl(full) {
      if (full && full.dataset.url) {
        URL.revokeObjectURL(full.dataset.url);
        delete full.dataset.url;
      }
    }
    function showFile(name) {
      const box = el.querySelector('[data-upload="' + name + '"]');
      if (!box) return;
      const empty = box.querySelector('.sp-ver-drop-empty');
      const full = box.querySelector('.sp-ver-drop-full');
      const f = files[name];
      revokeFileUrl(full);
      if (!f) { empty.hidden = false; full.hidden = true; full.innerHTML = ''; return; }
      let thumb = '<i class="fa fa-file-pdf-o sp-ver-pdf" aria-hidden="true"></i>';
      if (/^image\//.test(f.type)) {
        const url = URL.createObjectURL(f);
        full.dataset.url = url;
        thumb = '<img src="' + url + '" alt="Selected document preview">';
      }
      full.innerHTML = thumb +
        '<span><strong>' + esc(f.name) + '</strong><small>' + esc(sizeText(f.size)) + ' · Click or tap to replace</small></span>' +
        '<button type="button" class="sp-ver-remove" data-remove="' + name + '" aria-label="Remove ' + (name === 'front' ? 'ID proof front' : 'ID proof back') + '">&times;</button>';
      empty.hidden = true;
      full.hidden = false;
    }
    function clearCategoryState() {
      el.querySelectorAll('[data-name]').forEach(i => {
        i.value = '';
        if (typeof i.setCustomValidity === 'function') i.setCustomValidity('');
      });
      files.front = null;
      files.back = null;
      el.querySelectorAll('[data-file]').forEach(i => {
        i.value = '';
        if (typeof i.setCustomValidity === 'function') i.setCustomValidity('');
      });
      showFile('front');
      showFile('back');
      clearErrors();
    }
    function setSectionEnabled(section, enabled) {
      section.hidden = !enabled;
      section.querySelectorAll('input, select, textarea, button').forEach(f => {
        f.disabled = !enabled;
        if (!enabled) {
          f.required = false;
          f.removeAttribute('aria-required');
          if (typeof f.setCustomValidity === 'function') f.setCustomValidity('');
        }
      });
    }
    function sync() {
      const c = category();
      const hasCat = !!c;
      fieldsEl.hidden = !hasCat;
      if (clearBtn) clearBtn.hidden = !hasCat;
      el.classList.toggle('is-student', c === 'student');
      el.classList.toggle('is-esm', c === 'ex_servicemen');
      el.querySelectorAll('.sp-ver-choice').forEach(l => l.classList.toggle('is-checked', !!l.querySelector('input:checked')));

      if (!hasCat) {
        studentSections.forEach(s => setSectionEnabled(s, false));
        esmSections.forEach(s => setSectionEnabled(s, false));
        fieldsEl.querySelectorAll('input, select, textarea, button').forEach(f => {
          f.disabled = true;
          f.required = false;
          f.removeAttribute('aria-required');
          if (typeof f.setCustomValidity === 'function') f.setCustomValidity('');
        });
      } else {
        // Enable shared fields (id_number, front, back, remove buttons)
        fieldsEl.querySelectorAll('input, select, textarea, button').forEach(f => {
          f.disabled = false;
        });
        studentSections.forEach(s => setSectionEnabled(s, c === 'student'));
        esmSections.forEach(s => setSectionEnabled(s, c === 'ex_servicemen'));

        const inst = el.querySelector('[data-name="institution_name"]');
        const exp = el.querySelector('[data-name="expiry_date"]');
        const branch = el.querySelector('[data-name="service_branch"]');
        const idno = el.querySelector('[data-name="id_number"]');
        const frontIn = el.querySelector('[data-file="front"]');
        const backIn = el.querySelector('[data-file="back"]');

        if (inst) { inst.required = (c === 'student'); if (c === 'student') inst.setAttribute('aria-required', 'true'); else inst.removeAttribute('aria-required'); }
        if (exp) { exp.required = (c === 'student'); if (c === 'student') exp.setAttribute('aria-required', 'true'); else exp.removeAttribute('aria-required'); }
        if (branch) { branch.required = (c === 'ex_servicemen'); if (c === 'ex_servicemen') branch.setAttribute('aria-required', 'true'); else branch.removeAttribute('aria-required'); }
        if (idno) { idno.required = false; idno.removeAttribute('aria-required'); }
        if (frontIn) { frontIn.required = true; frontIn.setAttribute('aria-required', 'true'); }
        if (backIn) { backIn.required = false; backIn.removeAttribute('aria-required'); }
      }
      if (typeof opts.onChange === 'function') opts.onChange(c);
    }

    function resetSelection(focusRadio) {
      el.querySelectorAll('input[name="' + p + 'cat"]').forEach(r => { r.checked = false; });
      prevCategory = '';
      clearCategoryState();
      sync();
      if (focusRadio) {
        const firstRadio = el.querySelector('input[name="' + p + 'cat"]');
        if (firstRadio) firstRadio.focus();
      }
    }

    el.addEventListener('change', async e => {
      const t = e.target;
      if (t.name === p + 'cat') {
        const next = category();
        if (prevCategory && prevCategory !== next) {
          clearCategoryState();
        }
        prevCategory = next;
        setError('category', '');
        sync();
        return;
      }
      if (t.dataset && t.dataset.file) {
        const name = t.dataset.file;
        const f = t.files && t.files[0];
        t.value = '';
        if (!f) return;
        if (!TYPES.includes(f.type)) {
          setError(name, 'Please upload a JPG, PNG or PDF file.' + (/heic|heif/i.test(f.type + f.name) ? ' iPhone HEIC photos: take a screenshot of the photo or set the camera to "Most Compatible".' : ''));
          return;
        }
        const small = await shrinkImage(f);
        if (small.size > MAX_BYTES) {
          setError(name, 'This file is larger than 8 MB. Please upload a JPG, PNG or PDF of 8 MB or less.');
          return;
        }
        files[name] = small;
        setError(name, '');
        showFile(name);
        return;
      }
      if (t.dataset && t.dataset.name) setError(t.dataset.name, '');
    });
    el.addEventListener('input', e => { if (e.target.dataset && e.target.dataset.name) setError(e.target.dataset.name, ''); });
    el.addEventListener('click', e => {
      const clr = e.target.closest('[data-ver-clear]');
      if (clr) {
        e.preventDefault();
        resetSelection(true);
        return;
      }
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      e.preventDefault();
      const name = b.dataset.remove;
      files[name] = null;
      const fileIn = el.querySelector('[data-file="' + name + '"]');
      if (fileIn) {
        fileIn.value = '';
        if (typeof fileIn.setCustomValidity === 'function') fileIn.setCustomValidity('');
      }
      setError(name, '');
      showFile(name);
      if (fileIn) fileIn.focus();
    });

    function validate() {
      clearErrors();
      const c = category();
      const errors = {};
      if (!c) errors.category = 'Please choose Student or Ex-serviceman / Defence.';
      if (c === 'student') {
        if (value('institution_name').length < 3) errors.institution_name = 'Please enter the name of your college or institution.';
        const exp = value('expiry_date');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) errors.expiry_date = 'Please enter the date your student ID is valid until.';
        else if (exp < todayYmd()) errors.expiry_date = 'This date has passed. Please upload your current, valid student ID.';
      }
      if (c === 'ex_servicemen' && !value('service_branch')) errors.service_branch = 'Please choose your service.';
      if (c && !files.front) errors.front = 'Please upload a JPG, PNG or PDF of your ID proof front.';
      Object.keys(errors).forEach(k => setError(k, errors[k]));
      const first = Object.keys(errors)[0];
      if (first) {
        const target = el.querySelector('[data-name="' + first + '"], [data-file="' + first + '"], .sp-ver-choices input');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof target.focus === 'function') target.focus({ preventScroll: true });
        }
      }
      return !first;
    }

    async function submit() {
      const fd = new FormData();
      const c = category();
      if (!c) return { ok: false, status: 400, message: 'Please choose Student or Ex-serviceman / Defence.', errors: { category: 'Please choose one.' } };
      fd.append('category', c);
      fd.append('id_number', value('id_number'));
      if (c === 'student') {
        fd.append('institution_name', value('institution_name'));
        fd.append('expiry_date', value('expiry_date'));
      } else {
        fd.append('service_branch', value('service_branch'));
      }
      if (files.front) fd.append('front', files.front, files.front.name);
      if (files.back) fd.append('back', files.back, files.back.name);
      const r = await api('POST', '/customer/verification', fd);
      if (!r.ok && r.errors) Object.keys(r.errors).forEach(k => setError(k, r.errors[k]));
      return r;
    }

    sync();
    return { category, validate, submit, reset: () => resetSelection(false), el };
  }

  // ---------------------------------------------------------------------------
  // Sign-up form
  // ---------------------------------------------------------------------------
  function initSignup() {
    const form = document.getElementById('spSignupForm');
    if (!form) return null;
    let box = document.getElementById('spBenefitBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'spBenefitBox';
      const consent = form.querySelector('.sp-auth-consent');
      form.insertBefore(box, consent || form.querySelector('button[type="submit"]'));
    }
    box.className = 'sp-ver-box sp-ver-box-signup';
    const ctl = mountForm(box, {
      preset: '',
      legend: 'Special category (optional)',
      helper: 'If applicable, select a category to submit eligibility documents.'
    });
    return {
      category: () => ctl.category(),
      validate: () => ctl.validate(),
      submit: () => ctl.submit(),
      reset: () => ctl.reset()
    };
  }

  // ---------------------------------------------------------------------------
  // Account page section
  // ---------------------------------------------------------------------------
  function benefitCard(b) {
    const isStudent = b.category === 'student';
    let html = '<div class="sp-ver-card is-ok"><div class="sp-ver-card-icon"><i class="fa ' + (isStudent ? 'fa-graduation-cap' : 'fa-shield') + '"></i></div><div>' +
      '<h3>' + esc(b.label || 'Benefit') + ' active</h3>' +
      '<p>Your ID is verified. You can book your <strong>free consultation from today</strong> — no 2-month wait. One consultation at a time: the next one can be booked after the current one has taken place.</p>' +
      '<p class="sp-ver-meta">' + (b.valid_until ? 'Valid until <strong>' + esc(b.valid_until_text || formatDay(b.valid_until)) + '</strong> (the date on your student ID).' : 'No expiry.') +
        (b.category === 'ex_servicemen' && b.last_consultation ? ' Last consultation: ' + esc(formatDay(b.last_consultation)) + '.' : '') + '</p>';
    if (b.reminder_due) html += '<p class="sp-ver-reminder"><i class="fa fa-bell"></i> It has been a year since your last consultation. This is a good time for your yearly check-in — your free consultation is ready to book.</p>';
    html += '<div class="sp-shop-actions"><a class="sp-cta-primary" href="book-appoinment.htm?type=free"><span>Book my free consultation</span><span class="arrow">↗</span></a></div></div></div>';
    return html;
  }

  function latestFacts(v) {
    const parts = [esc(v.category_label)];
    if (v.institution_name) parts.push(esc(v.institution_name));
    if (v.service_branch) parts.push(esc(v.service_branch));
    if (v.expiry_text) parts.push('valid until ' + esc(v.expiry_text));
    if (v.files && v.files.length) parts.push(v.files.length + (v.files.length === 1 ? ' file' : ' files'));
    return '<p class="sp-ver-meta">' + parts.join(' · ') + '</p>';
  }

  async function mountAccount(el) {
    if (!el || el.dataset.mounted === '1') return;
    el.dataset.mounted = '1';
    let flash = null;
    const saved = storage(s => s.getItem(NOTICE_KEY));
    if (saved) {
      storage(s => s.removeItem(NOTICE_KEY));
      try { flash = JSON.parse(saved); } catch (e) { flash = null; }
    }

    async function render() {
      const r = await api('GET', '/customer/verification');
      if (!r.ok) {
        el.innerHTML = '<p class="sp-form-msg is-error">' + esc(r.message || 'Could not load your ID verification.') + '</p>';
        return;
      }
      const d = r.data || {};
      const v = d.latest;
      const b = d.benefit || {};
      let html = '';
      if (flash && flash.type === 'sent') html += '<p class="sp-form-msg is-success"><i class="fa fa-check-circle"></i> Thank you — your ID proof has been received. We will check it and let you know here.</p>';
      if (flash && flash.type === 'error') html += '<p class="sp-form-msg is-error">Your account was created, but the ID proof could not be uploaded: ' + esc(flash.message || 'please try again') + ' Please upload it below.</p>';
      flash = null;

      let showForm = false;
      let formIntro = '';
      if (b.active) html += benefitCard(b);

      if (v && v.status === 'pending') {
        html += '<div class="sp-ver-card is-wait"><div class="sp-ver-card-icon"><i class="fa fa-clock-o"></i></div><div>' +
          '<h3>Your ID is being checked</h3>' +
          '<p>Our team is checking the ID proof you uploaded' + (v.submitted_at ? ' on ' + esc(new Date(v.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })) : '') + '. ' +
          (b.active ? 'Your current benefit stays active meanwhile.' : 'Until it is approved, free consultations open 2 months ahead; paid consultations can be booked any time.') + '</p>' +
          latestFacts(v) + '</div></div>';
      } else if (v && v.status === 'rejected') {
        html += '<div class="sp-ver-card is-fail"><div class="sp-ver-card-icon"><i class="fa fa-exclamation-circle"></i></div><div>' +
          '<h3>We could not verify your ID</h3>' +
          '<p class="sp-ver-admin-msg"><span>Message from the SPOUZY team</span>' + esc(v.admin_message || 'Please upload a clear photo of a valid ID.') + '</p>' +
          latestFacts(v) + '<p>Please follow the note above and upload your ID again.</p></div></div>';
        showForm = true;
        formIntro = 'Upload your ID again';
      } else if (!b.active && b.expired_on) {
        html += '<div class="sp-ver-card is-expired"><div class="sp-ver-card-icon"><i class="fa fa-calendar"></i></div><div>' +
          '<h3>Your student ID has expired</h3>' +
          '<p>Your ID was valid until ' + esc(formatDay(b.expired_on)) + ', so the free consultation from today is no longer available. You can still book a paid consultation any time, or a free consultation from 2 months ahead. Still studying? Upload your new ID below.</p></div></div>';
        showForm = true;
        formIntro = 'Upload your new ID';
      } else if (!v) {
        html += '<div class="sp-ver-card is-intro"><div class="sp-ver-card-icon"><i class="fa fa-certificate"></i></div><div>' +
          '<h3>Students and ex-servicemen / defence</h3>' +
          '<p>Upload your college ID or ex-servicemen / defence ID. Once our team verifies it you can book your <strong>free consultation straight away</strong>, instead of from 2 months ahead.</p></div></div>';
        showForm = true;
        formIntro = 'Verify my ID';
      } else if (v && v.status === 'approved' && b.active && b.category === 'student') {
        html += '<p class="sp-ver-small">Got a new student ID? <button type="button" class="sp-ver-linkbtn" data-ver-new>Upload it here</button> to update the valid-until date.</p>';
      }

      html += '<div class="sp-ver-form-wrap" data-ver-wrap' + (showForm ? '' : ' hidden') + '>' +
        (formIntro ? '<h3 class="sp-account-sub">' + esc(formIntro) + '</h3>' : '') +
        '<div data-ver-form></div>' +
        '<p class="sp-form-msg" data-ver-msg hidden></p>' +
        '<button type="button" class="sp-cta-primary" data-ver-submit><span>Send for verification</span><span class="arrow">↗</span></button>' +
      '</div>';
      el.innerHTML = html;

      const wrap = el.querySelector('[data-ver-wrap]');
      const preset = v && v.status === 'rejected' ? v.category : (b.expired_on ? 'student' : (b.category || ''));
      const ctl = mountForm(el.querySelector('[data-ver-form]'), {
        preset,
        prefill: v || {},
        legend: 'Eligibility category',
        helper: 'Select Student or Ex-serviceman / Defence to upload your eligibility documents.'
      });
      const newBtn = el.querySelector('[data-ver-new]');
      if (newBtn) newBtn.addEventListener('click', () => { wrap.hidden = false; newBtn.closest('p').hidden = true; });
      el.querySelector('[data-ver-submit]').addEventListener('click', async e => {
        const btn = e.currentTarget;
        const msg = el.querySelector('[data-ver-msg]');
        msg.hidden = true;
        if (!ctl.validate()) return;
        btn.disabled = true;
        const label = btn.innerHTML;
        btn.innerHTML = '<span><i class="fa fa-spinner fa-spin"></i> Uploading…</span>';
        const res = await ctl.submit();
        btn.disabled = false;
        btn.innerHTML = label;
        if (res.ok) {
          flash = { type: 'sent' };
          await render();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        msg.hidden = false;
        msg.className = 'sp-form-msg is-error';
        msg.textContent = res.message || 'Could not upload your ID. Please try again.';
      });
    }

    await render();
    if (location.hash === '#id-verification') {
      setTimeout(() => { const sec = document.getElementById('id-verification'); if (sec) sec.scrollIntoView({ behavior: 'smooth' }); }, 200);
    }
  }

  // ---------------------------------------------------------------------------
  const Verify = { signup: null, mountForm, mountAccount, NOTICE_KEY };
  window.SpouzyVerify = Verify;

  function boot() {
    Verify.signup = initSignup();
    const mine = document.getElementById('spMyVerification');
    if (mine) mountAccount(mine);
    document.addEventListener('spouzy:account-ready', () => mountAccount(document.getElementById('spMyVerification')));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
