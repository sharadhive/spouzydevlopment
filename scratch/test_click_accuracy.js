const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5526;
const CDP_PORT = 9426;

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

async function testClickAccuracy() {
  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0;
    padding: 20px;
    cursor: url('/image/cursors/spouzy-teddy-large-arrow-50.png') 2 0, default;
  }
  .test-link {
    display: inline-block;
    padding: 10px 20px;
    background: #481e28;
    color: white;
    cursor: url('/image/cursors/spouzy-teddy-large-arrow-50.png') 2 0, pointer !important;
  }
  .test-link:hover {
    background: #bf674f;
  }
</style>
</head>
<body>
  <a href="#test" id="targetLink" class="test-link">Book Consultation</a>
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
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=800,600'
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
  await wait(400);

  // Check computed cursor style on body and on targetLink
  const styles = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const bodyCursor = window.getComputedStyle(document.body).cursor;
      const link = document.getElementById('targetLink');
      const linkCursor = window.getComputedStyle(link).cursor;
      return { bodyCursor, linkCursor };
    })()`,
    returnByValue: true
  });

  console.log('Computed cursor styles:', styles.result.value);

  // Test click on link
  let clicked = false;
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      document.getElementById('targetLink').addEventListener('click', (e) => {
        e.preventDefault();
        window.__clicked = true;
      });
    })()`
  });

  // Get link bounding rect
  const rect = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const r = document.getElementById('targetLink').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`,
    returnByValue: true
  });

  const { x, y } = rect.result.value;
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

  const clickCheck = await client.send('Runtime.evaluate', {
    expression: 'window.__clicked === true',
    returnByValue: true
  });

  console.log('Click successfully registered on button:', clickCheck.result.value);

  client.close();
  cp.kill();
  server.close();
}

testClickAccuracy();
