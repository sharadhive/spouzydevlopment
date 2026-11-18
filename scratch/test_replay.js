const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9320;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-test-replay';

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
    '--no-sandbox'
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
    await client.send('Runtime.enable');
    await client.send('Page.enable');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(1000);

    const testRes = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        function checkSample(img) {
          const c = document.createElement('canvas');
          c.width = 640; c.height = 360;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, 640, 360).data;
          let op = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 10) op++;
          return op;
        }

        // Test 1: Load spouzy-transition.webp
        const img1 = new Image();
        img1.src = 'image/spouzy-transition.webp';
        await img1.decode();
        document.body.appendChild(img1);
        const opAtStart1 = checkSample(img1);

        // Wait 1.6s so it finishes playing
        await new Promise(r => setTimeout(r, 1600));
        const opAtEnd1 = checkSample(img1);
        img1.remove();

        // Test 2: Navigate or re-create image element on same page or next page
        const img2 = new Image();
        img2.src = 'image/spouzy-transition.webp';
        await img2.decode();
        document.body.appendChild(img2);
        const opAtStart2 = checkSample(img2);
        img2.remove();

        return {
          opAtStart1,
          opAtEnd1,
          opAtStart2
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Replay test result:', JSON.stringify(testRes.result.value, null, 2));
    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
