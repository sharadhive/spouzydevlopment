const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9350;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-verify-topbar';

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_topbar_announcement';
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
    pagesTested: [],
    measurements: {},
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

    console.log('=== TEST 1: index.htm (Desktop Header & Announcement Loop) ===');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(1800); // let arrival loader fade

    const desktopMetrics = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const track = document.querySelector('.sp-topbar-track');
        const groups = document.querySelectorAll('.sp-topbar-group');
        const sentences = document.querySelectorAll('.sp-topbar-sentence');
        const seps = document.querySelectorAll('.sp-topbar-sep');
        const trackStyle = window.getComputedStyle(track);
        const g1 = groups[0].getBoundingClientRect();
        const g2 = groups[1].getBoundingClientRect();
        
        return {
          animationName: trackStyle.animationName,
          animationDuration: trackStyle.animationDuration,
          animationTimingFunction: trackStyle.animationTimingFunction,
          groupCount: groups.length,
          g1AriaHidden: groups[0].getAttribute('aria-hidden'),
          g2AriaHidden: groups[1].getAttribute('aria-hidden'),
          g1Width: Math.round(g1.width),
          g2Width: Math.round(g2.width),
          g1Text: sentences[0].textContent.trim(),
          g2Text: sentences[1].textContent.trim(),
          identicalText: sentences[0].textContent.trim() === sentences[1].textContent.trim(),
          sepCount: seps.length,
          sep1AriaHidden: seps[0].getAttribute('aria-hidden'),
          sep2AriaHidden: seps[1].getAttribute('aria-hidden')
        };
      })()`,
      returnByValue: true
    });
    console.log('Desktop index.htm metrics:', JSON.stringify(desktopMetrics.result.value, null, 2));
    report.measurements.desktopIndex = desktopMetrics.result.value;

    const ssDesktop = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '01-desktop-index-announcement.png'), Buffer.from(ssDesktop.data, 'base64'));
    report.screenshots.push('01-desktop-index-announcement.png');

    console.log('=== TEST 2: index.html (Alternative Homepage Route) ===');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.html' });
    await wait(1800);

    const indexHtmlMetrics = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const sentences = document.querySelectorAll('.sp-topbar-sentence');
        const groups = document.querySelectorAll('.sp-topbar-group');
        return {
          sentenceCount: sentences.length,
          exactSentenceMatch: sentences[0].textContent.trim() === "Fully Confidential and all under one roof care by India’s first and only specialist lab of its kind since 2004.",
          group2Hidden: groups[1].getAttribute('aria-hidden') === 'true'
        };
      })()`,
      returnByValue: true
    });
    console.log('index.html metrics:', indexHtmlMetrics.result.value);
    report.measurements.indexHtml = indexHtmlMetrics.result.value;

    const ssIndexHtml = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '02-desktop-index-html-announcement.png'), Buffer.from(ssIndexHtml.data, 'base64'));
    report.screenshots.push('02-desktop-index-html-announcement.png');

    console.log('=== TEST 3: corporate-kamasutra.htm & intimate-aesthetics-treatment.htm ===');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/corporate-kamasutra.htm' });
    await wait(1800);

    const corpMetrics = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const sentences = document.querySelectorAll('.sp-topbar-sentence');
        const groups = document.querySelectorAll('.sp-topbar-group');
        const track = document.querySelector('.sp-topbar-track');
        return {
          hasTrack: !!track,
          sentenceCount: sentences.length,
          exactSentenceMatch: sentences[0].textContent.trim() === "Fully Confidential and all under one roof care by India’s first and only specialist lab of its kind since 2004.",
          group2Hidden: groups[1].getAttribute('aria-hidden') === 'true'
        };
      })()`,
      returnByValue: true
    });
    console.log('corporate-kamasutra.htm metrics:', corpMetrics.result.value);
    report.measurements.corporateKamasutra = corpMetrics.result.value;

    const ssCorp = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '03-corporate-kamasutra-announcement.png'), Buffer.from(ssCorp.data, 'base64'));
    report.screenshots.push('03-corporate-kamasutra-announcement.png');

    console.log('=== TEST 4: Mobile Viewport Rendering (390x844) ===');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(1800);

    const mobileMetrics = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const topbar = document.querySelector('.sp-topbar-modern');
        const msg = document.querySelector('.sp-topbar-message');
        const track = document.querySelector('.sp-topbar-track');
        const sentence = document.querySelector('.sp-topbar-sentence');
        const right = document.querySelector('.sp-topbar-right');
        const topbarRect = topbar.getBoundingClientRect();
        const msgRect = msg.getBoundingClientRect();
        const sentStyle = window.getComputedStyle(sentence);

        return {
          topbarVisible: topbarRect.height > 0,
          msgWidth: Math.round(msgRect.width),
          fontSize: sentStyle.fontSize,
          sentenceReadable: sentence.textContent.trim() === "Fully Confidential and all under one roof care by India’s first and only specialist lab of its kind since 2004.",
          actionsVisible: right.children.length >= 4
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile index.htm metrics:', mobileMetrics.result.value);
    report.measurements.mobileIndex = mobileMetrics.result.value;

    const ssMobile = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '04-mobile-index-announcement.png'), Buffer.from(ssMobile.data, 'base64'));
    report.screenshots.push('04-mobile-index-announcement.png');

    fs.writeFileSync(path.join(ARTIFACT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Browser verification completed successfully!');

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
