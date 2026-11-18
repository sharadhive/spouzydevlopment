const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9395;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-inspect-edge';

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

async function inspectEdge() {
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

    const edgeCheck = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const video = document.createElement('video');
        video.src = 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm';
        video.muted = true;
        video.playsInline = true;

        await new Promise(r => video.onloadedmetadata = r);
        video.currentTime = 1.0;
        await new Promise(r => video.onseeked = r);

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Check row 719 (the very bottom row of the video)
        const row719 = ctx.getImageData(0, 719, 1280, 1).data;
        const row718 = ctx.getImageData(0, 718, 1280, 1).data;
        const row710 = ctx.getImageData(0, 710, 1280, 1).data;

        let activeCols719 = [];
        for (let x = 0; x < 1280; x++) {
          if (row719[x * 4 + 3] > 20) activeCols719.push(x);
        }

        // Export a cropped image of the bottom 120 pixels of the characters
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 1000;
        cropCanvas.height = 150;
        const cropCtx = cropCanvas.getContext('2d');
        // crop from y=570 to 720, x=150 to 1150
        cropCtx.drawImage(canvas, 150, 570, 1000, 150, 0, 0, 1000, 150);

        return {
          totalColsAtRow719: activeCols719.length,
          firstCol719: activeCols719[0],
          lastCol719: activeCols719[activeCols719.length - 1],
          cropDataUrl: cropCanvas.toDataURL('image/png')
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    const info = edgeCheck.result.value;
    console.log('Edge check info:');
    console.log({
      totalColsAtRow719: info.totalColsAtRow719,
      firstCol719: info.firstCol719,
      lastCol719: info.lastCol719
    });

    const base64 = info.cropDataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('scratch/bottom_edge_shoes.png', Buffer.from(base64, 'base64'));
    console.log('Saved bottom 150px crop to scratch/bottom_edge_shoes.png');

  } catch (err) {
    console.error(err);
  } finally {
    if (client) client.close();
    chromeProcess.kill('SIGKILL');
  }
}

inspectEdge();
