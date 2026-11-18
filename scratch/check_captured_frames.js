const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9332;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-test-ss-check';

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
  const ss2 = fs.readFileSync('C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_loader_transition_v2\\02-reveal-early.png').toString('base64');
  const ss3 = fs.readFileSync('C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_loader_transition_v2\\03-reveal-mid.png').toString('base64');

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

    const evalRes = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        function analyze(b64) {
          return new Promise(r => {
            const img = new Image();
            img.onload = () => {
              const c = document.createElement('canvas');
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const ctx = c.getContext('2d');
              ctx.drawImage(img, 0, 0);
              // Count copper/gold/burgundy logo pixels (not ivory #FAF5EE background)
              const d = ctx.getImageData(0, 0, c.width, c.height).data;
              let logoPixels = 0;
              for (let i = 0; i < d.length; i += 4) {
                const red = d[i], green = d[i+1], blue = d[i+2];
                // Ivory background is red: ~250, green: ~245, blue: ~238
                if (red < 240 || green < 235 || blue < 225) {
                  logoPixels++;
                }
              }
              r({ w: img.naturalWidth, h: img.naturalHeight, logoPixels });
            };
            img.src = 'data:image/png;base64,' + b64;
          });
        }

        const info2 = await analyze("${ss2}");
        const info3 = await analyze("${ss3}");
        return { info2, info3 };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Analysis of captured frames:', JSON.stringify(evalRes.result.value, null, 2));
    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
