const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5567;
const CDP_PORT = 9467;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-submit-test-' + Date.now());

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(u) {
  return new Promise((resolve, reject) => {
    http.get(u, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function startStaticServer(port) {
  const mimeTypes = {
    '.html': 'text/html', '.htm': 'text/html',
    '.css': 'text/css', '.js': 'application/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.webm': 'video/webm',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/book-appoinment.htm';
    const fp = path.join(process.cwd(), decodeURIComponent(p.replace(/^\//, '')));

    fs.stat(fp, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(fp).pipe(res);
    });
  });

  return new Promise(r => server.listen(port, () => r(server)));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }
  ready() { return new Promise(r => this.ws.readyState === WebSocket.OPEN ? r() : this.ws.onopen = r); }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch(e){} }
}

async function testSubmit() {
  let server, cp, client;
  try {
    server = await startStaticServer(HTTP_PORT);
    cp = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1440,1100'
    ]);

    for (let i = 0; i < 40; i++) {
      try {
        const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
        const t = targets.find(x => x.type === 'page');
        if (t) {
          client = new CDPClient(t.webSocketDebuggerUrl);
          await client.ready();
          break;
        }
      } catch(e) { await wait(250); }
    }

    if (!client) throw new Error('Could not connect to CDP');
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/book-appoinment.htm` });
    await wait(1000);

    // Mock window.open to intercept WhatsApp handoff URL
    await client.send('Runtime.evaluate', {
      expression: `
        window.__interceptedWaUrls = [];
        window.open = function(url) {
          window.__interceptedWaUrls.push(url);
          return null;
        };
      `
    });

    // 1. Submit empty - check validation error
    console.log('Submitting without inputs...');
    const submitEmptyRes = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const submitBtn = document.getElementById('spBookingSubmitBtn');
        submitBtn.click();
        const err = document.getElementById('spBookingValidationError');
        return {
          errVisible: err && err.style.display !== 'none',
          errMsg: err ? err.textContent.trim() : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Empty Submit Result:', submitEmptyRes.result.value);

    // 2. Select slot and fill form fields
    console.log('Filling form and selecting slot...');
    const fillAndSelectRes = await client.send('Runtime.evaluate', {
      expression: `(() => {
        // Click first available slot
        const availSlot = document.querySelector('.sp-slot-card.is-available');
        if (availSlot) availSlot.click();

        // Fill patient details
        document.getElementById('spPatientName').value = 'Aarav Mehta';
        document.getElementById('spPatientPhone').value = '+91 98765 43210';
        document.getElementById('spPatientEmail').value = 'aarav.mehta@example.com';
        document.getElementById('spPatientNotes').value = 'Interested in couples alignment consultation.';

        return {
          selectedSlot: document.getElementById('spSelectedTimeSlot').value
        };
      })()`,
      returnByValue: true
    });
    console.log('Fill Result:', fillAndSelectRes.result.value);

    // 3. Submit with valid inputs
    console.log('Submitting valid form...');
    const submitValidRes = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const submitBtn = document.getElementById('spBookingSubmitBtn');
        submitBtn.click();
        const feedback = document.getElementById('spBookingFeedback');
        return {
          interceptedUrl: window.__interceptedWaUrls[0],
          feedbackDisplayed: feedback && feedback.style.display !== 'none',
          feedbackText: feedback ? feedback.textContent.trim() : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Valid Submit Result:');
    console.log('- Intercepted WhatsApp URL:', decodeURIComponent(submitValidRes.result.value.interceptedUrl));
    console.log('- Feedback card displayed:', submitValidRes.result.value.feedbackDisplayed);
    console.log('- Feedback text:', submitValidRes.result.value.feedbackText);

    client.close();
  } catch (err) {
    console.error('Submit test failed:', err);
  } finally {
    if (cp) cp.kill();
    if (server) server.close();
  }
}

testSubmit();
