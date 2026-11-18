const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5524;
const CDP_PORT = 9424;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-hotspot-' + Date.now());

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(u) {
  return new Promise((resolve, reject) => {
    http.get(u, res => {
      let data = '';
      res.on('data', c => data += c);
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
  ready() { return new Promise(r => this.ws.readyState === WebSocket.OPEN ? r() : this.ws.onopen = r); }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch(e){} }
}

async function testHotspots() {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    padding: 40px;
    background: #FFF9F5;
    font-family: sans-serif;
  }
  .test-row {
    display: flex;
    gap: 40px;
    margin-bottom: 40px;
  }
  .canvas-box {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  canvas {
    image-rendering: pixelated;
    border: 1px solid #ddd;
  }
</style>
</head>
<body>
  <h1>Teddy Cursor Hotspot Analysis</h1>
  <div class="test-row">
    <div class="canvas-box">
      <h3>Zoomed 12x with Hotspot at (2, 0)</h3>
      <canvas id="c0" width="300" height="300"></canvas>
    </div>
    <div class="canvas-box">
      <h3>Zoomed 12x with Hotspot at (2, 1)</h3>
      <canvas id="c1" width="300" height="300"></canvas>
    </div>
  </div>
  <script>
    const img = new Image();
    img.src = '/image/cursors/spouzy-teddy-large-arrow-50.png';
    img.onload = () => {
      function drawZoom(canvasId, hx, hy) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Draw top-left 25x25 pixels scaled by 12x
        ctx.drawImage(img, 0, 0, 25, 25, 0, 0, 300, 300);

        // Draw pixel grid
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 25; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 12, 0);
          ctx.lineTo(i * 12, 300);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i * 12);
          ctx.lineTo(300, i * 12);
          ctx.stroke();
        }

        // Draw crosshair at hotspot (center of pixel [hx, hy])
        const cx = hx * 12 + 6;
        const cy = hy * 12 + 6;

        ctx.strokeStyle = '#e60000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - 14, cy);
        ctx.lineTo(cx + 14, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx, cy + 14);
        ctx.stroke();
      }

      drawZoom('c0', 2, 0);
      drawZoom('c1', 2, 1);
      window.ready = true;
    };
  </script>
</body>
</html>`;

  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    const fp = path.join(process.cwd(), decodeURIComponent(p.replace(/^\//, '')));
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(data);
    });
  });

  await new Promise(r => server.listen(HTTP_PORT, r));

  const cp = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1200,800'
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
  await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/` });

  for (let i = 0; i < 20; i++) {
    const ready = await client.send('Runtime.evaluate', { expression: 'window.ready === true' });
    if (ready.result.value) break;
    await wait(100);
  }

  const ss = await client.send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ARTIFACT_DIR, '05-cursor-hotspot-analysis.png');
  fs.writeFileSync(outPath, Buffer.from(ss.data, 'base64'));
  console.log('Saved hotspot analysis screenshot to:', outPath);

  client.close();
  cp.kill();
  server.close();
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch(e){}
}

testHotspots();
