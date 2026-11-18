const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9323;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-test-anim-replay';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
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
    return new Promise(resolve => {
      if (this.ws.readyState === WebSocket.OPEN) resolve();
      else this.ws.onopen = resolve;
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox'
  ]);

  try {
    let tabs = null;
    for (let i = 0; i < 20; i++) {
      try {
        tabs = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (tabs && tabs.length > 0) break;
      } catch (e) { await wait(200); }
    }
    const client = new CDPClient(tabs[0].webSocketDebuggerUrl);
    await client.ready();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(800);

    const testAnim = await client.send('Runtime.evaluate', {
      expression: `(async () => {
        // Let's create an img with spouzy-transition.webp, attach it to DOM
        const img = document.createElement('img');
        img.src = 'image/spouzy-transition.webp';
        img.style.position = 'fixed';
        img.style.top = '10px';
        img.style.left = '10px';
        img.style.width = '320px';
        img.style.zIndex = '999999';
        document.body.appendChild(img);
        await img.decode();

        // Let's wait 1.8s for animation to complete
        await new Promise(r => setTimeout(r, 1800));

        // Now remove it
        img.remove();

        // Wait 200ms
        await new Promise(r => setTimeout(r, 200));

        // Now create a SECOND image with the exact same URL (no query string!)
        const img2 = document.createElement('img');
        img2.src = 'image/spouzy-transition.webp';
        img2.style.position = 'fixed';
        img2.style.top = '10px';
        img2.style.left = '10px';
        img2.style.width = '320px';
        img2.style.zIndex = '999999';
        document.body.appendChild(img2);
        await img2.decode();

        return {
          firstComplete: img.complete,
          secondComplete: img2.complete,
          currentSrc: img2.currentSrc
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('DOM Replay test:', testAnim.result.value);

    // Take screenshot to see what img2 shows!
    const ss = await client.send('Page.captureScreenshot', { format: 'png' });
    const fs = require('fs');
    fs.writeFileSync('scratch/test_replay_ss.png', Buffer.from(ss.data, 'base64'));
    console.log('Saved screenshot scratch/test_replay_ss.png');

    client.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
