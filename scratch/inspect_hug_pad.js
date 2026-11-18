const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const html = `<!DOCTYPE html>
<html>
<body>
<canvas id="c"></canvas>
<script>
const img = new Image();
img.onload = () => {
  const c = document.getElementById('c');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let top = -1, bottom = -1, left = c.width, right = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const a = data[(y * c.width + x) * 4 + 3];
      if (a > 10) {
        if (top === -1) top = y;
        bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  window.result = {
    canvasWidth: c.width,
    canvasHeight: c.height,
    contentWidth: right - left + 1,
    contentHeight: bottom - top + 1,
    padTop: top,
    padBottom: c.height - 1 - bottom,
    padLeft: left,
    padRight: c.width - 1 - right,
    padTopRatio: top / c.height,
    padBottomRatio: (c.height - 1 - bottom) / c.height
  };
};
img.src = '../image/gif/spouzy-teddy-hug-static.png';
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'inspect_logo_pad.html'), html);

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  let filePath = path.join(__dirname, reqUrl === '/' ? 'inspect_logo_pad.html' : '..' + reqUrl);
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': ext === '.png' ? 'image/png' : 'text/html' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(5644, async () => {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9477',
    '--disable-gpu',
    '--no-sandbox'
  ]);

  await new Promise(r => setTimeout(r, 1000));
  const getJson = (url) => new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const targets = await getJson('http://127.0.0.1:9477/json');
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
  await send('Page.navigate', { url: 'http://127.0.0.1:5644/' });
  await new Promise(r => setTimeout(r, 1500));

  const res = await send('Runtime.evaluate', {
    expression: 'window.result',
    returnByValue: true
  });
  console.log('LOGO PIXEL PADDING RESULT:', res.result.value);

  ws.close();
  chrome.kill();
  server.close();
  process.exit(0);
});
