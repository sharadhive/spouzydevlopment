const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5522;
const CDP_PORT = 9422;

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

async function printAscii() {
  const server = http.createServer((req, res) => {
    const fp = req.url.split('?')[0].replace(/^\//, '');
    fs.readFile(fp || 'index.htm', (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(HTTP_PORT, r));

  const cp = spawn(CHROME_PATH, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--disable-gpu']);
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

  const res = await client.send('Runtime.evaluate', {
    expression: `(async () => {
      const img = new Image();
      img.src = 'http://127.0.0.1:${HTTP_PORT}/image/cursors/spouzy-teddy-large-arrow-50.png';
      await new Promise(r => img.onload = r);
      const canvas = document.createElement('canvas');
      canvas.width = 50; canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, 50, 50).data;
      const lines = [];
      for (let y = 0; y < 50; y++) {
        let line = '';
        for (let x = 0; x < 50; x++) {
          const a = data[(y * 50 + x) * 4 + 3];
          if (a === 0) line += ' ';
          else if (a < 80) line += '.';
          else if (a < 180) line += '+';
          else line += '#';
        }
        lines.push(String(y).padStart(2, '0') + ': ' + line);
      }
      return lines.join('\\n');
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  fs.writeFileSync('scratch/cursor_ascii.txt', res.result.value);
  console.log('Written scratch/cursor_ascii.txt');

  client.close();
  cp.kill();
  server.close();
}

printAscii();
