const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9366;
const USER_DATA_DIR = path.join(__dirname, 'chrome-test-icons-' + Date.now());

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Social Icons Visual Test</title>
<link rel="stylesheet" href="../css/guide.css">
<style>
  body {
    background: #1e0e13;
    padding: 40px;
    font-family: sans-serif;
    color: #fff;
  }
  .test-container {
    max-width: 1440px;
    margin: 0 auto;
    border: 1px dashed rgba(255,255,255,0.2);
    padding: 20px;
  }
  
  /* New Social Icons CSS */
  .sp-footer-social-col {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 0 !important;
    margin-left: auto !important;
  }
  
  .sp-footer-social-wrap {
    display: inline-flex !important;
    align-items: center !important;
    gap: 12px !important;
    min-height: 46px !important;
  }
  
  .sp-footer-social-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 40px !important;
    height: 40px !important;
    border-radius: 50% !important;
    color: #ffffff !important;
    text-decoration: none !important;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35) !important;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, filter 0.2s ease !important;
    flex-shrink: 0 !important;
    box-sizing: border-box !important;
    border: none !important;
    cursor: pointer !important;
  }
  
  .sp-footer-social-btn:hover {
    transform: translateY(-2px) scale(1.06) !important;
    filter: brightness(1.1) !important;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45) !important;
  }
  
  .sp-footer-social-btn:focus-visible {
    outline: 2px solid #e08b73 !important;
    outline-offset: 3px !important;
  }
  
  .sp-footer-social-btn.sp-social-fb {
    background: #1877F2 !important;
  }
  
  .sp-footer-social-btn.sp-social-x {
    background: #000000 !important;
    border: 1px solid rgba(255, 255, 255, 0.22) !important;
  }
  
  .sp-footer-social-btn.sp-social-li {
    background: #0A66C2 !important;
  }
  
  .sp-footer-social-btn.sp-social-ig {
    background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%) !important;
  }
  
  .sp-footer-social-placeholder {
    cursor: default !important;
  }
  
  .sp-footer-social-placeholder:hover {
    transform: none !important;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35) !important;
    filter: none !important;
  }
</style>
</head>
<body>
  <h2>Footer Extras Row Simulation</h2>
  <div class="test-container">
    <div class="sp-footer-extras">
      <!-- 1. We Accept -->
      <div class="sp-footer-extra">
        <h4 class="sp-footer-col-title">We Accept</h4>
        <div class="sp-footer-badge-card" title="Secure Payment Options: MasterCard, Visa, RuPay">
          <img class="sp-footer-logo-strip" src="../image/payment.png" width="472" height="68" alt="MasterCard, Visa, RuPay and Secure Checkout" loading="lazy">
        </div>
      </div>

      <!-- 2. We Support -->
      <div class="sp-footer-extra">
        <h4 class="sp-footer-col-title">We Support</h4>
        <div class="sp-footer-badge-card" title="National Digital Health &amp; Wellness">
          <img class="sp-footer-logo-strip" src="../image/sequre.png" width="319" height="80" alt="Digital India and Make in India" loading="lazy">
        </div>
      </div>

      <!-- 3. Social Media Links (No heading, 4 brand icons) -->
      <div class="sp-footer-extra sp-footer-social-col" role="region" aria-label="Social media links">
        <div class="sp-footer-social-wrap">
          <!-- Facebook -->
          <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fspouzy.com%2F"
             target="_blank" rel="noopener noreferrer"
             class="sp-footer-social-btn sp-social-fb"
             aria-label="Share SPOUZY on Facebook">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff" aria-hidden="true" focusable="false">
              <path d="M14.04 13.75h2.51l.37-2.45h-2.88V9.71c0-.67.33-1.32 1.38-1.32h1.5V6.31s-1.36-.23-2.66-.23c-2.71 0-4.49 1.64-4.49 4.62v1.6H7.3v2.45h2.47V21h4.27v-7.25z"/>
            </svg>
          </a>

          <!-- X -->
          <a href="https://x.com/intent/tweet?url=https%3A%2F%2Fspouzy.com%2F&amp;text=SPOUZY"
             target="_blank" rel="noopener noreferrer"
             class="sp-footer-social-btn sp-social-x"
             aria-label="Share SPOUZY on X">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff" aria-hidden="true" focusable="false">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>

          <!-- LinkedIn -->
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fspouzy.com%2F"
             target="_blank" rel="noopener noreferrer"
             class="sp-footer-social-btn sp-social-li"
             aria-label="Share SPOUZY on LinkedIn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff" aria-hidden="true" focusable="false">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
            </svg>
          </a>

          <!-- Instagram (Profile URL pending - styled placeholder) -->
          <span class="sp-footer-social-btn sp-social-ig sp-footer-social-placeholder"
                role="img"
                aria-label="SPOUZY on Instagram (profile URL pending configuration)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#ffffff" aria-hidden="true" focusable="false">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'test_visual.html'), htmlContent);

const server = http.createServer((req, res) => {
  const reqUrl = req.url.split('?')[0];
  let filePath = path.join(__dirname, reqUrl === '/' ? 'test_visual.html' : '..' + reqUrl);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..' + reqUrl);
  }
  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    const mime = ext === '.png' ? 'image/png' : ext === '.css' ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found: ' + reqUrl);
  }
});

server.listen(5611, () => {
  console.log('Test server on 5611');

  const args = [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank'
  ];
  const chrome = spawn(CHROME_PATH, args);

  setTimeout(async () => {
    try {
      const getJson = (url) => new Promise((resolve, reject) => {
        http.get(url, res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });

      let targets;
      for (let i = 0; i < 30; i++) {
        try {
          targets = await getJson(`http://127.0.0.1:${PORT}/json`);
          if (targets && targets.length) break;
        } catch (e) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
      const pageTarget = targets.find(t => t.type === 'page');
      const wsUrl = pageTarget.webSocketDebuggerUrl;

      class CDP {
        constructor(url) {
          this.ws = new WebSocket(url);
          this.id = 1;
          this.callbacks = new Map();
          this.ws.onmessage = e => {
            const msg = JSON.parse(e.data);
            if (msg.id && this.callbacks.has(msg.id)) {
              const { resolve, reject } = this.callbacks.get(msg.id);
              this.callbacks.delete(msg.id);
              if (msg.error) reject(msg.error);
              else resolve(msg.result);
            }
          };
        }
        ready() {
          return new Promise(r => {
            if (this.ws.readyState === WebSocket.OPEN) r();
            else this.ws.onopen = r;
          });
        }
        send(method, params = {}) {
          return new Promise((resolve, reject) => {
            const id = this.id++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
          });
        }
      }

      const client = new CDP(wsUrl);
      await client.ready();
      await client.send('Page.enable');
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: 1200,
        height: 600,
        deviceScaleFactor: 1,
        mobile: false
      });
      await client.send('Page.navigate', { url: 'http://127.0.0.1:5611/' });
      await new Promise(r => setTimeout(r, 1500));

      const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(__dirname, 'test_visual_ss.png'), Buffer.from(screenshot.data, 'base64'));
      console.log('Saved test_visual_ss.png');

      chrome.kill();
      server.close();
      process.exit(0);
    } catch (err) {
      console.error(err);
      chrome.kill();
      server.close();
      process.exit(1);
    }
  }, 1000);
});
