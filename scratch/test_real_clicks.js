const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5540;
const CDP_PORT = 9440;

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

async function testRealPageClicks() {
  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0].replace(/^\//, '');
    if (!p) p = 'index.htm';
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(p);
      const mime = { '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png' }[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(HTTP_PORT, r));

  const cp = spawn(CHROME_PATH, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--disable-gpu', '--no-sandbox', '--window-size=1440,900']);
  let client;
  for (let i = 0; i < 30; i++) {
    try {
      const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
      const t = targets.find(x => x.type === 'page');
      if (t) { client = new CDPClient(t.webSocketDebuggerUrl); await client.ready(); break; }
    } catch(e) { await wait(200); }
  }

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
  await wait(2000);

  // Test 1: Header CTA button (.sp-booking-btn or .sp-cta-primary)
  const ctaCheck = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const cta = document.querySelector('.sp-nav-cta') || document.querySelector('.sp-booking-btn') || document.querySelector('header a');
      if (!cta) return null;
      window.__ctaFired = false;
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        window.__ctaFired = true;
      }, { once: true });
      const r = cta.getBoundingClientRect();
      return {
        tag: cta.tagName,
        text: cta.textContent.trim(),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        cursor: window.getComputedStyle(cta).cursor
      };
    })()`,
    returnByValue: true
  });
  console.log('CTA info:', ctaCheck.result.value);

  if (ctaCheck.result.value) {
    const { x, y } = ctaCheck.result.value;
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  const ctaResult = await client.send('Runtime.evaluate', {
    expression: 'window.__ctaFired === true',
    returnByValue: true
  });
  console.log('CTA click fired:', ctaResult.result.value);

  // Test 2: Hero CTA button
  const heroCheck = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const heroCta = document.querySelector('.sp-search-btn');
      if (!heroCta) return null;
      window.__heroCtaFired = false;
      heroCta.addEventListener('click', (e) => {
        e.preventDefault();
        window.__heroCtaFired = true;
      }, { once: true });
      const r = heroCta.getBoundingClientRect();
      return {
        tag: heroCta.tagName,
        text: heroCta.textContent.trim(),
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        cursor: window.getComputedStyle(heroCta).cursor
      };
    })()`,
    returnByValue: true
  });
  console.log('Hero CTA info:', heroCheck.result.value);

  if (heroCheck.result.value) {
    const { x, y } = heroCheck.result.value;
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  const heroResult = await client.send('Runtime.evaluate', {
    expression: 'window.__heroCtaFired === true',
    returnByValue: true
  });
  console.log('Hero CTA click fired:', heroResult.result.value);

  client.close();
  cp.kill();
  server.close();
}

testRealPageClicks();
