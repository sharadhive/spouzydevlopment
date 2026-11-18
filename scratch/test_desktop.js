const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5510;
const CDP_PORT = 9390;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-desktop-' + Date.now());

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function startStaticServer(port) {
  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.htm';
    const fp = path.join(process.cwd(), decodeURIComponent(p));
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(fp).toLowerCase();
      const mime = {
        '.html': 'text/html', '.htm': 'text/html',
        '.css': 'text/css', '.js': 'application/javascript',
        '.png': 'image/png', '.webm': 'video/webm'
      }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

function getJson(u) {
  return new Promise((resolve, reject) => {
    http.get(u, res => {
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
    return new Promise(r => this.ws.readyState === WebSocket.OPEN ? r() : this.ws.onopen = r);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch(e){} }
}

async function run() {
  const server = await startStaticServer(HTTP_PORT);
  const cp = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    '--autoplay-policy=no-user-gesture-required'
  ]);

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

  // Navigate to blank first, ensure sessionStorage is clear
  await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });

  // Poll for overlay
  let found = false;
  let measurements = null;
  for (let i = 0; i < 20; i++) {
    const res = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        if (!overlay) return null;
        const video = overlay.querySelector('.sp-hug-video');
        const logo = overlay.querySelector('.sp-hug-logo');
        const vRect = video ? video.getBoundingClientRect() : null;
        const lRect = logo ? logo.getBoundingClientRect() : null;
        return {
          classes: Array.from(overlay.classList),
          videoTime: video ? video.currentTime : null,
          videoPaused: video ? video.paused : null,
          logoWidth: lRect ? lRect.width : null,
          logoHeight: lRect ? lRect.height : null,
          vBottom: vRect ? vRect.bottom : null,
          lTop: lRect ? lRect.top : null,
          rawSpacing: (vRect && lRect) ? lRect.top - vRect.bottom : null
        };
      })()`,
      returnByValue: true
    });
    if (res.result.value) {
      console.log(`Poll ${i*50}ms found overlay:`, res.result.value);
      if (!measurements && res.result.value.videoTime > 0.05) {
        measurements = res.result.value;
        const ss = await client.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, '01-loader-desktop-active.png'), Buffer.from(ss.data, 'base64'));
        console.log('Saved 01-loader-desktop-active.png');
      }
    } else {
      console.log(`Poll ${i*50}ms: no overlay`);
    }
    await wait(50);
  }

  client.close();
  cp.kill();
  server.close();
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch(e){}
}
run();
