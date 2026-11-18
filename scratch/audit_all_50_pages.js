const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5566;
const CDP_PORT = 9466;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-audit-all-' + Date.now());

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

async function auditAllPages() {
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

  const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
  console.log(`Auditing ${files.length} pages for text contrast on light/canvas backgrounds...`);

  const results = {};

  for (const file of files) {
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/${file}` });
    await wait(350);

    const pageAudit = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          function parseRgb(str) {
            if (!str) return null;
            const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
            if (!m) return null;
            return {
              r: parseInt(m[1]),
              g: parseInt(m[2]),
              b: parseInt(m[3]),
              a: m[4] !== undefined ? parseFloat(m[4]) : 1
            };
          }

          function getEffectiveBg(el) {
            let cur = el;
            while (cur && cur !== document) {
              const s = getComputedStyle(cur);
              const bg = parseRgb(s.backgroundColor);
              if (bg && bg.a > 0.8) {
                return { r: bg.r, g: bg.g, b: bg.b, el: cur };
              }
              // Check if it has a dark background image/scrim
              if (s.backgroundImage && (s.backgroundImage.includes('linear-gradient') || s.backgroundImage.includes('url'))) {
                // If the element has a background image, we can flag it
                return { isImageOrGradient: true, el: cur };
              }
              cur = cur.parentElement;
            }
            return { r: 255, g: 250, b: 205, el: document.body }; // Canvas fallback #FFFACD
          }

          function getLuminance(r, g, b) {
            const a = [r, g, b].map(v => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
          }

          function contrastRatio(l1, l2) {
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
          }

          const issues = [];
          const textNodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, a, span, label, summary, .sp-hero-pill-badge, .sp-breadcrumbs, .sp-kicker, .sp-text-shimmer'));

          for (const el of textNodes) {
            // Ignore hidden elements
            if (el.offsetParent === null && el.tagName.toLowerCase() !== 'body') continue;
            const text = el.innerText ? el.innerText.trim() : '';
            if (!text) continue;
            // Ignore topbar announcement and footer because they have dark surfaces
            if (el.closest('.sp-topbar-modern, .sp-footer-modern, .sp-footer-bottom')) continue;
            // Ignore banner slides because they have dark image scrim overlays
            if (el.closest('.sp-hero-banner-slides, .sp-hero-banner-frame')) continue;

            const s = getComputedStyle(el);
            const textColor = parseRgb(s.color);
            const bg = getEffectiveBg(el);

            if (bg.isImageOrGradient) continue; // On intentional gradient/photo

            // Check if bg is light (Luminance > 0.6, e.g. #FFFACD has lum ~0.94)
            const bgLum = getLuminance(bg.r, bg.g, bg.b);
            if (bgLum > 0.6) {
              // Check text color
              let textLum = 0;
              let isPaleShimmer = false;

              if (s.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || s.webkitTextFillColor === 'transparent') {
                isPaleShimmer = true;
              } else if (textColor) {
                // If text is white or very pale
                textLum = getLuminance(textColor.r, textColor.g, textColor.b);
              }

              const isLarge = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.5 && (s.fontWeight === 'bold' || parseInt(s.fontWeight) >= 700));
              const minRatio = isLarge ? 3.0 : 4.5;
              const ratio = contrastRatio(bgLum, textLum);

              if (isPaleShimmer || ratio < minRatio) {
                // Check if already reported for this selector/class
                issues.push({
                  tag: el.tagName.toLowerCase(),
                  className: el.className,
                  text: text.substring(0, 45),
                  color: s.color,
                  webkitTextFillColor: s.webkitTextFillColor,
                  ratio: isPaleShimmer ? 'FAIL (transparent fill)' : ratio.toFixed(2),
                  minRequired: minRatio,
                  bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')'
                });
              }
            }
          }

          return issues;
        })()
      `,
      returnByValue: true
    });

    const issues = pageAudit.result.value || [];
    if (issues.length > 0) {
      results[file] = issues;
    }
  }

  console.log(`\nAudit complete! Pages with low-contrast issues on light/canvas backgrounds:`, Object.keys(results).length);
  for (const [f, issues] of Object.entries(results)) {
    console.log(`\n=== ${f} (${issues.length} issues) ===`);
    issues.slice(0, 6).forEach(iss => {
      console.log(`  <${iss.tag} class="${iss.className}"> "${iss.text}" ratio: ${iss.ratio} (need ${iss.minRequired}) color: ${iss.color}`);
    });
  }

  fs.writeFileSync('scratch/contrast_audit_raw.json', JSON.stringify(results, null, 2));

  client.close();
  cp.kill('SIGKILL');
  server.close();
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
}

auditAllPages().catch(err => {
  console.error(err);
  process.exit(1);
});
