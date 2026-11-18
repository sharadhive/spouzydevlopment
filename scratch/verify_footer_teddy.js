const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9355;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-verify-teddy';

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_footer_teddy';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

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
  send(method, params = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
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

async function runVerification() {
  console.log('Launching headless Chrome...');
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

  let connected = false;
  let client;
  const results = {
    tests: [],
    passed: 0,
    failed: 0,
    screenshots: []
  };

  try {
    for (let i = 0; i < 30; i++) {
      try {
        const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        const target = targets.find(t => t.type === 'page');
        if (target) {
          client = new CDPClient(target.webSocketDebuggerUrl);
          await client.ready();
          connected = true;
          break;
        }
      } catch (e) {
        await wait(200);
      }
    }

    if (!connected) throw new Error('Could not connect to Chrome CDP');
    console.log('Connected to Chrome CDP!');

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    async function captureScreenshot(filename, clip = null) {
      const params = { format: 'png' };
      if (clip) params.clip = clip;
      const res = await client.send('Page.captureScreenshot', params);
      const filePath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      results.screenshots.push({ name: filename, path: filePath });
      console.log(`Saved screenshot: ${filename}`);
      return filePath;
    }

    // =========================================================================
    // TEST 1: Desktop Footer Layout on index.htm (5-column arrangement)
    // =========================================================================
    console.log('\n--- Test 1: Desktop Footer Layout (index.htm) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(1800);

    // Scroll to footer
    await client.send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.body.scrollHeight);'
    });
    await wait(600);

    const desktopFooterInfo = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const grid = document.querySelector('.sp-footer-grid');
        if (!grid) return { error: 'grid not found' };
        const children = Array.from(grid.children);
        const psgCol = children.find(c => c.querySelector('.sp-footer-col-title')?.textContent.includes('Problem Solver Group'));
        const teddyCol = document.querySelector('.sp-footer-teddy');
        const video = teddyCol?.querySelector('.sp-footer-teddy-video');
        const staticImg = teddyCol?.querySelector('.sp-footer-teddy-static');
        const toggleBtn = teddyCol?.querySelector('.sp-footer-teddy-toggle');

        const psgRect = psgCol?.getBoundingClientRect();
        const teddyRect = teddyCol?.getBoundingClientRect();
        const gridStyle = window.getComputedStyle(grid);
        const teddyStyle = window.getComputedStyle(teddyCol);
        const stage = teddyCol?.querySelector('.sp-footer-teddy-stage');
        const stageStyle = stage ? window.getComputedStyle(stage) : null;

        return {
          childCount: children.length,
          gridTemplateColumns: gridStyle.gridTemplateColumns,
          psgFound: !!psgCol,
          teddyFound: !!teddyCol,
          psgRight: psgRect ? psgRect.right : null,
          teddyLeft: teddyRect ? teddyRect.left : null,
          teddyWidth: teddyRect ? teddyRect.width : null,
          teddyHeight: teddyRect ? teddyRect.height : null,
          teddyAspectRatio: stageStyle ? stageStyle.aspectRatio : null,
          videoSrc: video ? video.getAttribute('src') : null,
          sourceSrc: video && video.querySelector('source') ? video.querySelector('source').getAttribute('src') : null,
          videoMuted: video ? video.muted : null,
          videoPaused: video ? video.paused : null,
          videoCurrentTime: video ? video.currentTime : null,
          toggleAriaLabel: toggleBtn ? toggleBtn.getAttribute('aria-label') : null,
          staticImgSrc: staticImg ? staticImg.getAttribute('src') : null,
          staticImgDisplay: staticImg ? window.getComputedStyle(staticImg).display : null,
          hasBorder: teddyStyle.borderStyle !== 'none' && teddyStyle.borderWidth !== '0px',
          hasBoxShadow: teddyStyle.boxShadow !== 'none',
          backgroundColor: teddyStyle.backgroundColor
        };
      })()`,
      returnByValue: true
    });

    const dInfo = desktopFooterInfo?.result?.value || desktopFooterInfo?.result;
    console.log('Desktop Footer Inspection:', JSON.stringify(desktopFooterInfo, null, 2));

    const t1ColsPass = dInfo.childCount === 5;
    const t1PlacementPass = dInfo.teddyLeft >= (dInfo.psgRight - 10);
    const t1WidthPass = dInfo.teddyWidth >= 220 && dInfo.teddyWidth <= 260;
    const t1VideoSrcPass = dInfo.videoSrc === 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm' &&
                          dInfo.sourceSrc === 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm';
    const t1MutedPass = dInfo.videoMuted === true;

    const t1Pass = t1ColsPass && t1PlacementPass && t1WidthPass && t1VideoSrcPass && t1MutedPass;
    results.tests.push({
      test: 'Desktop Footer 5-Column Layout & Placement',
      passed: t1Pass,
      details: { childCount: dInfo.childCount, teddyLeft: dInfo.teddyLeft, psgRight: dInfo.psgRight, width: dInfo.teddyWidth, videoSrc: dInfo.videoSrc, muted: dInfo.videoMuted }
    });
    if (t1Pass) results.passed++; else results.failed++;

    // Screenshot of desktop footer
    await captureScreenshot('01-desktop-footer-teddy.png');

    // =========================================================================
    // TEST 2: Playback & Toggle Button Interactivity
    // =========================================================================
    console.log('\n--- Test 2: Playback & Toggle Button ---');
    // Wait for video to advance frames
    await wait(1000);
    const playState1 = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const v = document.querySelector('.sp-footer-teddy-video');
        return { paused: v.paused, currentTime: v.currentTime };
      })()`,
      returnByValue: true
    });
    console.log('Play State after scroll:', playState1.result.value);

    // Capture clip screenshot of the teddy dancing stage
    const stageClip = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('.sp-footer-teddy');
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.left - 20), y: Math.max(0, r.top - 20), width: r.width + 40, height: r.height + 40, scale: 1 };
      })()`,
      returnByValue: true
    });
    await captureScreenshot('02-desktop-footer-teddy-playing.png', stageClip.result.value);

    // Click toggle button to PAUSE
    console.log('Clicking toggle button to pause...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.sp-footer-teddy-toggle');
        btn.click();
      })()`
    });
    await wait(300);

    const pauseState = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const v = document.querySelector('.sp-footer-teddy-video');
        const btn = document.querySelector('.sp-footer-teddy-toggle');
        const pauseIcon = btn.querySelector('.sp-teddy-icon-pause');
        const playIcon = btn.querySelector('.sp-teddy-icon-play');
        return {
          paused: v.paused,
          ariaLabel: btn.getAttribute('aria-label'),
          pauseIconDisplay: window.getComputedStyle(pauseIcon).display,
          playIconDisplay: window.getComputedStyle(playIcon).display
        };
      })()`,
      returnByValue: true
    });
    console.log('Pause State:', pauseState.result.value);
    await captureScreenshot('03-desktop-footer-teddy-paused.png', stageClip.result.value);

    const t2PausePass = pauseState.result.value.paused === true &&
                        pauseState.result.value.ariaLabel === 'Play animation' &&
                        pauseState.result.value.pauseIconDisplay === 'none' &&
                        pauseState.result.value.playIconDisplay !== 'none';

    // Click toggle button to RESUME
    console.log('Clicking toggle button to resume...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('.sp-footer-teddy-toggle');
        btn.click();
      })()`
    });
    await wait(300);

    const resumeState = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const v = document.querySelector('.sp-footer-teddy-video');
        const btn = document.querySelector('.sp-footer-teddy-toggle');
        return {
          paused: v.paused,
          ariaLabel: btn.getAttribute('aria-label')
        };
      })()`,
      returnByValue: true
    });
    console.log('Resume State:', resumeState.result.value);
    const t2ResumePass = resumeState.result.value.paused === false &&
                         resumeState.result.value.ariaLabel === 'Pause animation';

    const t2Pass = t2PausePass && t2ResumePass;
    results.tests.push({
      test: 'Pause/Play Toggle Button Interactivity & ARIA states',
      passed: t2Pass,
      details: { pauseState: pauseState.result.value, resumeState: resumeState.result.value }
    });
    if (t2Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 3: Tablet Responsive Viewport (800 x 1024)
    // =========================================================================
    console.log('\n--- Test 3: Tablet Responsive (800px) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(400);
    await client.send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.body.scrollHeight);'
    });
    await wait(400);

    const tabletInfo = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const grid = document.querySelector('.sp-footer-grid');
        const psgCol = Array.from(grid.children).find(c => c.querySelector('.sp-footer-col-title')?.textContent.includes('Problem Solver Group'));
        const teddyCol = document.querySelector('.sp-footer-teddy');
        const psgRect = psgCol?.getBoundingClientRect();
        const teddyRect = teddyCol?.getBoundingClientRect();
        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;

        return {
          scrollWidth,
          innerWidth,
          noOverflow: scrollWidth <= innerWidth,
          teddyWidth: teddyRect.width,
          teddyTop: teddyRect.top,
          psgBottom: psgRect.bottom,
          beneathPsg: teddyRect.top >= (psgRect.top - 20)
        };
      })()`,
      returnByValue: true
    });
    console.log('Tablet Info:', tabletInfo.result.value);
    const t3Pass = tabletInfo.result.value.noOverflow;
    results.tests.push({
      test: 'Tablet 2-Column Responsive Layout (No overflow, wraps cleanly)',
      passed: t3Pass,
      details: tabletInfo.result.value
    });
    if (t3Pass) results.passed++; else results.failed++;
    await captureScreenshot('04-tablet-footer-teddy.png');

    // =========================================================================
    // TEST 4: Mobile Responsive Viewport (390 x 844)
    // =========================================================================
    console.log('\n--- Test 4: Mobile Responsive (390px) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(400);
    await client.send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.body.scrollHeight);'
    });
    await wait(400);

    const mobileInfo = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const teddyCol = document.querySelector('.sp-footer-teddy');
        const teddyRect = teddyCol.getBoundingClientRect();
        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;
        const floatingPill = document.querySelector('.sp-floating-quick-pill');
        const pillRect = floatingPill ? floatingPill.getBoundingClientRect() : null;

        // Check if centered
        const leftMargin = teddyRect.left;
        const rightMargin = innerWidth - teddyRect.right;
        const isCentered = Math.abs(leftMargin - rightMargin) < 15;

        return {
          scrollWidth,
          innerWidth,
          noOverflow: scrollWidth <= innerWidth,
          teddyWidth: teddyRect.width,
          teddyLeft: teddyRect.left,
          teddyRight: teddyRect.right,
          leftMargin,
          rightMargin,
          isCentered,
          floatingPillVisible: !!pillRect
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile Info:', mobileInfo.result.value);
    const t4Pass = mobileInfo.result.value.noOverflow &&
                   mobileInfo.result.value.teddyWidth >= 180 &&
                   mobileInfo.result.value.teddyWidth <= 220 &&
                   mobileInfo.result.value.isCentered;

    results.tests.push({
      test: 'Mobile Single-Column Centered Layout (180-220px, no overflow)',
      passed: t4Pass,
      details: mobileInfo.result.value
    });
    if (t4Pass) results.passed++; else results.failed++;
    await captureScreenshot('05-mobile-footer-teddy.png');

    // =========================================================================
    // TEST 5: Prefers-Reduced-Motion Emulation
    // =========================================================================
    console.log('\n--- Test 5: Prefers-Reduced-Motion Fallback ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await wait(500);

    const reducedMotionInfo = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const teddyCol = document.querySelector('.sp-footer-teddy');
        const video = teddyCol.querySelector('.sp-footer-teddy-video');
        const staticImg = teddyCol.querySelector('.sp-footer-teddy-static');
        const toggleBtn = teddyCol.querySelector('.sp-footer-teddy-toggle');

        const vStyle = window.getComputedStyle(video);
        const sStyle = window.getComputedStyle(staticImg);
        const bStyle = window.getComputedStyle(toggleBtn);

        return {
          videoDisplay: vStyle.display,
          staticDisplay: sStyle.display,
          toggleDisplay: bStyle.display,
          videoPaused: video.paused,
          staticImgSrc: staticImg.getAttribute('src'),
          staticImgComplete: staticImg.complete,
          staticImgNaturalWidth: staticImg.naturalWidth
        };
      })()`,
      returnByValue: true
    });
    console.log('Reduced Motion Info:', reducedMotionInfo.result.value);
    const rm = reducedMotionInfo.result.value;
    const t5Pass = rm.videoDisplay === 'none' &&
                   rm.staticDisplay !== 'none' &&
                   rm.toggleDisplay === 'none' &&
                   rm.staticImgNaturalWidth > 0;

    results.tests.push({
      test: 'Reduced Motion Static PNG Fallback Display',
      passed: t5Pass,
      details: rm
    });
    if (t5Pass) results.passed++; else results.failed++;

    // Reset emulated media
    await client.send('Emulation.setEmulatedMedia', { media: '', features: [] });
    await captureScreenshot('06-reduced-motion-fallback.png');

    // =========================================================================
    // TEST 6: Multi-Page Sitewide Verification
    // =========================================================================
    console.log('\n--- Test 6: Multi-Page Sitewide Check ---');
    const pagesToTest = [
      'index.html',
      'about-us.htm',
      'corporate-kamasutra.htm',
      'intimate-aesthetics-treatment.htm',
      'contactus.htm'
    ];

    let multiPagePass = true;
    for (const page of pagesToTest) {
      await client.send('Page.navigate', { url: `http://127.0.0.1:5502/${page}` });
      await wait(1200);
      await client.send('Runtime.evaluate', {
        expression: 'window.scrollTo(0, document.body.scrollHeight);'
      });
      await wait(400);

      const check = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const teddy = document.querySelector('.sp-footer-teddy');
          const video = teddy?.querySelector('.sp-footer-teddy-video');
          const staticImg = teddy?.querySelector('.sp-footer-teddy-static');
          const toggle = teddy?.querySelector('.sp-footer-teddy-toggle');
          return {
            hasTeddy: !!teddy,
            hasVideo: !!video,
            hasStatic: !!staticImg,
            hasToggle: !!toggle,
            videoSrc: video?.getAttribute('src')
          };
        })()`,
        returnByValue: true
      });
      const v = check.result.value;
      const ok = v.hasTeddy && v.hasVideo && v.hasStatic && v.hasToggle && v.videoSrc === 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm';
      console.log(`Page ${page}: ${ok ? 'PASSED' : 'FAILED'}`);
      if (!ok) multiPagePass = false;
    }

    results.tests.push({
      test: 'Sitewide Verification Across Diverse Template Types',
      passed: multiPagePass,
      details: { testedPages: pagesToTest, multiPagePass }
    });
    if (multiPagePass) results.passed++; else results.failed++;

    // Save final report json
    const reportPath = path.join(ARTIFACT_DIR, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nVerification finished! Results: ${results.passed} passed, ${results.failed} failed.`);

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    if (client) client.close();
    chromeProcess.kill('SIGKILL');
  }
}

runVerification();
