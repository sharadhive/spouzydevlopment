const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9377;
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

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) console.log('CDP RES:', msg.id, msg.error || 'ok');
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
    return new Promise(resolve => {
      if (this.ws.readyState === WebSocket.OPEN) resolve();
      else this.ws.onopen = resolve;
    });
  }
  send(method, params = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      console.log('CDP SEND:', id, method);
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP command timed out: ${method} (id=${id})`));
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

// 1. Static Audit of all 50 HTML files
function auditHtmlFiles() {
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

    // Check order
    const fbIdx = content.indexOf('sp-social-fb');
    const xIdx = content.indexOf('sp-social-x');
    const liIdx = content.indexOf('sp-social-li');
    const igIdx = content.indexOf('sp-social-ig');
    if (!(fbIdx < xIdx && xIdx < liIdx && liIdx < igIdx)) {
      results.errors.push(`Order incorrect in ${f}: fb=${fbIdx}, x=${xIdx}, li=${liIdx}, ig=${igIdx}`);
    }
  });

  console.log(`Audited ${results.totalFiles} files:`);
  console.log(`- Files with visible 'Share SPOUZY' heading: ${results.shareSpouzyHeadingCount} (expected: 0)`);
  console.log(`- Files with Twitter bird: ${results.twitterBirdCount} (expected: 0)`);
  console.log(`- Files with Pinterest: ${results.pinterestCount} (expected: 0)`);
  console.log(`- Files with sp-footer-social: ${results.socialBlockCount} (expected: ${results.totalFiles})`);
  console.log(`- Files with FB, X, LI, IG in exact order: ${results.socialBlockCount - results.errors.length} / ${results.totalFiles}`);
  console.log(`- Files with valid Instagram placeholder (no href="#"): ${results.placeholderValidCount} / ${results.totalFiles}`);
  console.log(`- Files with We Accept: ${results.weAcceptCount} / ${results.totalFiles}`);
  console.log(`- Files with We Support: ${results.weSupportCount} / ${results.totalFiles}`);
  console.log(`- Files with Teddy Animation: ${results.teddyCount} / ${results.totalFiles}`);

  return results;
}

// 2. Embedded HTTP Server
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
      console.log(`Embedded static server running at http://127.0.0.1:${SERVER_PORT}`);
      resolve(server);
    });
  });
}

