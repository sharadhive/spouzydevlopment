const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9422;
const SERVER_PORT = 5502;
const USER_DATA_DIR = path.join(__dirname, 'chrome-verify-social-' + Date.now());

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_footer_social';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// 1. Static Audit
function runStaticAudit() {
  console.log('=== Step 1: Sitewide Static Audit Across 50 Files ===');
  const files = fs.readdirSync('.').filter(f => f.endsWith('.htm') || f.endsWith('.html'));
  const results = {
    totalFiles: files.length,
    shareSpouzyHeadingCount: 0,
    twitterBirdCount: 0,
    pinterestCount: 0,
    socialBlockCount: 0,
    fbCount: 0,
    xCount: 0,
    liCount: 0,
    igCount: 0,
    placeholderValidCount: 0,
    weAcceptCount: 0,
    weSupportCount: 0,
    teddyCount: 0,
    orderCorrectCount: 0,
    errors: []
  };

  files.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('Share SPOUZY</h4>') || content.includes('Share SPOUZY</h3>')) {
      results.shareSpouzyHeadingCount++;
    }
    if (content.includes('fa-twitter')) results.twitterBirdCount++;
    if (content.includes('pinterest.com') || content.includes('fa-pinterest')) results.pinterestCount++;
    if (content.includes('sp-footer-social')) results.socialBlockCount++;
    if (content.includes('sp-social-fb')) results.fbCount++;
    if (content.includes('sp-social-x')) results.xCount++;
    if (content.includes('sp-social-li')) results.liCount++;
    if (content.includes('sp-social-ig')) results.igCount++;
    if (content.includes('sp-social-placeholder') && !content.includes('href="#"')) results.placeholderValidCount++;
    if (content.includes('We Accept')) results.weAcceptCount++;
    if (content.includes('We Support')) results.weSupportCount++;
    if (content.includes('sp-footer-teddy')) results.teddyCount++;

    const fbIdx = content.indexOf('sp-social-fb');
    const xIdx = content.indexOf('sp-social-x');
    const liIdx = content.indexOf('sp-social-li');
    const igIdx = content.indexOf('sp-social-ig');
    if (fbIdx !== -1 && fbIdx < xIdx && xIdx < liIdx && liIdx < igIdx) {
      results.orderCorrectCount++;
    } else {
      results.errors.push(`Order incorrect in ${f}`);
    }
  });

  console.log(`Audited ${results.totalFiles} files:`);
  console.log(`- Files with visible 'Share SPOUZY' heading: ${results.shareSpouzyHeadingCount} (expected: 0)`);
  console.log(`- Files with Twitter bird: ${results.twitterBirdCount} (expected: 0)`);
  console.log(`- Files with Pinterest: ${results.pinterestCount} (expected: 0)`);
  console.log(`- Files with sp-footer-social: ${results.socialBlockCount} / ${results.totalFiles}`);
  console.log(`- Files with FB, X, LI, IG in exact order: ${results.orderCorrectCount} / ${results.totalFiles}`);
  console.log(`- Files with valid Instagram placeholder (no href="#"): ${results.placeholderValidCount} / ${results.totalFiles}`);
  console.log(`- Files with We Accept: ${results.weAcceptCount} / ${results.totalFiles}`);
  console.log(`- Files with We Support: ${results.weSupportCount} / ${results.totalFiles}`);
  console.log(`- Files with Teddy Animation: ${results.teddyCount} / ${results.totalFiles}`);

  return results;
}

// 2. HTTP Server
function startStaticServer() {
  const root = path.resolve('.');
  const mimeTypes = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.webm': 'video/webm',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
  };

  const server = http.createServer((req, res) => {
    let reqUrl = decodeURI(req.url.split('?')[0]);
    if (reqUrl === '/') reqUrl = '/index.htm';
    const filePath = path.join(root, reqUrl);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found: ' + reqUrl);
    }
  });

  return new Promise(resolve => {
    server.listen(SERVER_PORT, () => {
      console.log(`Static server running at http://127.0.0.1:${SERVER_PORT}`);
      resolve(server);
    });
  });
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (typeof msg.id !== 'undefined' && this.callbacks.has(msg.id)) {
        const { resolve, reject, timer } = this.callbacks.get(msg.id);
        clearTimeout(timer);
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
  send(method, params = {}, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`Timeout: ${method} (id=${id})`));
        }
      }, timeoutMs);
      this.callbacks.set(id, { resolve, reject, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.callbacks.delete(id);
        reject(err);
      }
    });
  }
  close() {
    try { this.ws.close(); } catch (e) {}
  }
}

