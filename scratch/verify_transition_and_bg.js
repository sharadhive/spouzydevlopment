const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5556;
const CDP_PORT = 9456;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-trans-verify-' + Date.now());

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

async function verifyAll() {
  const server = await startStaticServer(HTTP_PORT);
  console.log(`Server started on http://127.0.0.1:${HTTP_PORT}`);

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

  const results = {
    testDate: new Date().toISOString(),
    tests: []
  };

  try {
    // -----------------------------------------------------------------------
    // TEST 1: UNIFORM PAGE BACKGROUND (#FFFACD) ACROSS MULTIPLE KEY PAGES
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 1: Background Audit (#FFFACD) ---');
    const testPages = [
      'index.htm',
      'index.html',
      'intimate-health.htm',
      'corporate-kamasutra.htm',
      'about-us.htm',
      'faq.htm',
      'intimate-aesthetics-treatment.htm'
    ];

    const bgAuditResults = [];

    for (const pageName of testPages) {
      await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/${pageName}` });
      await wait(600);

      const evalBg = await client.send('Runtime.evaluate', {
        expression: `
          (function() {
            const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
            const bodyBg = getComputedStyle(document.body).backgroundColor;
            const modernWrapper = document.querySelector('.sp-modern-wrapper');
            const wrapperBg = modernWrapper ? getComputedStyle(modernWrapper).backgroundColor : null;
            const guidePage = document.querySelector('.guide-page, main.guide-page');
            const guideBg = guidePage ? getComputedStyle(guidePage).backgroundColor : null;
            
            const sections = Array.from(document.querySelectorAll('section, .care-slider, #why-spouzy, #services, #questions, .why-spouzy'));
            const sectionBgs = sections.slice(0, 5).map(s => ({
              tag: s.tagName.toLowerCase(),
              className: s.className,
              id: s.id,
              bg: getComputedStyle(s).backgroundColor
            }));

            const cards = Array.from(document.querySelectorAll('.sp-doctor-card-modern, .sp-service-card-modern, .sp-mega-card-link, .why-card, .do-box'));
            const cardSample = cards.slice(0, 3).map(c => ({
              className: c.className,
              bg: getComputedStyle(c).backgroundColor
            }));

            return {
              htmlBg,
              bodyBg,
              wrapperBg,
              guideBg,
              sectionBgs,
              cardSample
            };
          })()
        `,
        returnByValue: true
      });

      const res = evalBg.result.value;
      const expectedRgb = 'rgb(255, 250, 205)'; // #FFFACD
      const isHtmlFffacd = res.htmlBg === expectedRgb;
      const isBodyFffacd = res.bodyBg === expectedRgb;
      const isCanvasFffacd = (res.wrapperBg === expectedRgb || res.guideBg === expectedRgb || isBodyFffacd);

      bgAuditResults.push({
        page: pageName,
        htmlBg: res.htmlBg,
        bodyBg: res.bodyBg,
        wrapperBg: res.wrapperBg,
        guideBg: res.guideBg,
        isHtmlFffacd,
        isBodyFffacd,
        isCanvasFffacd,
        sectionSample: res.sectionBgs,
        cardSample: res.cardSample
      });
      console.log(`Page: ${pageName.padEnd(32)} html: ${res.htmlBg} | body: ${res.bodyBg} | canvasMatch: ${isCanvasFffacd}`);
    }

    results.tests.push({
      name: 'Uniform Canvas Background (#FFFACD)',
      status: bgAuditResults.every(r => r.isHtmlFffacd && r.isBodyFffacd) ? 'PASS' : 'FAIL',
      details: bgAuditResults
    });

    // -----------------------------------------------------------------------
    // TEST 2: CURRENT-PAGE TRANSITION (OUTGOING ANIMATION, NO CARD, NO LOGO)
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 2: Current-Page Transition Lifecycle ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(800);
    await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0);' });
    await wait(100);

    // Trigger internal link click
    const clickLinkEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const link = document.querySelector('a[href="intimate-health.htm"], a[href="./intimate-health.htm"]');
          if (!link) return { found: false };
          link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return { found: true, href: link.href };
        })()
      `,
      returnByValue: true
    });

    console.log('Clicked internal link:', clickLinkEval.result.value);

    // Wait 150ms for overlay creation and initial frame paint
    await wait(150);

    const overlayState = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const overlay = document.getElementById('sp-transition-overlay');
          if (!overlay) return { exists: false };
          const overlayStyle = getComputedStyle(overlay);
          const stage = overlay.querySelector('.sp-transition-stage');
          const video = overlay.querySelector('video.sp-transition-video');
          const logo = overlay.querySelector('img, .sp-transition-logo');
          
          return {
            exists: true,
            overlayBg: overlayStyle.backgroundColor,
            isTransparent: overlayStyle.backgroundColor === 'rgba(0, 0, 0, 0)',
            stageOpacity: stage ? getComputedStyle(stage).opacity : null,
            stageHasIsVisible: stage ? stage.classList.contains('is-visible') : false,
            videoSrc: video ? video.currentSrc || video.src : null,
            videoMuted: video ? video.muted : null,
            videoLoop: video ? video.loop : null,
            videoDuration: video ? video.duration : null,
            videoCurrentTime: video ? video.currentTime : null,
            hasLogo: !!logo,
            bodyChildrenCount: document.body.children.length
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Transition Overlay State during active playback:', overlayState.result.value);

    // Capture desktop transition screenshot showing floating teddy over CURRENT page
    const ssDesktop = await client.send('Page.captureScreenshot', { format: 'png' });
    const ssDesktopPath = path.join(ARTIFACT_DIR, '01-transition-desktop-active.png');
    fs.writeFileSync(ssDesktopPath, Buffer.from(ssDesktop.data, 'base64'));
    console.log(`Saved desktop active transition screenshot: ${ssDesktopPath}`);

    // Wait for video ended and page navigation to complete (~1.5s total)
    console.log('Waiting for video ended and destination arrival...');
    await wait(1500);

    // Check destination page state
    const destinationState = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const currentUrl = window.location.href;
          const overlay = document.getElementById('sp-transition-overlay');
          const hasLoaderPending = document.documentElement.classList.contains('sp-loader-pending');
          const bodyBg = getComputedStyle(document.body).backgroundColor;
          const h1Text = document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : '';

          return {
            currentUrl,
            overlayPresent: !!overlay,
            hasLoaderPending,
            bodyBg,
            h1Text
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Destination Page State after navigation:', destinationState.result.value);

    // Capture destination screenshot
    const ssDest = await client.send('Page.captureScreenshot', { format: 'png' });
    const ssDestPath = path.join(ARTIFACT_DIR, '02-destination-immediate-arrival.png');
    fs.writeFileSync(ssDestPath, Buffer.from(ssDest.data, 'base64'));
    console.log(`Saved destination arrival screenshot: ${ssDestPath}`);

    const transitionTestPassed = (
      overlayState.result.value.exists &&
      overlayState.result.value.isTransparent &&
      !overlayState.result.value.hasLogo &&
      destinationState.result.value.currentUrl.includes('intimate-health.htm') &&
      !destinationState.result.value.overlayPresent &&
      !destinationState.result.value.hasLoaderPending
    );

    results.tests.push({
      name: 'Current-Page Outgoing Transition & Immediate Arrival',
      status: transitionTestPassed ? 'PASS' : 'FAIL',
      details: {
        activeOverlay: overlayState.result.value,
        destination: destinationState.result.value
      }
    });

    // -----------------------------------------------------------------------
    // TEST 3: MOBILE VIEWPORT TRANSITION (390 x 844)
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 3: Mobile Viewport Transition ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(800);

    // Click an internal link in mobile view
    await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const link = document.querySelector('a[href="faq.htm"], a[href="./faq.htm"]');
          if (link) link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        })()
      `
    });

    await wait(200);

    const mobileOverlayState = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const overlay = document.getElementById('sp-transition-overlay');
          if (!overlay) return { exists: false };
          const stage = overlay.querySelector('.sp-transition-stage');
          const rect = stage ? stage.getBoundingClientRect() : null;
          return {
            exists: true,
            isTransparent: getComputedStyle(overlay).backgroundColor === 'rgba(0, 0, 0, 0)',
            stageRect: rect ? { width: rect.width, height: rect.height, top: rect.top, left: rect.left } : null
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Mobile overlay state:', mobileOverlayState.result.value);

    const ssMobile = await client.send('Page.captureScreenshot', { format: 'png' });
    const ssMobilePath = path.join(ARTIFACT_DIR, '03-transition-mobile-active.png');
    fs.writeFileSync(ssMobilePath, Buffer.from(ssMobile.data, 'base64'));
    console.log(`Saved mobile active transition screenshot: ${ssMobilePath}`);

    // Wait for navigation
    await wait(1400);

    // Reset emulation
    await client.send('Emulation.clearDeviceMetricsOverride');

    results.tests.push({
      name: 'Mobile Viewport Transition',
      status: mobileOverlayState.result.value.exists && mobileOverlayState.result.value.isTransparent ? 'PASS' : 'FAIL',
      details: mobileOverlayState.result.value
    });

    // -----------------------------------------------------------------------
    // TEST 4: LINK FILTERING PRESERVATIONS
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 4: Link Filtering Preservations ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(600);

    const linkFilteringEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const res = {};
          
          // 1. Same-page hash link
          const hashLink = document.querySelector('a[href^="#"]');
          if (hashLink) {
            hashLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            res.hashLinkTriggeredOverlay = !!document.getElementById('sp-transition-overlay');
          }

          // 2. WhatsApp link test
          const waLink = document.createElement('a');
          waLink.href = 'https://wa.me/919876543210';
          document.body.appendChild(waLink);
          const waEvt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          waLink.dispatchEvent(waEvt);
          res.waDefaultPrevented = waEvt.defaultPrevented;
          res.waTriggeredOverlay = !!document.getElementById('sp-transition-overlay');
          waLink.remove();

          // 3. Modifier key click test
          const internalLink = document.querySelector('a[href="about-us.htm"]');
          if (internalLink) {
            const modEvt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window, ctrlKey: true });
            internalLink.dispatchEvent(modEvt);
            res.ctrlClickDefaultPrevented = modEvt.defaultPrevented;
            res.ctrlClickTriggeredOverlay = !!document.getElementById('sp-transition-overlay');
          }

          return res;
        })()
      `,
      returnByValue: true
    });

    console.log('Link filtering evaluation:', linkFilteringEval.result.value);

    const filterPass = (
      linkFilteringEval.result.value.hashLinkTriggeredOverlay === false &&
      linkFilteringEval.result.value.waTriggeredOverlay === false &&
      linkFilteringEval.result.value.ctrlClickTriggeredOverlay === false
    );

    results.tests.push({
      name: 'Link Filtering Preservations (Anchors, WhatsApp, Modifiers)',
      status: filterPass ? 'PASS' : 'FAIL',
      details: linkFilteringEval.result.value
    });

    // -----------------------------------------------------------------------
    // TEST 5: PREFERS-REDUCED-MOTION COMPLIANCE
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 5: Prefers-Reduced-Motion Compliance ---');
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(600);

    const reducedMotionEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const link = document.querySelector('a[href="corporate-kamasutra.htm"]');
          if (!link) return { found: false };
          link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          const overlayImmediately = document.getElementById('sp-transition-overlay');
          return {
            found: true,
            overlayMounted: !!overlayImmediately
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Reduced motion test:', reducedMotionEval.result.value);
    await wait(600);

    results.tests.push({
      name: 'Reduced Motion Compliance',
      status: reducedMotionEval.result.value.overlayMounted === false ? 'PASS' : 'FAIL',
      details: reducedMotionEval.result.value
    });

    await client.send('Emulation.setEmulatedMedia', { features: [] });

    // -----------------------------------------------------------------------
    // TEST 6: FOOTER TEDDY DANCE & BRAND CURSOR PRESERVATIONS
    // -----------------------------------------------------------------------
    console.log('\n--- Running Test 6: Footer Teddy & Custom Cursor Checks ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(800);

    const footerCursorEval = await client.send('Runtime.evaluate', {
      expression: `
        (function() {
          const footerVideo = document.querySelector('.sp-footer-teddy-video');
          const cursor = getComputedStyle(document.body).cursor;
          
          return {
            hasFooterVideo: !!footerVideo,
            footerVideoSrc: footerVideo ? (footerVideo.querySelector('source') ? footerVideo.querySelector('source').getAttribute('src') : footerVideo.getAttribute('src')) : null,
            footerVideoAutoplay: footerVideo ? footerVideo.hasAttribute('autoplay') : null,
            footerVideoMuted: footerVideo ? footerVideo.hasAttribute('muted') : null,
            footerVideoLoop: footerVideo ? footerVideo.hasAttribute('loop') : null,
            bodyCursor: cursor
          };
        })()
      `,
      returnByValue: true
    });

    console.log('Footer video and cursor status:', footerCursorEval.result.value);

    const footerCursorPass = (
      footerCursorEval.result.value.hasFooterVideo &&
      footerCursorEval.result.value.footerVideoSrc &&
      footerCursorEval.result.value.footerVideoSrc.includes('SPOUZY_Teddy_Dance_Transparent.webm') &&
      footerCursorEval.result.value.bodyCursor.includes('spouzy-teddy-large-arrow-50.png')
    );

    results.tests.push({
      name: 'Footer Dancing Teddy & Brand Cursor Unchanged',
      status: footerCursorPass ? 'PASS' : 'FAIL',
      details: footerCursorEval.result.value
    });

    // Write final verification report JSON
    const reportPath = path.join(ARTIFACT_DIR, 'verification_transition_and_bg_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nVerification Report saved to: ${reportPath}`);

    const allPassed = results.tests.every(t => t.status === 'PASS');
    console.log(`\nFINAL STATUS: ${allPassed ? 'ALL TESTS PASSED (6/6)!' : 'SOME TESTS FAILED'}`);

  } finally {
    if (client) client.close();
    cp.kill('SIGKILL');
    server.close();
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

verifyAll().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
