const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9316;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-test-profile3';

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
  const gifBase64 = fs.readFileSync('image/SPOUZY-loader.gif').toString('base64');
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
        const b64 = "${gifBase64}";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const decoder = new ImageDecoder({ data: bytes.buffer, type: 'image/gif' });
        await decoder.tracks.ready;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');

        // Decode frame 32
        const frame32Res = await decoder.decode({ frameIndex: 32 });
        ctx.clearRect(0, 0, 640, 360);
        ctx.drawImage(frame32Res.image, 0, 0);

        // PNG data URL
        const pngDataUrl = canvas.toDataURL('image/png');

        // WebP blob with quality 0.95
        const webpBlob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.95));
        const webpBuf = await webpBlob.arrayBuffer();
        const webpBytes = new Uint8Array(webpBuf);

        // Parse webp chunks
        let chunks = [];
        let pos = 12;
        while (pos < webpBytes.length) {
          let id = String.fromCharCode(webpBytes[pos], webpBytes[pos+1], webpBytes[pos+2], webpBytes[pos+3]);
          let size = webpBytes[pos+4] | (webpBytes[pos+5] << 8) | (webpBytes[pos+6] << 16) | (webpBytes[pos+7] << 24);
          chunks.push({ id, size, pos });
          pos += 8 + size + (size % 2);
        }

        return {
          pngLength: pngDataUrl.length,
          webpLength: webpBytes.length,
          chunks,
          pngBase64Prefix: pngDataUrl.slice(0, 50)
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Frame 32 export test:', JSON.stringify(res.result.value, null, 2));
    client.close();
  } finally {
    chrome.kill();
  }
}
run();
