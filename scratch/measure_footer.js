const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9400;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-measure-footer';

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

async function measureFooter() {
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
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
    await wait(1500);

    const measurements = await client.send('Runtime.evaluate', {
      expression: `(() => {
        window.scrollTo(0, document.body.scrollHeight);
        const grid = document.querySelector('.sp-footer-grid');
        const extras = document.querySelector('.sp-footer-extras');
        const teddy = document.querySelector('.sp-footer-teddy');
        const psg = Array.from(grid.children).find(c => c.querySelector('.sp-footer-col-title')?.textContent.includes('Problem Solver Group'));
        const video = teddy.querySelector('.sp-footer-teddy-video');

        const gridRect = grid.getBoundingClientRect();
        const extrasRect = extras ? extras.getBoundingClientRect() : null;
        const teddyRect = teddy.getBoundingClientRect();
        const psgRect = psg ? psg.getBoundingClientRect() : null;
        const videoRect = video ? video.getBoundingClientRect() : null;

        return {
          gridRect: { top: gridRect.top, bottom: gridRect.bottom, height: gridRect.height, width: gridRect.width },
          extrasRect: extrasRect ? { top: extrasRect.top, bottom: extrasRect.bottom } : null,
          gapBetweenGridAndExtras: extrasRect ? extrasRect.top - gridRect.bottom : null,
          teddyRect: { top: teddyRect.top, bottom: teddyRect.bottom, left: teddyRect.left, right: teddyRect.right, width: teddyRect.width, height: teddyRect.height },
          psgRect: psgRect ? { top: psgRect.top, bottom: psgRect.bottom, right: psgRect.right, width: psgRect.width, height: psgRect.height } : null,
          videoRect: videoRect ? { top: videoRect.top, bottom: videoRect.bottom, width: videoRect.width, height: videoRect.height } : null,
          distanceFromVideoBottomToExtrasTop: extrasRect && videoRect ? extrasRect.top - videoRect.bottom : null
        };
      })()`,
      returnByValue: true
    });

    console.log('Current Footer Measurements:');
    console.log(JSON.stringify(measurements.result.value, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    if (client) client.close();
    chromeProcess.kill('SIGKILL');
  }
}

measureFooter();
