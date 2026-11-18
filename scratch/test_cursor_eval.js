const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5557;
const CDP_PORT = 9457;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-cursor-test-' + Date.now());

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

function startStaticServer(port) {
  const mimeTypes = {
    '.html': 'text/html', '.htm': 'text/html',
    '.css': 'text/css', '.js': 'application/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.webm': 'video/webm',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let p = req.url.split('?')[0];
    if (p === '/') p = '/index.htm';
    const fp = path.join(process.cwd(), decodeURIComponent(p.replace(/^\//, '')));

    fs.stat(fp, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(fp).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(fp).pipe(res);
    });
  });

  return new Promise(r => server.listen(port, () => r(server)));
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

async function testCursor() {
  const server = await startStaticServer(HTTP_PORT);

  const cp = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
  ]);

  let client;
  for (let i = 0; i < 30; i++) {
    try {
      const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
      const t = targets.find(x => x.type === 'page');
      if (t) {
        client = new CDPClient(t.webSocketDebuggerUrl);
        await client.ready();
        break;
      }
    } catch(e) { await wait(200); }
  }

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  // Test page with the 90x90 cursor
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 50px;
          cursor: url('image/cursors/spouzy-big-teddies-small-tip-90.png') 7 1, default;
          background: #FFFACD;
          font-family: sans-serif;
        }
        .btn {
          padding: 15px 30px;
          background: #bf674f;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: url('image/cursors/spouzy-pointer.svg') 18 2, url('image/cursors/spouzy-pointer.png') 18 2, pointer !important;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <h1>SPOUZY Dual Cursor Test</h1>
      <button class="btn" id="test-btn">Click Me (Pointer Cursor)</button>
    </body>
    </html>
  `;

  fs.writeFileSync('scratch/test_cursor_dual.html', testHtml, 'utf8');

  await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/scratch/test_cursor_dual.html` });
  await wait(600);

  const cursorEval = await client.send('Runtime.evaluate', {
    expression: `
      (function() {
        const bodyCursor = getComputedStyle(document.body).cursor;
        const btn = document.getElementById('test-btn');
        const btnCursor = getComputedStyle(btn).cursor;
        
        // Also test image dimensions when loaded
        const img = new Image();
        img.src = 'image/cursors/spouzy-big-teddies-small-tip-90.png';
        const imgPointer = new Image();
        imgPointer.src = 'image/cursors/spouzy-pointer.png';

        return new Promise(resolve => {
          let loaded = 0;
          function check() {
            loaded++;
            if (loaded === 2) {
              resolve({
                bodyCursor,
                btnCursor,
                teddyImgWidth: img.naturalWidth,
                teddyImgHeight: img.naturalHeight,
                pointerImgWidth: imgPointer.naturalWidth,
                pointerImgHeight: imgPointer.naturalHeight
              });
            }
          }
          img.onload = check;
          img.onerror = check;
          imgPointer.onload = check;
          imgPointer.onerror = check;
        });
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Cursor evaluation result:', cursorEval.result.value);

  client.close();
  cp.kill('SIGKILL');
  server.close();
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
}

testCursor().catch(err => {
  console.error(err);
  process.exit(1);
});
