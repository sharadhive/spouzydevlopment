const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9455;
const SERVER_PORT = 5502;
const USER_DATA_DIR = path.join(__dirname, 'chrome-captures-' + Date.now());

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (typeof msg.id !== 'undefined' && this.callbacks.has(msg.id)) {
        const { resolve, reject, timer } = this.callbacks.get(msg.id);
        clearTimeout(timer);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }
  ready() {
    return new Promise(r => {
      if (this.ws.readyState === WebSocket.OPEN) r();
      else this.ws.onopen = r;
    });
  }
  send(method, params = {}, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`Timeout: ${method} (id=${id})`));
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
  close() {
    try { this.ws.close(); } catch (e) {}
  }
}

// Static server
const root = path.resolve('.');
const mimeTypes = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqUrl = decodeURI(req.url.split('?')[0]);
  if (reqUrl === '/') reqUrl = '/index.htm';
  const filePath = path.join(root, reqUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(SERVER_PORT, async () => {
  console.log('Server running on', SERVER_PORT);

  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
  ]);

  try {
    let targets;
    for (let i = 0; i < 30; i++) {
      try {
        targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
        if (targets && targets.length) break;
      } catch (e) {
        await wait(200);
      }
    }
    const page = targets.find(t => t.type === 'page');
    const cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');

    // 1. Desktop
    console.log('Navigating to index.htm Desktop...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/index.htm` });
    await wait(2500);

    // Remove loader and scroll to footer
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        sessionStorage.setItem('spouzy_session_active', '1');
        const loader = document.getElementById('sp-page-loader');
        if (loader) loader.remove();
        window.scrollTo(0, 999999);
        document.documentElement.scrollTop = 999999;
        document.body.scrollTop = 999999;
      })()`
    });
    await wait(800);

    // Capture Desktop Ribbon
    const ss1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '01-desktop-footer-social-ribbon.png'), Buffer.from(ss1.data, 'base64'));
    console.log('Captured 01-desktop-footer-social-ribbon.png');

    // Capture Closeup of social icons
    const clipData = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const wrap = document.querySelector('.sp-footer-social');
        if (!wrap) return null;
        const rect = wrap.getBoundingClientRect();
        return {
          x: Math.round(Math.max(0, rect.x - 10)),
          y: Math.round(Math.max(0, rect.y - 10)),
          width: Math.round(rect.width + 20),
          height: Math.round(rect.height + 20),
          scale: 1
        };
      })()`,
      returnByValue: true
    });

    if (clipData.result.value && clipData.result.value.width > 0 && clipData.result.value.height > 0) {
      console.log('Clip data:', clipData.result.value);
      const ss2 = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: clipData.result.value
      });
      fs.writeFileSync(path.join(ARTIFACT_DIR, '02-social-icons-closeup.png'), Buffer.from(ss2.data, 'base64'));
      console.log('Captured 02-social-icons-closeup.png');
    }

    // 2. Mobile (375px)
    console.log('Capturing Mobile 375px...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(300);
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        window.scrollTo(0, 999999);
        document.documentElement.scrollTop = 999999;
        document.body.scrollTop = 999999;
      })()`
    });
    await wait(800);

    const ss4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '04-mobile-footer-social.png'), Buffer.from(ss4.data, 'base64'));
    console.log('Captured 04-mobile-footer-social.png');

    cdp.close();
    chrome.kill();
    server.close();
    console.log('Done capturing screenshots!');
    process.exit(0);

  } catch (err) {
    console.error('Error:', err);
    chrome.kill();
    server.close();
    process.exit(1);
  }
});
