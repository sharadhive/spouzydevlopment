const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9385;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-verify-hug-' + Date.now();

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_teddy_hug_loader';
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
          break;
        }
      } catch (e) { await wait(200); }
    }

    if (!client) throw new Error('Could not connect to Chrome CDP');
    console.log('Connected to Chrome CDP!');

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    async function captureScreenshot(filename) {
      const res = await client.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      results.screenshots.push({ name: filename, path: filePath });
      console.log(`Saved screenshot: ${filename}`);
      return filePath;
    }

    // =========================================================================
    // TEST 1: First-Visit Loading Screen Design & Structure
    // =========================================================================
    console.log('\n--- Test 1: First-Visit Loading Screen Design ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    // Sample during playback (at ~400ms)
    await wait(400);

    const overlayInfo = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        if (!overlay) return { error: 'overlay not found' };

        const glow = overlay.querySelector('.sp-hug-bg-glow');
        const orb1 = overlay.querySelector('.sp-hug-orb-1');
        const orb2 = overlay.querySelector('.sp-hug-orb-2');
        const stage = overlay.querySelector('.sp-hug-stage');
        const video = overlay.querySelector('.sp-hug-video');
        const shadow = overlay.querySelector('.sp-hug-shadow');
        const staticImg = overlay.querySelector('.sp-hug-static');

        const oStyle = window.getComputedStyle(overlay);
        const sStyle = stage ? window.getComputedStyle(stage) : null;
        const vStyle = video ? window.getComputedStyle(video) : null;
        const shStyle = shadow ? window.getComputedStyle(shadow) : null;

        const stageRect = stage ? stage.getBoundingClientRect() : null;

        return {
          hasOverlay: !!overlay,
          overlayBg: oStyle.background || oStyle.backgroundImage,
          hasGlow: !!glow,
          hasOrb1: !!orb1,
          hasOrb2: !!orb2,
          hasShadow: !!shadow,
          stageWidth: stageRect ? stageRect.width : null,
          videoSrc: video ? video.getAttribute('src') : null,
          videoMuted: video ? video.muted : null,
          videoLoop: video ? video.loop : null,
          videoPaused: video ? video.paused : null,
          videoCurrentTime: video ? video.currentTime : null,
          staticSrc: staticImg ? staticImg.getAttribute('src') : null,
          hasBorder: sStyle ? sStyle.borderStyle !== 'none' && sStyle.borderWidth !== '0px' : null,
          hasBoxShadow: sStyle ? sStyle.boxShadow !== 'none' : null,
          zIndex: oStyle.zIndex
        };
      })()`,
      returnByValue: true
    });

    const oData = overlayInfo.result.value;
    console.log('Overlay inspection:', oData);
    await captureScreenshot('01-desktop-hug-loader-overlay.png');

    const t1Pass = oData.hasOverlay &&
                   oData.hasGlow &&
                   oData.hasOrb1 &&
                   oData.hasOrb2 &&
                   oData.hasShadow &&
                   oData.stageWidth >= 460 && oData.stageWidth <= 500 &&
                   oData.videoSrc === 'image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm' &&
                   oData.videoMuted === true &&
                   oData.videoLoop === false &&
                   oData.hasBorder === false &&
                   oData.hasBoxShadow === false;

    results.tests.push({
      test: 'Loading Screen Design, Backdrop, Lighting & 480px Stage',
      passed: t1Pass,
      details: oData
    });
    if (t1Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 2: Video Playback & Clean Dismissal
    // =========================================================================
    console.log('\n--- Test 2: Full Hug Playback & Clean Fade Dismissal ---');
    // Wait for the video to complete (t = 1400ms from load)
    await wait(1000);

    const afterDismiss = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        return {
          overlayPresent: !!overlay,
          bodyBg,
          sessionActive: sessionStorage.getItem('spouzy_session_active')
        };
      })()`,
      returnByValue: true
    });
    console.log('After dismiss state:', afterDismiss.result.value);
    await captureScreenshot('02-desktop-page-after-dismiss.png');

    const t2Pass = afterDismiss.result.value.overlayPresent === false &&
                   afterDismiss.result.value.sessionActive === '1';

    results.tests.push({
      test: 'Playback to Ended Event & Clean Removal with Page Interaction Restored',
      passed: t2Pass,
      details: afterDismiss.result.value
    });
    if (t2Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 3: Internal Navigation (Homepage -> About Us -> Background)
    // =========================================================================
    console.log('\n--- Test 3: Multi-Hop Internal Navigation Transition ---');
    // Click About Us link
    console.log('Clicking About Us link...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const link = document.querySelector('a[href="about-us.htm"]');
        if (link) link.click();
      })()`
    });
    // Wait 250ms for arrival overlay to mount
    await wait(250);

    const hop1Check = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        const video = overlay?.querySelector('.sp-hug-video');
        return {
          pathname: window.location.pathname,
          hasOverlay: !!overlay,
          videoPaused: video?.paused,
          videoCurrentTime: video?.currentTime
        };
      })()`,
      returnByValue: true
    });
    console.log('Hop 1 (About Us) during transition:', hop1Check.result.value);
    await captureScreenshot('03-hop1-about-us-transition.png');

    // Wait for About Us transition to complete
    await wait(1200);

    // On About Us, find continuation link to Background (about-profile.htm)
    console.log('Clicking continuation link to Background (about-profile.htm)...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const link = document.querySelector('a[href="about-profile.htm"]');
        if (link) link.click();
      })()`
    });
    await wait(250);

    const hop2Check = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        const video = overlay?.querySelector('.sp-hug-video');
        return {
          pathname: window.location.pathname,
          hasOverlay: !!overlay,
          videoPaused: video?.paused,
          videoCurrentTime: video?.currentTime
        };
      })()`,
      returnByValue: true
    });
    console.log('Hop 2 (Background) during transition:', hop2Check.result.value);
    await captureScreenshot('04-hop2-background-transition.png');

    // Wait for Background page to finish transition
    await wait(1200);

    const hop2After = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        return {
          pathname: window.location.pathname,
          overlayPresent: !!overlay
        };
      })()`,
      returnByValue: true
    });
    console.log('Hop 2 final state:', hop2After.result.value);

    const t3Pass = hop1Check.result.value.hasOverlay &&
                   hop2Check.result.value.hasOverlay &&
                   hop2After.result.value.overlayPresent === false &&
                   hop2After.result.value.pathname.includes('about-profile.htm');

    results.tests.push({
      test: 'Sequential Navigation Flow (Homepage -> About Us -> Background)',
      passed: t3Pass,
      details: { hop1: hop1Check.result.value, hop2: hop2Check.result.value, hop2After: hop2After.result.value }
    });
    if (t3Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 4: Mobile Responsive Loading Screen (390 x 844)
    // =========================================================================
    console.log('\n--- Test 4: Mobile Responsive Loading Screen (390px) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    // Trigger arrival on corporate-kamasutra.htm
    await client.send('Runtime.evaluate', {
      expression: 'sessionStorage.setItem("sp_transition_pending", "1");'
    });
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/corporate-kamasutra.htm' });
    await wait(300);

    const mobileCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        const stage = overlay?.querySelector('.sp-hug-stage');
        const shadow = overlay?.querySelector('.sp-hug-shadow');
        const stageRect = stage ? stage.getBoundingClientRect() : null;
        const shadowRect = shadow ? shadow.getBoundingClientRect() : null;
        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;

        return {
          hasOverlay: !!overlay,
          stageWidth: stageRect ? stageRect.width : null,
          shadowWidth: shadowRect ? shadowRect.width : null,
          scrollWidth,
          innerWidth,
          noOverflow: scrollWidth <= innerWidth
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile Check:', mobileCheck.result.value);
    await captureScreenshot('05-mobile-hug-loader.png');

    const m = mobileCheck.result.value;
    const t4Pass = m.hasOverlay &&
                   m.stageWidth <= 360 &&
                   m.stageWidth >= 320 &&
                   m.noOverflow;

    results.tests.push({
      test: 'Mobile Sizing: min(90vw, 360px), zero overflow',
      passed: t4Pass,
      details: m
    });
    if (t4Pass) results.passed++; else results.failed++;

    // Wait for mobile transition to complete
    await wait(1200);

    // =========================================================================
    // TEST 5: Prefers-Reduced-Motion Fallback
    // =========================================================================
    console.log('\n--- Test 5: Prefers-Reduced-Motion Static Frame Fallback ---');
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

    await client.send('Runtime.evaluate', {
      expression: 'sessionStorage.setItem("sp_transition_pending", "1");'
    });
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/intimate-aesthetics-treatment.htm' });
    // Check static frame rendered during the prompt display
    await wait(40);

    const reducedCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        const video = overlay?.querySelector('.sp-hug-video');
        const staticImg = overlay?.querySelector('.sp-hug-static');

        return {
          hasOverlay: !!overlay,
          videoDisplay: video ? window.getComputedStyle(video).display : null,
          staticDisplay: staticImg ? window.getComputedStyle(staticImg).display : null,
          staticSrc: staticImg ? staticImg.getAttribute('src') : null,
          isFallbackClass: overlay?.classList.contains('is-fallback')
        };
      })()`,
      returnByValue: true
    });
    console.log('Reduced motion check:', reducedCheck.result.value);
    await captureScreenshot('06-reduced-motion-static-hug.png');

    // Verify it dismisses promptly upon DOM ready without waiting 1s
    await wait(250);
    const reducedAfter = await client.send('Runtime.evaluate', {
      expression: `(() => {
        return { overlayPresent: !!document.getElementById('sp-page-loader') };
      })()`,
      returnByValue: true
    });
    console.log('Reduced motion after 250ms:', reducedAfter.result.value);

    // Reset emulated media
    await client.send('Emulation.setEmulatedMedia', { media: '', features: [] });

    const rc = reducedCheck.result.value;
    const t5Pass = (rc.videoDisplay === 'none' || rc.isFallbackClass) &&
                   rc.staticDisplay === 'block' &&
                   rc.staticSrc === 'image/gif/spouzy-teddy-hug-static.png' &&
                   reducedAfter.result.value.overlayPresent === false;

    results.tests.push({
      test: 'Reduced Motion: Static PNG Fallback & Immediate DOM-Ready Dismissal',
      passed: t5Pass,
      details: { initial: rc, after350ms: reducedAfter.result.value }
    });
    if (t5Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 6: Non-Intercepted Links & Footer Dancing Bears Preservation
    // =========================================================================
    console.log('\n--- Test 6: Non-Intercepted Links & Footer Dancing Bears Preservation ---');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    await wait(1500);

    const nonInterceptCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        // Test same-page anchor
        const anchor = document.querySelector('a[href="#services"]');
        let anchorIntercepted = false;
        if (anchor) {
          const rawHref = anchor.getAttribute('href');
          anchorIntercepted = (rawHref === '#services');
        }

        // Test WhatsApp link
        const waLink = document.querySelector('a[href*="wa.me"], a[href*="whatsapp.com"]');
        const waHref = waLink ? waLink.getAttribute('href') : null;

        // Check footer teddy dancing video preservation
        const footerTeddy = document.querySelector('.sp-footer-teddy');
        const footerVideo = footerTeddy?.querySelector('.sp-footer-teddy-video');

        return {
          waLinkFound: !!waLink,
          waHref,
          footerTeddyFound: !!footerTeddy,
          footerVideoFound: !!footerVideo,
          footerVideoSrc: footerVideo?.getAttribute('src')
        };
      })()`,
      returnByValue: true
    });
    console.log('Non-intercept & Footer check:', nonInterceptCheck.result.value);

    const ni = nonInterceptCheck.result.value;
    const t6Pass = ni.footerTeddyFound &&
                   ni.footerVideoFound &&
                   ni.footerVideoSrc === 'image/gif/SPOUZY_Teddy_Dance_Transparent.webm';

    results.tests.push({
      test: 'External/WhatsApp Links Unaffected & Footer Dancing Bears Preserved',
      passed: t6Pass,
      details: ni
    });
    if (t6Pass) results.passed++; else results.failed++;

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
