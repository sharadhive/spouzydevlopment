/**
 * SPOUZY Automated Integration Test Suite
 * Tests full lifecycle: Migrations, Idempotent Seeds, Auth, RBAC, File Security,
 * Form Submissions, Scheduling Overlaps, Payments, Webhooks, and CSV Sanitization.
 */

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'spouzy_test';
process.env.PORT = '5001';

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert');

// Load environment & models
const config = require('../src/config/environment');
const {
  sequelize,
  User,
  Role,
  Session,
  Enquiry,
  ClinicalApplication,
  CareerOpening,
  CareerApplication,
  Appointment,
  MediaAsset,
  PaymentGatewayConfig,
  PaymentOrder,
  PaymentTransaction
} = require('../src/models');
const app = require('../src/app');
const { hashPassword, sanitizeCsvValue } = require('../src/config/security');
const { runMigrations } = require('../src/scripts/db-migrate');
const { runSeeds } = require('../src/scripts/db-seed');
const { createDatabase } = require('../src/scripts/db-create');
const schedulingService = require('../src/services/scheduling.service');
const appointmentService = require('../src/services/appointment.service');
const paymentService = require('../src/services/payment.service');
const uploadService = require('../src/services/upload.service');

let server;
let baseUrl = 'http://127.0.0.1:5001';
let adminToken = '';
let adminUser = null;
let testPhotoAssetId = null;
let testCouncilCertAssetId = null;
let testResumeAssetId = null;

const results = [];

