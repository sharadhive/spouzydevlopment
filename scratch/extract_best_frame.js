const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9361;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-frame-inspect';

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
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(1000);

    const frameInspect = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const video = document.createElement('video');
        video.src = 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm';
        video.muted = true;
        video.playsInline = true;
        await new Promise(r => video.onloadedmetadata = r);

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        const timestamps = [0.5, 1.0, 1.5, 2.0, 3.0];
        const results = [];

        for (const t of timestamps) {
          video.currentTime = t;
          await new Promise(r => video.onseeked = r);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          let opaque = 0;
          let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const idx = (y * canvas.width + x) * 4;
              if (data[idx + 3] > 20) {
                opaque++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          const pngB64 = canvas.toDataURL('image/png').split(',')[1];
          results.push({ t, opaque, bbox: { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 }, pngB64 });
        }

        return results;
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    const frames = frameInspect.result.value;
    frames.forEach(f => {
      console.log(`t = ${f.t}s: opaque pixels = ${f.opaque}, bbox = ${JSON.stringify(f.bbox)}`);
      fs.writeFileSync(`scratch/frame_${f.t}.png`, Buffer.from(f.pngB64, 'base64'));
    });

    // Best static frame is frame with full character pose, e.g. at 1.0s or 1.5s
    // Let's use frame at 1.0s as spouzy-teddy-dance-static.png
    const bestFrame = frames.find(f => f.t === 1.0);
    fs.writeFileSync('image/gif/spouzy-teddy-dance-static.png', Buffer.from(bestFrame.pngB64, 'base64'));
    console.log('Saved image/gif/spouzy-teddy-dance-static.png');

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
