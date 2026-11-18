const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5565;
const CDP_PORT = 9465;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-audit-' + Date.now());

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

async function runAudit() {
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
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
      const t = targets.find(x => x.type === 'page');
      if (t) {
        client = new CDPClient(t.webSocketDebuggerUrl);
        await client.ready();
        break;
      }
    } catch(e) { await wait(250); }
  }

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  console.log('Auditing about-profile.htm...');
  await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/about-profile.htm` });
  await wait(800);

  const aboutProfileAudit = await client.send('Runtime.evaluate', {
    expression: `
      (function() {
        const hero = document.querySelector('.sp-subpage-hero');
        if (!hero) return { error: 'Hero not found' };

        const elements = [
          { name: 'Breadcrumb container', el: hero.querySelector('.sp-breadcrumbs') },
          { name: 'Breadcrumb link', el: hero.querySelector('.sp-breadcrumbs a') },
          { name: 'Breadcrumb separator', el: hero.querySelector('.sp-breadcrumbs i') },
          { name: 'Breadcrumb active span', el: hero.querySelector('.sp-breadcrumbs span') },
          { name: 'Subpage title (H1)', el: hero.querySelector('.sp-subpage-title') },
          { name: 'Shimmer span in title', el: hero.querySelector('.sp-text-shimmer') },
          { name: 'Subpage subtitle', el: hero.querySelector('.sp-subpage-subtitle') },
          { name: 'Hero badges container', el: hero.querySelector('.sp-subpage-badge-row') }
        ];

        const badges = Array.from(hero.querySelectorAll('.sp-hero-pill-badge')).map((b, i) => ({
          name: 'Hero badge ' + (i + 1) + ' (' + b.textContent.trim() + ')',
          el: b,
          icon: b.querySelector('i')
        }));

        const results = [];
        for (const item of elements) {
          if (!item.el) {
            results.push({ name: item.name, missing: true });
            continue;
          }
          const s = getComputedStyle(item.el);
          results.push({
            name: item.name,
            color: s.color,
            backgroundColor: s.backgroundColor,
            webkitTextFillColor: s.webkitTextFillColor,
            backgroundImage: s.backgroundImage,
            opacity: s.opacity,
            text: item.el.textContent.trim().substring(0, 50)
          });
        }

        for (const b of badges) {
          const s = getComputedStyle(b.el);
          const is = b.icon ? getComputedStyle(b.icon) : null;
          results.push({
            name: b.name,
            color: s.color,
            backgroundColor: s.backgroundColor,
            borderColor: s.borderColor,
            iconColor: is ? is.color : null
          });
        }

        // Also check main story container elements
        const story = document.querySelector('.sp-story-container');
        const storyElements = [];
        if (story) {
          const titles = Array.from(story.querySelectorAll('h1, h2, h3, p, a, span.sp-kicker'));
          titles.slice(0, 10).forEach(t => {
            const s = getComputedStyle(t);
            storyElements.push({
              tag: t.tagName.toLowerCase(),
              className: t.className,
              color: s.color,
              bg: s.backgroundColor,
              text: t.textContent.trim().substring(0, 40)
            });
          });
        }

        return {
          heroComputed: {
            bg: getComputedStyle(hero).backgroundColor
          },
          heroItems: results,
          storyItems: storyElements
        };
      })()
    `,
    returnByValue: true
  });

  console.log('About Profile Hero items:');
  console.log(JSON.stringify(aboutProfileAudit.result.value, null, 2));

  // Take screenshot of about-profile before fix
  const ss = await client.send('Page.captureScreenshot', { format: 'png' });
  const ssPath = path.join(ARTIFACT_DIR, '01-about-profile-before-fix.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log(`Saved screenshot: ${ssPath}`);

  client.close();
  cp.kill('SIGKILL');
  server.close();
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
