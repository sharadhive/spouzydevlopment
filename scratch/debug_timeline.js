const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9380;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-timeline-' + Date.now();

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
  send(method, params = {}, timeoutMs = 8000) {
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
  close() {
    try { this.ws.close(); } catch (e) {}
  }
}

async function timeline() {
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required'
  ]);

  let client;
  try {
    for (let i = 0; i < 30; i++) {
      try {
        const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        const target = targets.find(t => t.type === 'page');
        if (target) {
          client = new CDPClient(target.webSocketDebuggerUrl);
          await client.ready();
          break;
        }
      } catch (e) { await wait(200); }
    }

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });

    for (let i = 0; i < 20; i++) {
      await wait(100);
      const res = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const overlay = document.getElementById('sp-page-loader');
          const video = overlay?.querySelector('.sp-hug-video');
          return {
            t: ${i * 100},
            hasOverlay: !!overlay,
            fade: overlay?.classList.contains('sp-loader-fade-out'),
            videoCurrentTime: video?.currentTime,
            videoPaused: video?.paused,
            videoEnded: video?.ended,
            readyState: document.readyState
          };
        })()`,
        returnByValue: true
      });
      console.log(`t = ${i * 100}ms:`, res.result.value);
    }
  } catch (e) {
    console.error(e);
  } finally {
    if (client) client.close();
    chromeProcess.kill('SIGKILL');
  }
}

timeline();
