const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9311;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-img-profile';

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
  close() {
    this.ws.close();
  }
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
      } catch (e) {
        await wait(200);
      }
    }
    const client = new CDPClient(tabs[0].webSocketDebuggerUrl);
    await client.ready();
    await client.send('Runtime.enable');

    const evalRes = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const b64 = "${gifBase64}";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const decoder = new ImageDecoder({ data: bytes.buffer, type: 'image/gif' });
        await decoder.tracks.ready;
        const count = decoder.tracks.selectedTrack.frameCount;
        const repetitionCount = decoder.tracks.selectedTrack.repetitionCount;

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const frameStats = [];
        let globalMinX = 640, globalMinY = 360, globalMaxX = 0, globalMaxY = 0;

        for (let i = 0; i < count; i++) {
          const result = await decoder.decode({ frameIndex: i });
          ctx.clearRect(0, 0, 640, 360);
          ctx.drawImage(result.image, 0, 0);
          const imgData = ctx.getImageData(0, 0, 640, 360);
          const data = imgData.data;

          let opaquePixels = 0;
          let minX = 640, minY = 360, maxX = 0, maxY = 0;

          for (let y = 0; y < 360; y++) {
            for (let x = 0; x < 640; x++) {
              const idx = (y * 640 + x) * 4;
              const alpha = data[idx + 3];
              if (alpha > 10) {
                opaquePixels++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          if (opaquePixels > 0) {
            if (minX < globalMinX) globalMinX = minX;
            if (maxX > globalMaxX) globalMaxX = maxX;
            if (minY < globalMinY) globalMinY = minY;
            if (maxY > globalMaxY) globalMaxY = maxY;
          }

          frameStats.push({
            frameIndex: i,
            duration: result.image.duration / 1000, // ms
            opaquePixels,
            bbox: opaquePixels > 0 ? { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 } : null
          });
          result.image.close();
        }

        return {
          count,
          repetitionCount,
          globalBbox: {
            minX: globalMinX,
            minY: globalMinY,
            maxX: globalMaxX,
            maxY: globalMaxY,
            w: globalMaxX - globalMinX + 1,
            h: globalMaxY - globalMinY + 1
          },
          frameStats
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('Decoder results:', JSON.stringify(evalRes.result.value, null, 2));
    client.close();
  } finally {
    chrome.kill();
  }
}

run();
