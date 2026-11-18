const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9319;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-test-verify';

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
  const webpB64 = fs.readFileSync('image/spouzy-transition.webp').toString('base64');
  const gifB64 = fs.readFileSync('image/spouzy-transition.gif').toString('base64');
  const staticB64 = fs.readFileSync('image/spouzy-transition-static.png').toString('base64');

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
        async function checkDecoder(b64, type) {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const decoder = new ImageDecoder({ data: bytes.buffer, type });
          await decoder.tracks.ready;
          const count = decoder.tracks.selectedTrack.frameCount;
          const rep = decoder.tracks.selectedTrack.repetitionCount;

          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 360;
          const ctx = canvas.getContext('2d');

          // Check Frame 0
          const f0 = await decoder.decode({ frameIndex: 0 });
          ctx.clearRect(0, 0, 640, 360);
          ctx.drawImage(f0.image, 0, 0);
          let d0 = ctx.getImageData(0, 0, 640, 360).data;
          let op0 = 0;
          for (let k = 3; k < d0.length; k += 4) if (d0[k] > 10) op0++;
          f0.image.close();

          // Check last frame
          const fLast = await decoder.decode({ frameIndex: count - 1 });
          ctx.clearRect(0, 0, 640, 360);
          ctx.drawImage(fLast.image, 0, 0);
          let dL = ctx.getImageData(0, 0, 640, 360).data;
          let opL = 0;
          for (let k = 3; k < dL.length; k += 4) if (dL[k] > 10) opL++;
          fLast.image.close();

          return { count, repetitionCount: rep, frame0Opaque: op0, lastFrameOpaque: opL };
        }

        const webpInfo = await checkDecoder("${webpB64}", 'image/webp');
        const gifInfo = await checkDecoder("${gifB64}", 'image/gif');

        // Check static PNG
        const img = new Image();
        const staticLoad = new Promise(r => {
          img.onload = () => r({ w: img.naturalWidth, h: img.naturalHeight });
          img.src = 'data:image/png;base64,' + "${staticB64}";
        });
        const staticInfo = await staticLoad;

        return { webpInfo, gifInfo, staticInfo };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Verification Output:', JSON.stringify(evalRes.result.value, null, 2));
    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
