const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5536;
const CDP_PORT = 9436;

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

async function testSocialClick() {
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
  await wait(1400);

  const res = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const socialBtn = document.querySelector('.sp-footer-social-btn');
      if (!socialBtn) return { error: 'Not found' };
      socialBtn.scrollIntoView({ block: 'center' });
      const r = socialBtn.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const topEl = document.elementFromPoint(x, y);
      return {
        x, y,
        btnTag: socialBtn.tagName,
        btnClasses: Array.from(socialBtn.classList),
        topElTag: topEl ? topEl.tagName : null,
        topElClasses: topEl ? Array.from(topEl.classList) : null,
        isSameOrChild: topEl === socialBtn || socialBtn.contains(topEl)
      };
    })()`,
    returnByValue: true
  });

  console.log('Element from point on social btn:', res.result.value);

  // Add click listener and dispatch
  const { x, y } = res.result.value;
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      window.__socialFired = false;
      document.querySelector('.sp-footer-social-btn').addEventListener('click', (e) => {
        e.preventDefault();
        window.__socialFired = true;
      });
    })()`
  });

  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

  const fired = await client.send('Runtime.evaluate', {
    expression: 'window.__socialFired === true',
    returnByValue: true
  });
  console.log('Social button click fired:', fired.result.value);

  client.close();
  cp.kill();
  server.close();
}

testSocialClick();
