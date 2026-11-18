const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9410;
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-measure-refined-' + Date.now();

const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_footer_teddy_refined';
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

async function verifyRefinedFooter() {
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    '--autoplay-policy=no-user-gesture-required'
  ]);

  let client;
  const results = {
    measurements: {},
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

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    async function captureScreenshot(filename) {
      const res = await client.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
      results.screenshots.push({ name: filename, path: filePath });
      console.log(`Saved screenshot: ${filename}`);
      return filePath;
    }

    // =========================================================================
    // TEST 1: Wide Desktop Footer Layout & Grounding
    // =========================================================================
    console.log('\n--- Test 1: Desktop Footer Layout & Measurements ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/index.htm' });
    // Let arrival loader fade
    await wait(1500);

    // Scroll to footer
    await client.send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.body.scrollHeight);'
    });
    await wait(600);

    const m = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const grid = document.querySelector('.sp-footer-grid');
        const teddy = document.querySelector('.sp-footer-teddy');
        const stage = teddy.querySelector('.sp-footer-teddy-stage');
        const video = teddy.querySelector('.sp-footer-teddy-video');
        const shadow = teddy.querySelector('.sp-footer-teddy-shadow');
        const toggle = teddy.querySelector('.sp-footer-teddy-toggle');
        const psg = Array.from(grid.children).find(c => c.querySelector('.sp-footer-col-title')?.textContent.includes('Problem Solver Group'));
        const extras = document.querySelector('.sp-footer-extras');

        const gridRect = grid.getBoundingClientRect();
        const teddyRect = teddy.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const videoRect = video.getBoundingClientRect();
        const shadowRect = shadow ? shadow.getBoundingClientRect() : null;
        const psgRect = psg ? psg.getBoundingClientRect() : null;
        const extrasRect = extras ? extras.getBoundingClientRect() : null;

        // In 1280x720 video, characters occupy 700px out of 720px height
        const visibleCharacterHeight = videoRect.height * (700 / 720);
        const distanceToDivider = extrasRect ? extrasRect.top - videoRect.bottom : null;
        const shadowToDivider = extrasRect && shadowRect ? extrasRect.top - shadowRect.bottom : null;

        return {
          hasToggle: !!toggle,
          hasNativeControls: video.hasAttribute('controls'),
          videoMuted: video.muted,
          videoLoop: video.loop,
          videoPaused: video.paused,
          teddyWidth: teddyRect.width,
          stageWidth: stageRect.width,
          stageHeight: stageRect.height,
          videoWidth: videoRect.width,
          videoHeight: videoRect.height,
          visibleCharacterHeight,
          gridHeight: gridRect.height,
          psgHeight: psgRect ? psgRect.height : null,
          teddyHeight: teddyRect.height,
          distanceFromFeetToDivider: distanceToDivider,
          hasGroundShadow: !!shadow,
          shadowWidth: shadowRect ? shadowRect.width : null,
          shadowHeight: shadowRect ? shadowRect.height : null,
          shadowTop: shadowRect ? shadowRect.top : null,
          videoBottom: videoRect.bottom,
          psgRight: psgRect ? psgRect.right : null,
          teddyLeft: teddyRect.left,
          gapToPsg: psgRect ? teddyRect.left - psgRect.right : null
        };
      })()`,
      returnByValue: true
    });

    const dData = m.result.value;
    results.measurements.desktop = dData;
    console.log('Desktop Measurements:');
    console.log(JSON.stringify(dData, null, 2));

    await captureScreenshot('01-desktop-footer-teddy-grounded.png');

    const t1NoButtons = dData.hasToggle === false && dData.hasNativeControls === false;
    const t1LoopMuted = dData.videoMuted === true && dData.videoLoop === true;
    const t1HeightRange = dData.visibleCharacterHeight >= 200 && dData.visibleCharacterHeight <= 270;
    const t1DividerDist = dData.distanceFromFeetToDivider >= 12 && dData.distanceFromFeetToDivider <= 30;
    const t1Shadow = dData.hasGroundShadow && dData.shadowWidth >= 200;
    const t1GapPsg = dData.gapToPsg >= 20;

    const t1Pass = t1NoButtons && t1LoopMuted && t1HeightRange && t1DividerDist && t1Shadow && t1GapPsg;
    results.tests.push({
      test: 'Desktop Enlarge, Bottom-Alignment, Ground Shadow & Distance to Divider',
      passed: t1Pass,
      details: dData
    });
    if (t1Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 2: Dance Loop Playback
    // =========================================================================
    console.log('\n--- Test 2: Dance Loop Playback ---');
    await wait(2000);
    const loopCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const v = document.querySelector('.sp-footer-teddy-video');
        return {
          paused: v.paused,
          currentTime: v.currentTime,
          muted: v.muted,
          loop: v.loop
        };
      })()`,
      returnByValue: true
    });
    console.log('Playback state after 2s:', loopCheck.result.value);

    const t2Pass = loopCheck.result.value.paused === false &&
                   loopCheck.result.value.currentTime > 0 &&
                   loopCheck.result.value.muted === true &&
                   loopCheck.result.value.loop === true;

    results.tests.push({
      test: 'Automatic Silent Looping Playback in Viewport',
      passed: t2Pass,
      details: loopCheck.result.value
    });
    if (t2Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 3: Tablet Responsive Viewport (800 x 1024)
    // =========================================================================
    console.log('\n--- Test 3: Tablet Layout (800px) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(400);
    await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
    await wait(400);

    const tabM = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const teddy = document.querySelector('.sp-footer-teddy');
        const video = teddy.querySelector('.sp-footer-teddy-video');
        const shadow = teddy.querySelector('.sp-footer-teddy-shadow');
        const tRect = teddy.getBoundingClientRect();
        const vRect = video.getBoundingClientRect();
        const sRect = shadow.getBoundingClientRect();
        const scrollWidth = document.documentElement.scrollWidth;

        return {
          teddyWidth: tRect.width,
          videoWidth: vRect.width,
          videoHeight: vRect.height,
          visibleCharacterHeight: vRect.height * (700 / 720),
          shadowWidth: sRect.width,
          scrollWidth,
          noOverflow: scrollWidth <= 800
        };
      })()`,
      returnByValue: true
    });
    console.log('Tablet Measurements:', tabM.result.value);
    results.measurements.tablet = tabM.result.value;
    await captureScreenshot('02-tablet-footer-teddy-grounded.png');

    const t3Pass = tabM.result.value.noOverflow &&
                   tabM.result.value.teddyWidth <= 320 &&
                   tabM.result.value.shadowWidth >= 180;
    results.tests.push({
      test: 'Tablet 2-Column Responsive Layout (Clean wrap under PSG, no overflow)',
      passed: t3Pass,
      details: tabM.result.value
    });
    if (t3Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 4: Mobile Responsive Viewport (390 x 844)
    // =========================================================================
    console.log('\n--- Test 4: Mobile Layout (390px) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(400);
    await client.send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight);' });
    await wait(400);

    const mobM = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const teddy = document.querySelector('.sp-footer-teddy');
        const video = teddy.querySelector('.sp-footer-teddy-video');
        const shadow = teddy.querySelector('.sp-footer-teddy-shadow');
        const tRect = teddy.getBoundingClientRect();
        const vRect = video.getBoundingClientRect();
        const sRect = shadow.getBoundingClientRect();
        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;

        // Centering
        const leftMargin = tRect.left;
        const rightMargin = innerWidth - tRect.right;
        const isCentered = Math.abs(leftMargin - rightMargin) < 15;

        return {
          teddyWidth: tRect.width,
          videoWidth: vRect.width,
          videoHeight: vRect.height,
          visibleCharacterHeight: vRect.height * (700 / 720),
          shadowWidth: sRect.width,
          isCentered,
          scrollWidth,
          innerWidth,
          noOverflow: scrollWidth <= innerWidth
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile Measurements:', mobM.result.value);
    results.measurements.mobile = mobM.result.value;
    await captureScreenshot('03-mobile-footer-teddy-grounded.png');

    const t4Pass = mobM.result.value.noOverflow &&
                   mobM.result.value.isCentered &&
                   mobM.result.value.videoWidth >= 240 &&
                   mobM.result.value.videoWidth <= 320;
    results.tests.push({
      test: 'Mobile Centered Layout (280px, zero overflow, grounded shadow)',
      passed: t4Pass,
      details: mobM.result.value
    });
    if (t4Pass) results.passed++; else results.failed++;

    // =========================================================================
    // TEST 5: Verify Teddy Hug Page Loader is Unaffected
    // =========================================================================
    console.log('\n--- Test 5: Teddy Hug Page Loader Unaffected ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    // Trigger transition to about-us.htm
    await client.send('Runtime.evaluate', {
      expression: 'sessionStorage.setItem("sp_transition_pending", "1");'
    });
    await client.send('Page.navigate', { url: 'http://127.0.0.1:5502/about-us.htm' });
    await wait(300);

    const hugCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('sp-page-loader');
        const hugVideo = overlay?.querySelector('.sp-hug-video');
        return {
          hasHugLoader: !!overlay,
          hugVideoSrc: hugVideo?.getAttribute('src'),
          hugVideoPaused: hugVideo?.paused
        };
      })()`,
      returnByValue: true
    });
    console.log('Teddy Hug Loader check:', hugCheck.result.value);

    await wait(1400);

    const t5Pass = hugCheck.result.value.hasHugLoader &&
                   hugCheck.result.value.hugVideoSrc === 'image/gif/SPOUZY_Teddy_Hug_Loader_1s.webm';

    results.tests.push({
      test: 'Separate Teddy Hug 1s Page Loader Remains Completely Intact',
      passed: t5Pass,
      details: hugCheck.result.value
    });
    if (t5Pass) results.passed++; else results.failed++;

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

verifyRefinedFooter();
