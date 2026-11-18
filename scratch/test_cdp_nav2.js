const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, '..', req.url === '/' ? 'index.htm' : req.url.split('?')[0]);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime = ext === '.html' || ext === '.htm' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(5502, async () => {
  console.log('Server on 5502');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9399',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + path.join(__dirname, 'cdp-debug2-' + Date.now())
  ]);

  await new Promise(r => setTimeout(r, 1000));
  const getJson = (url) => new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const targets = await getJson('http://127.0.0.1:9399/json');
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  ws.onopen = () => {
    console.log('WS OPEN');
    ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  };

  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 1) {
      console.log('Sending Page.navigate');
      ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: 'http://127.0.0.1:5502/index.htm' } }));
    }
    if (msg.id === 2) {
      console.log('Page.navigate ACKed!');
      await new Promise(r => setTimeout(r, 1500));
      console.log('Sending Runtime.evaluate');
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          expression: 'document.querySelectorAll(".sp-footer-social-btn").length',
          returnByValue: true
        }
      }));
    }
    if (msg.id === 3) {
      console.log('Runtime.evaluate result:', msg.result.result.value);
      console.log('Capturing screenshot...');
      ws.send(JSON.stringify({
        id: 4,
        method: 'Page.captureScreenshot',
        params: { format: 'png' }
      }));
    }
    if (msg.id === 4) {
      console.log('Screenshot received! length:', msg.result.data.length);
      fs.writeFileSync(path.join(__dirname, 'test_cdp_success.png'), Buffer.from(msg.result.data, 'base64'));
      chrome.kill();
      server.close();
      console.log('SUCCESS! Exiting.');
      process.exit(0);
    }
  };
});
