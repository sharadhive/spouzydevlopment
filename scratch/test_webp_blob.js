const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9315;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-test-profile2';

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
    const res = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(255, 100, 50, 0.8)';
        ctx.fillRect(10, 10, 80, 80);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.95));
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let chunks = [];
        let pos = 12; // skip RIFF + size + WEBP
        while (pos < bytes.length) {
          let id = String.fromCharCode(bytes[pos], bytes[pos+1], bytes[pos+2], bytes[pos+3]);
          let size = bytes[pos+4] | (bytes[pos+5] << 8) | (bytes[pos+6] << 16) | (bytes[pos+7] << 24);
          chunks.push({ id, size, pos });
          pos += 8 + size + (size % 2);
        }
        return { length: bytes.length, chunks };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Result:', JSON.stringify(res.result.value, null, 2));
    client.close();
  } finally {
    chrome.kill();
  }
}
run();
