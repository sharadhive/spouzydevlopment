const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5579;
const CDP_PORT = 9479;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-menu-test-' + Date.now());

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
    if (p === '/') p = '/index.html';
    const fp = path.join(process.cwd(), decodeURIComponent(p.replace(/^\//, '')));

    fs.stat(fp, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + p);
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

async function verifyMenuDropdown() {
  let server, cp, client;
  try {
    server = await startStaticServer(HTTP_PORT);
    cp = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1440,900'
    ]);

    await wait(2000);
    const tabs = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.ready();
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.html` });
    await wait(1800);

    // Click "Join Our Team" to open dropdown and hover "Careers"
    const dropdownState = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.sp-desktop-nav [aria-controls="group-2"]');
        if (btn) btn.click();
        const menu = document.getElementById('group-2');
        const options = Array.from(menu ? menu.querySelectorAll('.sp-dropdown-item') : []).map(a => ({
          text: a.textContent.trim(),
          href: a.getAttribute('href')
        }));
        // Hover on careers to trigger preview
        const careersItem = menu ? menu.querySelector('a[href="careers.htm"]') : null;
        if (careersItem) {
          careersItem.dispatchEvent(new Event('pointerenter', { bubbles: true }));
        }
        return {
          isOpen: menu ? !menu.hidden : false,
          options
        };
      })()`,
      returnByValue: true
    });

    console.log('Dropdown state on index.html:', dropdownState.result.value);
    await wait(300);

    const sc = await client.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, '19-join-our-team-dropdown.png');
    fs.writeFileSync(fullPath, Buffer.from(sc.data, 'base64'));
    console.log('Captured screenshot of Join Our Team menu: ' + fullPath);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    if (client) client.close();
    if (cp) cp.kill();
    if (server) server.close();
  }
}

verifyMenuDropdown();
