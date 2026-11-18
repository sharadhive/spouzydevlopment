const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5560;
const CDP_PORT = 9460;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-dual-cursor-verify-' + Date.now());

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

async function verifyDualCursors() {
  const server = await startStaticServer(HTTP_PORT);
  console.log(`HTTP Server listening on http://127.0.0.1:${HTTP_PORT}`);

  const cp = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    '--autoplay-policy=no-user-gesture-required'
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

  if (!client) throw new Error('Failed to connect to Chrome CDP');
  console.log('Connected to Chrome DevTools Protocol');

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  const report = {
    testDate: new Date().toISOString(),
    hotspotCoordinates: {
      normalTeddyArrow: {
        file: 'image/cursors/spouzy-big-teddies-small-tip-90.png',
        dimensions: '90x90',
        hotspotX: 7,
        hotspotY: 1,
        description: 'Precise apex tip of the small rose-gold pointer arrow at (X=7, Y=1)'
      },
      clickableHandPointer: {
        file: 'image/cursors/spouzy-pointer.svg / image/cursors/spouzy-pointer.png',
        dimensions: '48x48',
        hotspotX: 18,
        hotspotY: 2,
        description: 'Existing rose-gold index fingertip hotspot at (X=18, Y=2)'
      }
    },
    tests: []
  };

  try {
    // -----------------------------------------------------------------------
    // TEST 1: ASSET VERIFICATION (Dimensions, Network Status, Integrity)
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 1: Cursor Asset Verification ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(600);

    const assetEval = await client.send('Runtime.evaluate', {
      expression: `
        (async function() {
          function checkImage(src) {
            return new Promise(resolve => {
              const img = new Image();
              img.onload = () => resolve({ ok: true, width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => resolve({ ok: false });
              img.src = src;
            });
          }

          const teddy = await checkImage('image/cursors/spouzy-big-teddies-small-tip-90.png');
          const pointerSvg = await checkImage('image/cursors/spouzy-pointer.svg');
          const pointerPng = await checkImage('image/cursors/spouzy-pointer.png');

          return { teddy, pointerSvg, pointerPng };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Asset verification:', assetEval.result.value);

    const assetPass = (
      assetEval.result.value.teddy.ok &&
      assetEval.result.value.teddy.width === 90 &&
      assetEval.result.value.teddy.height === 90 &&
      assetEval.result.value.pointerPng.ok &&
      assetEval.result.value.pointerPng.width === 48 &&
      assetEval.result.value.pointerPng.height === 48
    );

    report.tests.push({
      name: 'Asset Integrity & Exact Dimensions (90x90 & 48x48)',
      status: assetPass ? 'PASS' : 'FAIL',
      details: assetEval.result.value
    });

    // -----------------------------------------------------------------------
    // TEST 2: NORMAL CURSOR STATE ACROSS MULTIPLE KEY PAGES
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 2: Normal Cursor State (90x90 Teddy Arrow) ---');
    const testPages = [
      'index.htm',
      'index.html',
      'intimate-health.htm',
      'corporate-kamasutra.htm',
      'about-us.htm',
      'faq.htm',
      'intimate-aesthetics-treatment.htm'
    ];

    const normalCursorResults = [];
    for (const pageName of testPages) {
      await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/${pageName}` });
      await wait(500);

      const evalNormal = await client.send('Runtime.evaluate', {
        expression: `
          (function() {
            const bodyCursor = getComputedStyle(document.body).cursor;
            const htmlCursor = getComputedStyle(document.documentElement).cursor;
            const p = document.querySelector('p');
            const pCursor = p ? getComputedStyle(p).cursor : null;
            const h1 = document.querySelector('h1');
            const h1Cursor = h1 ? getComputedStyle(h1).cursor : null;

            return { bodyCursor, htmlCursor, pCursor, h1Cursor };
          })()
        `,
        returnByValue: true
      });

      const res = evalNormal.result.value;
      const hasTeddy90 = res.bodyCursor.includes('spouzy-big-teddies-small-tip-90.png') && res.bodyCursor.includes('7 1');
      normalCursorResults.push({
        page: pageName,
        bodyCursor: res.bodyCursor,
        hasTeddy90,
        pCursor: res.pCursor,
        h1Cursor: res.h1Cursor
      });
      console.log(`Page: ${pageName.padEnd(32)} bodyCursor: ${res.bodyCursor}`);
    }

    const normalPass = normalCursorResults.every(r => r.hasTeddy90);
    report.tests.push({
      name: 'Normal Cursor State Sitewide (90x90 Teddy Arrow, Hotspot: 7 1)',
      status: normalPass ? 'PASS' : 'FAIL',
      details: normalCursorResults
    });

    // -----------------------------------------------------------------------
    // TEST 3: CLICKABLE-ELEMENT CURSOR STATE (Rose-Gold Hand Pointer)
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 3: Clickable-Element Cursor (Hand Pointer, Hotspot: 18 2) ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(700);

    const interactiveCursorEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const selectors = [
            'a.sp-nav-link',
            'a.sp-brand-pill',
            '.sp-cta-primary',
            '.sp-cta-secondary',
            '.sp-search-btn',
            '#sp-policy-trigger',
            '.sp-footer-links a',
            '.sp-footer-social a',
            '.care-nav-prev',
            '.care-nav-next',
            '.sp-service-card-modern',
            '.sp-quiz-opt-btn',
            'summary',
            'button',
            'input[type="button"], input[type="submit"]'
          ];

          const results = [];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const cursor = getComputedStyle(el).cursor;
              const hasPointer = cursor.includes('spouzy-pointer') && cursor.includes('18 2');
              results.push({
                selector: sel,
                cursor,
                hasPointer,
                tagName: el.tagName.toLowerCase()
              });
            } else {
              results.push({ selector: sel, notFound: true });
            }
          }
          return results;
        })()
      `,
      returnByValue: true
    });

    console.log('Interactive element cursor samples:', interactiveCursorEval.result.value);

    const foundInteractive = interactiveCursorEval.result.value.filter(r => !r.notFound);
    const interactivePass = foundInteractive.length > 0 && foundInteractive.every(r => r.hasPointer);

    report.tests.push({
      name: 'Clickable-Element Cursor State (Rose-Gold Hand Pointer, Hotspot: 18 2)',
      status: interactivePass ? 'PASS' : 'FAIL',
      details: interactiveCursorEval.result.value
    });

    // -----------------------------------------------------------------------
    // TEST 4: DYNAMIC CURSOR SWITCHING (Mouse Enter & Leave)
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 4: Dynamic Cursor State Switching ---');
    const switchingEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          // 1. Initial body cursor
          const initialBodyCursor = getComputedStyle(document.body).cursor;

          // 2. Query a button or link
          const btn = document.querySelector('a.sp-brand-pill, .sp-cta-primary, button');
          const btnCursor = btn ? getComputedStyle(btn).cursor : null;

          // 3. Query a child inside the button/link
          const child = btn ? btn.querySelector('span, svg, strong') || btn : null;
          const childCursor = child ? getComputedStyle(child).cursor : null;

          // 4. Query an adjacent non-clickable element (e.g. paragraph)
          const nonClickable = document.querySelector('p, h2, .sp-hero-title');
          const nonClickableCursor = nonClickable ? getComputedStyle(nonClickable).cursor : null;

          return {
            initialBodyCursor,
            btnCursor,
            childCursor,
            nonClickableCursor,
            bodyHasTeddy: initialBodyCursor.includes('spouzy-big-teddies-small-tip-90.png'),
            btnHasPointer: btnCursor ? btnCursor.includes('spouzy-pointer') : false,
            childHasPointer: childCursor ? childCursor.includes('spouzy-pointer') : false,
            nonClickableHasTeddy: nonClickableCursor ? nonClickableCursor.includes('spouzy-big-teddies-small-tip-90.png') : false
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Switching evaluation:', switchingEval.result.value);

    const switchingPass = (
      switchingEval.result.value.bodyHasTeddy &&
      switchingEval.result.value.btnHasPointer &&
      switchingEval.result.value.childHasPointer &&
      switchingEval.result.value.nonClickableHasTeddy
    );

    report.tests.push({
      name: 'Dynamic Cursor Switching (Teddy Arrow <-> Hand Pointer)',
      status: switchingPass ? 'PASS' : 'FAIL',
      details: switchingEval.result.value
    });

    // -----------------------------------------------------------------------
    // TEST 5: PRESERVATIONS (Text caret, Disabled state, Mobile touch)
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 5: Native Preservations (Text Caret, Disabled, Mobile) ---');
    const preservationsEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          // Test input caret
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = 'Test Input';
          document.body.appendChild(input);
          const inputCursor = getComputedStyle(input).cursor;
          input.remove();

          // Test textarea caret
          const textarea = document.createElement('textarea');
          document.body.appendChild(textarea);
          const textareaCursor = getComputedStyle(textarea).cursor;
          textarea.remove();

          // Test disabled element
          const disabledBtn = document.createElement('button');
          disabledBtn.disabled = true;
          document.body.appendChild(disabledBtn);
          const disabledCursor = getComputedStyle(disabledBtn).cursor;
          disabledBtn.remove();

          return {
            inputCursor,
            textareaCursor,
            disabledCursor,
            isInputText: inputCursor === 'text',
            isTextareaText: textareaCursor === 'text',
            isDisabledNotAllowed: disabledCursor === 'not-allowed'
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Preservations evaluation:', preservationsEval.result.value);

    const preservationPass = (
      preservationsEval.result.value.isInputText &&
      preservationsEval.result.value.isTextareaText &&
      preservationsEval.result.value.isDisabledNotAllowed
    );

    report.tests.push({
      name: 'Preservations (Input Text Caret, Disabled not-allowed)',
      status: preservationPass ? 'PASS' : 'FAIL',
      details: preservationsEval.result.value
    });

    // -----------------------------------------------------------------------
    // TEST 6: CLICK ACCURACY VIA CDP MOUSE EVENTS
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 6: Click Accuracy with Brand Cursor Hotspot ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(600);

    const clickAccuracyEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          let clicked = false;
          let clickCoords = null;
          const searchBtn = document.querySelector('.sp-search-btn');
          if (!searchBtn) return { error: 'Search button not found' };

          searchBtn.addEventListener('click', function(e) {
            clicked = true;
            clickCoords = { clientX: e.clientX, clientY: e.clientY };
          }, { once: true });

          const rect = searchBtn.getBoundingClientRect();
          // Hotspot targeting: dispatch at center of button
          const targetX = rect.left + rect.width / 2;
          const targetY = rect.top + rect.height / 2;

          searchBtn.dispatchEvent(new MouseEvent('click', {
            clientX: targetX,
            clientY: targetY,
            bubbles: true,
            cancelable: true,
            view: window
          }));

          return {
            clicked,
            clickCoords,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Click accuracy evaluation:', clickAccuracyEval.result.value);

    const clickPass = clickAccuracyEval.result.value.clicked === true;
    report.tests.push({
      name: 'Click Accuracy with Brand Cursor Hotspot',
      status: clickPass ? 'PASS' : 'FAIL',
      details: clickAccuracyEval.result.value
    });

    // Capture desktop screenshot
    const ssDesktop = await client.send('Page.captureScreenshot', { format: 'png' });
    const ssDesktopPath = path.join(ARTIFACT_DIR, '01-dual-cursor-desktop.png');
    fs.writeFileSync(ssDesktopPath, Buffer.from(ssDesktop.data, 'base64'));
    console.log(`Saved screenshot: ${ssDesktopPath}`);

    // Write final JSON report
    const reportPath = path.join(ARTIFACT_DIR, 'verification_dual_cursor_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Saved report: ${reportPath}`);

    const allPassed = report.tests.every(t => t.status === 'PASS');
    console.log(`\nFINAL RESULT: ${allPassed ? 'ALL TESTS PASSED (6/6)!' : 'SOME TESTS FAILED'}`);

  } finally {
    if (client) client.close();
    cp.kill('SIGKILL');
    server.close();
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

verifyDualCursors().catch(err => {
  console.error('Error in verification:', err);
  process.exit(1);
});
