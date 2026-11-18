const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5502';
const PORT = 9278;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\scratch\\chrome-corp-profile-2';
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200\\verification_corporate_kamasutra';

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
  console.log('Launching Headless Chrome for Corporate Kamasutra Verification...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900'
  ]);

  let client = null;
  const testResults = {};

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

    // TEST 1: corporate-kamasutra.htm Desktop
    console.log('\n--- Test 1: corporate-kamasutra.htm Content & Structure ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/corporate-kamasutra.htm` });
    await wait(1200);

    const pageInfo = await evaluate(`({
      title: document.title,
      h1: document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : null,
      sections: Array.from(document.querySelectorAll('.guide-body section h2')).map(h => h.innerText.trim()),
      hasGuideActions: !!document.querySelector('.guide-actions'),
      hasStickyHeader: !!document.querySelector('.sp-header-sticky-wrapper'),
      hasFooter: !!document.querySelector('.sp-footer-modern'),
      floatingWidgetExists: !!document.querySelector('.sp-floating-widget')
    })`);
    console.log('Page Info:', pageInfo);
    testResults.corporatePage = pageInfo;
    await screenshot('01-corporate-kamasutra-desktop');

    // TEST 2: Desktop Dropdown Interaction on index.htm
    console.log('\n--- Test 2: Desktop Dropdown Navigation Preview ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(1200);

    // Open "No Cost Resources" dropdown
    await evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('.sp-desktop-nav .sp-nav-link'))
        .find(b => b.innerText.includes('No Cost Resources'));
      if (btn) btn.click();
    })()`);
    await wait(500);

    const items = await evaluate(`(() => {
      const group = document.getElementById('group-3');
      if (!group) return null;
      const opts = Array.from(group.querySelectorAll('.sp-dropdown-item')).map(a => ({
        text: a.innerText.trim(),
        href: a.getAttribute('href')
      }));
      const visuals = Array.from(group.querySelectorAll('.nav-visual img')).map(img => ({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt')
      }));
      return { opts, visuals };
    })()`);
    console.log('Dropdown items count:', items.opts.length, 'visuals count:', items.visuals.length);
    testResults.dropdownItems = items;

    // Hover over 6th item: Corporate Kamasutra via pointerenter and focus
    await evaluate(`(() => {
      const group = document.getElementById('group-3');
      const items = group.querySelectorAll('.sp-dropdown-item');
      if (items[5]) {
        items[5].dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        items[5].focus();
      }
    })()`);
    await wait(400);

    const corpActivePreview = await evaluate(`(() => {
      const activeFig = document.querySelector('#group-3 .nav-visual.selected');
      if (!activeFig) return null;
      return {
        imgSrc: activeFig.querySelector('img') ? activeFig.querySelector('img').getAttribute('src') : null,
        caption: activeFig.querySelector('figcaption') ? activeFig.querySelector('figcaption').innerText.trim() : null
      };
    })()`);
    console.log('Active preview for 6th item (Corporate Kamasutra):', corpActivePreview);
    testResults.corpActivePreview = corpActivePreview;
    await screenshot('02-dropdown-corporate-kamasutra-active');

    // Hover over 5th item: Gen Z Kama Sutra via pointerenter and focus
    await evaluate(`(() => {
      const group = document.getElementById('group-3');
      const items = group.querySelectorAll('.sp-dropdown-item');
      if (items[4]) {
        items[4].dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
        items[4].focus();
      }
    })()`);
    await wait(400);

    const genZActivePreview = await evaluate(`(() => {
      const activeFig = document.querySelector('#group-3 .nav-visual.selected');
      if (!activeFig) return null;
      return {
        imgSrc: activeFig.querySelector('img') ? activeFig.querySelector('img').getAttribute('src') : null,
        caption: activeFig.querySelector('figcaption') ? activeFig.querySelector('figcaption').innerText.trim() : null
      };
    })()`);
    console.log('Active preview for 5th item (Gen Z Kama Sutra):', genZActivePreview);
    testResults.genZActivePreview = genZActivePreview;
    await screenshot('03-dropdown-gen-z-active');

    // TEST 3: Continuation Sequence gen-z-kama-sutra.htm -> corporate-kamasutra.htm
    console.log('\n--- Test 3: Continuation Link on gen-z-kama-sutra.htm ---');
    await client.send('Page.navigate', { url: `${BASE_URL}/gen-z-kama-sutra.htm` });
    await wait(1000);

    const genZContinuation = await evaluate(`(() => {
      const action = document.querySelector('.guide-actions .guide-action');
      return action ? { text: action.innerText.trim(), href: action.getAttribute('href') } : null;
    })()`);
    console.log('gen-z-kama-sutra.htm continuation link:', genZContinuation);
    testResults.genZContinuation = genZContinuation;

    // Scroll to bottom
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await wait(400);
    await screenshot('04-gen-z-continuation-link');

    // Click continuation link
    await evaluate(`document.querySelector('.guide-actions .guide-action').click()`);
    await wait(1000);

    const destUrl = await evaluate(`window.location.href`);
    console.log('Navigated destination:', destUrl);
    testResults.continuationDestination = destUrl;

    // TEST 4: Search Modal Query Testing
    console.log('\n--- Test 4: Search Modal Queries ---');
    // Open search modal via .sp-search-trigger
    await evaluate(`(() => {
      const searchBtn = document.querySelector('.sp-search-trigger');
      if (searchBtn) searchBtn.click();
    })()`);
    await wait(400);

    // Search "corporate kamasutra" using .sp-search-field
    await evaluate(`(() => {
      const input = document.querySelector('.sp-search-field');
      if (input) {
        input.value = 'corporate kamasutra';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await wait(400);

    const searchCorpResults = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('.sp-search-modal .sp-search-result-item a'));
      return items.slice(0, 3).map(el => ({
        title: el.querySelector('.sp-search-result-title') ? el.querySelector('.sp-search-result-title').innerText.trim() : el.innerText.trim(),
        href: el.getAttribute('href')
      }));
    })()`);
    console.log('Search "corporate kamasutra" results:', searchCorpResults);
    testResults.searchCorpResults = searchCorpResults;
    await screenshot('05-search-corporate-kamasutra');

    // Search "gen z" using .sp-search-field
    await evaluate(`(() => {
      const input = document.querySelector('.sp-search-field');
      if (input) {
        input.value = 'gen z';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await wait(400);

    const searchGenZResults = await evaluate(`(() => {
      const items = Array.from(document.querySelectorAll('.sp-search-modal .sp-search-result-item a'));
      return items.slice(0, 3).map(el => ({
        title: el.querySelector('.sp-search-result-title') ? el.querySelector('.sp-search-result-title').innerText.trim() : el.innerText.trim(),
        href: el.getAttribute('href')
      }));
    })()`);
    console.log('Search "gen z" results:', searchGenZResults);
    testResults.searchGenZResults = searchGenZResults;
    await screenshot('06-search-gen-z');

    // Close search modal
    await evaluate(`(() => {
      const closeBtn = document.querySelector('.sp-search-close');
      if (closeBtn) closeBtn.click();
    })()`);
    await wait(300);

    // TEST 5: Mobile Drawer
    console.log('\n--- Test 5: Mobile Viewport & Drawer ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.send('Page.navigate', { url: `${BASE_URL}/index.htm` });
    await wait(1000);

    // Open mobile drawer
    await evaluate(`(() => {
      const toggle = document.getElementById('spMenuToggle');
      if (toggle) toggle.click();
    })()`);
    await wait(500);

    // Expand "No Cost Resources" details
    await evaluate(`(() => {
      const summaries = Array.from(document.querySelectorAll('.sp-mobile-drawer summary'));
      const noCost = summaries.find(s => s.innerText.includes('No Cost Resources'));
      if (noCost && !noCost.parentElement.open) {
        noCost.click();
      }
    })()`);
    await wait(500);

    const drawerNoCostItems = await evaluate(`(() => {
      const summaries = Array.from(document.querySelectorAll('.sp-mobile-drawer summary'));
      const noCost = summaries.find(s => s.innerText.includes('No Cost Resources'));
      if (!noCost) return null;
      const links = Array.from(noCost.parentElement.querySelectorAll('.sp-drawer-sublink'));
      return links.map(l => ({
        text: l.innerText.trim(),
        href: l.getAttribute('href'),
        hasImg: !!l.querySelector('img'),
        imgSrc: l.querySelector('img') ? l.querySelector('img').getAttribute('src') : null
      }));
    })()`);
    console.log('Mobile drawer No Cost Resources items:', drawerNoCostItems);
    testResults.drawerNoCostItems = drawerNoCostItems;
    await screenshot('07-mobile-drawer-no-cost-resources');

    // Save full JSON test results
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'verification_results.json'),
      JSON.stringify(testResults, null, 2),
      'utf8'
    );
    console.log('\nVerification suite successfully completed! Results written to verification_results.json.');

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

run();
