const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9345;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-verify-robust';

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_loader_transition_v2';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

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
        const { resolve, reject, timer } = this.callbacks.get(msg.id);
        clearTimeout(timer);
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
  send(method, params = {}, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }
      }, timeoutMs);
      this.callbacks.set(id, { resolve, reject, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.callbacks.delete(id);
        reject(err);
      }
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

  const report = {
    tests: [],
    screenshots: []
  };

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
    await client.send('DOM.enable');

    console.log('=== TEST 1: Initial Page Load (First Visit) ===');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });

    let overlayFoundOnFirstVisit = false;
    for (let i = 0; i < 15; i++) {
      await wait(100);
      try {
        const res = await client.send('Runtime.evaluate', {
          expression: `!!document.getElementById('sp-page-loader')`,
          returnByValue: true
        });
        if (res.result.value) {
          overlayFoundOnFirstVisit = true;
          break;
        }
      } catch (e) {}
    }
    console.log('First visit overlay detected:', overlayFoundOnFirstVisit);

    await wait(2200); // let first visit loader finish
    const postFirstVisit = await client.send('Runtime.evaluate', {
      expression: `!document.getElementById('sp-page-loader')`,
      returnByValue: true
    });
    console.log('First visit overlay cleanly dismissed:', postFirstVisit.result.value);
    report.tests.push({
      name: 'First Visit Lifecycle',
      passed: overlayFoundOnFirstVisit && postFirstVisit.result.value
    });

    console.log('=== TEST 2: Navigation to About Us (Arrival Lifecycle) ===');
    // Click About Us
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const a = document.querySelector('a[href="about-us.htm"]');
        if (a) a.click();
      })()`
    });

    await wait(30);
    const departureCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const o = document.getElementById('sp-page-loader');
        const img = o ? o.querySelector('img') : null;
        return {
          hasOverlay: !!o,
          imgSrc: img ? img.getAttribute('src') : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Departure feedback check:', departureCheck.result.value);

    const ssDep = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '01-departure-feedback.png'), Buffer.from(ssDep.data, 'base64'));
    report.screenshots.push('01-departure-feedback.png');

    // Wait 250ms for navigation to about-us.htm to complete
    await wait(250);

    // At t ~ 250ms: early ribbon reveal
    const ss1 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '02-reveal-early.png'), Buffer.from(ss1.data, 'base64'));
    report.screenshots.push('02-reveal-early.png');

    // At t ~ 750ms: mid reveal
    await wait(500);
    const ss2 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '03-reveal-mid.png'), Buffer.from(ss2.data, 'base64'));
    report.screenshots.push('03-reveal-mid.png');

    // At t ~ 1200ms: full logo reveal holding
    await wait(450);
    const ss3 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '04-hold-complete-logo.png'), Buffer.from(ss3.data, 'base64'));
    report.screenshots.push('04-hold-complete-logo.png');

    const holdCheck = await client.send('Runtime.evaluate', {
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
          ariaLive: o ? o.getAttribute('aria-live') : null,
          srText: o ? (o.querySelector('.sp-loader-sr-only') ? o.querySelector('.sp-loader-sr-only').textContent : null) : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Hold state on destination:', holdCheck.result.value);

    // At t ~ 1750ms: overlay completely dismissed
    await wait(550);
    const ss4 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '05-destination-content-revealed.png'), Buffer.from(ss4.data, 'base64'));
    report.screenshots.push('05-destination-content-revealed.png');

    const postDismissCheck = await client.send('Runtime.evaluate', {
      expression: `!document.getElementById('sp-page-loader')`,
      returnByValue: true
    });
    console.log('Overlay completely removed post-dismissal:', postDismissCheck.result.value);

    report.tests.push({
      name: 'Destination Arrival Lifecycle',
      passed: holdCheck.result.value.hasOverlay && postDismissCheck.result.value,
      details: holdCheck.result.value
    });

    console.log('=== TEST 3: Repeated Navigation (Cached Asset Playback) ===');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const a = document.querySelector('a[href="corporate-kamasutra.htm"]');
        if (a) a.click();
      })()`
    });

    await wait(400);
    const repeatCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const o = document.getElementById('sp-page-loader');
        return {
          url: window.location.pathname,
          hasOverlay: !!o
        };
      })()`,
      returnByValue: true
    });
    console.log('Repeated navigation check:', repeatCheck.result.value);

    const ssRepeat = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '06-repeat-navigation.png'), Buffer.from(ssRepeat.data, 'base64'));
    report.screenshots.push('06-repeat-navigation.png');

    await wait(1400);
    const repeatDismissed = await client.send('Runtime.evaluate', {
      expression: `!document.getElementById('sp-page-loader')`,
      returnByValue: true
    });
    console.log('Repeated navigation dismissed:', repeatDismissed.result.value);

    report.tests.push({
      name: 'Repeated Navigation (Cache Replay)',
      passed: repeatCheck.result.value.hasOverlay && repeatDismissed.result.value
    });

    console.log('=== TEST 4: Mobile Viewport Proportions (390x844) ===');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const a = document.querySelector('a[href="intimate-aesthetics-treatment.htm"]') || document.querySelector('a[href*="intimate"]');
        if (a) a.click();
        else window.location.href = 'intimate-aesthetics-treatment.htm';
      })()`
    });

    await wait(450);
    const mobileCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const o = document.getElementById('sp-page-loader');
        const img = o ? o.querySelector('img') : null;
        const rect = img ? img.getBoundingClientRect() : null;
        return {
          hasOverlay: !!o,
          renderedWidth: rect ? Math.round(rect.width) : null,
          renderedHeight: rect ? Math.round(rect.height) : null,
          aspectRatio: rect ? (rect.width / rect.height).toFixed(2) : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile sizing check:', mobileCheck.result.value);

    const ssMobile = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '07-mobile-loader.png'), Buffer.from(ssMobile.data, 'base64'));
    report.screenshots.push('07-mobile-loader.png');

    await wait(1400);
    report.tests.push({
      name: 'Mobile Viewport Proportions',
      passed: mobileCheck.result.value.renderedWidth >= 180 && mobileCheck.result.value.renderedWidth <= 245,
      details: mobileCheck.result.value
    });

    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('=== TEST 5: Prefers-Reduced-Motion Accessibility ===');
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const a = document.querySelector('a[href="index.htm"]');
        if (a) a.click();
      })()`
    });

    await wait(40);
    const reducedDeparture = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const o = document.getElementById('sp-page-loader');
        const img = o ? o.querySelector('img') : null;
        return {
          hasOverlay: !!o,
          imgSrc: img ? img.getAttribute('src') : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Reduced motion departure check:', reducedDeparture.result.value);

    await wait(250);
    const ssReduced = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '08-reduced-motion-result.png'), Buffer.from(ssReduced.data, 'base64'));
    report.screenshots.push('08-reduced-motion-result.png');

    const reducedFinal = await client.send('Runtime.evaluate', {
      expression: `!document.getElementById('sp-page-loader')`,
      returnByValue: true
    });
    console.log('Reduced motion dismissed promptly without delay:', reducedFinal.result.value);

    report.tests.push({
      name: 'Prefers Reduced Motion',
      passed: reducedFinal.result.value,
      details: reducedDeparture.result.value
    });

    fs.writeFileSync(path.join(ARTIFACT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Saved test report to', path.join(ARTIFACT_DIR, 'report.json'));

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
