const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9335;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-test-hold';

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_loader_transition_v2';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
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
  ready() {
    return new Promise(resolve => {
      if (this.ws.readyState === WebSocket.OPEN) resolve();
      else this.ws.onopen = resolve;
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800'
  ]);

  try {
    let tabs = null;
    for (let i = 0; i < 20; i++) {
      try {
        tabs = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (tabs && tabs.length > 0) break;
      } catch (e) { await wait(200); }
    }
    const client = new CDPClient(tabs[0].webSocketDebuggerUrl);
    await client.ready();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(2200); // let first visit loader finish

    console.log('Navigating to about-us.htm...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const a = document.querySelector('a[href="about-us.htm"]');
        if (a) a.click();
      })()`
    });

    // Wait until URL changes to about-us.htm
    let t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      await wait(50);
      try {
        const res = await client.send('Runtime.evaluate', {
          expression: `window.location.pathname`,
          returnByValue: true
        });
        if (res.result.value && res.result.value.includes('about-us.htm')) {
          t0 = Date.now();
          console.log(`Arrived on about-us.htm at ${i * 50}ms`);
          break;
        }
      } catch (e) {}
    }

    // At t0 + 200ms: early ribbon
    await wait(200);
    const ss1 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '02-reveal-early.png'), Buffer.from(ss1.data, 'base64'));

    // At t0 + 700ms: mid reveal
    await wait(500);
    const ss2 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '03-reveal-mid.png'), Buffer.from(ss2.data, 'base64'));

    // At t0 + 1200ms: complete logo holding
    await wait(450);
    const ss3 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '04-hold-complete-logo.png'), Buffer.from(ss3.data, 'base64'));

    const overlayCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const o = document.getElementById('sp-page-loader');
        const img = o ? o.querySelector('img') : null;
        const rect = img ? img.getBoundingClientRect() : null;
        return {
          hasOverlay: !!o,
          isFading: o ? o.classList.contains('sp-loader-fade-out') : false,
          imgSrc: img ? img.getAttribute('src') : null,
          imgWidth: rect ? Math.round(rect.width) : null,
          imgHeight: rect ? Math.round(rect.height) : null,
          role: o ? o.getAttribute('role') : null,
          ariaLive: o ? o.getAttribute('aria-live') : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Hold overlay check (at ~1150ms):', overlayCheck.result.value);

    // At t0 + 1700ms: completely dismissed
    await wait(550);
    const ss4 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '05-destination-content-revealed.png'), Buffer.from(ss4.data, 'base64'));

    const postCheck = await client.send('Runtime.evaluate', {
      expression: `!document.getElementById('sp-page-loader')`,
      returnByValue: true
    });
    console.log('Post-dismissal check:', postCheck.result.value);

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