function recordTest(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} : ${name} ${detail ? '(' + detail + ')' : ''}`);
}

async function requestApi(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        postData = body;
      } else {
        postData = JSON.stringify(body);
        if (!options.headers['Content-Type']) {
          options.headers['Content-Type'] = 'application/json';
        }
      }
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('   STARTING SPOUZY AUTOMATED INTEGRATION TEST SUITE   ');
  console.log('======================================================\n');

  try {
    // -----------------------------------------------------------------------
    // STEP 1: Database Setup & Migration Test
    // -----------------------------------------------------------------------
    console.log('--- Phase 1: Database Setup & Migrations ---');
    await createDatabase('spouzy_test');
    await sequelize.authenticate();
    const migrated = await runMigrations();
    recordTest('Database creation and migrations', true, `${migrated} migrations applied`);

    // -----------------------------------------------------------------------
    // STEP 2: Seeding Idempotency Test (Run Twice)
    // -----------------------------------------------------------------------
    console.log('--- Phase 2: Seeding Idempotency ---');
    const seed1 = await runSeeds();
    const seed2 = await runSeeds(); // Second run must succeed cleanly without duplicate key error
    recordTest('Seeder idempotency (runs twice cleanly)', seed1 && seed2);

    // Ensure Admin User Exists
    const adminRole = await Role.findOne({ where: { slug: 'admin' } });
    let admin = await User.findOne({ where: { email: 'admin@spouzy.com' } });
    const password_hash = await hashPassword('AdminPass123!');
    if (!admin) {
      admin = await User.create({
        first_name: 'PSG',
        last_name: 'Administrator',
        email: 'admin@spouzy.com',
        password_hash,
        role_id: adminRole.id,
        is_active: true
      });
    } else {
      await admin.update({ password_hash, is_active: true });
    }
    adminUser = admin;

    // Start Test Server
    server = app.listen(5001);
    await new Promise(r => setTimeout(r, 600));

    // -----------------------------------------------------------------------
    // STEP 3: Admin Authentication & Session Issuance
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 3: Authentication & Security ---');
    const loginRes = await requestApi('POST', '/api/auth/login', {
      email: 'admin@spouzy.com',
      password: 'AdminPass123!'
    });

    const loginSuccess = loginRes.status === 200 && loginRes.data.success && loginRes.data.token;
    if (loginSuccess) {
      adminToken = loginRes.data.token;
    }
    recordTest('Admin login and session token issuance', loginSuccess);

    // -----------------------------------------------------------------------
    // STEP 4: Invalid Password Rejection
    // -----------------------------------------------------------------------
    const badLoginRes = await requestApi('POST', '/api/auth/login', {
      email: 'admin@spouzy.com',
      password: 'WrongPassword999'
    });
    recordTest('Invalid credentials rejection (401)', badLoginRes.status === 401);

    // -----------------------------------------------------------------------
    // STEP 5: Protected Route Access & Session Validation
    // -----------------------------------------------------------------------
    const meRes = await requestApi('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    recordTest('Session authentication via Bearer token', meRes.status === 200 && meRes.data.user.email === 'admin@spouzy.com');

    // -----------------------------------------------------------------------
    // STEP 6: RBAC & Permission Enforcement
    // -----------------------------------------------------------------------
    const unauthAdminRes = await requestApi('GET', '/api/admin/dashboard/stats');
    recordTest('Unauthenticated access to /api/admin rejected (401)', unauthAdminRes.status === 401);

    const authAdminRes = await requestApi('GET', '/api/admin/dashboard/stats', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    recordTest('Authorized admin access to dashboard stats (200)', authAdminRes.status === 200 && authAdminRes.data.success);

    // -----------------------------------------------------------------------
    // STEP 7: Private Media File Protection
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 4: File Storage & Private Downloads ---');
    // Store a private test file (JPEG magic bytes FF D8 FF)
    const testJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
    const privateAsset = await uploadService.storeFile({
      buffer: testJpgBuffer,
      originalName: 'confidential_doctor_cert.jpg',
      mimeType: 'image/jpeg',
      size: testJpgBuffer.length,
      isPrivate: true
    });
    testCouncilCertAssetId = privateAsset.id;

    const unauthDownload = await requestApi('GET', `/api/media/private/${privateAsset.id}`);
    recordTest('Unauthorized download of private document rejected (401)', unauthDownload.status === 401);

    const authDownload = await requestApi('GET', `/api/media/private/${privateAsset.id}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    recordTest('Authorized staff download of private document (200)', authDownload.status === 200);

    // -----------------------------------------------------------------------
    // STEP 8: Public Form Submissions
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 5: Public Submissions & Applications ---');
    // Start each run from empty submission tables (test database only)
    await sequelize.models.EnquiryNote.destroy({ where: {} });
    await Enquiry.destroy({ where: {} });
    await ClinicalApplication.destroy({ where: {} });
    await CareerApplication.destroy({ where: {} });
    await sequelize.models.VisitorQuestion.destroy({ where: {} });
    await sequelize.models.VisitorStory.destroy({ where: {} });
    const { todayIST, addDays, addMonths } = require('../src/config/time');
    const auth = { 'Authorization': `Bearer ${adminToken}` };
    const multipart = (fields, files = []) => {
      const boundary = '----spouzyTest' + crypto.randomBytes(6).toString('hex');
      const parts = [];
      for (const [k, v] of Object.entries(fields)) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
      }
      for (const f of files) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.type}\r\n\r\n`), f.buf, Buffer.from('\r\n'));
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      return { body: Buffer.concat(parts), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
    };
    const pdfBuf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const jpgBuf = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64, 7)]);

    // 8a. Enquiry (consent required)
    const enqNoConsent = await requestApi('POST', '/api/enquiries', {
      name: 'Pooja Verma', email: 'pooja.verma@example.com', phone: '+91 98765 43210',
      message: 'Looking for consultation on marital communication.'
    });
    recordTest('Enquiry without consent rejected (400)', enqNoConsent.status === 400 && !!enqNoConsent.data.errors?.consent);

    const enqRes = await requestApi('POST', '/api/enquiries', {
      name: 'Pooja Verma',
      email: 'pooja.verma@example.com',
      phone: '+91 98765 43210',
      whatsapp: '+91 98765 43210',
      subject: 'Couples Counselling',
      service_interest: 'Couples Counselling',
      preferred_contact_method: 'Discreet WhatsApp Message',
      message: 'Looking for consultation on marital communication.',
      consent: true,
      source: 'contact_page'
    });
    const enqSuccess = enqRes.status === 201 && enqRes.data.data.referenceNo.startsWith('SP-ENQ-');
    recordTest('Public Enquiry submission and reference generation', enqSuccess, enqRes.data?.data?.referenceNo);
    const savedEnq = enqSuccess ? await Enquiry.findByPk(enqRes.data.data.id) : null;
    recordTest('Enquiry stores contact method, service and consent in their own columns',
      !!savedEnq && savedEnq.preferred_contact_method === 'Discreet WhatsApp Message' && savedEnq.service_interest === 'Couples Counselling' && savedEnq.consent_agreed === true && !savedEnq.message.includes('Preferred Contact'));

    // 8b. Clinical Doctor Application (multipart with required files)
    const doctorFields = {
      role_type: 'doctor', title: 'Dr', first_name: 'Vikram', last_name: 'Mehta', gender: 'Male', dob: '1982-05-14',
      mobile: '+91 98200 11223', whatsapp: '+91 98200 11223', email: 'dr.vikram.mehta@example.com',
      practice_status: 'Private Practice & Visiting Consultant', experience_years: '16 years',
      institution_name: 'PSG Clinic & Lilavati Hospital', specialisation: 'Intimate Aesthetics & Reproductive Medicine',
      objective: 'To provide confidential intimate health care.', primary_qualification: 'MBBS',
      primary_college: 'KEM Hospital & Seth GS Medical College', primary_year: '2005', primary_grade: 'First Class',
      council_name: 'Maharashtra Medical Council', registration_number: 'MMC-2005-08-1429', state_jurisdiction: 'Maharashtra',
      registration_year: '2005', valid_until: '2030-12-31', preferred_hours_from: '10:00', preferred_hours_to: '18:00',
      consultation_modes: JSON.stringify(['Both Online & In-Person']), declaration_agreed: 'true',
      declaration_date: todayIST(), signed_name: 'Dr Vikram Mehta', typed_signature: 'Dr. Vikram Mehta',
      additional_qualifications: JSON.stringify([{ degree: 'MD', college: 'AIIMS', year: '2010', grade: 'A', cert_index: 0 }])
    };
    const docMissing = multipart(doctorFields, [{ name: 'photo', filename: 'photo.jpg', type: 'image/jpeg', buf: jpgBuf }]);
    const docMissingRes = await requestApi('POST', '/api/clinical-applications', docMissing.body, docMissing.headers);
    recordTest('Doctor application without certificates rejected (400)', docMissingRes.status === 400 && !!docMissingRes.data.errors?.primary_cert && !!docMissingRes.data.errors?.council_cert);

    const docForm = multipart(doctorFields, [
      { name: 'photo', filename: 'photo.jpg', type: 'image/jpeg', buf: jpgBuf },
      { name: 'primary_cert', filename: 'mbbs.pdf', type: 'application/pdf', buf: pdfBuf },
      { name: 'council_cert', filename: 'council.pdf', type: 'application/pdf', buf: pdfBuf },
      { name: 'additional_certs', filename: 'md.pdf', type: 'application/pdf', buf: pdfBuf }
    ]);
    const docAppRes = await requestApi('POST', '/api/clinical-applications', docForm.body, docForm.headers);
    const docSuccess = docAppRes.status === 201 && docAppRes.data.data.referenceNo.startsWith('SP-DOC-');
    recordTest('Doctor registration submission with SP-DOC reference', docSuccess, docAppRes.data?.data?.referenceNo);
    const savedDoc = docSuccess ? await ClinicalApplication.findByPk(docAppRes.data.data.id) : null;
    const addQ = savedDoc ? (typeof savedDoc.additional_qualifications === 'string' ? JSON.parse(savedDoc.additional_qualifications) : savedDoc.additional_qualifications) : [];
    const modes = savedDoc ? (typeof savedDoc.consultation_modes === 'string' ? JSON.parse(savedDoc.consultation_modes) : savedDoc.consultation_modes) : [];
    recordTest('Doctor application keeps work mode, declaration and additional certificate',
      !!savedDoc && modes[0] === 'Both Online & In-Person' && savedDoc.signed_name === 'Dr Vikram Mehta' && addQ.length === 1 && !!addQ[0].cert_asset_id);
    testPhotoAssetId = savedDoc ? savedDoc.council_cert_asset_id : null;

    const docDupRes = await requestApi('POST', '/api/clinical-applications', docForm.body, docForm.headers);
    recordTest('Repeated doctor submission returns the same reference (no duplicate)', docDupRes.status === 200 && docDupRes.data.duplicate === true && docDupRes.data.data.referenceNo === docAppRes.data?.data?.referenceNo);

    // 8c. Clinical Counsellor Application with "Not Applicable" Council (no council certificate needed)
    const couForm = multipart({
      role_type: 'counsellor', title: 'Ms', first_name: 'Ananya', last_name: 'Deshmukh', gender: 'Female', dob: '1990-02-02',
      mobile: '+91 98111 22334', whatsapp: '+91 98111 22334', email: 'ananya.deshmukh@example.com',
      practice_status: 'Independent', experience_years: '8 years', institution_name: 'Independent Practice',
      specialisation: 'Couples & Marital Therapy', objective: 'Support couples through change.',
      primary_qualification: 'M.A. Applied Psychology', primary_college: 'TISS Mumbai', primary_year: '2014', primary_grade: 'A',
      council_name: 'Not Applicable', registration_number: 'Not Applicable', state_jurisdiction: 'N/A',
      preferred_hours_from: '09:00', preferred_hours_to: '17:00', declaration_agreed: 'true', typed_signature: 'Ananya Deshmukh'
    }, [
      { name: 'photo', filename: 'photo.jpg', type: 'image/jpeg', buf: jpgBuf },
      { name: 'primary_cert', filename: 'ma.pdf', type: 'application/pdf', buf: pdfBuf }
    ]);
    const couAppRes = await requestApi('POST', '/api/clinical-applications', couForm.body, couForm.headers);
    const couSuccess = couAppRes.status === 201 && couAppRes.data.data.referenceNo.startsWith('SP-COU-');
    recordTest('Counsellor registration with NA accreditation and SP-COU reference', couSuccess, couAppRes.data?.data?.referenceNo);

    // 8d. Careers application through the URL the website uses
    const careerForm = multipart({
      role_title: 'Sales Coordinator', full_name: 'Neha Kapoor', email: 'neha.kapoor@example.com',
      mobile: '+91 98765 11111', whatsapp: '+91 98765 11111', city: 'Pune', experience_level: '1-3 years',
      skills: 'CRM, client coordination', notice_period: 'Immediate',
      statement_of_purpose: 'I would love to help couples reach the right specialist.', consent: 'true'
    }, [{ name: 'resume', filename: 'cv.pdf', type: 'application/pdf', buf: pdfBuf }]);
    const careerRes = await requestApi('POST', '/api/career-applications', careerForm.body, careerForm.headers);
    recordTest('Careers application saved with SP-CAR reference', careerRes.status === 201 && careerRes.data.data.referenceNo.startsWith('SP-CAR-'), careerRes.data?.data?.referenceNo);
    const savedCareer = careerRes.status === 201 ? await CareerApplication.findByPk(careerRes.data.data.id) : null;
    recordTest('Careers application linked to its opening', !!savedCareer && !!savedCareer.career_opening_id && savedCareer.consent_agreed === true);
    testResumeAssetId = savedCareer ? savedCareer.resume_asset_id : null;

    const careerBad = multipart({ role_title: 'Sales Coordinator' }, []);
    const careerBadRes = await requestApi('POST', '/api/careers/applications', careerBad.body, careerBad.headers);
    recordTest('Careers application without resume or details rejected (400)', careerBadRes.status === 400 && !!careerBadRes.data.errors?.resume);

    // 8e. Visitor question & story
    const qOld = await requestApi('POST', '/api/content/faqs/ask', { question: 'Short?', consent: true });
    const qOk = await requestApi('POST', '/api/content/faqs/ask', { question: 'How long does a typical counselling session last?', submitter_email: 'visitor@example.com', consent: true });
    recordTest('Visitor question validation and submission', qOld.status === 400 && qOk.status === 201);
    const sOk = await requestApi('POST', '/api/content/stories/submit', { story_text: 'We were close to separating, and the sessions helped us talk again without blame.', display_name: '', consent: true });
    recordTest('Stories need a customer login (old public form answers 401 login_required)', sOk.status === 401 && sOk.data.code === 'login_required');

    // -----------------------------------------------------------------------
    // STEP 9: Scheduling & Overlapping Interval Conflict Safety
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 6: Scheduling & Transactional Conflict Protection ---');
    await PaymentTransaction.destroy({ where: {}, force: true });
    await PaymentOrder.destroy({ where: {}, force: true });
    await sequelize.models.AppointmentStatusHistory.destroy({ where: {}, force: true });
    await Appointment.destroy({ where: {}, force: true });
    await PaymentGatewayConfig.destroy({ where: {}, force: true });
    // Booking tests below run as guests; the account requirement is tested in Phase 7e
    await sequelize.models.SiteSetting.upsert({ setting_key: 'booking_requires_account', setting_value: 'false', category: 'booking', is_public: true });
    require('../src/routes/appointment.routes').resetBookingSettingCache();

    const servicesRes = await requestApi('GET', '/api/scheduling/services');
    recordTest('Public services list loads (200)', servicesRes.status === 200 && servicesRes.data.data.length > 0);

    const counsellor = await sequelize.models.Practitioner.findOne({ where: { role_type: 'counsellor', is_active: true } });
    const testDate = addDays(todayIST(), 10);
    const baseBooking = {
      serviceSlug: 'couples-therapy', practitionerId: counsellor.id, bookingType: 'paid', date: testDate,
      consultationMode: 'virtual', clientName: 'Sunil Kumar', clientEmail: 'sunil.kumar@example.com',
      clientMobile: '+91 98100 99887', consent: true
    };

    const r1 = await appointmentService.createAppointment({ ...baseBooking, startTime: '10:00', duration: 30 });
    const appt1 = r1.appointment;
    recordTest('First appointment booked successfully (10:00–10:30)', !!appt1.reference_no && appt1.status === 'confirmed' && appt1.payment_status === 'pending', appt1.reference_no);

    let collisionBlocked = false;
    try {
      await appointmentService.createAppointment({ ...baseBooking, startTime: '10:00', duration: 30, clientEmail: 'conflict@example.com' });
    } catch (err) {
      collisionBlocked = err.status === 409;
    }
    recordTest('Exact overlapping slot booking blocked by transaction lock', collisionBlocked);

    let partialOverlapBlocked = false;
    try {
      await appointmentService.createAppointment({ ...baseBooking, startTime: '09:30', duration: 60, clientEmail: 'overlap@example.com' });
    } catch (err) {
      partialOverlapBlocked = err.status === 409;
    }
    recordTest('Partial interval overlap (09:30–10:30 vs 10:00–10:30) blocked', partialOverlapBlocked);

    const avail = await requestApi('GET', `/api/scheduling/availability?date=${testDate}&duration=30&serviceSlug=couples-therapy&practitionerId=${counsellor.id}`);
    const slot10 = avail.data.data.slots.find(sl => sl.start_time === '10:00');
    recordTest('Availability shows the booked slot as booked', avail.status === 200 && slot10 && slot10.status === 'booked');

    const labelRes = await requestApi('POST', '/api/appointments', { ...baseBooking, startTime: '10:00 AM – 10:30 AM', duration: 30 });
    recordTest('Slot label instead of HH:MM is rejected (400)', labelRes.status === 400 && !!labelRes.data.errors?.startTime);

    // Free consultations: only from 2 months ahead
    const freeEarly = await requestApi('POST', '/api/appointments', { ...baseBooking, bookingType: 'free', startTime: '11:00', duration: 30 });
    recordTest('Free consultation before the 2-month window rejected', freeEarly.status === 400 && !!freeEarly.data.errors?.date);
    const freeDate = addMonths(todayIST(), 2);
    const freeOk = await requestApi('POST', '/api/appointments', { ...baseBooking, bookingType: 'free', date: freeDate, startTime: '11:00', duration: 30 });
    recordTest('Free consultation from 2 months ahead booked without payment',
      freeOk.status === 201 && freeOk.data.data.bookingType === 'free' && freeOk.data.data.paymentStatus === 'not_required' && freeOk.data.data.status === 'confirmed');

    // Wrong practitioner type for a service
    const doctor = await sequelize.models.Practitioner.findOne({ where: { role_type: 'doctor', is_active: true } });
    const wrongType = await requestApi('POST', '/api/appointments', { ...baseBooking, practitionerId: doctor.id, startTime: '12:00', duration: 30 });
    recordTest('Booking a doctor for a counselling service rejected', wrongType.status === 400);

    const payCfgOff = await requestApi('GET', '/api/payments/config');
    recordTest('Payment shows "coming soon" while the gateway is not configured', payCfgOff.status === 200 && payCfgOff.data.data.enabled === false && /coming soon/i.test(payCfgOff.data.data.message));

    // -----------------------------------------------------------------------
    // STEP 10: Payment Driver & Signature Verification (Razorpay HMAC-SHA256)
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7: Payments & HMAC Signature Verification ---');
    await paymentService.saveGatewayConfig({
      provider: 'razorpay',
      mode: 'test',
      key_id: 'rzp_test_integrationKey123',
      secret: 'secret_test_signature_key_456',
      webhook_secret: 'webhook_test_secret_789',
      is_active: true
    });
    const payCfgOn = await requestApi('GET', '/api/payments/config');
    recordTest('Payment enabled once the gateway driver is configured', payCfgOn.data.data.enabled === true && payCfgOn.data.data.keyId === 'rzp_test_integrationKey123' && !JSON.stringify(payCfgOn.data).includes('secret_test'));

    const paidBook = await requestApi('POST', '/api/appointments', { ...baseBooking, startTime: '14:00', duration: 60 });
    recordTest('Paid booking with online payment is held for payment', paidBook.status === 201 && paidBook.data.data.status === 'hold' && paidBook.data.data.payment.onlineEnabled === true);

    const tamper = await requestApi('POST', '/api/payments/create-order', { appointmentReference: paidBook.data.data.referenceNo, amountMinorUnits: 100 });
    const orderRes = tamper.data.data || {};
    const heldAppt = await Appointment.findOne({ where: { reference_no: paidBook.data.data.referenceNo } });
    recordTest('Order amount comes from the appointment, not the browser', tamper.status === 200 && orderRes.amount === heldAppt.amount_minor_units && orderRes.amount > 100, orderRes.orderReference);

    const hmac = crypto.createHmac('sha256', 'secret_test_signature_key_456');
    hmac.update(`${orderRes.gatewayOrderId}|pay_testPaymentId_888`);
    const validSignature = hmac.digest('hex');

    let badVerifyPassed = false;
    const badVerify = await paymentService.verifyPaymentSignature({
      gatewayOrderId: orderRes.gatewayOrderId,
      gatewayPaymentId: 'pay_testPaymentId_888',
      gatewaySignature: 'bad_forged_signature_000',
      orderReference: orderRes.orderReference
    });
    badVerifyPassed = !badVerify.success;
    recordTest('Forged payment signature rejected', badVerifyPassed);

    // A rejected attempt marks the order failed; create a fresh order for the real payment
    const order2 = (await requestApi('POST', '/api/payments/create-order', { appointmentReference: paidBook.data.data.referenceNo })).data.data;
    const hmac2 = crypto.createHmac('sha256', 'secret_test_signature_key_456');
    hmac2.update(`${order2.gatewayOrderId}|pay_testPaymentId_889`);
    const verifySuccess = await requestApi('POST', '/api/payments/verify', {
      gatewayOrderId: order2.gatewayOrderId,
      gatewayPaymentId: 'pay_testPaymentId_889',
      gatewaySignature: hmac2.digest('hex'),
      orderReference: order2.orderReference
    });
    await heldAppt.reload();
    recordTest('Valid HMAC-SHA256 payment signature verified and appointment confirmed',
      verifySuccess.status === 200 && verifySuccess.data.success && heldAppt.status === 'confirmed' && heldAppt.payment_status === 'paid');

    // -----------------------------------------------------------------------
    // STEP 11: Webhook Signature Verification
    // -----------------------------------------------------------------------
    const paidBook2 = await requestApi('POST', '/api/appointments', { ...baseBooking, startTime: '16:00', duration: 30 });
    const order3 = (await requestApi('POST', '/api/payments/create-order', { appointmentReference: paidBook2.data.data.referenceNo })).data.data;
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_webhook_999', order_id: order3.gatewayOrderId, amount: order3.amount } } }
    });

    const webhookHmac = crypto.createHmac('sha256', 'webhook_test_secret_789');
    webhookHmac.update(Buffer.from(webhookPayload));
    const validWebhookSig = webhookHmac.digest('hex');

    const webhookResult = await paymentService.handleWebhook(Buffer.from(webhookPayload), validWebhookSig);
    const webhookAppt = await Appointment.findOne({ where: { reference_no: paidBook2.data.data.referenceNo } });
    recordTest('Valid webhook signature processed successfully', webhookResult.received === true && webhookAppt.payment_status === 'paid' && webhookAppt.status === 'confirmed');

    let badWebhookRejected = false;
    try {
      await paymentService.handleWebhook(Buffer.from(webhookPayload), 'bad_webhook_sig');
    } catch (e) {
      badWebhookRejected = true;
    }
    recordTest('Invalid webhook signature rejected with error', badWebhookRejected);

    // Expired hold is released by the cleanup job
    const paidBook3 = await requestApi('POST', '/api/appointments', { ...baseBooking, startTime: '18:00', duration: 30 });
    await Appointment.update({ hold_expires_at: new Date(Date.now() - 60000) }, { where: { reference_no: paidBook3.data.data.referenceNo } });
    const { cleanExpiredHolds } = require('../src/jobs/holdCleanup.job');
    await cleanExpiredHolds();
    const expired = await Appointment.findOne({ where: { reference_no: paidBook3.data.data.referenceNo } });
    recordTest('Expired payment hold released by the cleanup job', expired.status === 'cancelled');

    // -----------------------------------------------------------------------
    // STEP 11b: Staff roles, permissions, statuses, settings
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7b: Staff Roles & Admin Rules ---');
    const makeStaff = async (slug, email) => {
      const role = await Role.findOne({ where: { slug } });
      let u = await User.findOne({ where: { email } });
      const hash = await hashPassword('StaffPass123!');
      if (!u) u = await User.create({ first_name: slug, last_name: 'Tester', email, password_hash: hash, role_id: role.id, is_active: true });
      else await u.update({ password_hash: hash, role_id: role.id, is_active: true });
      const login = await requestApi('POST', '/api/auth/login', { email, password: 'StaffPass123!' });
      return { 'Authorization': `Bearer ${login.data.token}` };
    };
    const opsAuth = await makeStaff('operations_staff', 'ops.test@spouzy.test');
    const dirAuth = await makeStaff('clinical_director', 'director.test@spouzy.test');
    const edAuth = await makeStaff('content_editor', 'editor.test@spouzy.test');

    const opsClinical = await requestApi('GET', '/api/admin/clinical-applications', null, opsAuth);
    const opsCareers = await requestApi('GET', '/api/admin/career-applications', null, opsAuth);
    const opsUsers = await requestApi('GET', '/api/admin/users', null, opsAuth);
    recordTest('Operations Staff can open Clinical and Careers but not Users', opsClinical.status === 200 && opsCareers.status === 200 && opsUsers.status === 403);

    const dirBlocks = await requestApi('GET', '/api/admin/schedules/blocks', null, dirAuth);
    const dirQuestions = await requestApi('GET', '/api/admin/visitor-questions', null, dirAuth);
    const dirEnquiries = await requestApi('GET', '/api/admin/enquiries', null, dirAuth);
    recordTest('Clinical Director can open scheduling and moderation, not enquiries', dirBlocks.status === 200 && dirQuestions.status === 200 && dirEnquiries.status === 403);

    const edBlogs = await requestApi('GET', '/api/admin/blogs', null, edAuth);
    const edAppointments = await requestApi('GET', '/api/admin/appointments', null, edAuth);
    recordTest('Content Editor can manage blogs but not appointments', edBlogs.status === 200 && edAppointments.status === 403);

    const opsDoc = await requestApi('GET', `/api/media/private/${testPhotoAssetId}`, null, opsAuth);
    const dirDoc = await requestApi('GET', `/api/media/private/${testPhotoAssetId}`, null, dirAuth);
    const opsResume = await requestApi('GET', `/api/media/private/${testResumeAssetId}`, null, opsAuth);
    recordTest('Certificates: Clinical Director yes, Operations no; resumes: Operations yes', dirDoc.status === 200 && opsDoc.status === 403 && opsResume.status === 200);

    const ovOps = await requestApi('GET', '/api/admin/dashboard/overview', null, opsAuth);
    const ovEd = await requestApi('GET', '/api/admin/dashboard/overview', null, edAuth);
    const ovAdmin = await requestApi('GET', '/api/admin/dashboard/overview', null, auth);
    recordTest('Dashboard overview shows only the sections each role may see',
      ovOps.status === 200 && !!ovOps.data.data.sections.enquiries && !ovOps.data.data.sections.payments && !ovOps.data.data.sections.content &&
      ovEd.status === 200 && !ovEd.data.data.sections.enquiries && !!ovEd.data.data.sections.content &&
      ovAdmin.status === 200 && !!ovAdmin.data.data.sections.payments && ovAdmin.data.data.trend.length === 14);

    const customerRole = await Role.findOne({ where: { slug: 'customer' } });
    const badUser = await requestApi('POST', '/api/admin/users', { name: 'X Y', email: 'x@example.com', password: 'Password123', role_id: customerRole.id }, auth);
    const editorRole = await Role.findOne({ where: { slug: 'content_editor' } });
    const goodUser = await requestApi('POST', '/api/admin/users', { name: 'New Editor', email: `editor.${Date.now()}@spouzy.test`, password: 'Password123', role_id: editorRole.id }, auth);
    const createdUser = goodUser.status === 201 ? await User.findByPk(goodUser.data.data.id, { include: [{ model: Role, as: 'role' }] }) : null;
    recordTest('New staff user gets exactly the chosen role (never customer)', badUser.status === 400 && !!createdUser && createdUser.role.slug === 'content_editor');

    const badStatus = await requestApi('PATCH', `/api/admin/clinical-applications/${docAppRes.data?.data?.id}`, { status: 'shortlisted' }, auth);
    const goodStatus = await requestApi('PATCH', `/api/admin/clinical-applications/${docAppRes.data?.data?.id}`, { status: 'interview_scheduled' }, auth);
    recordTest('Application status must be one of the database values', badStatus.status === 400 && goodStatus.status === 200);

    const badSetting = await requestApi('PUT', '/api/admin/settings', { contact_whatsapp: '+91 1' }, auth);
    const goodSetting = await requestApi('PUT', '/api/admin/settings', { announcement_text: 'Confidential care since 2004.', whatsapp_number: '+91 85919 45055' }, auth);
    const publicSettings = await requestApi('GET', '/api/content/settings');
    recordTest('Settings accept only known keys and reach the public API',
      badSetting.status === 400 && goodSetting.status === 200 && publicSettings.data.data.announcement_text === 'Confidential care since 2004.');

    // Cookie-authenticated admin writes need the CSRF header
    const cookieLogin = await requestApi('POST', '/api/auth/login', { email: 'admin@spouzy.com', password: 'AdminPass123!' });
    const sessionCookie = (cookieLogin.headers['set-cookie'] || []).map(c => c.split(';')[0]).find(c => c.startsWith('spouzy_session='));
    const csrfNo = await requestApi('PUT', '/api/admin/settings', { announcement_text: 'x' }, { Cookie: `${sessionCookie}; spouzy_csrf=abc` });
    const csrfYes = await requestApi('PUT', '/api/admin/settings', { announcement_text: 'Confidential care since 2004.' }, { Cookie: `${sessionCookie}; spouzy_csrf=abc`, 'X-CSRF-Token': 'abc' });
    recordTest('Admin cookie session writes require the CSRF token', csrfNo.status === 403 && csrfYes.status === 200);

    // -----------------------------------------------------------------------
    // STEP 11b: Admin content tools (banner photo upload, blogs, FAQs, driver switch)
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7c: Admin Content & Payment Driver ---');
    const imgUp = multipart({ alt_text: 'Couple at sunset' }, [{ name: 'file', filename: 'banner.jpg', type: 'image/jpeg', buf: jpgBuf }]);
    const mediaRes = await requestApi('POST', '/api/admin/media', imgUp.body, { ...auth, ...imgUp.headers });
    const mediaUrl = mediaRes.data?.data?.url || '';
    const servedImg = mediaUrl ? await requestApi('GET', mediaUrl) : { status: 0 };
    const pdfUp = multipart({}, [{ name: 'file', filename: 'doc.pdf', type: 'application/pdf', buf: pdfBuf }]);
    const mediaPdf = await requestApi('POST', '/api/admin/media', pdfUp.body, { ...auth, ...pdfUp.headers });
    recordTest('Admin uploads a banner photo; it is served publicly; PDFs refused', mediaRes.status === 201 && /^\/media\/public\//.test(mediaUrl) && servedImg.status === 200 && mediaPdf.status === 400);

    const bannerRes = await requestApi('POST', '/api/admin/hero-banners', {
      headline: 'Test Slide', headline_emphasis: 'Second line', description: 'A test slide.', image_path: mediaUrl,
      pills: ['One', 'Two'], overlay_strength: 'medium', sort_order: 9, status: 'published', is_active: true, id: 999999
    }, auth);
    const bannerNoImg = await requestApi('POST', '/api/admin/hero-banners', { headline: 'No image', description: 'x' }, auth);
    const pubBanners = await requestApi('GET', '/api/content/hero-banners');
    const liveSlide = (pubBanners.data.data || []).find(b => b.headline === 'Test Slide');
    recordTest('Banner with uploaded photo goes live; banner without image rejected', bannerRes.status === 201 && bannerRes.data.data.id !== 999999 && !!liveSlide && liveSlide.image_path === mediaUrl && bannerNoImg.status === 400);
    if (bannerRes.data?.data?.id) await requestApi('DELETE', `/api/admin/hero-banners/${bannerRes.data.data.id}`, null, auth);

    // Missing image files are refused with a clear message (no broken images on the website)
    const bannerMissing = await requestApi('POST', '/api/admin/hero-banners', { headline: 'Broken', description: 'x', image_path: '/image/banner1.jpg' }, auth);
    const tipMissing = await requestApi('POST', '/api/admin/tips', { tip_text: 'Test tip', photo_url: '/image/tips/tip1.jpg' }, auth);
    const tipOk = await requestApi('POST', '/api/admin/tips', { tip_text: 'Test tip with a real photo', photo_url: mediaUrl, is_active: false }, auth);
    const blogMissing = await requestApi('POST', '/api/admin/blogs', { title: 'Cover test', excerpt: 'x', body_html: '<p>x</p>', cover_image: '/media/public/not-uploaded.jpg' }, auth);
    const pathTrick = await requestApi('POST', '/api/admin/hero-banners', { headline: 'Trick', description: 'x', image_path: '/media/public/../../../.env' }, auth);
    recordTest('Banner, tip and blog with a missing image file are refused; an uploaded photo is accepted',
      bannerMissing.status === 400 && /Image not found/.test(JSON.stringify(bannerMissing.data)) &&
      tipMissing.status === 400 && tipOk.status === 201 && blogMissing.status === 400 && pathTrick.status === 400);
    if (tipOk.data?.data?.id) await requestApi('DELETE', `/api/admin/tips/${tipOk.data.data.id}`, null, auth);

    const blogDraft = await requestApi('POST', '/api/admin/blogs', { title: 'Talking About Money', excerpt: 'Short read.', body_html: '<p>Body</p>', is_published: false }, auth);
    const blogsBefore = await requestApi('GET', '/api/content/blogs');
    const blogPub = await requestApi('PUT', `/api/admin/blogs/${blogDraft.data.data.id}`, { is_published: true }, auth);
    const blogsAfter = await requestApi('GET', '/api/content/blogs');
    const blogSecond = await requestApi('POST', '/api/admin/blogs', { title: 'Talking About Money', excerpt: 'Another.', body_html: '<p>Body 2</p>', is_published: true }, auth);
    const blogOne = await requestApi('GET', `/api/content/blogs/${blogDraft.data.data.slug}`);
    recordTest('Blog draft hidden, published article public, duplicate titles get unique addresses',
      blogDraft.status === 201 && !(blogsBefore.data.data.articles || []).some(a => a.id === blogDraft.data.data.id) &&
      blogPub.status === 200 && (blogsAfter.data.data.articles || []).some(a => a.id === blogDraft.data.data.id) &&
      blogSecond.status === 201 && blogSecond.data.data.slug !== blogDraft.data.data.slug && blogOne.status === 200 && !!blogOne.data.data.published_at);

    const blogImgBad = await requestApi('PUT', `/api/admin/blogs/${blogDraft.data.data.id}`, { banner_image: 'image/does-not-exist-banner.jpg' }, auth);
    const blogImgOk = await requestApi('PUT', `/api/admin/blogs/${blogDraft.data.data.id}`, { banner_image: 'image/spouzy.png', thumbnail_image: 'image/spouzy.png', show_in_banner: false }, auth);
    const blogsImg = await requestApi('GET', '/api/content/blogs');
    const imgRow = (blogsImg.data.data.articles || []).find(a => a.id === blogDraft.data.data.id) || {};
    recordTest('Blog banner and thumbnail are saved and public; missing pictures refused; banner can be switched off',
      blogImgBad.status === 400 && !!(blogImgBad.data.errors || {}).banner_image &&
      blogImgOk.status === 200 && imgRow.banner_image === 'image/spouzy.png' && imgRow.thumbnail_image === 'image/spouzy.png' && imgRow.show_in_banner === false);

    const qList = await requestApi('GET', '/api/admin/visitor-questions?status=pending', null, auth);
    const firstQ = (qList.data.data.questions || [])[0];
    const emptyAnswer = firstQ ? await requestApi('POST', `/api/admin/visitor-questions/${firstQ.id}/answer`, { answer_html: '  ', publish_to_faq: true }, auth) : { status: 0 };
    const goodAnswer = firstQ ? await requestApi('POST', `/api/admin/visitor-questions/${firstQ.id}/answer`, { answer_html: '<p>Yes, sessions are private.</p>', publish_to_faq: true }, auth) : { status: 0 };
    const pubFaqs = await requestApi('GET', '/api/content/faqs');
    const pubFaqOne = firstQ ? (pubFaqs.data.data || []).find(f => f.question === firstQ.question) : null;
    const pubAnswer = pubFaqOne ? await requestApi('GET', `/api/content/faqs/${pubFaqOne.id}`) : { data: {} };
    const faqNoAnswer = await requestApi('POST', '/api/admin/faqs', { question: 'Is it private?' }, auth);
    recordTest('Visitor question answered into a public FAQ; empty answers rejected',
      !!firstQ && emptyAnswer.status === 400 && goodAnswer.status === 200 &&
      !!pubFaqOne && pubFaqOne.answer_html === undefined && pubAnswer.status === 200 && pubAnswer.data.data.answer_html === '<p>Yes, sessions are private.</p>' &&
      faqNoAnswer.status === 400);

    const gwWrongMode = await requestApi('PUT', '/api/admin/gateway-config', { provider: 'razorpay', mode: 'live', key_id: 'rzp_test_integrationKey123', is_active: true }, auth);
    const gwOff = await requestApi('PUT', '/api/admin/gateway-config', { provider: 'razorpay', mode: 'test', key_id: 'rzp_test_integrationKey123', is_active: false }, auth);
    const payCfgAfterOff = await requestApi('GET', '/api/payments/config');
    const gwView = await requestApi('GET', '/api/admin/gateway-config', null, auth);
    const gwOn = await requestApi('PUT', '/api/admin/gateway-config', { provider: 'razorpay', mode: 'test', key_id: 'rzp_test_integrationKey123', is_active: true }, auth);
    const payCfgAfterOn = await requestApi('GET', '/api/payments/config');
    recordTest('Payment driver can be switched off (coming soon) and on again; mismatched keys refused',
      gwWrongMode.status === 400 && gwOff.status === 200 && payCfgAfterOff.data.data.enabled === false &&
      gwView.data.data.key_id === 'rzp_test_integrationKey123' && gwView.data.data.is_active === false && !JSON.stringify(gwView.data).includes('secret_test') &&
      gwOn.status === 200 && payCfgAfterOn.data.data.enabled === true);

    // -----------------------------------------------------------------------
    // STEP 11c: Website customer accounts, packages, cart and checkout
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7d: Customer Accounts, Packages & Cart ---');
    const { Package, CartItem, PackageOrder, User: UserModel, Role: RoleModel } = sequelize.models;
    const custRole = await RoleModel.findOne({ where: { slug: 'customer' } });
    await CartItem.destroy({ where: {} });
    await sequelize.models.Invoice.destroy({ where: {} });
    await PaymentTransaction.destroy({ where: {}, force: true });
    await PaymentOrder.destroy({ where: {}, force: true });
    await PackageOrder.destroy({ where: {} });
    await sequelize.models.IdVerification.destroy({ where: {} });
    const oldCustomers = (await UserModel.findAll({ where: { role_id: custRole.id }, attributes: ['id'] })).map(u => u.id);
    if (oldCustomers.length) await sequelize.models.MediaAsset.destroy({ where: { uploaded_by_user_id: oldCustomers } });
    await UserModel.destroy({ where: { role_id: custRole.id } });
    await Package.update({ is_active: true }, { where: {} });

    const cookiesFrom = (r) => (r.headers['set-cookie'] || []).map(c => c.split(';')[0]);
    const custBody = { name: 'Riya Mehta', email: 'riya.mehta@example.com', phone: '+91 98200 11223', password: 'Secure123', consent: true };
    const weak = await requestApi('POST', '/api/auth/customer/register', { ...custBody, password: 'short' });
    const noConsent = await requestApi('POST', '/api/auth/customer/register', { ...custBody, consent: false });
    const reg = await requestApi('POST', '/api/auth/customer/register', custBody);
    const regCookies = cookiesFrom(reg);
    const dupReg = await requestApi('POST', '/api/auth/customer/register', custBody);
    recordTest('Customer sign-up validates, signs in and refuses duplicate emails',
      weak.status === 400 && !!weak.data.errors?.password && noConsent.status === 400 && !!noConsent.data.errors?.consent &&
      reg.status === 201 && regCookies.some(c => c.startsWith('spouzy_session=')) && regCookies.includes('spouzy_customer=1') &&
      dupReg.status === 409 && !JSON.stringify(reg.data).includes('password'));

    const badLogin = await requestApi('POST', '/api/auth/customer/login', { email: custBody.email, password: 'Wrong123' });
    const custLogin = await requestApi('POST', '/api/auth/customer/login', { email: custBody.email, password: custBody.password });
    const staffAsCustomer = await requestApi('POST', '/api/auth/customer/login', { email: 'admin@spouzy.com', password: 'AdminPass123!' });
    const custSession = cookiesFrom(custLogin).find(c => c.startsWith('spouzy_session='));
    const custCookie = { Cookie: `${custSession}; spouzy_csrf=tok1` };
    const custWrite = { ...custCookie, 'X-CSRF-Token': 'tok1' };
    const me = await requestApi('GET', '/api/auth/me', null, custCookie);
    const custAdmin = await requestApi('GET', '/api/admin/dashboard/overview', null, custCookie);
    const staffCart = await requestApi('GET', '/api/customer/cart', null, auth);
    recordTest('Customer login works; customers are kept out of the admin and staff out of the cart',
      badLogin.status === 401 && custLogin.status === 200 && staffAsCustomer.status === 401 &&
      me.data.user.role.slug === 'customer' && custAdmin.status === 403 && staffCart.status === 403);

    await paymentService.saveGatewayConfig({ provider: 'razorpay', mode: 'test', key_id: 'rzp_test_integrationKey123', is_active: false });
    const pubPk = await requestApi('GET', '/api/packages');
    const pkList = pubPk.data.data.packages || [];
    const freePk = pkList.find(p => p.is_free);
    const paidPk = pkList.find(p => p.slug === 'single-session');
    const filtered = await requestApi('GET', '/api/packages?service=intimacy-clinic');
    recordTest('Public packages list: 4 example packages, free one included, service filter works',
      pubPk.status === 200 && pkList.length === 4 && !!freePk && !!paidPk && paidPk.price_inr === 1999 &&
      pubPk.data.data.payment.enabled === false && (filtered.data.data.packages || []).every(p => p.service_slugs.includes('intimacy-clinic')));

    const noCsrf = await requestApi('POST', '/api/customer/cart', { packageSlug: paidPk.slug }, custCookie);
    const addPaid = await requestApi('POST', '/api/customer/cart', { packageSlug: paidPk.slug, quantity: 2, price_minor: 1 }, custWrite);
    const addFree = await requestApi('POST', '/api/customer/cart', { packageSlug: freePk.slug, quantity: 3 }, custWrite);
    const cart1 = addFree.data.data;
    recordTest('Cart needs CSRF; prices come from the server; free package limited to one',
      noCsrf.status === 403 && addPaid.status === 200 && cart1.total_minor === 2 * 199900 &&
      cart1.items.find(i => i.package.is_free).quantity === 1 && cart1.can_checkout === false);

    const blocked = await requestApi('POST', '/api/customer/checkout', {}, custWrite);
    const ordersAfterBlocked = await PackageOrder.count();
    const freeClaim = await requestApi('POST', '/api/customer/checkout', { freeOnly: true }, custWrite);
    const cartAfterFree = await requestApi('GET', '/api/customer/cart', null, custCookie);
    await requestApi('POST', '/api/customer/cart', { packageSlug: freePk.slug }, custWrite);
    const freeAgain = await requestApi('POST', '/api/customer/checkout', { freeOnly: true }, custWrite);
    await requestApi('DELETE', `/api/customer/cart/${freePk.id}`, null, custWrite);
    recordTest('Checkout blocked while payment is off (nothing saved); free package claimable once',
      blocked.status === 409 && /coming soon/i.test(blocked.data.message) && ordersAfterBlocked === 0 &&
      freeClaim.status === 200 && freeClaim.data.data.order.status === 'confirmed' && freeClaim.data.data.order.total_minor === 0 &&
      cartAfterFree.data.data.items.length === 1 && !cartAfterFree.data.data.has_free && freeAgain.status === 409);

    await paymentService.saveGatewayConfig({ provider: 'razorpay', mode: 'test', key_id: 'rzp_test_integrationKey123', is_active: true });
    const paidCheckout = await requestApi('POST', '/api/customer/checkout', { note: 'Evenings preferred' }, custWrite);
    const pc = paidCheckout.data.data || {};
    const hmacPk = crypto.createHmac('sha256', 'secret_test_signature_key_456');
    hmacPk.update(`${pc.payment?.gatewayOrderId}|pay_pkg_001`);
    const pkVerify = await requestApi('POST', '/api/payments/verify', { gatewayOrderId: pc.payment?.gatewayOrderId, gatewayPaymentId: 'pay_pkg_001', gatewaySignature: hmacPk.digest('hex') });
    const myOrders = await requestApi('GET', '/api/customer/orders', null, custCookie);
    const cartAfterPay = await requestApi('GET', '/api/customer/cart', null, custCookie);
    const paidOrder = (myOrders.data.data || []).find(o => o.order_no === pc.order?.order_no);
    recordTest('Paid checkout opens a Razorpay order for the server total; verified payment marks the order paid and empties the cart',
      paidCheckout.status === 200 && pc.paymentRequired === true && pc.payment.amount === 2 * 199900 && pc.order.status === 'pending_payment' &&
      pkVerify.status === 200 && !!paidOrder && paidOrder.status === 'paid' && paidOrder.payment_status === 'paid' &&
      cartAfterPay.data.data.items.length === 0 && (myOrders.data.data || []).length === 2);

    const adminPk = await requestApi('GET', '/api/admin/packages', null, auth);
    const target = (adminPk.data.data || []).find(p => p.slug === 'couple-care-plan');
    await requestApi('POST', '/api/customer/cart', { packageSlug: 'couple-care-plan' }, custWrite);
    const priceEdit = await requestApi('PUT', `/api/admin/packages/${target.id}`, { price_inr: 4999, features: 'Three sessions\nAssessment', badge: 'Offer' }, auth);
    const cartNewPrice = await requestApi('GET', '/api/customer/cart', null, custCookie);
    const hide = await requestApi('PUT', `/api/admin/packages/${target.id}`, { is_active: false }, auth);
    const cartHidden = await requestApi('GET', '/api/customer/cart', null, custCookie);
    const pubHidden = await requestApi('GET', '/api/packages');
    const badPrice = await requestApi('PUT', `/api/admin/packages/${target.id}`, { price_inr: -5 }, auth);
    await requestApi('PUT', `/api/admin/packages/${target.id}`, { price_inr: 5499, features: target.features, badge: target.badge, is_active: true }, auth);
    recordTest('Admin price and contents edits reach the cart; hidden packages leave the site and carts',
      priceEdit.status === 200 && cartNewPrice.data.data.total_minor === 499900 && cartNewPrice.data.data.items[0].package.features.length === 2 &&
      hide.status === 200 && cartHidden.data.data.items.length === 0 && !(pubHidden.data.data.packages || []).some(p => p.slug === 'couple-care-plan') &&
      badPrice.status === 400);

    const opsAuthShop = opsAuth;
    const opsOrders = await requestApi('GET', '/api/admin/package-orders', null, opsAuthShop);
    const opsEditPk = await requestApi('PUT', `/api/admin/packages/${target.id}`, { price_inr: 1 }, opsAuthShop);
    const adminCustomers = await requestApi('GET', '/api/admin/customers?search=riya', null, auth);
    const markDone = await requestApi('PATCH', `/api/admin/package-orders/${paidOrder.id}`, { status: 'completed', internal_notes: 'All sessions done' }, opsAuthShop);
    const badOrderStatus = await requestApi('PATCH', `/api/admin/package-orders/${paidOrder.id}`, { status: 'shipped' }, opsAuthShop);
    const overviewShop = await requestApi('GET', '/api/admin/dashboard/overview', null, auth);
    recordTest('Staff see orders and customers; only admins change package prices; dashboard shows shop numbers',
      opsOrders.status === 200 && opsOrders.data.data.total === 2 && opsEditPk.status === 403 &&
      adminCustomers.data.data.customers.length === 1 && adminCustomers.data.data.customers[0].orders === 2 &&
      markDone.status === 200 && markDone.data.data.status === 'completed' && badOrderStatus.status === 400 &&
      overviewShop.data.data.sections.shop && overviewShop.data.data.sections.shop.customers === 1);

    const custRow = adminCustomers.data.data.customers[0];
    const weakReset = await requestApi('PATCH', `/api/admin/customers/${custRow.id}`, { password: 'abc' }, auth);
    const okReset = await requestApi('PATCH', `/api/admin/customers/${custRow.id}`, { password: 'NewPass456' }, auth);
    const oldSession = await requestApi('GET', '/api/customer/cart', null, custCookie);
    const newLogin = await requestApi('POST', '/api/auth/customer/login', { email: custBody.email, password: 'NewPass456' });
    const newSession = cookiesFrom(newLogin).find(c => c.startsWith('spouzy_session='));
    recordTest('Staff can reset a customer password; old sessions end',
      weakReset.status === 400 && okReset.status === 200 && oldSession.status === 401 && newLogin.status === 200);
    custCookie.Cookie = `${newSession}; spouzy_csrf=tok1`;
    custWrite.Cookie = custCookie.Cookie;

    // -----------------------------------------------------------------------
    // Phase 7e: Booking needs an account; details come from the account; activity log
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7e: Login-required booking & customer activity ---');
    await sequelize.models.SiteSetting.update({ setting_value: 'true' }, { where: { setting_key: 'booking_requires_account' } });
    require('../src/routes/appointment.routes').resetBookingSettingCache();
    const bookDate = addDays(todayIST(), 12);
    const guestBooking = { serviceSlug: 'couples-therapy', practitionerId: 'any', bookingType: 'paid', date: bookDate, startTime: '15:00', duration: 30, consultationMode: 'virtual',
      clientName: 'Someone Else', clientEmail: 'other@example.com', clientMobile: '+91 90000 00000', consent: true };
    const guestTry = await requestApi('POST', '/api/appointments', guestBooking);
    const noCsrfTry = await requestApi('POST', '/api/appointments', guestBooking, custCookie);
    const custBook = await requestApi('POST', '/api/appointments', guestBooking, custWrite);
    const bookedRow = custBook.data?.data ? await Appointment.findOne({ where: { reference_no: custBook.data.data.referenceNo } }) : null;
    const myAppts = await requestApi('GET', '/api/customer/appointments', null, custCookie);
    recordTest('Booking needs a customer login; booked details come from the account, not the form',
      guestTry.status === 401 && guestTry.data.code === 'LOGIN_REQUIRED' && noCsrfTry.status === 401 && custBook.status === 201 &&
      !!bookedRow && bookedRow.client_email === custBody.email && bookedRow.client_name === 'Riya Mehta' && bookedRow.user_id !== null &&
      (myAppts.data.data || []).some(a => a.reference_no === custBook.data.data.referenceNo));

    const chkEmail = await requestApi('POST', '/api/auth/customer/check', { email: custBody.email.toUpperCase() });
    const chkPhone = await requestApi('POST', '/api/auth/customer/check', { phone: '98200 11223' });
    const chkNew = await requestApi('POST', '/api/auth/customer/check', { email: 'brand.new@example.com', phone: '+91 91111 22222' });
    const dupPhoneReg = await requestApi('POST', '/api/auth/customer/register', { ...custBody, email: 'second.account@example.com' });
    const phoneLogin = await requestApi('POST', '/api/auth/customer/login', { identifier: '+91-98200-11223', password: 'NewPass456' });
    recordTest('Account check finds existing email or mobile; one account per mobile; login with mobile number',
      chkEmail.data.data.exists === true && chkEmail.data.data.matched_by === 'email' && /•/.test(chkEmail.data.data.masked_email) &&
      chkPhone.data.data.exists === true && chkPhone.data.data.matched_by === 'phone' && chkNew.data.data.exists === false &&
      dupPhoneReg.status === 409 && !!dupPhoneReg.data.errors?.phone && phoneLogin.status === 200);

    const trail = await requestApi('POST', '/api/customer/activity', { events: [
      { event: 'page_view', page: '/book-appoinment.htm?type=free', title: 'Book', at: new Date(Date.now() - 60000).toISOString(), beforeLogin: true },
      { event: 'click', page: '/book-appoinment.htm', label: 'Confirm Appointment', href: '#' },
      { event: 'keystrokes', page: '/x', label: 'secret' }
    ] }, custWrite);
    const custId = bookedRow.user_id;
    const actAdmin = await requestApi('GET', `/api/admin/customers/${custId}/activity`, null, auth);
    const evs = (actAdmin.data.data && actAdmin.data.data.events) || [];
    const activeToday = await requestApi('GET', '/api/admin/customer-activity', null, auth);
    const custList = await requestApi('GET', '/api/admin/customers?search=riya', null, auth);
    const edActivity = await requestApi('GET', `/api/admin/customers/${custId}/activity`, null, edAuth);
    recordTest('Admin sees the customer trail (logins, pages, buttons, booking) and who was active today',
      trail.status === 200 && trail.data.data.saved === 2 &&
      ['signup', 'login', 'login_failed', 'cart_add', 'checkout', 'booking', 'page_view', 'click'].every(e => evs.some(x => x.event === e)) &&
      evs.some(x => x.event === 'page_view' && x.details && x.details.before_login) && !evs.some(x => x.label === 'secret') &&
      (activeToday.data.data.customers || []).some(c => c.user_id === custId && c.logins >= 1 && c.bookings >= 1) &&
      custList.data.data.customers[0].active_today === true && edActivity.status === 403);

    // -----------------------------------------------------------------------
    // Phase 7f: Website chat assistant
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7f: Chat assistant ---');
    const guestChat = await requestApi('POST', '/api/customer/chat/start', {});
    const staffChat = await requestApi('POST', '/api/customer/chat/start', {}, auth);
    const chatStart = await requestApi('POST', '/api/customer/chat/start', { page: '/index.htm' }, custWrite);
    const convId = chatStart.data.data && chatStart.data.data.conversationId;
    const say = async (text) => (await requestApi('POST', '/api/customer/chat/message', { conversationId: convId, text }, custWrite)).data.data.messages[0];
    const preSvc = await sequelize.models.Service.findOne({ where: { slug: 'premarital' } });
    const preInr = '₹' + Math.round(preSvc.price_30_minor / 100).toLocaleString('en-IN');
    const aPrice = await say('i want to know price of pre marrage');
    const aHinglish = await say('pre marriage ka price kitna hai');
    const aPkg = await say('what will i get in couple care plan');
    const aEmail = await say('give me your email id');
    const aClinic = await say('where is your clinic in pune');
    recordTest('Chat needs a customer login and answers prices, package contents, email and clinic (incl. Hinglish and typos)',
      [401, 403].includes(guestChat.status) && staffChat.status === 403 && chatStart.status === 200 && /Riya/.test(chatStart.data.data.messages[0].text) &&
      chatStart.data.data.idleSeconds === 30 &&
      aPrice.text.includes(preInr) && aPrice.links.some(l => l.url === 'pre-marriage.htm') && aHinglish.text.includes(preInr) &&
      /Three 60-minute couple sessions/.test(aPkg.text) && /care@spouzy\.com|@/.test(aEmail.text) && /Koregaon/.test(aClinic.text));

    const aUnknown = await say('do you speak tamil');
    const unansweredList = await requestApi('GET', '/api/admin/chat-unanswered', null, auth);
    const newFaq = await requestApi('POST', '/api/admin/faqs', { category: 'General', question: 'Which languages do you speak in sessions?', answer_html: 'Sessions are available in English, Hindi and Tamil.', is_published: true }, auth);
    const aLearned = await say('which languages do you speak');
    const aCallback = await say('please call me back');
    const aCallbackTime = await say('Evening (4–8)');
    const callbackEnq = await sequelize.models.Enquiry.findOne({ where: { source: 'floating_widget' }, order: [['id', 'DESC']] });
    const ended = await requestApi('POST', '/api/customer/chat/end', { conversationId: convId, reason: 'idle' }, custWrite);
    const afterEnd = await requestApi('POST', '/api/customer/chat/message', { conversationId: convId, text: 'hello again' }, custWrite);
    const adminChats = await requestApi('GET', '/api/admin/chats?unanswered=true', null, auth);
    const transcript = await requestApi('GET', `/api/admin/chats/${convId}`, null, auth);
    recordTest('Unanswered questions reach the admin; a new FAQ is used at once; call-back request; idle end; transcript',
      /didn.t quite get/.test(aUnknown.text) && (unansweredList.data.data || []).some(m => m.text === 'do you speak tamil') &&
      newFaq.status === 201 && /Tamil/.test(aLearned.text) && /When should our team call/.test(aCallback.text) &&
      /Done! Our team will call you/.test(aCallbackTime.text) && !!callbackEnq && /Call-back requested from the website chat/.test(callbackEnq.message) &&
      ended.status === 200 && /Thank you for chatting/.test(ended.data.data.messages[0].text) &&
      afterEnd.status === 200 && afterEnd.data.data.restarted === true &&
      (adminChats.data.data.conversations || []).some(c => c.id === convId && c.unanswered_count >= 1) &&
      transcript.status === 200 && transcript.data.data.messages.length >= 12 && transcript.data.data.messages.some(m => m.sender === 'user' && m.matched === false));

    const logout = await requestApi('POST', '/api/auth/logout', {}, custWrite);
    const afterLogout = await requestApi('GET', '/api/customer/cart', null, custCookie);
    recordTest('Customer logout ends the session', logout.status === 200 && afterLogout.status === 401);

    // Dashboard charts: periods, sections per role
    console.log('\n--- Phase 7g: Dashboard charts ---');
    const an30 = await requestApi('GET', '/api/admin/dashboard/analytics?days=30', null, auth);
    const an7 = await requestApi('GET', '/api/admin/dashboard/analytics?days=7', null, auth);
    const anOdd = await requestApi('GET', '/api/admin/dashboard/analytics?days=9999', null, auth);
    const anEd = await requestApi('GET', '/api/admin/dashboard/analytics?days=30', null, edAuth);
    const anOps = await requestApi('GET', '/api/admin/dashboard/analytics?days=90', null, opsAuth);
    const anGuest = await requestApi('GET', '/api/admin/dashboard/analytics?days=30');
    const d30 = an30.data && an30.data.data;
    recordTest('Dashboard charts: 7/30/90-day periods, every section for admin, only permitted sections for other roles',
      an30.status === 200 && d30.range.labels.length === 30 && d30.bookings && d30.bookings.byDay.length === 30 &&
      d30.revenue && d30.enquiries && d30.chat && d30.customers && Array.isArray(d30.funnel) && d30.funnel.length === 4 && d30.applications &&
      an7.data.data.range.labels.length === 7 && anOdd.data.data.range.days === 30 &&
      anEd.status === 200 && !anEd.data.data.bookings && !anEd.data.data.revenue && !anEd.data.data.customers &&
      anOps.status === 200 && anOps.data.data.range.days === 90 && !!anOps.data.data.bookings && !!anOps.data.data.enquiries &&
      anGuest.status === 401);

    // -----------------------------------------------------------------------
    // Phase 7h: Offers (popup card images, offer prices on packages and at checkout)
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7h: Offers ---');
    const { Offer } = sequelize.models;
    await Offer.destroy({ where: {} });
    const today = todayIST();
    const offersNone = await requestApi('GET', '/api/offers');
    const singlePk = (await requestApi('GET', '/api/admin/packages', null, auth)).data.data.find(p => p.slug === 'single-session');
    const imageOffer = { title: 'Festive Wellness Week', description: 'Free 10-minute follow-up call with any session.', image_path: 'image/hero-marriage.webp', badge_text: 'Festive Offer', cta_url: 'pre-marriage.htm' };
    const edOffer = await requestApi('POST', '/api/admin/offers', imageOffer, edAuth);
    const edPrice = await requestApi('POST', '/api/admin/offers', { ...imageOffer, title: 'Cheaper session', package_id: singlePk.id, offer_price_inr: 999 }, edAuth);
    const opsOffers = await requestApi('GET', '/api/admin/offers', null, opsAuth);
    const opsCreate = await requestApi('POST', '/api/admin/offers', imageOffer, opsAuth);
    const guestOffers = await requestApi('GET', '/api/admin/offers');
    const offersOne = await requestApi('GET', '/api/offers');
    recordTest('Offers: no offer = empty list (no popup); editors add image offers but not offer prices; operations can only view',
      offersNone.status === 200 && offersNone.data.data.offers.length === 0 &&
      edOffer.status === 201 && edPrice.status === 403 && opsOffers.status === 200 && opsCreate.status === 403 && guestOffers.status === 401 &&
      offersOne.data.data.offers.length === 1 && offersOne.data.data.offers[0].title === 'Festive Wellness Week' && offersOne.data.data.offers[0].cta_url === 'pre-marriage.htm');

    const noImage = await requestApi('POST', '/api/admin/offers', { title: 'X', image_path: 'image/does-not-exist.jpg' }, auth);
    const tooHigh = await requestApi('POST', '/api/admin/offers', { ...imageOffer, package_id: singlePk.id, offer_price_inr: singlePk.price_inr }, auth);
    const freePrice = await requestApi('POST', '/api/admin/offers', { ...imageOffer, package_id: (await requestApi('GET', '/api/packages')).data.data.packages.find(p => p.is_free).id, offer_price_inr: 10 }, auth);
    const badDates = await requestApi('POST', '/api/admin/offers', { ...imageOffer, start_date: addDays(today, 5), end_date: addDays(today, 2) }, auth);
    const badLink = await requestApi('POST', '/api/admin/offers', { ...imageOffer, cta_url: 'javascript:alert(1)' }, auth);
    await requestApi('POST', '/api/admin/offers', { ...imageOffer, title: 'Starts later', start_date: addDays(today, 3) }, auth);
    await requestApi('POST', '/api/admin/offers', { ...imageOffer, title: 'Already over', end_date: addDays(today, -1) }, auth);
    await requestApi('POST', '/api/admin/offers', { ...imageOffer, title: 'Switched off', is_active: false }, auth);
    const priced = await requestApi('POST', '/api/admin/offers', { title: 'Diwali Session Offer', image_path: 'image/hero-clinical.webp', badge_text: '25% OFF', package_id: singlePk.id, offer_price_inr: 1499, end_date: addDays(today, 10), terms: 'One per customer.' }, auth);
    const adminList = await requestApi('GET', '/api/admin/offers', null, auth);
    const statuses = (adminList.data.data || []).map(o => o.status).sort().join(',');
    const pubOffers = await requestApi('GET', '/api/offers');
    const pubPkgs = await requestApi('GET', '/api/packages');
    const offPk = pubPkgs.data.data.packages.find(p => p.slug === 'single-session');
    recordTest('Offer checks (image, price lower than normal, not on free packages, dates, safe link); only live offers are public; offer price shows on the package',
      noImage.status === 400 && !!noImage.data.errors?.image_path && tooHigh.status === 400 && !!tooHigh.data.errors?.offer_price_inr &&
      freePrice.status === 400 && badDates.status === 400 && !!badDates.data.errors?.end_date && badLink.status === 400 && !!badLink.data.errors?.cta_url &&
      priced.status === 201 && statuses === 'ended,live,live,off,scheduled' &&
      pubOffers.data.data.offers.length === 2 && pubOffers.data.data.offers.some(o => o.package && o.package.offer_price_inr === 1499 && o.cta_url === 'packages.htm#pkg-single-session') &&
      offPk.price_inr === 1499 && offPk.compare_at_inr === 1999 && offPk.offer && offPk.offer.has_price && offPk.offer.save_inr === 500 && offPk.offer.title === 'Diwali Session Offer');

    await paymentService.saveGatewayConfig({ provider: 'razorpay', mode: 'test', key_id: 'rzp_test_integrationKey123', is_active: true });
    const buyer = { name: 'Offer Buyer', email: 'offer.buyer@example.com', phone: '+91 98200 44556', password: 'Secure123', consent: true };
    await UserModel.destroy({ where: { email: buyer.email } });
    const buyerReg = await requestApi('POST', '/api/auth/customer/register', buyer);
    const buyerSession = cookiesFrom(buyerReg).find(c => c.startsWith('spouzy_session='));
    const buyerWrite = { Cookie: `${buyerSession}; spouzy_csrf=tok9`, 'X-CSRF-Token': 'tok9' };
    const buyerCart = await requestApi('POST', '/api/customer/cart', { packageSlug: 'single-session', quantity: 2 }, buyerWrite);
    const buyerCheckout = await requestApi('POST', '/api/customer/checkout', {}, buyerWrite);
    const bc = buyerCheckout.data.data || {};
    const chatOffers = await requestApi('POST', '/api/customer/chat/start', {}, buyerWrite);
    const offerConv = chatOffers.data.data && chatOffers.data.data.conversationId;
    const askOffers = (await requestApi('POST', '/api/customer/chat/message', { conversationId: offerConv, text: 'any discount or offer going on?' }, buyerWrite)).data.data.messages[0];
    recordTest('Cart and checkout charge the offer price; the order records the offer; the chat lists live offers',
      buyerCart.status === 200 && buyerCart.data.data.total_minor === 2 * 149900 &&
      buyerCheckout.status === 200 && bc.payment && bc.payment.amount === 2 * 149900 &&
      bc.order.items[0].price_minor === 149900 && bc.order.items[0].list_price_minor === 199900 && bc.order.items[0].offer && bc.order.items[0].offer.title === 'Diwali Session Offer' &&
      /Diwali Session Offer/.test(askOffers.text) && /₹1,499/.test(askOffers.text) && /Festive Wellness Week/.test(askOffers.text));

    const pricedId = priced.data.data.id;
    const edEditTitle = await requestApi('PUT', `/api/admin/offers/${pricedId}`, { title: 'Diwali Session Offer 2026' }, edAuth);
    const edDropPrice = await requestApi('PUT', `/api/admin/offers/${pricedId}`, { offer_price_inr: '' }, edAuth);
    const delOffer = await requestApi('DELETE', `/api/admin/offers/${pricedId}`, null, auth);
    const afterDelete = (await requestApi('GET', '/api/packages')).data.data.packages.find(p => p.slug === 'single-session');
    await Offer.destroy({ where: {} });
    const afterClear = await requestApi('GET', '/api/offers');
    recordTest('Editors can retitle a priced offer but not change its price; deleting the offer restores the normal price; no offers = no popup',
      edEditTitle.status === 200 && edDropPrice.status === 403 && delOffer.status === 200 &&
      afterDelete.price_inr === 1999 && !afterDelete.offer && afterClear.data.data.offers.length === 0);

    // -----------------------------------------------------------------------
    // Phase 7i: Bills and admin notifications
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7i: Bills & notifications ---');
    const billing = require('../src/services/billing.service');
    const { Invoice, BillingProfile, CustomerBillingDetail, Notification, NotificationRead } = sequelize.models;
    await Invoice.destroy({ where: {} });
    await BillingProfile.destroy({ where: {} });
    await CustomerBillingDetail.destroy({ where: {} });
    await NotificationRead.destroy({ where: {} });
    await Notification.destroy({ where: {} });

    // A customer buys a package online
    await paymentService.saveGatewayConfig({ provider: 'razorpay', mode: 'test', key_id: 'rzp_test_integrationKey123', is_active: true });
    const billBuyer = { name: 'Asha Kulkarni', email: 'asha.bills@example.com', phone: '+91 98200 77881', password: 'Secure123', consent: true };
    await UserModel.destroy({ where: { email: billBuyer.email } });
    const bReg = await requestApi('POST', '/api/auth/customer/register', billBuyer);
    const bCookie = { Cookie: `${cookiesFrom(bReg).find(c => c.startsWith('spouzy_session='))}; spouzy_csrf=tokB`, 'X-CSRF-Token': 'tokB' };
    await requestApi('POST', '/api/customer/cart', { packageSlug: 'couple-care-plan' }, bCookie);
    const bCheckout = (await requestApi('POST', '/api/customer/checkout', {}, bCookie)).data.data;
    const bHmac = crypto.createHmac('sha256', 'secret_test_signature_key_456');
    bHmac.update(`${bCheckout.payment.gatewayOrderId}|pay_bill_001`);
    const bVerify = await requestApi('POST', '/api/payments/verify', { gatewayOrderId: bCheckout.payment.gatewayOrderId, gatewayPaymentId: 'pay_bill_001', gatewaySignature: bHmac.digest('hex') });
    const bVerifyAgain = await requestApi('POST', '/api/payments/verify', { gatewayOrderId: bCheckout.payment.gatewayOrderId, gatewayPaymentId: 'pay_bill_001', gatewaySignature: 'x' });
    const invoices1 = await Invoice.findAll();
    const fy = billing.financialYear(new Date());
    const summaryAdmin = (await requestApi('GET', '/api/admin/notifications/summary', null, auth)).data.data;
    const custBills0 = (await requestApi('GET', '/api/customer/invoices', null, bCookie)).data.data;
    const payNote = summaryAdmin.latest.find(n => n.type === 'payment_received');
    recordTest('A paid order creates one bill (numbered per financial year) and a "Payment received" notification; the customer sees nothing until it is sent',
      bVerify.status === 200 && bVerifyAgain.status === 200 && invoices1.length === 1 && invoices1[0].invoice_no === `SPZ/${fy}/0001` &&
      invoices1[0].status === 'ready' && invoices1[0].total_minor === 549900 &&
      !!payNote && /Payment received · ₹5,499/.test(payNote.title) && payNote.link === `/shop?tab=bills&bill=${invoices1[0].id}` && !payNote.read &&
      summaryAdmin.unread >= 3 && summaryAdmin.latest.some(n => n.type === 'order_placed') && summaryAdmin.latest.some(n => n.type === 'customer_signup') &&
      Array.isArray(custBills0) && custBills0.length === 0);

    const billId = invoices1[0].id;
    const sendEmpty = await requestApi('POST', `/api/admin/invoices/${billId}/send`, {}, auth);
    const badGst = await requestApi('PUT', `/api/admin/invoices/${billId}`, { seller: { business_name: 'SPOUZY · PSG', address: 'Mulund West, Mumbai 400080', gstin: '27ABC', gst_rate: 18 } }, auth);
    const edPut = await requestApi('PUT', `/api/admin/invoices/${billId}`, { notes: 'x' }, edAuth);
    const seller = { business_name: 'SPOUZY · Problem Solver Group', address: 'Mulund West\nMumbai, Maharashtra 400080', gstin: '27ABCDE1234F1Z5', phone: '+91 85919 45055', email: 'care@spouzy.com', gst_rate: 18, footer_note: 'Thank you for trusting SPOUZY.' };
    const saveDetails = await requestApi('PUT', `/api/admin/invoices/${billId}`, { seller, customer: { name: 'Asha Kulkarni', company: 'Kulkarni Designs', email: 'asha.bills@example.com', phone: '+91 98200 77881', address: 'Baner, Pune 411045', gstin: '27PQRSX6789K1Z2' }, notes: 'Sessions can be online or in clinic.' }, auth);
    const sd = saveDetails.data.data || {};
    const tax = sd.invoice && sd.invoice.tax;
    recordTest('Bill details: "Bill from" is needed before sending; GSTIN checked; new details are saved for the dropdowns; GST inside the price is shown',
      sendEmpty.status === 400 && badGst.status === 400 && !!badGst.data.errors?.['seller.gstin'] && edPut.status === 403 &&
      saveDetails.status === 200 && sd.profiles.length === 1 && sd.profiles[0].is_default === true && sd.customer_details.length === 1 &&
      !!tax && tax.rate === 18 && tax.split === 'intra' && tax.taxable_minor === 466017 && tax.tax_minor === 83883 &&
      sd.invoice.amount_in_words === 'Rupees Five Thousand Four Hundred Ninety-Nine Only');

    const opsSend = await requestApi('POST', `/api/admin/invoices/${billId}/send`, {}, opsAuth);
    const editAfterSend = await requestApi('PUT', `/api/admin/invoices/${billId}`, { notes: 'changed' }, auth);
    const custBills = (await requestApi('GET', '/api/customer/invoices', null, bCookie)).data.data;
    const custBill = await requestApi('GET', `/api/customer/invoices/${billId}`, null, bCookie);
    const otherCust = await requestApi('GET', `/api/customer/invoices/${billId}`, null, { Cookie: custWrite.Cookie });
    const afterView = (await requestApi('GET', '/api/customer/invoices', null, bCookie)).data.data;
    const sentNote = (await requestApi('GET', '/api/admin/notifications?limit=5', null, auth)).data.data.notifications.find(n => n.type === 'bill_sent');
    recordTest('Sending: staff with orders:edit send the bill; it then appears in the customer\'s My bills (only theirs) with the SPOUZY details and cannot be changed',
      opsSend.status === 200 && opsSend.data.data.invoice.status === 'sent' && editAfterSend.status === 409 &&
      custBills.length === 1 && custBills[0].is_new === true && custBill.status === 200 && custBill.data.data.seller.gstin === '27ABCDE1234F1Z5' &&
      custBill.data.data.customer.company === 'Kulkarni Designs' && custBill.data.data.items[0].description === 'Couple Care Plan' &&
      custBill.data.data.payment.gateway_payment_id === 'pay_bill_001' && custBill.data.data.user_id === undefined &&
      [401, 404].includes(otherCust.status) && afterView[0].is_new === false && !!sentNote && /sent to Asha Kulkarni/.test(sentNote.title));

    // Second bill: staff mark an order paid by hand; the saved details are offered and an out-of-state GSTIN gives IGST
    await requestApi('POST', '/api/customer/cart', { packageSlug: 'single-session' }, bCookie);
    const bCheckout2 = (await requestApi('POST', '/api/customer/checkout', {}, bCookie)).data.data;
    const markPaid = await requestApi('PATCH', `/api/admin/package-orders/${bCheckout2.order.id}`, { payment_status: 'paid', status: 'paid' }, auth);
    const inv2 = await Invoice.findOne({ where: { package_order_id: bCheckout2.order.id } });
    const get2 = (await requestApi('GET', `/api/admin/invoices/${inv2 && inv2.id}`, null, auth)).data.data;
    const useSaved = await requestApi('PUT', `/api/admin/invoices/${inv2 && inv2.id}`, { seller: { profile_id: get2.profiles[0].id }, customer: { name: 'Asha Kulkarni', address: 'Bengaluru 560038', gstin: '29PQRSX6789K1Z6' } }, auth);
    const dup = await requestApi('POST', `/api/admin/package-orders/${bCheckout2.order.id}/invoice`, {}, auth);
    recordTest('Payment marked by staff also creates a bill; saved details come back as dropdown choices; the next number follows; IGST for another state',
      markPaid.status === 200 && !!inv2 && inv2.invoice_no === `SPZ/${fy}/0002` && inv2.source === 'manual' &&
      get2.invoice.seller && get2.invoice.seller.business_name === seller.business_name && get2.invoice.customer.gstin === '27PQRSX6789K1Z2' &&
      get2.profiles.length === 1 && get2.customer_details.length === 1 &&
      useSaved.status === 200 && useSaved.data.data.invoice.tax.split === 'inter' && useSaved.data.data.customer_details.length === 2 &&
      dup.status === 201 && dup.data.data.id === inv2.id);

    const edNotes = (await requestApi('GET', '/api/admin/notifications', null, edAuth)).data.data.notifications;
    await requestApi('POST', '/api/content/faqs/ask', { question: 'Do you offer sessions for couples living in different cities?', submitter_email: 'q@example.com', consent: true });
    const edNotes2 = (await requestApi('GET', '/api/admin/notifications', null, edAuth)).data.data.notifications;
    const markOne = await requestApi('POST', '/api/admin/notifications/read', { ids: [payNote.id] }, auth);
    const s1 = (await requestApi('GET', '/api/admin/notifications/summary', null, auth)).data.data;
    const opsSummary = (await requestApi('GET', '/api/admin/notifications/summary', null, opsAuth)).data.data;
    const markAll = await requestApi('POST', '/api/admin/notifications/read', { all: true }, auth);
    const s2 = (await requestApi('GET', '/api/admin/notifications/summary', null, auth)).data.data;
    const payOnly = (await requestApi('GET', '/api/admin/notifications?category=payments', null, auth)).data.data.notifications;
    const guestNotes = await requestApi('GET', '/api/admin/notifications');
    recordTest('Notifications: each role sees only its events, newest first; read state is per person; filter by type',
      edNotes.every(n => n.category === 'website') && edNotes2.some(n => n.type === 'visitor_question') &&
      markOne.status === 200 && s1.unread === summaryAdmin.unread + 4 - 1 && opsSummary.unread > 0 &&
      markAll.status === 200 && s2.unread === 0 && payOnly.length >= 3 && payOnly.every(n => n.category === 'payments') &&
      payOnly[0].id > payOnly[payOnly.length - 1].id && guestNotes.status === 401);

    // -----------------------------------------------------------------------
    // Phase 7j: Client stories and FAQs (Excel upload, pages)
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7j: Stories & FAQs ---');
    const { VisitorStory, Faq } = sequelize.models;
    await VisitorStory.destroy({ where: {} });
    const storyUser = { name: 'Rohit Sharma', email: 'rohit.story@example.com', phone: '+91 98200 55667', password: 'Secure123', consent: true };
    await UserModel.destroy({ where: { email: storyUser.email } });
    const sReg = await requestApi('POST', '/api/auth/customer/register', storyUser);
    const sCookie = { Cookie: `${cookiesFrom(sReg).find(c => c.startsWith('spouzy_session='))}; spouzy_csrf=tokS`, 'X-CSRF-Token': 'tokS' };
    const sGuest = await requestApi('POST', '/api/customer/stories', { story_text: 'x'.repeat(60) });
    const sNoConsent = await requestApi('POST', '/api/customer/stories', { story_text: 'Our sessions helped us listen to each other again after many difficult months.', display_name: 'Rohit & Priya S.', service_key: 'post-marriage' }, sCookie);
    const sShort = await requestApi('POST', '/api/customer/stories', { story_text: 'Too short', display_name: 'Rohit', service_key: 'post-marriage', consent: true }, sCookie);
    const sGood = await requestApi('POST', '/api/customer/stories', {
      story_text: 'Our sessions helped us listen to each other again after many difficult months. Thank you SPOUZY.',
      display_name: 'Rohit & Priya S.', service_key: 'post-marriage', rating: 5, city: 'Mumbai', tag_line: 'Married 11 years', consent: true
    }, sCookie);
    const sPublicBefore = await requestApi('GET', '/api/content/stories?home=1');
    const storyNote = await Notification.findOne({ where: { type: 'visitor_story' }, order: [['id', 'DESC']] });
    const sMine = await requestApi('GET', '/api/customer/stories', null, sCookie);
    recordTest('Customer shares a story only when logged in; it waits for approval and the admin is notified',
      [401, 403].includes(sGuest.status) && sNoConsent.status === 400 && sShort.status === 400 &&
      sGood.status === 200 && sGood.data.data.state === 'pending' && sGood.data.data.shown_as === 'R***t & P***a S.' &&
      sPublicBefore.data.data.length === 0 && !!storyNote && /story/i.test(storyNote.title) && storyNote.link.includes('tab=stories') &&
      sMine.data.data.stories.length === 1 && sMine.data.data.verified === false && sMine.data.data.services.length === 8);

    const sId = sGood.data.data.id;
    const sAdminList = await requestApi('GET', '/api/admin/stories?state=pending', null, auth);
    const sEdit = await requestApi('PUT', `/api/admin/stories/${sId}`, { story_text: 'Our sessions helped us listen to each other again after many difficult months. Thank you, SPOUZY team.', badge_label: 'Verified Couple' }, auth);
    const sApprove = await requestApi('PATCH', `/api/admin/stories/${sId}`, { action: 'approve', customer_message: 'Thank you for sharing!' }, auth);
    const sPublic = await requestApi('GET', '/api/content/stories?home=1');
    const pubStory = (sPublic.data.data || [])[0] || {};
    recordTest('Admin edits and approves; the website shows the masked name only (no email, phone or account)',
      sAdminList.status === 200 && sAdminList.data.data.stories.some(s => s.id === sId && s.author && s.author.email === storyUser.email) && sAdminList.data.data.counts.pending === 1 &&
      sEdit.status === 200 && sEdit.data.data.edited_by_team === true && sApprove.status === 200 && sApprove.data.data.state === 'live' &&
      pubStory.name === 'R***t & P***a S.' && pubStory.badge === 'Verified Couple' && pubStory.tag === 'Married 11 years • Mumbai' && pubStory.rating === 5 &&
      !JSON.stringify(sPublic.data).includes(storyUser.email) && !JSON.stringify(sPublic.data).includes('98200') && !JSON.stringify(sPublic.data).includes('Rohit'));

    const sHide = await requestApi('PATCH', `/api/admin/stories/${sId}`, { action: 'hide' }, auth);
    const sHiddenPublic = await requestApi('GET', '/api/content/stories');
    const sShow = await requestApi('PATCH', `/api/admin/stories/${sId}`, { action: 'show' }, auth);
    const sByAdmin = await requestApi('POST', '/api/admin/stories', { story_text: 'The doctor explained everything with patience and complete discretion. I felt safe.', is_anonymous: true, display_name: 'Anonymous Patient', service_key: 'intimate-health', rating: 4 }, auth);
    const sCustEdit = await requestApi('PUT', `/api/customer/stories/${sId}`, { story_text: 'Our sessions helped us listen to each other again. We are grateful to the whole SPOUZY team.' }, sCookie);
    const sAfterCustEdit = await requestApi('GET', '/api/content/stories');
    const otherUserEdit = await requestApi('PUT', `/api/customer/stories/${sByAdmin.data.data.id}`, { story_text: 'y'.repeat(80) }, sCookie);
    const sWithdraw = await requestApi('DELETE', `/api/customer/stories/${sId}`, null, sCookie);
    const sDelete = await requestApi('DELETE', `/api/admin/stories/${sByAdmin.data.data.id}`, null, auth);
    const editorStories = await requestApi('GET', '/api/admin/stories', null, edAuth);
    const opsStoryEdit = await requestApi('PATCH', `/api/admin/stories/${sId}`, { action: 'approve' }, opsAuth);
    recordTest('Hide/show, admin-added stories, a customer edit goes back to review, withdraw and delete; staff permissions respected',
      sHide.data.data.state === 'hidden' && sHiddenPublic.data.data.length === 0 && sShow.data.data.state === 'live' &&
      sByAdmin.status === 201 && sByAdmin.data.data.state === 'live' && sByAdmin.data.data.public_preview.name === 'Anonymous Patient' &&
      sCustEdit.status === 200 && sCustEdit.data.data.state === 'pending' && sAfterCustEdit.data.data.every(s => s.id !== sId) &&
      otherUserEdit.status === 404 && sWithdraw.status === 200 && (await VisitorStory.count({ where: { id: sId } })) === 0 &&
      sDelete.status === 200 && editorStories.status === 200 && [403].includes(opsStoryEdit.status));

    // FAQs: placement, Excel sample, upload preview/apply, download
    await Faq.destroy({ where: {} });
    const fHome = await requestApi('POST', '/api/admin/faqs', { question: 'Is our session strictly confidential?', answer_text: 'Yes. See our [Confidentiality Pledge](confidentiality.htm).', show_on_home: true, show_on_faq_page: false }, auth);
    const fTemplate = await requestApi('GET', '/api/admin/faqs/template', null, auth);
    const xlsxUtil = require('../src/utils/xlsx');
    const header = ['ID (empty = new)', 'Category', 'Question *', 'Answer *', 'Order', 'Show on website', 'FAQ page', 'Pre-Marriage', 'Post-Marriage', 'Relationship Guidance', 'Intimate Health Care', 'Intimate Aesthetics Treatment', 'Divorce Mediation', 'Prevent Sexual Violence'];
    const rowsX = [];
    for (let i = 1; i <= 420; i++) rowsX.push(['', i % 2 ? 'Pre-Marriage' : 'Fees', `Bulk question ${i}?`, `Answer ${i}\n- first point\n- second point`, '', 'Yes', 'Yes', i % 2 ? 'Yes' : '', '', '', i % 5 === 0 ? 'Yes' : 'No', '', '', '']);
    rowsX.push(['', 'EXAMPLE (delete this row)', 'EXAMPLE: sample', 'x', '', 'Yes', 'Yes', '', '', '', '', '', '', '']);
    rowsX.push(['', 'General', '', 'Answer without question', '', 'Yes', 'Yes', '', '', '', '', '', '', '']);
    rowsX.push(['', 'General', 'Bad flag?', 'ok', '', 'maybe', 'Yes', '', '', '', '', '', '', '']);
    const bookBuf = xlsxUtil.writeWorkbook([{ name: 'FAQs', columns: header.map(h => ({ header: h })), rows: rowsX }]);
    const upForm = (mode, strategy = 'merge', buf = bookBuf, name = 'faqs.xlsx') => multipart({ mode, strategy }, [{ name: 'file', filename: name, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buf }]);
    const pv = upForm('preview');
    const fPreview = await requestApi('POST', '/api/admin/faqs/import', pv.body, { ...auth, ...pv.headers });
    const countAfterPreview = await Faq.count();
    const ap = upForm('apply');
    const fApply = await requestApi('POST', '/api/admin/faqs/import', ap.body, { ...auth, ...ap.headers });
    const ap2 = upForm('apply');
    const fApplyAgain = await requestApi('POST', '/api/admin/faqs/import', ap2.body, { ...auth, ...ap2.headers });
    const fPagePre = await requestApi('GET', '/api/content/faqs?for=pre-marriage');
    const fPageHealth = await requestApi('GET', '/api/content/faqs?for=intimate-health');
    const fFaqPage = await requestApi('GET', '/api/content/faqs');
    const fHomeList = await requestApi('GET', '/api/content/faqs?for=home');
    const badFile = upForm('preview', 'merge', Buffer.from('not an excel file at all'), 'old.xls');
    const fBad = await requestApi('POST', '/api/admin/faqs/import', badFile.body, { ...auth, ...badFile.headers });
    const edImport = await requestApi('POST', '/api/admin/faqs/import', pv.body, { ...opsAuth, ...pv.headers });
    recordTest('FAQ Excel: sample download, preview saves nothing, 420 rows import with problems listed by row, same file again changes nothing',
      fTemplate.status === 200 && /spreadsheetml/.test(fTemplate.headers['content-type']) && /attachment/.test(fTemplate.headers['content-disposition']) &&
      fPreview.status === 200 && fPreview.data.data.create === 420 && fPreview.data.data.saved === false && fPreview.data.data.example_rows === 1 &&
      fPreview.data.data.error_count === 2 && fPreview.data.data.errors.some(e => e.row === 423 && /Question is empty/.test(e.message)) &&
      fPreview.data.data.errors.some(e => e.row === 424 && /Yes or No/.test(e.message)) && countAfterPreview === 1 &&
      fApply.status === 200 && fApply.data.data.saved === true && (await Faq.count()) === 421 &&
      fApplyAgain.data.data.create === 0 && fApplyAgain.data.data.unchanged === 420 &&
      fBad.status === 400 && /xlsx/i.test(fBad.data.message) && edImport.status === 403);
    const oneAnswer = await requestApi('GET', `/api/content/faqs/${fFaqPage.data.data[0].id}`);
    const noAnswer = await requestApi('GET', '/api/content/faqs/99999999');
    recordTest('FAQ page lists questions only (answers open one at a time); "What We Do" boxes get their first 8 with the total',
      fFaqPage.data.data.length === 420 && fFaqPage.data.total === 420 && fFaqPage.data.data.every(f => f.answer_html === undefined && f.question && f.category) &&
      oneAnswer.status === 200 && !!oneAnswer.data.data.answer_html && oneAnswer.data.data.question === fFaqPage.data.data[0].question &&
      !!oneAnswer.headers['ratelimit-limit'] && noAnswer.status === 404 &&
      fPagePre.data.data.length === 8 && fPagePre.data.total === 210 && fPagePre.headers['x-total-count'] === '210' && fPageHealth.data.total === 84);
    recordTest('FAQs show where chosen: FAQ page, homepage only, and each "What We Do" page; answers keep bullets and links',
      fPagePre.data.total === 210 && fPageHealth.data.total === 84 && fFaqPage.data.data.length === 420 &&
      fHomeList.data.data.length === 1 && fHomeList.data.data[0].id === fHome.data.data.id && !fFaqPage.data.data.some(f => f.id === fHome.data.data.id) &&
      /<ul><li>first point<\/li>/.test(fPagePre.data.data[0].answer_html) && /<a href="confidentiality.htm">/.test(fHome.data.data.answer_html));

    const someIds = fFaqPage.data.data.slice(0, 5).map(f => f.id);
    const fBulk = await requestApi('POST', '/api/admin/faqs/bulk', { ids: someIds, action: 'add_page', page: 'divorce-mediation' }, auth);
    const fBulkHide = await requestApi('POST', '/api/admin/faqs/bulk', { ids: someIds.slice(0, 2), action: 'hide' }, auth);
    const fDivorce = await requestApi('GET', '/api/content/faqs?for=divorce-mediation');
    const fExport = await requestApi('GET', '/api/admin/faqs/export', null, auth);
    const rp = upForm('preview', 'replace', xlsxUtil.writeWorkbook([{ name: 'FAQs', columns: header.map(h => ({ header: h })), rows: rowsX.slice(0, 10) }]));
    const fReplace = await requestApi('POST', '/api/admin/faqs/import', rp.body, { ...auth, ...rp.headers });
    const fMeta = await requestApi('GET', '/api/admin/faqs/meta', null, auth);
    recordTest('FAQ bulk actions (add a page, hide), Excel download, "replace" preview never touches homepage questions',
      fBulk.data.data.changed === 5 && fBulkHide.data.data.changed === 2 && fDivorce.data.data.length === 3 && fDivorce.data.total === 3 &&
      fExport.status === 200 && /spreadsheetml/.test(fExport.headers['content-type']) &&
      fReplace.data.data.remove === 410 && fReplace.data.data.off_faq_page === 0 && fReplace.data.data.saved === false &&
      fMeta.data.data.pages.length === 7 && fMeta.data.data.home === 1);
    await Faq.destroy({ where: { question: { [require('sequelize').Op.like]: 'Bulk question %' } } });

    // -----------------------------------------------------------------------
    // Phase 7k: Student / ex-servicemen ID verification and one consultation at a time
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 7k: ID verification & booking rules ---');
    const { IdVerification } = sequelize.models;
    await IdVerification.destroy({ where: {} });
    const oldV = await UserModel.findAll({ where: { email: ['aarav.student@example.com', 'ravi.esm@example.com'] } });
    if (oldV.length) {
      await Appointment.destroy({ where: { user_id: oldV.map(u => u.id) } });
      await sequelize.models.MediaAsset.destroy({ where: { uploaded_by_user_id: oldV.map(u => u.id) } });
    }
    const stud = { name: 'Aarav Desai', email: 'aarav.student@example.com', phone: '+91 98200 33445', password: 'Secure123', consent: true };
    await UserModel.destroy({ where: { email: stud.email } });
    const stReg = await requestApi('POST', '/api/auth/customer/register', stud);
    const stSession = cookiesFrom(stReg).find(c => c.startsWith('spouzy_session='));
    const stCookie = { Cookie: `${stSession}; spouzy_csrf=tokV`, 'X-CSRF-Token': 'tokV' };
    const idJpg = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(2048, 9)]);
    const future = addMonths(todayIST(), 10);
    const vForm = (fields, withFile = true) => multipart(fields, withFile ? [{ name: 'front', filename: 'college-id.jpg', type: 'image/jpeg', buf: idJpg }] : []);
    const v0 = await requestApi('GET', '/api/customer/verification', null, stCookie);
    const noFile = vForm({ category: 'student', institution_name: 'Fergusson College', expiry_date: future }, false);
    const vNoFile = await requestApi('POST', '/api/customer/verification', noFile.body, { ...stCookie, ...noFile.headers });
    const oldId = vForm({ category: 'student', institution_name: 'Fergusson College', expiry_date: addDays(todayIST(), -2) });
    const vOld = await requestApi('POST', '/api/customer/verification', oldId.body, { ...stCookie, ...oldId.headers });
    const okForm = vForm({ category: 'student', institution_name: 'Fergusson College', id_number: 'FC-2026-114', expiry_date: future });
    const vOk = await requestApi('POST', '/api/customer/verification', okForm.body, { ...stCookie, ...okForm.headers });
    const cfgPending = await requestApi('GET', '/api/scheduling/config', null, stCookie);
    const vNote = await Notification.findOne({ where: { type: 'id_verification' }, order: [['id', 'DESC']] });
    recordTest('Student uploads an ID proof (photo/PDF, expiry date); missing file or expired ID refused; admin notified; benefit waits for approval',
      v0.status === 200 && v0.data.data.latest === null && v0.data.data.can_upload === true &&
      vNoFile.status === 400 && !!vNoFile.data.errors?.front && vOld.status === 400 && !!vOld.data.errors?.expiry_date &&
      vOk.status === 200 && vOk.data.data.latest.status === 'pending' && vOk.data.data.can_upload === false && vOk.data.data.benefit.active === false &&
      !!vNote && vNote.link.startsWith('/verifications') &&
      cfgPending.data.data.free.earliestDate === addMonths(todayIST(), 2) && cfgPending.data.data.account.verification.status === 'pending');

    const vid = vOk.data.data.latest.id;
    const vRow = await IdVerification.findByPk(vid);
    const opsList = await requestApi('GET', '/api/admin/verifications', null, opsAuth);
    const opsFile = await requestApi('GET', `/api/media/private/${vRow.front_asset_id}`, null, opsAuth);
    const adminFile = await requestApi('GET', `/api/media/private/${vRow.front_asset_id}`, null, auth);
    const custFile = await requestApi('GET', `/api/media/private/${vRow.front_asset_id}`, null, stCookie);
    const vList = await requestApi('GET', '/api/admin/verifications?state=pending', null, auth);
    const rejShort = await requestApi('POST', `/api/admin/verifications/${vid}/reject`, { message: 'blurry' }, auth);
    const rej = await requestApi('POST', `/api/admin/verifications/${vid}/reject`, { message: 'The photo is blurry and the expiry date cannot be read. Please upload a clear photo of the front of your college ID.' }, auth);
    const vAfterRej = await requestApi('GET', '/api/customer/verification', null, stCookie);
    recordTest('Only the admin sees ID proofs (operations staff and customers cannot); a rejection needs a reason and the customer sees it with a new upload option',
      opsList.status === 403 && opsFile.status === 403 && adminFile.status === 200 && [401, 403].includes(custFile.status) &&
      vList.status === 200 && vList.data.data.items.some(i => i.id === vid && i.files.length === 1 && i.customer.email === stud.email) &&
      rejShort.status === 400 && rej.status === 200 && rej.data.data.status === 'rejected' &&
      vAfterRej.data.data.latest.status === 'rejected' && /blurry/.test(vAfterRej.data.data.latest.admin_message) && vAfterRej.data.data.can_upload === true);

    const reForm = vForm({ category: 'student', institution_name: 'Fergusson College', id_number: 'FC-2026-114', expiry_date: future });
    const vRe = await requestApi('POST', '/api/customer/verification', reForm.body, { ...stCookie, ...reForm.headers });
    const vid2 = vRe.data.data.latest.id;
    const appr = await requestApi('POST', `/api/admin/verifications/${vid2}/approve`, {}, auth);
    const cfgOk = await requestApi('GET', '/api/scheduling/config', null, stCookie);
    // first open free slot from today (the benefit) in the next weeks
    let freeDay = null;
    let freeSlot = null;
    for (let d = 1; d <= 20 && !freeSlot; d++) {
      const day = addDays(todayIST(), d);
      const av = await requestApi('GET', `/api/scheduling/availability?date=${day}&duration=30&serviceSlug=couples-therapy&bookingType=free`, null, stCookie);
      const sl = (av.data.data.slots || []).find(x => x.status === 'available');
      if (sl) { freeDay = day; freeSlot = sl.start_time; }
    }
    const guestAv = freeDay ? await requestApi('GET', `/api/scheduling/availability?date=${freeDay}&duration=30&serviceSlug=couples-therapy&bookingType=free`) : { data: { data: {} } };
    const freeBooking = { serviceSlug: 'couples-therapy', practitionerId: 'any', bookingType: 'free', date: freeDay, startTime: freeSlot, duration: 30, consultationMode: 'virtual', clientName: 'x', clientEmail: 'x@example.com', clientMobile: '+91 90000 00000', consent: true };
    const fb1 = await requestApi('POST', '/api/appointments', freeBooking, stCookie);
    const fbPaid = await requestApi('POST', '/api/appointments', { ...freeBooking, bookingType: 'paid' }, stCookie);
    recordTest('Approved student: free consultation from today (others still wait 2 months); only one consultation at a time, also paid',
      appr.status === 200 && appr.data.data.state === 'approved' && cfgOk.data.data.free.earliestDate === todayIST() && cfgOk.data.data.account.benefit.active === true &&
      cfgOk.data.data.account.benefit.valid_until === future && !!freeSlot && guestAv.data.data.is_closed === true &&
      fb1.status === 201 && fb1.data.data.bookingType === 'free' && fbPaid.status === 409 && fbPaid.data.code === 'ACTIVE_BOOKING' && /already have a consultation/.test(fbPaid.data.message));

    await Appointment.update({ status: 'completed' }, { where: { reference_no: fb1.data.data.referenceNo } });
    const av2 = await requestApi('GET', `/api/scheduling/availability?date=${freeDay}&duration=30&serviceSlug=couples-therapy&bookingType=free`, null, stCookie);
    const slot2 = (av2.data.data.slots || []).find(x => x.status === 'available');
    const fb2 = await requestApi('POST', '/api/appointments', { ...freeBooking, startTime: slot2?.start_time }, stCookie);
    await Appointment.update({ status: 'cancelled' }, { where: { reference_no: fb2.data.data?.referenceNo || '' } });
    await IdVerification.update({ expiry_date: addDays(todayIST(), -1) }, { where: { id: vid2 } });
    const cfgExpired = await requestApi('GET', '/api/scheduling/config', null, stCookie);
    const fbExpired = await requestApi('POST', '/api/appointments', freeBooking, stCookie);
    const expList = await requestApi('GET', '/api/admin/verifications?state=expired', null, auth);
    recordTest('After the first consultation is done the next can be booked; when the student ID expires the benefit stops (free again only from 2 months)',
      fb2.status === 201 && cfgExpired.data.data.free.earliestDate === addMonths(todayIST(), 2) && cfgExpired.data.data.account.benefit.active === false &&
      cfgExpired.data.data.account.benefit.expired_on === addDays(todayIST(), -1) && fbExpired.status === 400 && !!fbExpired.data.errors?.date &&
      expList.data.data.items.some(i => i.id === vid2));

    // Ex-servicemen: no expiry, yearly reminder for the team
    const esm = { name: 'Major Ravi Singh', email: 'ravi.esm@example.com', phone: '+91 98200 66778', password: 'Secure123', consent: true };
    await UserModel.destroy({ where: { email: esm.email } });
    const esReg = await requestApi('POST', '/api/auth/customer/register', esm);
    const esCookie = { Cookie: `${cookiesFrom(esReg).find(c => c.startsWith('spouzy_session='))}; spouzy_csrf=tokE`, 'X-CSRF-Token': 'tokE' };
    const esNoBranch = vForm({ category: 'ex_servicemen' });
    const esBad = await requestApi('POST', '/api/customer/verification', esNoBranch.body, { ...esCookie, ...esNoBranch.headers });
    const esForm = multipart({ category: 'ex_servicemen', service_branch: 'Army', id_number: 'ESM-44521' }, [
      { name: 'front', filename: 'esm-card.pdf', type: 'application/pdf', buf: pdfBuf },
      { name: 'back', filename: 'esm-back.jpg', type: 'image/jpeg', buf: idJpg }
    ]);
    const esOk = await requestApi('POST', '/api/customer/verification', esForm.body, { ...esCookie, ...esForm.headers });
    const esId = esOk.data.data?.latest?.id;
    const esAppr = await requestApi('POST', `/api/admin/verifications/${esId}/approve`, {}, auth);
    const esCfg = await requestApi('GET', '/api/scheduling/config', null, esCookie);
    await IdVerification.update({ reviewed_at: new Date(Date.now() - 400 * 24 * 3600 * 1000) }, { where: { id: esId } });
    const remList = await requestApi('GET', '/api/admin/verifications?state=reminders', null, auth);
    const raised = await require('../src/services/verification.service').raiseYearlyReminders();
    const raisedAgain = await require('../src/services/verification.service').raiseYearlyReminders();
    const remNote = await Notification.findOne({ where: { type: 'esm_reminder' }, order: [['id', 'DESC']] });
    const esMine = await requestApi('GET', '/api/customer/verification', null, esCookie);
    const reminded = await requestApi('POST', `/api/admin/verifications/${esId}/reminded`, {}, auth);
    recordTest('Ex-servicemen: service required, front and back files, no expiry; yearly reminder for the team once a year; the customer sees it too',
      esBad.status === 400 && !!esBad.data.errors?.service_branch && esOk.status === 200 && esOk.data.data.latest.files.length === 2 &&
      esAppr.status === 200 && esAppr.data.data.expiry_date === null && esCfg.data.data.free.earliestDate === todayIST() &&
      remList.data.data.items.some(i => i.id === esId) && raised === 1 && raisedAgain === 0 && !!remNote &&
      esMine.data.data.benefit.reminder_due === true && reminded.status === 200 && !!reminded.data.data.reminded_at);
    await Appointment.destroy({ where: { user_id: { [require('sequelize').Op.in]: [stReg.data.data?.user?.id || 0, esReg.data.data?.user?.id || 0] } } }).catch(() => {});

    // Category bypass, file type enforcement & orphan cleanup
    const regBadCat = await requestApi('POST', '/api/auth/customer/register', { name: 'Bad Cat', email: 'badcat@example.com', phone: '+91 98200 77001', password: 'Secure123', consent: true, category: 'vip_member' });
    const regStudentNoDocs = await requestApi('POST', '/api/auth/customer/register', { name: 'Bypass Stud', email: 'bypass@example.com', phone: '+91 98200 77002', password: 'Secure123', consent: true, category: 'student' });
    const regNeitherCompat = await requestApi('POST', '/api/auth/customer/register', { name: 'Regular Compat', email: 'regcompat@example.com', phone: '+91 98200 77003', password: 'Secure123', consent: true, category: 'neither' });
    const compatSession = cookiesFrom(regNeitherCompat).find(c => c.startsWith('spouzy_session='));
    const compatCookie = { Cookie: `${compatSession}; spouzy_csrf=tokC`, 'X-CSRF-Token': 'tokC' };
    const assetsBeforeBad = await MediaAsset.count();
    const badCatVer = vForm({ category: 'vip_member', institution_name: 'Test', expiry_date: future });
    const resBadCatVer = await requestApi('POST', '/api/customer/verification', badCatVer.body, { ...compatCookie, ...badCatVer.headers });
    const webpBuf = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(16, 0)]);
    const webpForm = multipart({ category: 'student', institution_name: 'Fergusson College', expiry_date: future }, [{ name: 'front', filename: 'id.webp', type: 'image/webp', buf: webpBuf }]);
    const resWebpFront = await requestApi('POST', '/api/customer/verification', webpForm.body, { ...compatCookie, ...webpForm.headers });
    const badBackForm = multipart({ category: 'student', institution_name: 'Fergusson College', expiry_date: future }, [
      { name: 'front', filename: 'front.jpg', type: 'image/jpeg', buf: idJpg },
      { name: 'back', filename: 'fake-back.jpg', type: 'image/jpeg', buf: Buffer.from('not-a-jpeg') }
    ]);
    const resBadBackMagic = await requestApi('POST', '/api/customer/verification', badBackForm.body, { ...compatCookie, ...badBackForm.headers });
    const badBranchForm = vForm({ category: 'ex_servicemen', service_branch: 'Space Force' });
    const resBadBranch = await requestApi('POST', '/api/customer/verification', badBranchForm.body, { ...compatCookie, ...badBranchForm.headers });
    const assetsAfterBad = await MediaAsset.count();
    const compatVerifyStatus = await requestApi('GET', '/api/customer/verification', null, compatCookie);
    recordTest('Direct API rejects unknown/bypassed categories, enforces JPG/PNG/PDF, and leaves zero orphan files on failure',
      regBadCat.status === 400 && regStudentNoDocs.status === 400 && regNeitherCompat.status === 201 &&
      resBadCatVer.status === 400 && resWebpFront.status === 400 && !!resWebpFront.data.errors?.front &&
      resBadBackMagic.status === 400 && resBadBranch.status === 400 && !!resBadBranch.data.errors?.service_branch &&
      assetsBeforeBad === assetsAfterBad && compatVerifyStatus.data.data.latest === null);
    await UserModel.destroy({ where: { email: 'regcompat@example.com' } }).catch(() => {});

    // -----------------------------------------------------------------------
    // STEP 12: CSV Formula Injection Protection
    // -----------------------------------------------------------------------
    console.log('\n--- Phase 8: CSV Formula Injection Protection ---');
    const dangerousFormulas = [
      '=cmd|\' /C calc\'!A0',
      '+1+1',
      '-2+2',
      '@SUM(1,2)',
      '\tcmd.exe'
    ];

    let allSanitized = true;
    for (const formula of dangerousFormulas) {
      const sanitized = sanitizeCsvValue(formula);
      // Sanitized value must start with quote and single quote: "'=..."
      if (!sanitized.startsWith("\"'") && !sanitized.startsWith("'")) {
        allSanitized = false;
      }
    }
    recordTest('CSV Formula Injection protection (CWE-1236)', allSanitized);

    // -----------------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------------
    console.log('\n======================================================');
    console.log('                 TEST SUITE SUMMARY                   ');
    console.log('======================================================');
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`Total Tests Run: ${results.length}`);
    console.log(`Passed:          ${passedCount}`);
    console.log(`Failed:          ${failedCount}`);
    console.log('======================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      console.log('ALL TESTS PASSED WITH 100% SUCCESS.\n');
      process.exit(0);
    }

  } catch (err) {
    console.error('\n[FATAL ERROR IN TEST RUNNER]:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
}

runTestSuite();
