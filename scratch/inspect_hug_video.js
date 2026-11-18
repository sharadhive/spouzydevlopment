const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9360;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-inspect-hug';

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

async function inspectVideo() {
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox'
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
    await wait(1000);

    const videoAnalysis = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const video = document.createElement('video');
        video.src = 'image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm';
        video.muted = true;
        video.playsInline = true;
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });

        const duration = video.duration;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Seek to 0.8s (hug completed)
        video.currentTime = Math.min(0.8, duration * 0.8);
        await new Promise(r => video.onseeked = r);

        // Draw onto transparent canvas
        const canvas = document.createElement('canvas');
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, videoWidth, videoHeight);
        ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

        const imgData = ctx.getImageData(0, 0, videoWidth, videoHeight);
        let transparentPixels = 0;
        let opaquePixels = 0;
        let semiTransparentPixels = 0;

        for (let i = 0; i < imgData.data.length; i += 4) {
          const a = imgData.data[i + 3];
          if (a === 0) transparentPixels++;
          else if (a === 255) opaquePixels++;
          else semiTransparentPixels++;
        }

        const totalPixels = videoWidth * videoHeight;
        const dataUrl = canvas.toDataURL('image/png');

        return {
          duration,
          videoWidth,
          videoHeight,
          totalPixels,
          transparentPixels,
          semiTransparentPixels,
          opaquePixels,
          transparencyPercent: (transparentPixels / totalPixels * 100).toFixed(1) + '%',
          pngDataUrlLength: dataUrl.length,
          dataUrl
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    const info = videoAnalysis.result.value;
    console.log('Video Analysis:', {
      duration: info.duration,
      videoWidth: info.videoWidth,
      videoHeight: info.videoHeight,
      totalPixels: info.totalPixels,
      transparentPixels: info.transparentPixels,
      semiTransparentPixels: info.semiTransparentPixels,
      opaquePixels: info.opaquePixels,
      transparencyPercent: info.transparencyPercent
    });

    // Save fallback static transparent PNG
    const base64Data = info.dataUrl.replace(/^data:image\/png;base64,/, '');
    const outPath = 'image/gif/spouzy-teddy-hug-static.png';
    fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
    console.log(`Saved static fallback frame to ${outPath} (${fs.statSync(outPath).size} bytes)`);

  } catch (err) {
    console.error('Error during video inspection:', err);
  } finally {
    if (client) client.close();
    chromeProcess.kill('SIGKILL');
  }
}

inspectVideo();