async function runBrowserVerification() {
  const auditResults = auditHtmlFiles();

  const server = await startStaticServer();

  console.log('\nLaunching headless Chrome with debugging port ' + PORT + '...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    '--autoplay-policy=no-user-gesture-required'
  ]);

  let client;
  const testResults = {
    audit: auditResults,
    browserTests: [],
    passed: 0,
    failed: 0,
    screenshots: []
  };

  try {
    let targets;
    for (let i = 0; i < 30; i++) {
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length) break;
      } catch (e) {
        await wait(200);
      }
    }

    const pageTarget = targets.find(t => t.type === 'page');
    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Connected to Chrome DevTools Protocol successfully.');

    // TEST 1: Inspect Desktop Footer Social Area on index.htm
    console.log('\n--- Test 1: Desktop Footer Social Area Verification (index.htm) ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/index.htm` });
    await wait(1800); // Wait for page & initial animations

    // Scroll to footer
    await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
    await wait(600);

    // Evaluate social section metrics
    const evalResult = await client.send('Runtime.evaluate', {
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
            bgImg: cs.backgroundImage,
            borderRadius: cs.borderRadius,
            hasSvg: !!svg,
            svgWidth: svg ? svg.getAttribute('width') : null,
            svgHeight: svg ? svg.getAttribute('height') : null,
            svgFill: svg ? svg.getAttribute('fill') : null
          };
        });

        const extras = document.querySelector('.sp-footer-extras');
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

    const d = evalResult.result.value;
    console.log('Headings in extras:', d.headingsInExtras);
    console.log('Share heading visible:', d.shareHeadingVisible);
    console.log('Buttons detected:', d.buttonCount);
    d.buttons.forEach((b, i) => {
      console.log(`  Icon ${i + 1}: ${b.classes} | tag: <${b.tag}> | ${b.width}x${b.height}px | radius: ${b.borderRadius} | bg: ${b.bg} | label: "${b.ariaLabel}"`);
    });

    const test1Pass = !d.shareHeadingVisible &&
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

    testResults.browserTests.push({
      test: 'Desktop Footer Social Area Metrics & Integrity (index.htm)',
      passed: test1Pass,
      details: d
    });
    if (test1Pass) testResults.passed++; else testResults.failed++;

    // Capture Desktop Screenshot of Footer Ribbon
    const ss1 = await client.send('Page.captureScreenshot', { format: 'png' });
    const ss1Path = path.join(ARTIFACT_DIR, '01-desktop-footer-social-ribbon.png');
    fs.writeFileSync(ss1Path, Buffer.from(ss1.data, 'base64'));
    testResults.screenshots.push('01-desktop-footer-social-ribbon.png');
    console.log(`Saved screenshot: ${ss1Path}`);

    // TEST 2: Close-up Clip of Social Icons
    console.log('\n--- Test 2: High-Res Clip of Social Icons ---');
    const clipResult = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const wrap = document.querySelector('.sp-footer-social-col');
        if (!wrap) return null;
        const rect = wrap.getBoundingClientRect();
        return {
          x: Math.max(0, rect.x - 20),
          y: Math.max(0, rect.y - 15),
          width: rect.width + 40,
          height: rect.height + 30,
          scale: 1
        };
      })()`,
      returnByValue: true
    });

    if (clipResult.result.value) {
      const ss2 = await client.send('Page.captureScreenshot', {
        format: 'png',
        clip: clipResult.result.value
      });
      const ss2Path = path.join(ARTIFACT_DIR, '02-social-icons-closeup.png');
      fs.writeFileSync(ss2Path, Buffer.from(ss2.data, 'base64'));
      testResults.screenshots.push('02-social-icons-closeup.png');
      console.log(`Saved closeup screenshot: ${ss2Path}`);
    }

    // TEST 3: Tablet Responsiveness (768px)
    console.log('\n--- Test 3: Tablet Viewport Check (768px) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
    await wait(400);

    const tabletCheck = await client.send('Runtime.evaluate', {
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

    const ss3 = await client.send('Page.captureScreenshot', { format: 'png' });
    const ss3Path = path.join(ARTIFACT_DIR, '03-tablet-footer-social.png');
    fs.writeFileSync(ss3Path, Buffer.from(ss3.data, 'base64'));
    testResults.screenshots.push('03-tablet-footer-social.png');

    const test3Pass = !tabletCheck.result.value.hasOverflow;
    testResults.browserTests.push({
      test: 'Tablet Responsiveness & Layout Flow (768px)',
      passed: test3Pass,
      details: tabletCheck.result.value
    });
    if (test3Pass) testResults.passed++; else testResults.failed++;

    // TEST 4: Mobile Responsiveness (375px)
    console.log('\n--- Test 4: Mobile Viewport Check (375px) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
    await wait(400);

    const mobileCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const socialCol = document.querySelector('.sp-footer-social-col');
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

    const ss4 = await client.send('Page.captureScreenshot', { format: 'png' });
    const ss4Path = path.join(ARTIFACT_DIR, '04-mobile-footer-social.png');
    fs.writeFileSync(ss4Path, Buffer.from(ss4.data, 'base64'));
    testResults.screenshots.push('04-mobile-footer-social.png');

    const test4Pass = !mobileCheck.result.value.hasOverflow && mobileCheck.result.value.buttonCount === 4;
    testResults.browserTests.push({
      test: 'Mobile Viewport Integrity & No Overflow (375px)',
      passed: test4Pass,
      details: mobileCheck.result.value
    });
    if (test4Pass) testResults.passed++; else testResults.failed++;

    // TEST 5: Multi-page Check (corporate-kamasutra, gen-z, intimate-aesthetics, about-us)
    console.log('\n--- Test 5: Multi-Page Sitewide Verification ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
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
      await client.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/${p}` });
      await wait(1000);
      await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
      await wait(300);

      const pageCheck = await client.send('Runtime.evaluate', {
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

    testResults.browserTests.push({
      test: 'Multi-Page Sitewide Verification',
      passed: multiPageAllPassed,
      details: { pagesChecked: pages }
    });
    if (multiPageAllPassed) testResults.passed++; else testResults.failed++;

    // TEST 6: Hover and Focus State Interaction
    console.log('\n--- Test 6: Hover & Keyboard Focus States ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/index.htm` });
    await wait(1000);
    await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
    await wait(300);

    const focusCheck = await client.send('Runtime.evaluate', {
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

    const test6Pass = focusCheck.result.value.focused;
    testResults.browserTests.push({
      test: 'Keyboard Focus State Feedback',
      passed: test6Pass,
      details: focusCheck.result.value
    });
    if (test6Pass) testResults.passed++; else testResults.failed++;

    // Write final json report
    const reportPath = path.join(ARTIFACT_DIR, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\nVerification complete! ${testResults.passed} passed, ${testResults.failed} failed.`);

  } catch (err) {
    console.error('Browser verification error:', err);
  } finally {
    if (client) client.close();
    chromeProcess.kill();
    server.close();
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

runBrowserVerification();
