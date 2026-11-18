const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5502';
const PORT = 9299;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-treatment-profile';
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_intimate_treatment';

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
  console.log('Launching Headless Chrome for Intimate Aesthetics Treatment Verification...');
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

    // Set desktop metrics
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // -----------------------------------------------------------------------
    // TEST 1: New Page Load & Structure
    // -----------------------------------------------------------------------
    console.log('\n--- 1. Testing intimate-aesthetics-treatment.htm Load & Structure ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/intimate-aesthetics-treatment.htm` });
    await wait(1200);

    const pageInfo = await evaluate(`({
      title: document.title,
      h1: document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : null,
      subheading: document.querySelector('.guide-subheading') ? document.querySelector('.guide-subheading').innerText.trim() : null,
      sections: Array.from(document.querySelectorAll('.guide-body section h2')).map(h => h.innerText.trim()),
      hasStickyHeader: !!document.querySelector('.sp-header-sticky-wrapper'),
      hasFooter: !!document.querySelector('.sp-footer-modern'),
      hasFloatingWidget: !!document.querySelector('#spFloatingWidget'),
      continuation: document.querySelector('.guide-actions a.guide-action') ? {
        text: document.querySelector('.guide-actions a.guide-action').innerText.trim(),
        href: document.querySelector('.guide-actions a.guide-action').getAttribute('href')
      } : null
    })`);
    console.log('Page Info:', pageInfo);
    await screenshot('01-intimate-aesthetics-treatment-desktop');
    results.test1 = pageInfo;

    // -----------------------------------------------------------------------
    // TEST 2: Desktop Dropdown Navigation Preview & Order
    // -----------------------------------------------------------------------
    console.log('\n--- 2. Testing Desktop Dropdown "What We Do" (7 items & preview activation) ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(1000);

    // Open What We Do dropdown
    await evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('.sp-desktop-nav .sp-nav-link'))
        .find(b => b.innerText.includes('What We Do'));
      if (btn) btn.click();
    })()`);
    await wait(400);

    const dropdownData = await evaluate(`(() => {
      const group = document.getElementById('group-1');
      const opts = Array.from(group.querySelectorAll('.sp-dropdown-item')).map(a => ({
        text: a.innerText.trim(),
        href: a.getAttribute('href')
      }));
      return opts;
    })()`);
    console.log('What We Do dropdown items:', dropdownData);

    // Hover over 5th item (index 4): Intimate Aesthetics Treatment
    await evaluate(`(() => {
      const group = document.getElementById('group-1');
      const items = group.querySelectorAll('.sp-dropdown-item');
      if (items[4]) {
        items[4].dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        items[4].focus();
      }
    })()`);
    await wait(400);

    const activePreview = await evaluate(`(() => {
      const activeFig = document.querySelector('#group-1 .nav-visual.selected');
      if (!activeFig) return null;
      return {
        imgSrc: activeFig.querySelector('img') ? activeFig.querySelector('img').getAttribute('src') : null,
        caption: activeFig.querySelector('figcaption') ? activeFig.querySelector('figcaption').innerText.trim() : null
      };
    })()`);
    console.log('Active preview for item 5 (Intimate Aesthetics Treatment):', activePreview);
    await screenshot('02-dropdown-intimate-aesthetics-active');
    results.test2 = { dropdownData, activePreview };

    // -----------------------------------------------------------------------
    // TEST 3: Footer Link Destination
    // -----------------------------------------------------------------------
    console.log('\n--- 3. Testing Footer Breast & Genital Clinic link ---');
    const footerLink = await evaluate(`(() => {
      const a = Array.from(document.querySelectorAll('.sp-footer-modern a'))
        .find(el => el.innerText.includes('Breast & Genital Clinic'));
      return a ? { text: a.innerText.trim(), href: a.getAttribute('href') } : null;
    })()`);
    console.log('Footer link:', footerLink);

    // Click footer link
    await evaluate(`(() => {
      const a = Array.from(document.querySelectorAll('.sp-footer-modern a'))
        .find(el => el.innerText.includes('Breast & Genital Clinic'));
      if (a) a.click();
    })()`);
    await wait(1200);
    const footerDest = await evaluate(`window.location.href`);
    console.log('Navigated destination from footer click:', footerDest);
    results.test3 = { footerLink, footerDest };

    // -----------------------------------------------------------------------
    // TEST 4: Search Modal Queries
    // -----------------------------------------------------------------------
    console.log('\n--- 4. Testing Search Modal Queries ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(1000);

    // Open search modal
    await evaluate(`document.querySelector('.sp-search-trigger').click()`);
    await wait(400);

    // Search query: "intimate aesthetics"
    await evaluate(`(() => {
      const input = document.querySelector('.sp-search-field');
      if (input) {
        input.value = 'intimate aesthetics';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await wait(400);

    const searchResultsTreatment = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('.sp-search-modal .sp-search-result-item a'));
      return items.slice(0, 3).map(el => ({
        title: el.querySelector('.sp-search-result-title') ? el.querySelector('.sp-search-result-title').innerText.trim() : el.innerText.trim(),
        href: el.getAttribute('href')
      }));
    })()`);
    console.log('Search "intimate aesthetics" results:', searchResultsTreatment);
    await screenshot('03-search-intimate-aesthetics');

    // Search query: "intimate health"
    await evaluate(`(() => {
      const input = document.querySelector('.sp-search-field');
      if (input) {
        input.value = 'intimate health';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await wait(400);

    const searchResultsHealth = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('.sp-search-modal .sp-search-result-item a'));
      return items.slice(0, 3).map(el => ({
        title: el.querySelector('.sp-search-result-title') ? el.querySelector('.sp-search-result-title').innerText.trim() : el.innerText.trim(),
        href: el.getAttribute('href')
      }));
    })()`);
    console.log('Search "intimate health" results:', searchResultsHealth);
    await screenshot('04-search-intimate-health');
    results.test4 = { searchResultsTreatment, searchResultsHealth };

    // Close search
    await evaluate(`document.querySelector('.sp-search-close').click()`);
    await wait(300);

    // -----------------------------------------------------------------------
    // TEST 5: Homepage Clinic Card (Card 4)
    // -----------------------------------------------------------------------
    console.log('\n--- 5. Testing Homepage Card 4 Link ---');
    const card4Links = await evaluate(`(() => {
      const card4 = Array.from(document.querySelectorAll('.sp-service-card-modern'))
        .find(c => c.innerText.includes('Breast & Genital Specialized Clinic'));
      if (!card4) return null;
      const titleLink = card4.querySelector('h3 a');
      const btnLink = card4.querySelector('.sp-card-link-btn');
      return {
        titleHref: titleLink ? titleLink.getAttribute('href') : null,
        btnHref: btnLink ? btnLink.getAttribute('href') : null,
        btnText: btnLink ? btnLink.innerText.trim() : null
      };
    })()`);
    console.log('Homepage Card 4 links:', card4Links);
    results.test5 = card4Links;

    // -----------------------------------------------------------------------
    // TEST 6: Single-Continuation Sequence Navigation
    // -----------------------------------------------------------------------
    console.log('\n--- 6. Testing Single Continuation Link Navigation ---');
    // Start at intimate-health.htm
    await client.send('Page.navigate', { url: `${BASE_URL}/intimate-health.htm` });
    await wait(1000);

    const healthContinuation = await evaluate(`(() => {
      const a = document.querySelector('.guide-actions a.guide-action');
      return a ? { text: a.innerText.trim(), href: a.getAttribute('href') } : null;
    })()`);
    console.log('intimate-health.htm continuation link:', healthContinuation);

    // Click continuation link on intimate-health.htm
    await evaluate(`document.querySelector('.guide-actions a.guide-action').click()`);
    await wait(1200);

    const landedAt = await evaluate(`window.location.href`);
    console.log('Landed destination URL:', landedAt);

    const treatmentContinuation = await evaluate(`(() => {
      const a = document.querySelector('.guide-actions a.guide-action');
      return a ? { text: a.innerText.trim(), href: a.getAttribute('href') } : null;
    })()`);
    console.log('intimate-aesthetics-treatment.htm continuation link:', treatmentContinuation);

    // Click continuation link on intimate-aesthetics-treatment.htm
    await evaluate(`document.querySelector('.guide-actions a.guide-action').click()`);
    await wait(1200);

    const finalLandedAt = await evaluate(`window.location.href`);
    console.log('Final landed destination URL (Divorce Mediation):', finalLandedAt);
    results.test6 = { healthContinuation, landedAt, treatmentContinuation, finalLandedAt };

    // -----------------------------------------------------------------------
    // TEST 7: Mobile Drawer (375x812)
    // -----------------------------------------------------------------------
    console.log('\n--- 7. Testing Mobile Viewport & Drawer Navigation ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });

    await client.send('Page.navigate', { url: `${BASE_URL}/intimate-aesthetics-treatment.htm` });
    await wait(1000);
    await screenshot('05-mobile-intimate-treatment-page');

    // Open mobile drawer
    await evaluate(`document.getElementById('spMenuToggle').click()`);
    await wait(400);

    // Expand What We Do details
    await evaluate(`(() => {
      const summaries = Array.from(document.querySelectorAll('.sp-mobile-drawer summary'));
      const wwd = summaries.find(s => s.innerText.includes('What We Do'));
      if (wwd && !wwd.parentElement.open) wwd.click();
    })()`);
    await wait(400);

    const mobileDrawerItems = await evaluate(`(() => {
      const summaries = Array.from(document.querySelectorAll('.sp-mobile-drawer summary'));
      const wwd = summaries.find(s => s.innerText.includes('What We Do'));
      if (!wwd) return null;
      const links = Array.from(wwd.parentElement.querySelectorAll('.sp-drawer-sublink'));
      return links.map(l => ({
        text: l.innerText.trim(),
        href: l.getAttribute('href'),
        imgSrc: l.querySelector('img') ? l.querySelector('img').getAttribute('src') : null
      }));
    })()`);
    console.log('Mobile drawer What We Do items:', mobileDrawerItems);
    await screenshot('06-mobile-drawer-what-we-do-7items');
    results.test7 = mobileDrawerItems;

    // Save all test results to artifact
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'verification_results.json'),
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log('\nIntimate Aesthetics Treatment verification suite completed successfully!');

  } catch (err) {
    console.error('CDP test error:', err);
  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

run();
