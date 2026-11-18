const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9360;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-video-inspect';

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

    const videoEval = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const video = document.createElement('video');
        video.src = 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm';
        video.muted = true;
        video.playsInline = true;
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = (e) => reject(new Error('Video load error: ' + (video.error ? video.error.message : 'unknown')));
          video.load();
        });

        // Seek to 1.0s to get an active dancing frame
        video.currentTime = 1.0;
        await new Promise(r => video.onseeked = r);

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        let transparentPixels = 0;
        let opaquePixels = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 20) transparentPixels++;
          else opaquePixels++;
        }

        const pngB64 = canvas.toDataURL('image/png').split(',')[1];

        return {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          duration: video.duration,
          transparentPixels,
          opaquePixels,
          totalPixels: canvas.width * canvas.height,
          pngB64Length: pngB64.length,
          pngB64: pngB64
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Video Inspection Result:');
    const val = videoEval.result.value;
    console.log('Dimensions:', val.videoWidth, 'x', val.videoHeight);
    console.log('Duration:', val.duration, 's');
    console.log('Transparent pixels:', val.transparentPixels, 'Opaque pixels:', val.opaquePixels);
    console.log('Alpha percentage:', ((val.transparentPixels / val.totalPixels) * 100).toFixed(1) + '%');

    // Save extracted frame as transparent PNG
    const pngBuf = Buffer.from(val.pngB64, 'base64');
    fs.writeFileSync('image/gif/spouzy-teddy-dance-static.png', pngBuf);
    console.log('Saved static transparent fallback: image/gif/spouzy-teddy-dance-static.png (' + pngBuf.length + ' bytes)');

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
