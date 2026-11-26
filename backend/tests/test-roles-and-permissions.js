// Safety: these checks create and change records, so they always use the TEST database
// (prepared by `npm test`), never the real one named in backend/.env.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'spouzy_test';
const http = require('http');
const app = require('../src/app');
const { User, Role, HomepageSection, HeroBanner, Tip, SiteSetting } = require('../src/models');
const { getEffectivePermissions } = require('../src/middlewares/rbac.middleware');

let server;
let port;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };
    if (postData && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function loginUser(email, password) {
  const res = await request('POST', '/api/auth/login', { email, password });
  const cookies = res.headers['set-cookie'] || [];
  return {
    status: res.status,
    body: res.data,
    cookie: cookies.map(c => c.split(';')[0]).join('; ')
  };
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passCount++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SPOUZY ROLE-BASED ACCESS & CONTENT VERIFICATION    ');
  console.log('======================================================\n');

  // Start internal test server on ephemeral port
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  port = server.address().port;
  console.log(`Test server running on port ${port}`);

  try {
    // ------------------------------------------------------------------------
    // 1. DEVELOPMENT USERS & AUTHENTICATION CONTRACT
    // ------------------------------------------------------------------------
    console.log('\n--- Test Suite 1: Logins & Effective Permission Normalization ---');

    const adminAuth = await loginUser('admin@spouzy.com', 'AdminPass123!');
    assert(adminAuth.status === 200, 'Administrator login returns HTTP 200');
    assert(adminAuth.body.user.role_slug === 'admin', 'Administrator role_slug is "admin"');
    assert(adminAuth.body.user.permissions.includes('all'), 'Administrator receives ["all"] permissions');

    const contentAuth = await loginUser('content@spouzy.test', '$3mV2sDW$Hh&DZ');
    assert(contentAuth.status === 200, 'Content Editor login returns HTTP 200');
    assert(contentAuth.body.user.role_slug === 'content_editor', 'Content Editor role_slug is "content_editor"');
    assert(contentAuth.body.user.permissions.includes('content:view'), 'Content Editor has "content:view"');
    assert(contentAuth.body.user.permissions.includes('blogs:view'), 'Content Editor has "blogs:view"');

    const opsAuth = await loginUser('operations@spouzy.test', 'wT%X6$k6A%PEA!');
    assert(opsAuth.status === 200, 'Operations Staff login returns HTTP 200');
    assert(opsAuth.body.user.role_slug === 'operations_staff', 'Operations Staff role_slug is "operations_staff"');
    assert(opsAuth.body.user.permissions.includes('enquiries:view'), 'Operations Staff has "enquiries:view"');

    const clinicalAuth = await loginUser('clinical@spouzy.test', 'Kkcg#7sSz5LXyQ');
    assert(clinicalAuth.status === 200, 'Clinical Director login returns HTTP 200');
    assert(clinicalAuth.body.user.role_slug === 'clinical_director', 'Clinical Director role_slug is "clinical_director"');
    assert(clinicalAuth.body.user.permissions.includes('clinical_apps:view'), 'Clinical Director has "clinical_apps:view"');

    // Profile endpoint (/api/auth/me) with effective permissions
    const meRes = await request('GET', '/api/auth/me', null, { Cookie: contentAuth.cookie });
    assert(meRes.status === 200, '/api/auth/me returns 200 with session cookie');
    assert(meRes.data.user.role_slug === 'content_editor', '/api/auth/me returns role_slug');
    assert(Array.isArray(meRes.data.user.effective_permissions), '/api/auth/me includes effective_permissions array');

    // ------------------------------------------------------------------------
    // 2. CONTENT EDITOR AUTHORIZED CAPABILITIES
    // ------------------------------------------------------------------------
    console.log('\n--- Test Suite 2: Content Editor Authorised Modules ---');

    // Content summary dashboard
    const summaryRes = await request('GET', '/api/admin/dashboard/content-summary', null, { Cookie: contentAuth.cookie });
    assert(summaryRes.status === 200, 'Content summary dashboard returns 200 for Content Editor');
    assert(summaryRes.data.data.homepageSections !== undefined, 'Summary includes homepageSections');
    assert(summaryRes.data.data.heroBanners !== undefined, 'Summary includes heroBanners');
    assert(summaryRes.data.data.tips !== undefined, 'Summary includes tips');

    // Homepage sections CRUD & Rollback
    const sectionsRes = await request('GET', '/api/admin/homepage-sections', null, { Cookie: contentAuth.cookie });
    assert(sectionsRes.status === 200, 'Content Editor can read homepage sections');
    assert(sectionsRes.data.data.length >= 11, 'All 11 homepage sections are retrieved');

    const updateSecRes = await request('PUT', '/api/admin/homepage-sections/why_spouzy', {
      headline: 'Why Trust SPOUZY With Your Most Personal Conversations? (Updated)',
      subheadline: 'Evidence-based relationship science meets clinical empathy.'
    }, { Cookie: contentAuth.cookie });
    assert(updateSecRes.status === 200, 'Content Editor can update homepage section');
    assert(updateSecRes.data.data.version >= 2, 'Version incremented on section update');

    const historyRes = await request('GET', '/api/admin/homepage-sections/why_spouzy/history', null, { Cookie: contentAuth.cookie });
    assert(historyRes.status === 200, 'Content Editor can view section revision history');
    assert(historyRes.data.data.length >= 1, 'Previous revision recorded in history table');

    const rollbackRes = await request('POST', '/api/admin/homepage-sections/why_spouzy/rollback', {
      version: 1
    }, { Cookie: contentAuth.cookie });
    assert(rollbackRes.status === 200, 'Content Editor can rollback section to version 1');

    // Hero Banners
    const bannersRes = await request('GET', '/api/admin/hero-banners', null, { Cookie: contentAuth.cookie });
    assert(bannersRes.status === 200, 'Content Editor can list hero banners');

    const newBannerRes = await request('POST', '/api/admin/hero-banners', {
      tag_eyebrow: 'Specialist Care',
      title_lead: 'Rebuilding Marital Connection',
      highlight_phrase: 'With Compassion',
      title_tail: 'and Hope',
      description_text: 'Compassionate care for couples.',
      cta1_text: 'Start Journey',
      cta1_url: '#start',
      background_image: 'image/hero-marriage.webp',
      is_active: false
    }, { Cookie: contentAuth.cookie });
    assert(newBannerRes.status === 201, 'Content Editor can create new hero banner');
    const createdBannerId = newBannerRes.data.data.id;

    const dupBannerRes = await request('POST', `/api/admin/hero-banners/${createdBannerId}/duplicate`, {}, { Cookie: contentAuth.cookie });
    assert(dupBannerRes.status === 201, 'Content Editor can duplicate banner slide as draft');
    assert(dupBannerRes.data.data.is_active === false, 'Duplicated slide created as draft (is_active: false)');

    // Relationship Tips
    const tipsRes = await request('GET', '/api/admin/tips', null, { Cookie: contentAuth.cookie });
    assert(tipsRes.status === 200, 'Content Editor can list relationship tips');

    const newTipRes = await request('POST', '/api/admin/tips', {
      tip_text: 'Active listening requires validating emotions before seeking solutions.',
      photo_url: 'image/menu/faq.webp',
      category: 'Communication',
      alt_text: 'Couple in peaceful conversation',
      rotation_interval: 7,
      is_active: true
    }, { Cookie: contentAuth.cookie });
    assert(newTipRes.status === 201, 'Content Editor can create tip with bound photo URL');

    // Social Links
    const socialRes = await request('GET', '/api/admin/social-links', null, { Cookie: contentAuth.cookie });
    assert(socialRes.status === 200, 'Content Editor can retrieve social links');

    const validSocialUpdate = await request('PUT', '/api/admin/social-links', {
      facebook: 'https://www.facebook.com/spouzyofficial',
      linkedin: 'https://www.linkedin.com/company/spouzy',
      x: 'https://x.com/spouzyofficial',
      instagram: 'https://www.instagram.com/spouzyofficial'
    }, { Cookie: contentAuth.cookie });
    assert(validSocialUpdate.status === 200, 'Valid allowlisted social links saved successfully');

    const invalidSocialUpdate = await request('PUT', '/api/admin/social-links', {
      facebook: 'https://malicious-site.com/spouzy'
    }, { Cookie: contentAuth.cookie });
    assert(invalidSocialUpdate.status === 400, 'Non-allowlist domain rejected with 400 Bad Request');

    const shareIntentUpdate = await request('PUT', '/api/admin/social-links', {
      x: 'https://x.com/intent/tweet?text=Spam'
    }, { Cookie: contentAuth.cookie });
    assert(shareIntentUpdate.status === 400, 'Share-intent URL rejected with 400 Bad Request');

    // Public Media library
    const mediaRes = await request('GET', '/api/admin/media', null, { Cookie: contentAuth.cookie });
    assert(mediaRes.status === 200, 'Content Editor can view public media library');

    // ------------------------------------------------------------------------
    // 3. STRICT FORBIDDEN ACCESS (FAIL CLOSED FOR CONTENT EDITOR)
    // ------------------------------------------------------------------------
    console.log('\n--- Test Suite 3: Content Editor Forbidden Routes (Strict 403) ---');

    const forbiddenCalls = [
      { name: 'Operational Dashboard Stats', path: '/api/admin/dashboard/stats', method: 'GET' },
      { name: 'Enquiries CRM List', path: '/api/admin/enquiries', method: 'GET' },
      { name: 'Enquiries CSV Export', path: '/api/admin/enquiries/export/csv', method: 'GET' },
      { name: 'Clinical Applications List', path: '/api/admin/clinical-applications', method: 'GET' },
      { name: 'Clinical Applications Export', path: '/api/admin/clinical-applications/export/csv', method: 'GET' },
      { name: 'Appointments List', path: '/api/admin/appointments', method: 'GET' },
      { name: 'Gateway Secrets Config', path: '/api/admin/gateway-config', method: 'GET' },
      { name: 'Staff Users Management', path: '/api/admin/users', method: 'GET' },
      { name: 'System Audit Logs', path: '/api/admin/audit-logs', method: 'GET' }
    ];

    for (const call of forbiddenCalls) {
      const res = await request(call.method, call.path, null, { Cookie: contentAuth.cookie });
      assert(res.status === 403, `Content Editor blocked from ${call.name} (HTTP 403 Forbidden)`);
    }

    // ------------------------------------------------------------------------
    // 4. ROLE ISOLATION FOR OPERATIONS & CLINICAL DIRECTOR
    // ------------------------------------------------------------------------
    console.log('\n--- Test Suite 4: Operations Staff & Clinical Director Access ---');

    // Operations staff can view enquiries and operational dashboard
    const opsEnqRes = await request('GET', '/api/admin/enquiries', null, { Cookie: opsAuth.cookie });
    assert(opsEnqRes.status === 200, 'Operations Staff can access Enquiries CRM (200 OK)');

    const opsStatsRes = await request('GET', '/api/admin/dashboard/stats', null, { Cookie: opsAuth.cookie });
    assert(opsStatsRes.status === 200, 'Operations Staff can access Operational Dashboard (200 OK)');

    // Operations staff blocked from editing hero banners or payment secrets
    const opsBannerBlock = await request('POST', '/api/admin/hero-banners', { title_lead: 'Fail' }, { Cookie: opsAuth.cookie });
    assert(opsBannerBlock.status === 403, 'Operations Staff blocked from creating hero banners (403)');

    const opsGwBlock = await request('GET', '/api/admin/gateway-config', null, { Cookie: opsAuth.cookie });
    assert(opsGwBlock.status === 403, 'Operations Staff blocked from gateway configuration (403)');

    // Clinical Director can view clinical applications and practitioners
    const clinAppRes = await request('GET', '/api/admin/clinical-applications', null, { Cookie: clinicalAuth.cookie });
    assert(clinAppRes.status === 200, 'Clinical Director can access Clinical Applications (200 OK)');

    const clinPractRes = await request('GET', '/api/admin/practitioners', null, { Cookie: clinicalAuth.cookie });
    assert(clinPractRes.status === 200, 'Clinical Director can access Practitioners (200 OK)');

    const clinGwBlock = await request('GET', '/api/admin/gateway-config', null, { Cookie: clinicalAuth.cookie });
    assert(clinGwBlock.status === 403, 'Clinical Director blocked from gateway configuration (403)');

    // ------------------------------------------------------------------------
    // 5. PUBLIC WEBSITE ENDPOINTS
    // ------------------------------------------------------------------------
    console.log('\n--- Test Suite 5: Public Website APIs ---');

    const pubSectionsRes = await request('GET', '/api/content/homepage-sections');
    assert(pubSectionsRes.status === 200, 'Public can fetch /api/content/homepage-sections (200 OK)');
    assert(pubSectionsRes.data.data.length >= 11, 'Public receives all visible homepage sections');

    const pubSocialRes = await request('GET', '/api/content/social-links');
    assert(pubSocialRes.status === 200, 'Public can fetch /api/content/social-links (200 OK)');
    assert(pubSocialRes.data.data.facebook !== undefined, 'Public receives verified social links');

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }

  console.log('\n======================================================');
  console.log(`   TEST RESULTS: ${passCount} Passed, ${failCount} Failed`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