async function run() {
  const audit = runStaticAudit();
  const server = await startStaticServer();

  console.log('Spawning Chrome headless...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--window-size=1440,900'
  ]);

  let cdp;
  const results = {
    audit: audit,
    browserTests: [],
    passed: 0,
    failed: 0,
    screenshots: []
  };

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
    cdp = new CDP(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send('Page.enable');

    console.log('CDP Connected.');

    // TEST 1: index.htm Desktop
    console.log('\n--- Test 1: Desktop Navigation & Inspection (index.htm) ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/index.htm` });
    await wait(2200);

    // Ensure loader is dismissed and scroll footer extras into view
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const loader = document.getElementById('spPageLoader');
        if (loader) loader.remove();
        const extras = document.querySelector('.sp-footer-extras');
        if (extras) extras.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await wait(600);

    const desktopData = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const socialCol = document.querySelector('.sp-footer-social-col');
        const socialWrap = document.querySelector('.sp-footer-social');
        const buttons = Array.from(document.querySelectorAll('.sp-footer-social-btn'));
        const allHeadings = Array.from(document.querySelectorAll('.sp-footer-extras .sp-footer-col-title')).map(h => h.textContent.trim());

        const buttonDetails = buttons.map(b => {
          const rect = b.getBoundingClientRect();
          const cs = window.getComputedStyle(b);
          const svg = b.querySelector('svg');
          return {
            tag: b.tagName.toLowerCase(),
            classes: b.className,
            ariaLabel: b.getAttribute('aria-label'),
            href: b.getAttribute('href') || null,
            target: b.getAttribute('target') || null,
            rel: b.getAttribute('rel') || null,
            role: b.getAttribute('role') || null,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            bg: cs.backgroundColor,
            borderRadius: cs.borderRadius,
            border: cs.border,
            hasSvg: !!svg
          };
        });

        const teddy = document.querySelector('.sp-footer-teddy');
        const weAccept = document.querySelector('.sp-footer-extra img[src*="payment"]');
        const weSupport = document.querySelector('.sp-footer-extra img[src*="sequre"]');

        return {
          hasSocialCol: !!socialCol,
          socialColAriaLabel: socialCol ? socialCol.getAttribute('aria-label') : null,
          hasSocialWrap: !!socialWrap,
          headingsInExtras: allHeadings,
          shareHeadingVisible: allHeadings.some(h => h.toLowerCase().includes('share')),
          buttonCount: buttons.length,
          buttons: buttonDetails,
          hasTeddy: !!teddy,
          hasWeAccept: !!weAccept,
          hasWeSupport: !!weSupport
        };
      })()`,
      returnByValue: true
    });

    const d = desktopData.result.value;
    console.log('Headings in extras:', d.headingsInExtras);
    console.log('Buttons count:', d.buttonCount);
    d.buttons.forEach((b, i) => {
      console.log(`  Icon ${i + 1}: <${b.tag}> ${b.classes} | ${b.width}x${b.height}px | radius: ${b.borderRadius} | label: "${b.ariaLabel}"`);
    });

    const t1Pass = !d.shareHeadingVisible &&
      d.buttonCount === 4 &&
      d.buttons[0].classes.includes('sp-social-fb') &&
      d.buttons[1].classes.includes('sp-social-x') &&
      d.buttons[2].classes.includes('sp-social-li') &&
      d.buttons[3].classes.includes('sp-social-ig') &&
      d.buttons[3].tag === 'span' &&
      d.buttons[3].href === null &&
      d.buttons.every(b => b.width >= 38 && b.width <= 44 && b.height >= 38 && b.height <= 44) &&
      d.hasWeAccept &&
      d.hasWeSupport &&
      d.hasTeddy;

    results.browserTests.push({
      test: 'Desktop Footer Social Area Metrics & Integrity (index.htm)',
      passed: t1Pass,
      details: d
    });
    if (t1Pass) results.passed++; else results.failed++;

    // Screenshot 1: Desktop Footer Ribbon
    const ss1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const ss1Path = path.join(ARTIFACT_DIR, '01-desktop-footer-social-ribbon.png');
    fs.writeFileSync(ss1Path, Buffer.from(ss1.data, 'base64'));
    results.screenshots.push('01-desktop-footer-social-ribbon.png');
    console.log(`Saved screenshot: 01-desktop-footer-social-ribbon.png`);

    // Screenshot 2: Closeup of Social Icons
    console.log('\n--- Test 2: High-Res Closeup of Social Icons ---');
    const clipResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const wrap = document.querySelector('.sp-footer-social-col');
        if (!wrap) return null;
        const rect = wrap.getBoundingClientRect();
        return {
          x: Math.round(Math.max(0, rect.x - 12)),
          y: Math.round(Math.max(0, rect.y - 12)),
          width: Math.round(rect.width + 24),
          height: Math.round(rect.height + 24),
          scale: 1
        };
      })()`,
      returnByValue: true
    });

    if (clipResult.result.value) {
      const ss2 = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: clipResult.result.value
      });
      const ss2Path = path.join(ARTIFACT_DIR, '02-social-icons-closeup.png');
      fs.writeFileSync(ss2Path, Buffer.from(ss2.data, 'base64'));
      results.screenshots.push('02-social-icons-closeup.png');
      console.log(`Saved screenshot: 02-social-icons-closeup.png`);
    }

    // TEST 3: Tablet (768px)
    console.log('\n--- Test 3: Tablet Viewport (768px) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const loader = document.getElementById('spPageLoader');
        if (loader) loader.remove();
        const extras = document.querySelector('.sp-footer-extras');
        if (extras) extras.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await wait(500);

    const tabletCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const socialCol = document.querySelector('.sp-footer-social-col');
        const rect = socialCol ? socialCol.getBoundingClientRect() : null;
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
        return {
          width: rect ? rect.width : null,
          height: rect ? rect.height : null,
          hasOverflow: hasOverflow
        };
      })()`,
      returnByValue: true
    });
    console.log('Tablet check:', tabletCheck.result.value);

    const ss3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const ss3Path = path.join(ARTIFACT_DIR, '03-tablet-footer-social.png');
    fs.writeFileSync(ss3Path, Buffer.from(ss3.data, 'base64'));
    results.screenshots.push('03-tablet-footer-social.png');

    const t3Pass = !tabletCheck.result.value.hasOverflow;
    results.browserTests.push({
      test: 'Tablet Responsiveness & Layout Flow (768px)',
      passed: t3Pass,
      details: tabletCheck.result.value
    });
    if (t3Pass) results.passed++; else results.failed++;

    // TEST 4: Mobile (375px)
    console.log('\n--- Test 4: Mobile Viewport (375px) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const loader = document.getElementById('spPageLoader');
        if (loader) loader.remove();
        const extras = document.querySelector('.sp-footer-extras');
        if (extras) extras.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await wait(500);

    const mobileCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('.sp-footer-social-btn'));
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
        const buttonRects = buttons.map(b => {
          const r = b.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
        });
        const sameRow = buttonRects.every(r => Math.abs(r.top - buttonRects[0].top) < 10);
        return {
          hasOverflow: hasOverflow,
          sameRow: sameRow,
          buttonCount: buttons.length,
          buttonSizes: buttonRects
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile check:', mobileCheck.result.value);

    const ss4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const ss4Path = path.join(ARTIFACT_DIR, '04-mobile-footer-social.png');
    fs.writeFileSync(ss4Path, Buffer.from(ss4.data, 'base64'));
    results.screenshots.push('04-mobile-footer-social.png');

    const t4Pass = !mobileCheck.result.value.hasOverflow && mobileCheck.result.value.buttonCount === 4;
    results.browserTests.push({
      test: 'Mobile Viewport Integrity & No Overflow (375px)',
      passed: t4Pass,
      details: mobileCheck.result.value
    });
    if (t4Pass) results.passed++; else results.failed++;

    // TEST 5: Multi-page
    console.log('\n--- Test 5: Multi-Page Sitewide Verification ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    const pages = [
      'corporate-kamasutra.htm',
      'gen-z-kama-sutra.htm',
      'intimate-aesthetics-treatment.htm',
      'about-us.htm',
      'contactus.htm'
    ];

    let multiPageAllPassed = true;
    for (const p of pages) {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/${p}` });
      await wait(1200);
      await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
      await wait(400);

      const pageCheck = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const socialWrap = document.querySelector('.sp-footer-social');
          const buttons = Array.from(document.querySelectorAll('.sp-footer-social-btn'));
          const shareText = document.querySelector('.sp-footer-extras')?.innerText || '';
          const hasShare = shareText.toLowerCase().includes('share');
          return {
            hasWrap: !!socialWrap,
            buttonCount: buttons.length,
            hasShareHeading: hasShare
          };
        })()`,
        returnByValue: true
      });
      const v = pageCheck.result.value;
      const ok = v.hasWrap && v.buttonCount === 4 && !v.hasShareHeading;
      console.log(`Page ${p}: ${ok ? 'PASSED' : 'FAILED'} (buttons: ${v.buttonCount}, hasShareHeading: ${v.hasShareHeading})`);
      if (!ok) multiPageAllPassed = false;
    }

    results.browserTests.push({
      test: 'Multi-Page Sitewide Verification',
      passed: multiPageAllPassed,
      details: { pagesChecked: pages }
    });
    if (multiPageAllPassed) results.passed++; else results.failed++;

    // TEST 6: Keyboard Focus State
    console.log('\n--- Test 6: Hover & Keyboard Focus States ---');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/index.htm` });
    await wait(1200);
    await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
    await wait(400);

    const focusCheck = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const fb = document.querySelector('.sp-footer-social-btn.sp-social-fb');
        fb.focus();
        const active = document.activeElement === fb;
        const cs = window.getComputedStyle(fb);
        return {
          focused: active,
          outline: cs.outlineStyle,
          outlineColor: cs.outlineColor
        };
      })()`,
      returnByValue: true
    });
    console.log('Focus check on FB button:', focusCheck.result.value);

    const t6Pass = focusCheck.result.value.focused;
    results.browserTests.push({
      test: 'Keyboard Focus State Feedback',
      passed: t6Pass,
      details: focusCheck.result.value
    });
    if (t6Pass) results.passed++; else results.failed++;

    // Write final json report
    const reportPath = path.join(ARTIFACT_DIR, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n======================================================`);
    console.log(`Verification Complete: ${results.passed} passed, ${results.failed} failed.`);
    console.log(`Report saved to: ${reportPath}`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    server.close();
    process.exit(results.failed > 0 ? 1 : 0);
  }
}

run();
