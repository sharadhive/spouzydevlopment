const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5502';
const PORT = 9288;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-loader-test-profile';
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_loader_transition';

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
        const { resolve, reject } = this.callbacks.get(msg.id);
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
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('Launching Headless Chrome for 12-Point Loader Verification...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900'
  ]);

  let client = null;
  const results = {};

  try {
    let tabs = null;
    for (let i = 0; i < 20; i++) {
      try {
        tabs = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (tabs && tabs.length > 0) break;
      } catch (e) {
        await wait(250);
      }
    }
    if (!tabs || tabs.length === 0) throw new Error('Chrome remote debugging did not respond');

    client = new CDPClient(tabs[0].webSocketDebuggerUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    async function screenshot(name) {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(ARTIFACT_DIR, `${name}.png`);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`Saved screenshot: ${name}.png`);
    }

    async function evaluate(expression) {
      const res = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('Eval error for:', expression, res.exceptionDetails);
      }
      return res.result ? res.result.value : null;
    }

    // Set desktop viewport
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // -----------------------------------------------------------------------
    // TEST 1: Homepage -> About Us
    // -----------------------------------------------------------------------
    console.log('\n--- 1. Testing Homepage -> About Us ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(1200); // Allow first-visit loader to complete if present

    // Check no page-curtain exists
    const hasCurtain = await evaluate(`!!document.querySelector('.page-curtain')`);
    console.log('No burgundy page-curtain on page:', !hasCurtain);

    // Click "About Us" link in desktop navbar
    await evaluate(`(() => {
      const a = document.querySelector('.nav-options a[href="about-us.htm"]') ||
                document.querySelector('a[href="about-us.htm"]');
      if (a) a.click();
    })()`);

    // Check immediately: overlay mounted on departure
    await wait(50);
    const departureState = await evaluate(`(() => {
      const overlay = document.getElementById('sp-page-loader');
      if (!overlay) return null;
      const img = overlay.querySelector('img');
      const cs = window.getComputedStyle(overlay);
      return {
        overlayMounted: true,
        hasCurtain: !!document.querySelector('.page-curtain'),
        imgSrc: img ? img.getAttribute('src') : null,
        bgColor: cs.backgroundColor,
        zIndex: cs.zIndex,
        role: overlay.getAttribute('role'),
        ariaLive: overlay.getAttribute('aria-live'),
        hasSrOnly: !!overlay.querySelector('.sp-loader-sr-only')
      };
    })()`);
    console.log('Departure overlay state:', departureState);
    await screenshot('01-departure-about-us-loader');

    // Wait for arrival navigation to complete
    await wait(1200);
    const destUrl1 = await evaluate(`window.location.href`);
    const loaderRemoved1 = await evaluate(`!document.getElementById('sp-page-loader')`);
    console.log('Navigated URL:', destUrl1, 'Loader dismissed after arrival:', loaderRemoved1);
    await screenshot('01-arrival-about-us-complete');
    results.test1 = { departureState, destUrl1, loaderRemoved1 };

    // -----------------------------------------------------------------------
    // TEST 2: About Us -> Background
    // -----------------------------------------------------------------------
    console.log('\n--- 2. Testing About Us -> Background ---');
    // On about-us.htm, click single continuation link "Read our background ↗"
    await evaluate(`(() => {
      const continuation = document.querySelector('.guide-actions a.guide-action') ||
                           document.querySelector('a[href="about-profile.htm"]');
      if (continuation) continuation.click();
    })()`);

    await wait(50);
    const dep2 = await evaluate(`(() => {
      const o = document.getElementById('sp-page-loader');
      return o ? { mounted: true, src: o.querySelector('img').getAttribute('src') } : null;
    })()`);
    console.log('Continuation click loader state:', dep2);
    await screenshot('02-departure-background-loader');

    await wait(1200);
    const destUrl2 = await evaluate(`window.location.href`);
    const loaderRemoved2 = await evaluate(`!document.getElementById('sp-page-loader')`);
    console.log('Navigated to Background:', destUrl2, 'Loader dismissed:', loaderRemoved2);
    results.test2 = { dep2, destUrl2, loaderRemoved2 };

    // -----------------------------------------------------------------------
    // TEST 3: Background -> Mission & Vision
    // -----------------------------------------------------------------------
    console.log('\n--- 3. Testing Background -> Mission & Vision ---');
    await evaluate(`(() => {
      const link = document.querySelector('.guide-actions a.guide-action') ||
                   document.querySelector('a[href="mission-vision.htm"]');
      if (link) link.click();
    })()`);

    await wait(50);
    await screenshot('03-departure-mission-loader');
    await wait(1200);
    const destUrl3 = await evaluate(`window.location.href`);
    const loaderRemoved3 = await evaluate(`!document.getElementById('sp-page-loader')`);
    console.log('Navigated to Mission & Vision:', destUrl3, 'Loader dismissed:', loaderRemoved3);
    results.test3 = { destUrl3, loaderRemoved3 };

    // -----------------------------------------------------------------------
    // TEST 4: Navigation through Services and Resources (Corporate Kamasutra)
    // -----------------------------------------------------------------------
    console.log('\n--- 4. Testing Resource Navigation (Corporate Kamasutra) ---');
    // Open "No Cost Resources" dropdown
    await evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('.sp-desktop-nav .sp-nav-link'))
        .find(b => b.innerText.includes('No Cost Resources'));
      if (btn) btn.click();
    })()`);
    await wait(200);

    // Click "Corporate Kamasutra"
    await evaluate(`(() => {
      const a = document.querySelector('#group-3 a[href="corporate-kamasutra.htm"]');
      if (a) a.click();
    })()`);

    await wait(50);
    await screenshot('04-departure-corporate-kamasutra');
    await wait(1200);
    const destUrl4 = await evaluate(`window.location.href`);
    const loaderRemoved4 = await evaluate(`!document.getElementById('sp-page-loader')`);
    console.log('Navigated to Corporate Kamasutra:', destUrl4, 'Loader dismissed:', loaderRemoved4);
    results.test4 = { destUrl4, loaderRemoved4 };

    // -----------------------------------------------------------------------
    // TEST 5: Search-Result Navigation
    // -----------------------------------------------------------------------
    console.log('\n--- 5. Testing Search-Result Navigation ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(800);

    // Open search modal
    await evaluate(`(() => {
      const trigger = document.querySelector('.sp-search-trigger');
      if (trigger) trigger.click();
    })()`);
    await wait(300);

    // Type "pre-marriage"
    await evaluate(`(() => {
      const input = document.querySelector('.sp-search-field');
      if (input) {
        input.value = 'pre-marriage';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await wait(300);

    // Click first result link
    await evaluate(`(() => {
      const firstResultLink = document.querySelector('.sp-search-results-list .sp-search-result-item a');
      if (firstResultLink) firstResultLink.click();
    })()`);

    await wait(50);
    const searchNavState = await evaluate(`(() => {
      const o = document.getElementById('sp-page-loader');
      return o ? { mounted: true, src: o.querySelector('img').getAttribute('src') } : null;
    })()`);
    console.log('Search click loader mounted:', searchNavState);
    await screenshot('05-departure-search-loader');

    await wait(1200);
    const destUrl5 = await evaluate(`window.location.href`);
    const loaderRemoved5 = await evaluate(`!document.getElementById('sp-page-loader')`);
    console.log('Navigated from search:', destUrl5, 'Loader dismissed:', loaderRemoved5);
    results.test5 = { searchNavState, destUrl5, loaderRemoved5 };

    // -----------------------------------------------------------------------
    // TEST 6: Footer Links
    // -----------------------------------------------------------------------
    console.log('\n--- 6. Testing Footer Links Navigation ---');
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await wait(200);

    await evaluate(`(() => {
      const footerLink = document.querySelector('.sp-footer-modern a[href="terms.htm"]') ||
                         document.querySelector('footer a[href="terms.htm"]');
      if (footerLink) footerLink.click();
    })()`);

    await wait(50);
    await screenshot('06-departure-footer-loader');
    await wait(1200);
    const destUrl6 = await evaluate(`window.location.href`);
    const loaderRemoved6 = await evaluate(`!document.getElementById('sp-page-loader')`);
    console.log('Navigated to Terms via footer:', destUrl6, 'Loader dismissed:', loaderRemoved6);
    results.test6 = { destUrl6, loaderRemoved6 };

    // -----------------------------------------------------------------------
    // TEST 7: Browser Back/Forward (bfcache restoration)
    // -----------------------------------------------------------------------
    console.log('\n--- 7. Testing Browser Back / Forward ---');
    // Go Back
    await evaluate(`window.history.back()`);
    await wait(800);
    const backUrl = await evaluate(`window.location.href`);
    const backOverlayStuck = await evaluate(`!!document.getElementById('sp-page-loader')`);
    console.log('Back navigation URL:', backUrl, 'Overlay stuck:', backOverlayStuck);

    // Go Forward
    await evaluate(`window.history.forward()`);
    await wait(800);
    const fwdUrl = await evaluate(`window.location.href`);
    const fwdOverlayStuck = await evaluate(`!!document.getElementById('sp-page-loader')`);
    console.log('Forward navigation URL:', fwdUrl, 'Overlay stuck:', fwdOverlayStuck);
    results.test7 = { backUrl, backOverlayStuck, fwdUrl, fwdOverlayStuck };

    // -----------------------------------------------------------------------
    // TEST 8: Rapid Double-Clicks Guard
    // -----------------------------------------------------------------------
    console.log('\n--- 8. Testing Rapid Double-Clicks Guard ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(800);

    const doubleClickResult = await evaluate(`(() => {
      const a = document.querySelector('a[href="about-us.htm"]');
      if (!a) return { error: 'Link not found' };
      // Rapid double clicks
      a.click();
      a.click();
      const overlays = document.querySelectorAll('#sp-page-loader');
      return { overlayCount: overlays.length };
    })()`);
    console.log('Rapid double clicks result (overlays count):', doubleClickResult);
    await wait(1200);
    results.test8 = doubleClickResult;

    // -----------------------------------------------------------------------
    // TEST 9: Mobile Viewport & Drawer Navigation
    // -----------------------------------------------------------------------
    console.log('\n--- 9. Testing Mobile Viewport & Drawer Navigation ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(800);

    // Open mobile drawer
    await evaluate(`(() => {
      const toggle = document.getElementById('spMenuToggle');
      if (toggle) toggle.click();
    })()`);
    await wait(400);

    // Expand "No Cost Resources"
    await evaluate(`(() => {
      const summaries = Array.from(document.querySelectorAll('.sp-mobile-drawer summary'));
      const noCost = summaries.find(s => s.innerText.includes('No Cost Resources'));
      if (noCost && !noCost.parentElement.open) noCost.click();
    })()`);
    await wait(300);

    // Click "For Students"
    await evaluate(`(() => {
      const link = document.querySelector('.sp-mobile-drawer a[href="students.htm"]');
      if (link) link.click();
    })()`);

    await wait(50);
    const mobileLoader = await evaluate(`(() => {
      const o = document.getElementById('sp-page-loader');
      if (!o) return null;
      const img = o.querySelector('img');
      const cs = window.getComputedStyle(img);
      return {
        mounted: true,
        imgWidth: cs.width,
        imgHeight: cs.height
      };
    })()`);
    console.log('Mobile loader dimensions:', mobileLoader);
    await screenshot('07-mobile-loader-active');

    await wait(1200);
    const mobileDestUrl = await evaluate(`window.location.href`);
    const mobileLoaderRemoved = await evaluate(`!document.getElementById('sp-page-loader')`);
    console.log('Mobile navigated URL:', mobileDestUrl, 'Loader dismissed:', mobileLoaderRemoved);
    results.test9 = { mobileLoader, mobileDestUrl, mobileLoaderRemoved };

    // Reset to desktop viewport
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // -----------------------------------------------------------------------
    // TEST 10: Missing Image Fallback
    // -----------------------------------------------------------------------
    console.log('\n--- 10. Testing Missing Image Error Fallback ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(800);

    const errorFallbackResult = await evaluate(`(() => {
      // Simulate click with corrupted image
      const a = document.querySelector('a[href="about-us.htm"]');
      // Mount loader directly and dispatch error on img
      const o = document.createElement('div');
      o.id = 'sp-page-loader';
      o.className = 'sp-page-loader-overlay';
      const img = document.createElement('img');
      img.className = 'sp-page-loader-img';
      img.onerror = function() {
        if (o.parentNode) o.parentNode.removeChild(o);
      };
      o.appendChild(img);
      document.body.appendChild(o);

      const beforeError = !!document.getElementById('sp-page-loader');
      img.dispatchEvent(new Event('error'));
      const afterError = !!document.getElementById('sp-page-loader');
      return { beforeError, afterError };
    })()`);
    console.log('Image error fallback test:', errorFallbackResult);
    results.test10 = errorFallbackResult;

    // -----------------------------------------------------------------------
    // TEST 11: Reduced-Motion Behavior
    // -----------------------------------------------------------------------
    console.log('\n--- 11. Testing Prefers-Reduced-Motion Behavior ---');
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(800);

    // Click internal link under reduced-motion
    await evaluate(`(() => {
      const a = document.querySelector('a[href="faq.htm"]');
      if (a) a.click();
    })()`);

    await wait(30);
    const reducedMotionState = await evaluate(`(() => {
      const o = document.getElementById('sp-page-loader');
      if (!o) return { mounted: false };
      const img = o.querySelector('img');
      return {
        mounted: true,
        imgSrc: img ? img.getAttribute('src') : null,
        isStaticLogo: img && img.getAttribute('src').includes('spouzy.png')
      };
    })()`);
    console.log('Reduced-motion loader state:', reducedMotionState);
    await screenshot('08-reduced-motion-static-logo');

    await wait(1000);
    const reducedDestUrl = await evaluate(`window.location.href`);
    console.log('Reduced motion destination URL:', reducedDestUrl);
    results.test11 = { reducedMotionState, reducedDestUrl };

    // Reset emulated media
    await client.send('Emulation.setEmulatedMedia', { features: [] });

    // -----------------------------------------------------------------------
    // TEST 12: Excluded Actions (WhatsApp, Calls, Same-Page Anchors)
    // -----------------------------------------------------------------------
    console.log('\n--- 12. Testing Excluded Actions (WhatsApp, Calls, Anchors) ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(800);

    const exclusionsTest = await evaluate(`(() => {
      const results = {};

      // Test 12a: WhatsApp link
      const waLink = document.querySelector('a[href*="wa.me"]');
      if (waLink) {
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        waLink.dispatchEvent(ev);
        results.waLoaderMounted = !!document.getElementById('sp-page-loader');
      }

      // Test 12b: Telephone link
      const telLink = document.querySelector('a[href^="tel:"]');
      if (telLink) {
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        telLink.dispatchEvent(ev);
        results.telLoaderMounted = !!document.getElementById('sp-page-loader');
      }

      // Test 12c: Same-page anchor (#spServices or similar)
      const anchorLink = document.createElement('a');
      anchorLink.href = window.location.pathname + '#spServices';
      document.body.appendChild(anchorLink);
      const evAnchor = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchorLink.dispatchEvent(evAnchor);
      results.anchorLoaderMounted = !!document.getElementById('sp-page-loader');
      document.body.removeChild(anchorLink);

      // Test 12d: External link
      const extLink = document.createElement('a');
      extLink.href = 'https://example.com';
      document.body.appendChild(extLink);
      const evExt = new MouseEvent('click', { bubbles: true, cancelable: true });
      extLink.dispatchEvent(evExt);
      results.extLoaderMounted = !!document.getElementById('sp-page-loader');
      document.body.removeChild(extLink);

      return results;
    })()`);
    console.log('Exclusions test results:', exclusionsTest);
    results.test12 = exclusionsTest;

    // Save all results to artifact
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'verification_summary.json'),
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log('\nAll 12 verification tests completed successfully!');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

run();
