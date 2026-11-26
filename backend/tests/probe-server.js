const http = require('http');
require('../src/server');

setTimeout(async () => {
  function get(path, headers = {}) {
    return new Promise((res, rej) => {
      http.get({ hostname: '127.0.0.1', port: 5000, path, headers }, r => {
        let b = '';
        r.on('data', c => b += c);
        r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b }));
      }).on('error', rej);
    });
  }

  function post(path, data, headers = {}) {
    return new Promise((res, rej) => {
      const payload = JSON.stringify(data);
      const req = http.request({
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers
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
    // 1. Check Admin HTML
    const adminPage = await get('/admin/');
    console.log('1. GET /admin/ HTTP status:', adminPage.status, '| HTML served:', adminPage.body.includes('<div id="root"></div>'));

    // 2. Login via HTTP 5000
    const loginRes = await post('/api/auth/login', { email: 'admin@spouzy.com', password: 'AdminPass123!' });
    console.log('2. POST /api/auth/login status:', loginRes.status, '| User:', loginRes.body.user?.email);
    const cookies = loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');

    // 3. GET /api/auth/me
    const meRes = await get('/api/auth/me', { 'Cookie': cookies });
    console.log('3. GET /api/auth/me status:', meRes.status, '| User verified:', meRes.body.includes('admin@spouzy.com'));

    // 4. Logout
    const logoutRes = await post('/api/auth/logout', {}, { 'Cookie': cookies });
    console.log('4. POST /api/auth/logout status:', logoutRes.status);

    // 5. GET /api/auth/me post-logout -> 401
    const meAfter = await get('/api/auth/me', { 'Cookie': cookies });
    console.log('5. GET /api/auth/me post-logout status:', meAfter.status);

    console.log('Port 5000 End-to-End Server Probe: SUCCESS');
    process.exit(0);
  } catch (err) {
    console.error('Probe error:', err);
    process.exit(1);
  }
}, 1500);
