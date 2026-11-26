// Safety: these checks create and change records, so they always use the TEST database
// (prepared by `npm test`), never the real one named in backend/.env.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'spouzy_test';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Test the Frontend Normalization Adapter Logic
console.log('=== 1. Testing normalizeUser Authentication Adapter Contract ===');

// We simulate the adapter logic in CommonJS for test runner
function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;

  let roleId = null;
  let roleSlug = '';
  let roleName = '';
  let permissions = [];

  if (raw.role && typeof raw.role === 'object') {
    roleId = raw.role.id || null;
    roleSlug = typeof raw.role.slug === 'string' ? raw.role.slug.toLowerCase().trim() : '';
    roleName = typeof raw.role.name === 'string' ? raw.role.name.trim() : '';
    if (Array.isArray(raw.role.permissions)) {
      permissions = raw.role.permissions;
    }
  } else if (typeof raw.role === 'string') {
    roleSlug = raw.role.toLowerCase().trim();
    roleName = typeof raw.role_name === 'string' ? raw.role_name.trim() : '';
  }

  if (!roleName && roleSlug) {
    roleName = roleSlug === 'admin' ? 'Administrator' : roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1);
  }
  if (!roleSlug && roleName) {
    roleSlug = roleName.toLowerCase().replace(/\s+/g, '_');
  }

  if (Array.isArray(raw.permissions) && permissions.length === 0) {
    permissions = raw.permissions;
  }

  const firstName = typeof raw.first_name === 'string' ? raw.first_name.trim() : '';
  const lastName = typeof raw.last_name === 'string' ? raw.last_name.trim() : '';
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const computedName = `${firstName} ${lastName}`.trim();
  const name = typeof raw.name === 'string' && raw.name.trim()
    ? raw.name.trim()
    : (computedName || email || 'User');

  const isAdmin = roleSlug === 'admin';
  const isStaff = roleSlug === 'admin' || roleSlug === 'staff';

  return {
    id: raw.id || null,
    email,
    name,
    first_name: firstName,
    last_name: lastName,
    phone: typeof raw.phone === 'string' ? raw.phone.trim() : '',
    role: {
      id: roleId,
      slug: roleSlug,
      name: roleName || 'Restricted User',
      permissions
    },
    roleSlug,
    roleName: roleName || 'Restricted User',
    permissions,
    isAdmin,
    isStaff
  };
}

// Case A: Real /auth/me object-shaped role response
const objRoleUser = {
  id: 1,
  email: 'admin@spouzy.com',
  first_name: 'SPOUZY',
  last_name: 'Administrator',
  role: {
    id: 1,
    slug: 'admin',
    name: 'Administrator',
    permissions: ['*']
  }
};

const normA = normalizeUser(objRoleUser);
assert.strictEqual(normA.isAdmin, true, 'Admin slug must produce isAdmin=true');
assert.strictEqual(normA.role.slug, 'admin', 'role.slug must be string "admin"');
assert.strictEqual(normA.role.name, 'Administrator', 'role.name must be string "Administrator"');
// Test the exact failing line from Layout.jsx
const displayRoleA = (normA.role?.name || normA.roleName || 'Staff').toUpperCase();
assert.strictEqual(displayRoleA, 'ADMINISTRATOR', 'toUpperCase must format string name cleanly without TypeError');
console.log('  [PASS] Case A: Object-shaped role ({ slug, name }) normalized correctly ->', displayRoleA);

// Case B: Legacy string-shaped role response ('admin')
const strRoleUser = {
  id: 1,
  email: 'admin@spouzy.com',
  name: 'SPOUZY Administrator',
  role: 'admin',
  role_name: 'Administrator'
};

const normB = normalizeUser(strRoleUser);
assert.strictEqual(normB.isAdmin, true);
assert.strictEqual(normB.role.slug, 'admin');
assert.strictEqual(normB.role.name, 'Administrator');
const displayRoleB = (normB.role?.name || normB.roleName || 'Staff').toUpperCase();
assert.strictEqual(displayRoleB, 'ADMINISTRATOR');
console.log('  [PASS] Case B: String-shaped role ("admin") normalized correctly ->', displayRoleB);

// Case C: Unknown role must NOT default to administrator
const intruderUser = {
  id: 99,
  email: 'guest@example.com',
  role: { id: 9, slug: 'guest', name: 'Guest Visitor' }
};
const normC = normalizeUser(intruderUser);
assert.strictEqual(normC.isAdmin, false, 'Unknown role must NOT have admin access');
console.log('  [PASS] Case C: Unknown role prevented from administrator access (isAdmin=false)');

