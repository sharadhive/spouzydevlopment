const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9390;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-inspect-shoes';

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

async function inspectShoes() {
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
    await wait(800);

    const frameAnalysis = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const video = document.createElement('video');
        video.src = 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm';
        video.muted = true;
        video.playsInline = true;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const duration = video.duration;

        const canvas = document.createElement('canvas');
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const timestamps = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0];
        const results = [];

        for (const t of timestamps) {
          video.currentTime = Math.min(t, duration - 0.1);
          await new Promise(r => video.onseeked = r);

          ctx.clearRect(0, 0, vw, vh);
          ctx.drawImage(video, 0, 0, vw, vh);

          const imgData = ctx.getImageData(0, 0, vw, vh);
          const data = imgData.data;

          let minX = vw, maxX = 0, minY = vh, maxY = 0;
          let nonTransparentCount = 0;

          // Also check bottom 5 rows specifically
          let bottomRowNonTransparent = 0;

          for (let y = 0; y < vh; y++) {
            for (let x = 0; x < vw; x++) {
              const idx = (y * vw + x) * 4;
              const alpha = data[idx + 3];
              if (alpha > 15) { // non-transparent
                nonTransparentCount++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                if (y >= vh - 5) {
                  bottomRowNonTransparent++;
                }
              }
            }
          }

          results.push({
            time: t,
            bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
            touchesTop: minY === 0,
            touchesBottom: maxY >= vh - 2,
            bottomRowPixels: bottomRowNonTransparent,
            bottomEmptyMargin: vh - maxY
          });
        }

        return {
          videoWidth: vw,
          videoHeight: vh,
          duration,
          results
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Video Shoe & Frame Bounds Analysis:');
    console.log(JSON.stringify(frameAnalysis.result.value, null, 2));

  } catch (err) {
    console.error('Error during shoe inspection:', err);
  } finally {
    if (client) client.close();
    chromeProcess.kill('SIGKILL');
  }
}

inspectShoes();
