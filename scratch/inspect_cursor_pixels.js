const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5520;
const CDP_PORT = 9420;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function startStaticServer(port) {
  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.htm';
    const fp = path.join(process.cwd(), decodeURIComponent(p));
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(fp).toLowerCase();
      const mime = {
        '.html': 'text/html', '.htm': 'text/html',
        '.css': 'text/css', '.js': 'application/javascript',
        '.png': 'image/png', '.webm': 'video/webm'
      }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

function getJson(u) {
  return new Promise((resolve, reject) => {
    http.get(u, res => {
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
    return new Promise(r => this.ws.readyState === WebSocket.OPEN ? r() : this.ws.onopen = r);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch(e){} }
}

async function inspectCursorPixels() {
  const server = await startStaticServer(HTTP_PORT);
  const cp = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-sandbox'
  ]);

  let client;
  for (let i = 0; i < 30; i++) {
    try {
      const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
      const t = targets.find(x => x.type === 'page');
      if (t) { client = new CDPClient(t.webSocketDebuggerUrl); await client.ready(); break; }
    } catch(e) { await wait(200); }
  }

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
  await wait(500);

  const pixelAnalysis = await client.send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'image/cursors/spouzy-teddy-large-arrow-50.png';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const width = img.naturalWidth;
      const height = img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Find bounding box of non-transparent pixels (alpha > 20)
      let minX = width, maxX = -1, minY = height, maxY = -1;
      const nonZeroPixels = [];

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          if (a > 20) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            nonZeroPixels.push({ x, y, r, g, b, a });
          }
        }
      }

      // Top-left 15x15 alpha grid
      const grid = [];
      for (let y = 0; y < 15; y++) {
        let row = '';
        for (let x = 0; x < 15; x++) {
          const idx = (y * width + x) * 4;
          const a = data[idx + 3];
          if (a === 0) row += ' . ';
          else if (a < 100) row += ' * ';
          else if (a < 200) row += ' o ';
          else row += ' # ';
        }
        grid.push(row);
      }

      // Detailed upper-left pixel coordinates with colors
      const upperLeftPixels = [];
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const idx = (y * width + x) * 4;
          const a = data[idx + 3];
          if (a > 0) {
            upperLeftPixels.push({
              x, y,
              rgba: [data[idx], data[idx+1], data[idx+2], a]
            });
          }
        }
      }

      return {
        width,
        height,
        minX, maxX,
        minY, maxY,
        contentWidth: maxX - minX + 1,
        contentHeight: maxY - minY + 1,
        upperLeftPixels,
        grid
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Pixel Analysis Result:\n', JSON.stringify(pixelAnalysis.result.value, null, 2));

  client.close();
  cp.kill();
  server.close();
}

inspectCursorPixels();