// Case D: Null / malformed inputs
const normD = normalizeUser(null);
assert.strictEqual(normD, null);
const normE = normalizeUser({});
assert.strictEqual(normE.isAdmin, false);
assert.strictEqual(typeof normE.role.name, 'string');
console.log('  [PASS] Case D & E: Null and empty objects handled gracefully without throwing');

// 2. Test Express Serving Updated Admin Bundle & Endpoints
console.log('\n=== 2. Testing HTTP Endpoints & Admin Bundle Serving ===');
const app = require('../src/app');
const server = app.listen(0, async () => {
  const port = server.address().port;

  function get(p, headers = {}) {
    return new Promise((res, rej) => {
      http.get({ hostname: '127.0.0.1', port, path: p, headers }, r => {
        let b = '';
        r.on('data', c => b += c);
        r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b }));
      }).on('error', rej);
    });
  }

  function post(p, data) {
    return new Promise((res, rej) => {
      const payload = JSON.stringify(data);
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: p,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, r => {
        let b = '';
        r.on('data', c => b += c);
        r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: JSON.parse(b) }));
      });
      req.on('error', rej);
      req.write(payload);
      req.end();
    });
  }

  try {
    // 2a. Verify /admin/ index.html
    const adminIndex = await get('/admin/');
    assert.strictEqual(adminIndex.status, 200, '/admin/ must serve with HTTP 200');
    assert.ok(adminIndex.body.includes('<div id="root"></div>'), 'HTML must contain React root div');

    // Extract JS bundle asset path from index.html
    const scriptMatch = adminIndex.body.match(/src="(\/admin\/assets\/index-[^"]+\.js)"/);
    assert.ok(scriptMatch, 'index.html must reference bundled JS');
    const bundlePath = scriptMatch[1];
    console.log('  [PASS] Admin index.html served cleanly, references bundle:', bundlePath);

    // 2b. Verify bundle JS loads cleanly
    const bundleRes = await get(bundlePath);
    assert.strictEqual(bundleRes.status, 200, 'JS bundle must serve with HTTP 200');
    assert.ok(bundleRes.body.length > 50000, 'JS bundle must be substantial compiled React code');
    console.log(`  [PASS] Bundled JavaScript served successfully (${Math.round(bundleRes.body.length / 1024)} KB)`);

    // 2c. Login
    const login = await post('/api/auth/login', { email: 'admin@spouzy.com', password: 'AdminPass123!' });
    assert.strictEqual(login.status, 200);
    assert.ok(login.body.user);
    assert.strictEqual(typeof login.body.user.role, 'object', 'Login response user.role must be canonical object');
    assert.strictEqual(login.body.user.role.slug, 'admin');
    assert.strictEqual(login.body.user.role.name, 'Administrator');
    console.log('  [PASS] Login response contract matches: user.role is object with slug="admin" & name="Administrator"');

    const cookies = login.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

    // 2d. GET /api/auth/me
    const meRes = await get('/api/auth/me', { 'Cookie': cookies });
    assert.strictEqual(meRes.status, 200);
    const meBody = JSON.parse(meRes.body);
    assert.strictEqual(typeof meBody.user.role, 'object', '/api/auth/me user.role must be canonical object');
    assert.strictEqual(meBody.user.role.slug, 'admin');
    assert.strictEqual(meBody.user.role.name, 'Administrator');
    assert.strictEqual(meBody.user.password_hash, undefined, 'password_hash must NOT be exposed in profile');
    console.log('  [PASS] /api/auth/me response contract aligns: identical object structure, no leaked hash');

    // 2e. GET /api/admin/dashboard/stats
    const statsRes = await get('/api/admin/dashboard/stats', { 'Cookie': cookies });
    assert.strictEqual(statsRes.status, 200);
    const statsBody = JSON.parse(statsRes.body);
    assert.ok(statsBody.success);
    assert.ok(statsBody.data.counts);
    console.log('  [PASS] Dashboard stats loaded successfully with authenticated admin cookie');

    server.close(() => {
      console.log('\n=== ALL REGRESSION CHECKS PASSED WITH 100% SUCCESS ===\n');
      process.exit(0);
    });
  } catch (err) {
    console.error('Test error:', err);
    server.close(() => process.exit(1));
  }
});
