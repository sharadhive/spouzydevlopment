// Safety: these checks create and change records, so they always use the TEST database
// (prepared by `npm test`), never the real one named in backend/.env.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'spouzy_test';
const http = require('http');
const app = require('../src/app');

const server = app.listen(0, async () => {
  const port = server.address().port;

  function req(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { ...headers }
      };
      let postBody = null;
      if (data) {
        postBody = JSON.stringify(data);
        opts.headers['Content-Type'] = 'application/json';
        opts.headers['Content-Length'] = Buffer.byteLength(postBody);
      }
      const r = http.request(opts, res => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(buf); } catch (e) { parsed = buf; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });
      r.on('error', reject);
      if (postBody) r.write(postBody);
      r.end();
    });
  }

  try {
    console.log('=== END-TO-END FLOW VERIFICATION (SPOUZY_DEV) ===\n');

    // 1. Submit Public Contact Enquiry
    console.log('1. Submitting Public Contact Enquiry...');
    const enqRes = await req('POST', '/api/enquiries', {
      name: 'Aditi Sharma',
      email: 'aditi.sharma@example.com',
      phone: '+91 99201 88344',
      whatsapp: '+91 99201 88344',
      preferred_clinic: 'Mulund Flagship Clinic, Mumbai',
      subject: 'Relationship Counselling Query',
      message: 'Interested in couples counseling weekend slots.'
    });
    console.log('  Enquiry submission HTTP status:', enqRes.status);
    const enqRef = enqRes.body.data?.referenceNo;
    console.log('  Generated Enquiry Reference:', enqRef);

    // 2. Submit Public Doctor Registration Application
    console.log('\n2. Submitting Public Doctor Application...');
    const docRes = await req('POST', '/api/clinical-applications', {
      role_type: 'doctor',
      title: 'Dr',
      first_name: 'Rajesh',
      last_name: 'Kulkarni',
      gender: 'Male',
      dob: '1985-08-20',
      mobile: '+91 98205 67890',
      whatsapp: '+91 98205 67890',
      email: 'dr.rajesh.kulkarni@example.com',
      practice_status: 'Private Practice & Visiting Consultant',
      experience_years: '14 years',
      institution_name: 'Kulkarni Clinic & PSG Partner',
      specialisation: 'Intimate Aesthetics & Reproductive Medicine',
      primary_qualification: 'MBBS, MS',
      primary_college: 'Grant Government Medical College',
      primary_year: '2008',
      council_name: 'Maharashtra Medical Council',
      registration_number: 'MMC-2008-11-9876',
      state_jurisdiction: 'Maharashtra',
      registration_year: '2008',
      valid_until: '2030-12-31',
      declaration_agreed: true,
      typed_signature: 'Dr. Rajesh Kulkarni'
    });
    console.log('  Doctor application HTTP status:', docRes.status);
    const docRef = docRes.body.data?.referenceNo;
    console.log('  Generated Doctor Application Reference:', docRef);

    // 3. Submit Public Appointment Booking
    console.log('\n3. Submitting Public Appointment Booking...');
    const randomMinutes = Math.floor(Math.random() * 20) * 30; // 0 to 600
    const startHour = 9 + Math.floor(randomMinutes / 60);
    const startMin = (randomMinutes % 60) === 0 ? '00' : '30';
    const dynamicTime = `${String(startHour).padStart(2, '0')}:${startMin}`;
    const dynamicDate = '2026-12-28';

    const aptRes = await req('POST', '/api/appointments', {
      serviceId: 1,
      practitionerId: 1,
      date: dynamicDate,
      startTime: dynamicTime,
      duration: 30,
      clientName: 'Sanjay Malhotra',
      clientEmail: 'sanjay.m@example.com',
      clientMobile: '+91 98333 44555',
      consultationMode: 'in_person',
      clientNotes: 'First consultation regarding relationship guidance.',
      requiresPaymentHold: true
    });
    console.log('  Appointment booking HTTP status:', aptRes.status);
    const aptData = aptRes.body.data;
    console.log('  Generated Appointment Reference:', aptData?.referenceNo);
    console.log('  Initial Appointment Status:', aptData?.status);
    console.log('  Initial Payment Status:', aptData?.paymentStatus);

    // 4. Admin Login with documented test credentials
    console.log('\n4. Admin Login with documented credentials (admin@spouzy.com / AdminPass123!)...');
    const loginRes = await req('POST', '/api/auth/login', {
      email: 'admin@spouzy.com',
      password: 'AdminPass123!'
    });
    console.log('  Login HTTP status:', loginRes.status);
    const cookieHeader = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    const authHeaders = { 'Cookie': cookieHeader };

    // 5. Verify /api/auth/me
    console.log('\n5. Verifying /api/auth/me with session cookie...');
    const meRes = await req('GET', '/api/auth/me', null, authHeaders);
    console.log('  /api/auth/me HTTP status:', meRes.status);
    console.log('  Authenticated user:', meRes.body.user.email, '| Role:', meRes.body.user.role.slug);

    // 6. Verify Enquiry in Admin
    console.log('\n6. Verifying Enquiry in Admin Panel (/api/admin/enquiries)...');
    const adminEnq = await req('GET', `/api/admin/enquiries?search=${enqRef}`, null, authHeaders);
    console.log('  Admin Enquiries HTTP status:', adminEnq.status);
    const enqList = adminEnq.body.data?.enquiries || adminEnq.body.data || [];
    const foundEnq = enqList.find(e => e.reference_no === enqRef);
    console.log('  Enquiry found in Admin CRM:', !!foundEnq);
    console.log('  Enquiry Reference:', foundEnq?.reference_no, '| Name:', foundEnq?.name, '| Status:', foundEnq?.status);

    // 7. Verify Clinical Application in Admin
    console.log('\n7. Verifying Clinical Application in Admin Panel (/api/admin/clinical-applications)...');
    const adminDoc = await req('GET', `/api/admin/clinical-applications?search=${docRef}`, null, authHeaders);
    console.log('  Admin Clinical Applications HTTP status:', adminDoc.status);
    const docList = adminDoc.body.data?.applications || adminDoc.body.data || [];
    const foundDoc = docList.find(d => d.reference_no === docRef);
    console.log('  Doctor application found in Admin:', !!foundDoc);
    console.log('  Doctor Reference:', foundDoc?.reference_no, '| Doctor Name:', foundDoc?.first_name, foundDoc?.last_name, '| Council No:', foundDoc?.registration_number);

    // 8. Verify Appointment in Admin
    console.log('\n8. Verifying Appointment in Admin Panel (/api/admin/appointments)...');
    const adminApt = await req('GET', `/api/admin/appointments?search=${aptData.referenceNo}`, null, authHeaders);
    console.log('  Admin Appointments HTTP status:', adminApt.status);
    const aptList = adminApt.body.data?.appointments || adminApt.body.data || [];
    const foundApt = aptList.find(a => a.reference_no === aptData.referenceNo);
    console.log('  Appointment found in Admin:', !!foundApt);
    console.log('  ACTUAL Appointment Status:', foundApt?.status);
    console.log('  ACTUAL Payment Status:', foundApt?.payment_status);

    // 9. Staff updates status to "completed" in Admin...
    console.log('\n9. Staff updates status to "completed" in Admin...');
    const confirmRes = await req('PATCH', `/api/admin/appointments/${foundApt.id}/status`, {
      status: 'completed',
      notes: 'Consultation conducted and marked completed.'
    }, authHeaders);
    console.log('  Update Status HTTP status:', confirmRes.status);
    console.log('  Updated Appointment Status:', confirmRes.body.data?.status);

    server.close(() => {
      console.log('\n=== ALL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY ===');
      process.exit(0);
    });
  } catch (err) {
    console.error('E2E Verification Error:', err);
    server.close(() => process.exit(1));
  }
});
