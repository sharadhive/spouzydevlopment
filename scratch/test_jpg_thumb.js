const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5572;
const CDP_PORT = 9472;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.htm';
  const filePath = path.join(__dirname, '..', reqPath);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': ext === '.js' ? 'application/javascript' : (ext === '.css' ? 'text/css' : 'text/html') });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox'
  ]);

  await new Promise(r => setTimeout(r, 1500));
  const listRes = await fetch(`http://localhost:${CDP_PORT}/json`);
  const tabs = await listRes.json();
  const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);

  let messageId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error); else resolve(msg.result);
    }
  };

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++messageId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(r => { ws.onopen = r; });
  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/join-doctor.htm` });
  await new Promise(r => setTimeout(r, 800));

  const jpgRes = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('spCouncilCertInput');
      const preview = document.getElementById('spCouncilCertPreview');
      // Create a small base64 1x1 png/jpg fake image
      const byteString = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ia], { type: 'image/jpeg' });
      const file = new File([blob], 'delhi-council-cert.jpg', { type: 'image/jpeg' });
      
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      return new Promise(resolve => {
        setTimeout(() => {
          const thumb = preview.querySelector('.sp-file-thumb img');
          resolve({
            hasImageThumb: thumb !== null,
            imgSrcStartsData: thumb ? thumb.src.startsWith('data:image/') : false,
            fileName: preview.querySelector('.sp-file-name').textContent
          });
        }, 300);
      });
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('JPG Thumbnail Test Result:', jpgRes.result.value);

  ws.close();
  chromeProcess.kill();
  server.close();
  process.exit(0);
});
