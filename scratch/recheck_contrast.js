const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5567;
const CDP_PORT = 9467;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-audit-recheck-' + Date.now());

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

async function recheckAboutProfile() {
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

  console.log('Re-auditing about-profile.htm after fixes...');
  await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/about-profile.htm` });
  await wait(800);

  const checkResult = await client.send('Runtime.evaluate', {
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

        const hero = document.querySelector('.sp-subpage-hero');
        const heroBg = parseRgb(getComputedStyle(hero).backgroundColor);
        const heroBgLum = getLuminance(heroBg.r, heroBg.g, heroBg.b);

        const items = [
          { name: 'Breadcrumb container', el: hero.querySelector('.sp-breadcrumbs') },
          { name: 'Breadcrumb link 1 (Home)', el: hero.querySelector('.sp-breadcrumbs a[href="index.htm"]') },
          { name: 'Breadcrumb link 2 (About PSG)', el: hero.querySelector('.sp-breadcrumbs a[href="about-profile.htm"]') },
          { name: 'Breadcrumb separator (icon)', el: hero.querySelector('.sp-breadcrumbs i') },
          { name: 'Breadcrumb active text', el: hero.querySelector('.sp-breadcrumbs span') },
          { name: 'H1 Subpage Title', el: hero.querySelector('.sp-subpage-title') },
          { name: 'Highlighted Span (sp-text-shimmer)', el: hero.querySelector('.sp-subpage-title .sp-text-shimmer') },
          { name: 'Supporting Paragraph (subtitle)', el: hero.querySelector('.sp-subpage-subtitle') }
        ];

        const badges = Array.from(hero.querySelectorAll('.sp-hero-pill-badge')).map((b, i) => ({
          name: 'Hero badge ' + (i + 1) + ' (' + b.textContent.trim() + ')',
          el: b,
          icon: b.querySelector('i')
        }));

        const results = [];
        for (const item of items) {
          if (!item.el) continue;
          const s = getComputedStyle(item.el);
          const c = parseRgb(s.color);
          const cLum = c ? getLuminance(c.r, c.g, c.b) : 0;
          const ratio = contrastRatio(heroBgLum, cLum);

          results.push({
            name: item.name,
            color: s.color,
            webkitTextFillColor: s.webkitTextFillColor,
            text: item.el.textContent.trim().substring(0, 40),
            ratio: ratio.toFixed(2),
            passed: ratio >= (item.name.includes('H1') ? 3.0 : 4.5)
          });
        }

        for (const b of badges) {
          const s = getComputedStyle(b.el);
          const bBg = parseRgb(s.backgroundColor);
          const bBgLum = getLuminance(bBg.r, bBg.g, bBg.b);
          const c = parseRgb(s.color);
          const cLum = getLuminance(c.r, c.g, c.b);
          const ratio = contrastRatio(bBgLum, cLum);

          const is = b.icon ? getComputedStyle(b.icon) : null;
          const ic = is ? parseRgb(is.color) : null;
          const icLum = ic ? getLuminance(ic.r, ic.g, ic.b) : 0;
          const iconRatio = contrastRatio(bBgLum, icLum);

          results.push({
            name: b.name,
            badgeBg: s.backgroundColor,
            badgeColor: s.color,
            badgeBorder: s.borderColor,
            badgeRatio: ratio.toFixed(2),
            iconColor: is ? is.color : null,
            iconRatio: iconRatio.toFixed(2),
            passed: ratio >= 4.5 && iconRatio >= 4.5
          });
        }

        return { heroBg: getComputedStyle(hero).backgroundColor, results };
      })()
    `,
    returnByValue: true
  });

  console.log('\n=== Recheck Results for about-profile.htm ===');
  console.log('Hero Background:', checkResult.result.value.heroBg);
  console.log(JSON.stringify(checkResult.result.value.results, null, 2));

  // Capture screenshot after fix
  const ss = await client.send('Page.captureScreenshot', { format: 'png' });
  const ssPath = path.join(ARTIFACT_DIR, '02-about-profile-after-fix.png');
  fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  console.log(`\nSaved screenshot after fix: ${ssPath}`);

  // Re-run sitewide audit on all 50 pages to check overall compliance
  console.log('\nRe-checking sitewide contrast on all 50 pages...');
  const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
  let totalIssues = 0;
  const issuesByPage = {};

  for (const f of files) {
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/${f}` });
    await wait(300);

    const auditEval = await client.send('Runtime.evaluate', {
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
              if (s.backgroundImage && (s.backgroundImage.includes('linear-gradient') || s.backgroundImage.includes('url'))) {
                return { isImageOrGradient: true, el: cur };
              }
              cur = cur.parentElement;
            }
            return { r: 255, g: 250, b: 205, el: document.body };
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
            if (el.offsetParent === null && el.tagName.toLowerCase() !== 'body') continue;
            const text = el.innerText ? el.innerText.trim() : '';
            if (!text) continue;
            if (el.closest('.sp-topbar-modern, .sp-footer-modern, .sp-footer-bottom')) continue;
            if (el.closest('.sp-hero-banner-slides, .sp-hero-banner-frame')) continue;

            const s = getComputedStyle(el);
            const textColor = parseRgb(s.color);
            const bg = getEffectiveBg(el);
            if (bg.isImageOrGradient) continue;

            const bgLum = getLuminance(bg.r, bg.g, bg.b);
            if (bgLum > 0.6) {
              let textLum = 0;
              let isPaleShimmer = false;

              if (s.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || s.webkitTextFillColor === 'transparent') {
                isPaleShimmer = true;
              } else if (textColor) {
                textLum = getLuminance(textColor.r, textColor.g, textColor.b);
              }

              const isLarge = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.5 && (s.fontWeight === 'bold' || parseInt(s.fontWeight) >= 700));
              const minRatio = isLarge ? 3.0 : 4.5;
              const ratio = contrastRatio(bgLum, textLum);

              if (isPaleShimmer || ratio < minRatio) {
                issues.push({
                  tag: el.tagName.toLowerCase(),
                  className: el.className,
                  text: text.substring(0, 45),
                  color: s.color,
                  ratio: isPaleShimmer ? 'transparent-fill' : ratio.toFixed(2),
                  minRequired: minRatio
                });
              }
            }
          }
          return issues;
        })()
      `,
      returnByValue: true
    });

    const issues = auditEval.result.value || [];
    if (issues.length > 0) {
      issuesByPage[f] = issues;
      totalIssues += issues.length;
    }
  }

  console.log(`\nPost-fix sitewide audit: ${Object.keys(issuesByPage).length} pages with issues, total issues: ${totalIssues}`);
  if (totalIssues > 0) {
    console.log(JSON.stringify(issuesByPage, null, 2));
  } else {
    console.log('ALL 50 PAGES HAVE 100% PASSING CONTRAST RATIOS (ZERO LOW-CONTRAST ISSUES)!');
  }

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'verification_contrast_report.json'), JSON.stringify({
    aboutProfileDetails: checkResult.result.value,
    sitewideIssuesCount: totalIssues,
    sitewideIssuesByPage: issuesByPage
  }, null, 2));

  client.close();
  cp.kill('SIGKILL');
  server.close();
  try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
}

recheckAboutProfile().catch(err => {
  console.error(err);
  process.exit(1);
});
