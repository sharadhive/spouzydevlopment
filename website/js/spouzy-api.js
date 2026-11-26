/**
 * SPOUZY Public Client API
 * One place for every call the public website makes to the backend.
 *
 * Exposes window.SpouzyApi. Every submit function resolves to
 *   { ok: true,  referenceNo, duplicate, data, message }
 *   { ok: false, status, message, errors }
 * and never throws, so the page scripts can always show a clear result.
 *
 * Form behaviour (validation, review modals, WhatsApp hand-off) lives in
 * spouzy-modern.js, which calls these functions when the visitor submits.
 */
(function () {
  'use strict';

  const API_BASE = '/api';

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)spouzy_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function val(id) {
    const el = document.getElementById(id);
    return el && typeof el.value === 'string' ? el.value.trim() : '';
  }

  function checked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }

  async function call(method, path, body) {
    const headers = { 'Accept': 'application/json' };
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;

    const options = { method, headers, credentials: 'same-origin' };
    if (body instanceof FormData) {
      options.body = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(API_BASE + path, options);
    } catch (e) {
      return { ok: false, status: 0, message: 'We could not reach the SPOUZY server. Please check your internet connection and try again.' };
    }

    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }

    if (res.ok && json && json.success !== false) {
      const data = json.data !== undefined ? json.data : json;
      return {
        ok: true,
        status: res.status,
        data,
        duplicate: !!json.duplicate,
        message: json.message || '',
        referenceNo: data && data.referenceNo ? data.referenceNo : undefined
      };
    }

    let message = (json && json.message) || 'Something went wrong. Please try again.';
    if (res.status === 429) message = 'Too many submissions from this connection. Please wait a little and try again, or contact us on WhatsApp.';
    if (res.status === 413) message = 'Your files are too large. Each file must be 10 MB or smaller.';
    return { ok: false, status: res.status, message, errors: (json && json.errors) || null, code: (json && json.code) || null };
  }

  // ---------------------------------------------------------------------------
  // Doctor & Counsellor applications (join-doctor.htm / join-counsellor.htm)
  // ---------------------------------------------------------------------------
  function submitClinical({ role, files = {}, signatureBlob = null }) {
    const fd = new FormData();
    fd.append('role_type', role || 'doctor');
    fd.append('title', val('spTitle'));
    fd.append('first_name', val('spFirstName'));
    fd.append('last_name', val('spLastName'));
    fd.append('gender', val('spGender'));
    fd.append('dob', val('spDob'));
    fd.append('mobile', val('spMobile'));
    fd.append('whatsapp', val('spWhatsapp') || val('spMobile'));
    fd.append('email', val('spEmail'));

    fd.append('practice_status', val('spPracticeStatus'));
    fd.append('experience_years', val('spExperienceYears'));
    fd.append('institution_name', val('spInstitutionName'));
    fd.append('affiliations', val('spAffiliations'));
    fd.append('specialisation', val('spSpecialisation'));
    fd.append('objective', val('spObjective'));

    let primaryQual = val('spPrimaryQual');
    if (primaryQual === 'Other' && val('spPrimaryQualOther')) primaryQual = 'Other: ' + val('spPrimaryQualOther');
    fd.append('primary_qualification', primaryQual);
    fd.append('primary_college', val('spPrimaryCollege'));
    fd.append('primary_year', val('spPrimaryYear'));
    fd.append('primary_grade', val('spPrimaryGrade'));

    const pgQual = val('spPgQual');
    fd.append('pg_qualification', pgQual === 'None' ? '' : pgQual);
    fd.append('pg_college', val('spPgCollege'));
    fd.append('pg_year', val('spPgYear'));
    fd.append('pg_grade', val('spPgGrade'));

    const naReg = checked('spNaRegCheck');
    fd.append('council_name', naReg ? 'Not Applicable' : val('spCouncilSelect'));
    fd.append('registration_number', naReg ? 'Not Applicable' : val('spRegNum'));
    fd.append('state_jurisdiction', naReg ? 'N/A' : val('spRegState'));
    fd.append('registration_year', naReg ? 'N/A' : val('spRegYear'));
    fd.append('valid_until', naReg ? 'N/A' : val('spRegValid'));

    const workMode = val('spWorkMode');
    fd.append('consultation_modes', JSON.stringify(workMode ? [workMode] : []));
    fd.append('preferred_hours_from', val('spTimeFrom'));
    fd.append('preferred_hours_to', val('spTimeTo'));

    fd.append('declaration_agreed', checked('spDeclarationCheck') ? 'true' : 'false');
    fd.append('declaration_date', val('spDeclDate') || new Date().toISOString().slice(0, 10));
    fd.append('signed_name', val('spSignName'));
    fd.append('typed_signature', val('spTypedSignature'));

    // Files come from the page's in-memory state (covers click AND drag-and-drop)
    if (files.photo) fd.append('photo', files.photo);
    if (files.primaryCert) fd.append('primary_cert', files.primaryCert);
    if (files.pgCert) fd.append('pg_cert', files.pgCert);
    if (files.councilCert) fd.append('council_cert', files.councilCert);

    // Additional qualifications + their certificates
    const additional = [];
    let certIndex = 0;
    document.querySelectorAll('.sp-qual-card').forEach(card => {
      const degree = (card.querySelector('.sp-add-degree')?.value || '').trim();
      const college = (card.querySelector('.sp-add-college')?.value || '').trim();
      if (!degree && !college) return;
      const qid = card.getAttribute('data-qual-id');
      const file = files['addCert_' + qid];
      let idx = null;
      if (file && certIndex < 5) {
        fd.append('additional_certs', file);
        idx = certIndex++;
      }
      additional.push({
        degree,
        college,
        year: (card.querySelector('.sp-add-year')?.value || '').trim(),
        grade: (card.querySelector('.sp-add-grade')?.value || '').trim(),
        cert_index: idx
      });
    });
    fd.append('additional_qualifications', JSON.stringify(additional));

    if (signatureBlob) fd.append('signature_image', signatureBlob, 'signature.png');

    return call('POST', '/clinical-applications', fd);
  }

  // ---------------------------------------------------------------------------
  // Careers (careers.htm)
  // ---------------------------------------------------------------------------
  function submitCareer({ resume }) {
    const fd = new FormData();
    const roleSelect = document.getElementById('spCareerRole');
    const opt = roleSelect && roleSelect.selectedIndex >= 0 ? roleSelect.options[roleSelect.selectedIndex] : null;
    fd.append('role_title', val('spCareerRole'));
    if (opt && opt.getAttribute('data-opening-id')) fd.append('career_opening_id', opt.getAttribute('data-opening-id'));
    fd.append('full_name', val('spCareerFullName'));
    fd.append('email', val('spCareerEmail'));
    const mobileCode = val('spCareerMobileCode') || '+91';
    const waCode = val('spCareerWaCode') || mobileCode;
    const mobile = val('spCareerMobile').replace(/[^0-9]/g, '');
    const wa = (val('spCareerWhatsapp') || val('spCareerMobile')).replace(/[^0-9]/g, '');
    fd.append('mobile', mobile ? mobileCode + ' ' + mobile : '');
    fd.append('whatsapp', wa ? waCode + ' ' + wa : '');
    fd.append('city', val('spCareerCity'));
    fd.append('experience_level', val('spCareerExp'));
    fd.append('current_role', val('spCareerCurrentRole'));
    fd.append('highest_qualification', val('spCareerHighestQual'));
    fd.append('skills', val('spCareerSkills'));
    fd.append('portfolio_url', val('spCareerPortfolio'));
    fd.append('notice_period', val('spCareerNotice'));
    fd.append('expected_compensation', val('spCareerExpectedComp'));
    fd.append('statement_of_purpose', val('spCareerWhy'));
    fd.append('consent', checked('spCareerConsent') ? 'true' : 'false');
    if (resume) fd.append('resume', resume);
    return call('POST', '/careers/applications', fd);
  }

  async function getOpenings() {
    return call('GET', '/careers/openings');
  }

  // Fill the careers role dropdown from the openings managed in the admin panel
  async function initCareerOpenings() {
    const select = document.getElementById('spCareerRole');
    if (!select) return;
    const res = await getOpenings();
    if (!res.ok || !Array.isArray(res.data) || !res.data.length) return; // keep the built-in options
    const current = select.value;
    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (placeholder) select.appendChild(placeholder);
    res.data.forEach(op => {
      const o = document.createElement('option');
      o.value = op.title;
      o.textContent = op.department ? `${op.title} (${op.department})` : op.title;
      o.setAttribute('data-opening-id', op.id);
      select.appendChild(o);
    });
    if (current && Array.from(select.options).some(o => o.value === current)) select.value = current;
  }

  // ---------------------------------------------------------------------------
  // Enquiries (contact page, floating widget)
  // ---------------------------------------------------------------------------
  function submitEnquiry(payload) {
    return call('POST', '/enquiries', payload);
  }

  // ---------------------------------------------------------------------------
  // Booking & payments (book-appoinment.htm)
  // ---------------------------------------------------------------------------
  let bookingConfigPromise = null;
  function getBookingConfig(refresh) {
    if (refresh) bookingConfigPromise = null; // e.g. after logging in (student / ex-servicemen benefit, current booking)
    if (!bookingConfigPromise) {
      bookingConfigPromise = call('GET', '/scheduling/config').then(r => {
        if (!r.ok) bookingConfigPromise = null; // allow retry later
        return r;
      });
    }
    return bookingConfigPromise;
  }

  function getServices() {
    return call('GET', '/scheduling/services');
  }

  function getPractitioners(serviceSlug) {
    return call('GET', '/scheduling/practitioners' + (serviceSlug ? '?serviceSlug=' + encodeURIComponent(serviceSlug) : ''));
  }

  function getAvailability({ date, duration, serviceSlug, practitionerId, bookingType }) {
    const q = new URLSearchParams({ date, duration: String(duration || 30), bookingType: bookingType || 'paid' });
    if (serviceSlug) q.set('serviceSlug', serviceSlug);
    if (practitionerId && practitionerId !== 'any') q.set('practitionerId', practitionerId);
    return call('GET', '/scheduling/availability?' + q.toString());
  }

  function bookAppointment(payload) {
    return call('POST', '/appointments', payload);
  }

  function createPaymentOrder(appointmentReference) {
    return call('POST', '/payments/create-order', { appointmentReference });
  }

  function verifyPayment(payload) {
    return call('POST', '/payments/verify', payload);
  }

  let razorpayPromise = null;
  function loadRazorpay(src) {
    if (window.Razorpay) return Promise.resolve(true);
    if (!razorpayPromise) {
      razorpayPromise = new Promise(resolve => {
        const s = document.createElement('script');
        s.src = src || 'https://checkout.razorpay.com/v1/checkout.js';
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => { razorpayPromise = null; resolve(false); };
        document.head.appendChild(s);
      });
    }
    return razorpayPromise;
  }

  // ---------------------------------------------------------------------------
  // Visitor questions & stories (faq.htm, testimonials-policy.htm)
  // ---------------------------------------------------------------------------
  function askQuestion(payload) {
    return call('POST', '/content/faqs/ask', payload);
  }

  function submitStory(payload) {
    return call('POST', '/content/stories/submit', payload);
  }

  function showFormResult(form, type, html) {
    let box = form.querySelector('.sp-api-banner');
    if (!box) {
      box = document.createElement('div');
      box.className = 'sp-api-banner';
      box.setAttribute('role', type === 'error' ? 'alert' : 'status');
      form.prepend(box);
    }
    const ok = type === 'success';
    box.style.cssText = 'margin:0 0 16px 0;padding:14px 16px;border-radius:8px;font-size:14px;line-height:1.55;' +
      (ok ? 'background:#e8f5e9;border-left:4px solid #2e7d32;color:#1b5e20;' : 'background:#ffebee;border-left:4px solid #c62828;color:#8e1b1b;');
    box.innerHTML = html;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function errorList(res) {
    const errs = res.errors ? Object.values(res.errors) : [];
    return errs.length ? '<ul style="margin:6px 0 0 18px;">' + errs.map(e => '<li>' + escapeHtml(e) + '</li>').join('') + '</ul>' : '';
  }

  function wireSimpleForm(formId, buildPayload, sendFn, successHtml) {
    const form = document.getElementById(formId);
    if (!form) return;
    let busy = false;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (busy) return;
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
      const btn = form.querySelector('button[type="submit"]');
      const original = btn ? btn.innerHTML : '';
      busy = true;
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Sending...'; }
      const res = await sendFn(buildPayload(form));
      busy = false;
      if (btn) { btn.disabled = false; btn.innerHTML = original; }
      if (res.ok) {
        showFormResult(form, 'success', successHtml);
        form.reset();
      } else {
        showFormResult(form, 'error', '<strong>' + escapeHtml(res.message) + '</strong>' + errorList(res));
      }
    });
  }

  function initFaqAndStoryForms() {
    wireSimpleForm('spAskQuestionForm', form => ({
      question: form.querySelector('[name="question"]')?.value.trim() || '',
      category: form.querySelector('[name="category"]')?.value || 'General',
      submitter_name: form.querySelector('[name="name"]')?.value.trim() || '',
      submitter_email: form.querySelector('[name="email"]')?.value.trim() || '',
      consent: !!form.querySelector('[name="consent"]')?.checked
    }), askQuestion, '<strong>Thank you.</strong> Your question has been sent to our clinical team. Answered questions are added to this page; your email is never published.');

    wireSimpleForm('spSubmitStoryForm', form => {
      const name = form.querySelector('[name="display_name"]')?.value.trim() || '';
      return {
        story_text: form.querySelector('[name="story_text"]')?.value.trim() || '',
        display_name: name,
        is_anonymous: !name,
        private_email: form.querySelector('[name="private_email"]')?.value.trim() || '',
        private_phone: form.querySelector('[name="private_phone"]')?.value.trim() || '',
        consent: !!form.querySelector('[name="publish_consent"]')?.checked
      };
    }, submitStory, '<strong>Thank you for sharing.</strong> Our team reviews every story before it is published. Your contact details stay private.');
  }

  window.SpouzyApi = {
    submitClinical,
    submitCareer,
    getOpenings,
    submitEnquiry,
    getBookingConfig,
    getServices,
    getPractitioners,
    getAvailability,
    bookAppointment,
    createPaymentOrder,
    verifyPayment,
    loadRazorpay,
    askQuestion,
    submitStory
  };

  document.addEventListener('DOMContentLoaded', function () {
    initCareerOpenings();
    initFaqAndStoryForms();
  });
})();
