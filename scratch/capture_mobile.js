const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9466;
const SERVER_PORT = 5502;
const USER_DATA_DIR = path.join(__dirname, 'chrome-mob-' + Date.now());
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

const root = path.resolve('.');
const server = http.createServer((req, res) => {
  let reqUrl = decodeURI(req.url.split('?')[0]);
  if (reqUrl === '/') reqUrl = '/index.htm';
  const filePath = path.join(root, reqUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(SERVER_PORT, async () => {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=375,812'
  ]);

  try {
    let targets;
    for (let i = 0; i < 30; i++) {
      try {
        targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
        if (targets && targets.length) break;
      } catch (e) {
        await wait(200);
      }
    }
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (typeof msg.id !== 'undefined' && callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        cb(msg.result);
      }
    };
    const send = (method, params = {}) => new Promise(r => {
      const reqId = id++;
      callbacks.set(reqId, r);
      ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    await new Promise(r => ws.onopen = r);
    await send('Page.enable');
    await send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/index.htm` });
    await wait(2000);

    await send('Runtime.evaluate', {
      expression: `(() => {
        const loader = document.getElementById('sp-page-loader');
        if (loader) loader.remove();
        window.scrollTo(0, 999999);
        document.documentElement.scrollTop = 999999;
        document.body.scrollTop = 999999;
      })()`
    });
    await wait(600);

    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, '04-mobile-footer-social.png'), Buffer.from(ss.data, 'base64'));
    console.log('Mobile screenshot saved successfully!');

    ws.close();
    chrome.kill();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    chrome.kill();
    server.close();
    process.exit(1);
  }
});
