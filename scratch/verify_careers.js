const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5578;
const CDP_PORT = 9478;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-careers-test-' + Date.now());

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
    if (p === '/') p = '/careers.htm';
    const fp = path.join(process.cwd(), decodeURIComponent(p.replace(/^\//, '')));

    fs.stat(fp, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + p);
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

async function runCareersVerification() {
  let server, cp, client;
  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
    overflowChecks: {},
    screenshots: []
  };

  try {
    console.log('1. Starting HTTP server on port ' + HTTP_PORT);
    server = await startStaticServer(HTTP_PORT);

    console.log('2. Launching headless Chrome on port ' + CDP_PORT);
    cp = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1920,1080'
    ]);

    await wait(2000);
    const tabs = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
    const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
    client = new CDPClient(pageTab.webSocketDebuggerUrl);
    await client.ready();
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    // Helper: evaluate expression
    async function evaluate(expr) {
      const res = await client.send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error('Eval failed: ' + (res.exceptionDetails.text || '') + ' ' + (res.exceptionDetails.exception?.description || ''));
      }
      return res.result.value;
    }

    // Helper: take screenshot
    async function captureScreenshot(filename) {
      const sc = await client.send('Page.captureScreenshot', { format: 'png' });
      const fullPath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(fullPath, Buffer.from(sc.data, 'base64'));
      results.screenshots.push({ filename, path: fullPath });
      console.log('Captured: ' + filename);
    }

    // -------------------------------------------------------------------------
    // TEST 1: Navigation & Search on Homepage
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Navigation & Search on Homepage ---');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.htm` });
    await wait(1500);

    const navCheck = await evaluate(`(() => {
      const desktopCareersLink = document.querySelector('.sp-desktop-nav a[href="careers.htm"]');
      const drawerCareersLink = document.querySelector('.sp-mobile-drawer a[href="careers.htm"]');
      const searchCareersLink = document.querySelector('.sp-search-modal a[href="careers.htm"]');
      return {
        hasDesktopLink: !!desktopCareersLink,
        desktopText: desktopCareersLink?.textContent.trim(),
        hasDrawerLink: !!drawerCareersLink,
        hasSearchLink: !!searchCareersLink
      };
    })()`);
    results.tests.homepageNavigation = navCheck;
    console.log('Homepage Navigation Check:', navCheck);

    // -------------------------------------------------------------------------
    // TEST 2: Navigate to Careers Page (Desktop 1920x1080)
    // -------------------------------------------------------------------------
    console.log('--- TEST 2: Load Careers Page (1920x1080) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/careers.htm` });
    await wait(1800);

    const pageMeta = await evaluate(`(() => {
      const title = document.title;
      const h1 = document.querySelector('h1.sp-careers-main-title')?.textContent.trim();
      const desc = document.querySelector('.sp-careers-intro-desc')?.textContent.trim();
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const cards = Array.from(document.querySelectorAll('.sp-job-card')).map(c => ({
        id: c.id,
        dept: c.querySelector('.sp-job-dept-badge')?.textContent.trim(),
        title: c.querySelector('.sp-job-card-title')?.textContent.trim()
      }));
      return { title, h1, desc, bg, cardCount: cards.length, cards };
    })()`);
    results.tests.pageMeta = pageMeta;
    console.log('Page Meta Check:', pageMeta);

    await captureScreenshot('14-careers-1920.png');

    // -------------------------------------------------------------------------
    // TEST 3: Role Detail Expand / Collapse Accordion
    // -------------------------------------------------------------------------
    console.log('--- TEST 3: Role Detail Expand / Collapse ---');
    const roleAccordionTest = await evaluate(`(() => {
      const btn = document.querySelector('#role-sales-coordinator .sp-role-toggle-btn');
      const panel = document.getElementById('details-sales-coordinator');
      const initialExpanded = btn.getAttribute('aria-expanded');
      const initialHidden = panel.hidden;

      // Click to expand
      btn.click();
      const afterClickExpanded = btn.getAttribute('aria-expanded');
      const afterClickHidden = panel.hidden;

      const respCount = panel.querySelectorAll('.sp-role-list')[0]?.children.length;
      const skillsCount = panel.querySelectorAll('.sp-role-list')[1]?.children.length;
      const prefCount = panel.querySelectorAll('.sp-role-list')[2]?.children.length;
      const hasNotice = !!panel.querySelector('.sp-role-terms-notice');

      // Click to collapse
      btn.click();
      const afterSecondClickExpanded = btn.getAttribute('aria-expanded');
      const afterSecondClickHidden = panel.hidden;

      // Re-expand for screenshot
      btn.click();

      return {
        initialExpanded,
        initialHidden,
        afterClickExpanded,
        afterClickHidden,
        respCount,
        skillsCount,
        prefCount,
        hasNotice,
        afterSecondClickExpanded,
        afterSecondClickHidden
      };
    })()`);
    results.tests.roleAccordion = roleAccordionTest;
    console.log('Role Accordion Test:', roleAccordionTest);

    await wait(300);
    await captureScreenshot('15-careers-expanded-role.png');

    // -------------------------------------------------------------------------
    // TEST 4: "Apply Now" Preselection
    // -------------------------------------------------------------------------
    console.log('--- TEST 4: "Apply Now" Button Preselection ---');
    const applyPreselection = await evaluate(`(() => {
      const roleSelect = document.getElementById('spCareerRole');

      // 1. Click Digital Marketing Apply Now
      const dmBtn = document.querySelector('#role-digital-marketing .sp-role-apply-btn');
      dmBtn.click();
      const val1 = roleSelect.value;

      // 2. Click Performance Marketing Apply Now
      const pmBtn = document.querySelector('#role-performance-marketing .sp-role-apply-btn');
      pmBtn.click();
      const val2 = roleSelect.value;

      // 3. Click Sales Coordinator Apply Now
      const scBtn = document.querySelector('#role-sales-coordinator .sp-role-apply-btn');
      scBtn.click();
      const val3 = roleSelect.value;

      return {
        digitalMarketingSelect: val1,
        performanceMarketingSelect: val2,
        salesCoordinatorSelect: val3
      };
    })()`);
    results.tests.applyPreselection = applyPreselection;
    console.log('Apply Preselection Test:', applyPreselection);

    // -------------------------------------------------------------------------
    // TEST 5: Phone & WhatsApp Sync
    // -------------------------------------------------------------------------
    console.log('--- TEST 5: Phone and WhatsApp Number Sync ---');
    const phoneSyncTest = await evaluate(`(() => {
      const mob = document.getElementById('spCareerMobile');
      const wa = document.getElementById('spCareerWhatsapp');
      const syncCheck = document.getElementById('spCareerSameAsMobile');

      mob.value = '9876543210';
      mob.dispatchEvent(new Event('input', { bubbles: true }));

      syncCheck.checked = true;
      syncCheck.dispatchEvent(new Event('change', { bubbles: true }));

      const waVal1 = wa.value;
      const waReadOnly1 = wa.readOnly;

      // Change mobile number
      mob.value = '8591945055';
      mob.dispatchEvent(new Event('input', { bubbles: true }));
      const waVal2 = wa.value;

      // Uncheck sync
      syncCheck.checked = false;
      syncCheck.dispatchEvent(new Event('change', { bubbles: true }));
      const waReadOnly2 = wa.readOnly;

      // Restore checked
      syncCheck.checked = true;
      syncCheck.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        initialSyncValue: waVal1,
        isReadOnlyWhenSynced: waReadOnly1,
        updatedSyncValue: waVal2,
        isEditableWhenUnsynced: !waReadOnly2
      };
    })()`);
    results.tests.phoneSync = phoneSyncTest;
    console.log('Phone Sync Test:', phoneSyncTest);

    // -------------------------------------------------------------------------
    // TEST 6: Resume Upload Validation
    // -------------------------------------------------------------------------
    console.log('--- TEST 6: Resume Upload File Handling & Validation ---');
    const resumeTest = await evaluate(`(() => {
      const dropzone = document.getElementById('spResumeDropzone');
      const preview = document.getElementById('spResumePreviewCard');
      const err = document.getElementById('spResumeError');
      const input = document.getElementById('spResumeInput');
      const removeBtn = document.getElementById('spRemoveResumeBtn');

      // Helper to simulate setting file
      function simulateFile(name, size, type) {
        const dt = new DataTransfer();
        const file = new File(['mock content'.repeat(100)], name, { type });
        // Override size for test
        Object.defineProperty(file, 'size', { value: size });
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 1. Invalid file format
      simulateFile('script.exe', 1024, 'application/x-msdownload');
      const invalidErrMsg = err.textContent.trim();
      const previewHiddenOnInvalid = preview.style.display === 'none';

      // 2. Oversized file (> 10MB)
      simulateFile('large_portfolio.pdf', 15 * 1024 * 1024, 'application/pdf');
      const oversizedErrMsg = err.textContent.trim();

      // 3. Valid PDF file
      simulateFile('Priya_Sharma_Resume.pdf', 1.4 * 1024 * 1024, 'application/pdf');
      const validErrHidden = err.style.display === 'none';
      const previewVisible = preview.style.display !== 'none';
      const displayedName = preview.querySelector('.sp-file-name')?.textContent.trim();
      const displayedSize = preview.querySelector('.sp-file-size')?.textContent.trim();

      // 4. Test Remove button
      removeBtn.click();
      const previewHiddenAfterRemove = preview.style.display === 'none';
      const dropzoneVisibleAfterRemove = dropzone.style.display !== 'none';

      // 5. Re-attach valid PDF for form submission
      simulateFile('Priya_Sharma_Resume.pdf', 1.4 * 1024 * 1024, 'application/pdf');

      return {
        invalidErrMsg,
        previewHiddenOnInvalid,
        oversizedErrMsg,
        validErrHidden,
        previewVisible,
        displayedName,
        displayedSize,
        previewHiddenAfterRemove,
        dropzoneVisibleAfterRemove
      };
    })()`);
    results.tests.resumeHandling = resumeTest;
    console.log('Resume Handling Test:', resumeTest);

    // -------------------------------------------------------------------------
    // TEST 7: Form Fill, Review Modal, & WhatsApp Handoff
    // -------------------------------------------------------------------------
    console.log('--- TEST 7: Form Fill, Review Modal & WhatsApp Handoff ---');
    const formSubmissionTest = await evaluate(`(() => {
      const form = document.getElementById('spCareersForm');
      const modal = document.getElementById('spCareerReviewModal');
      const reviewContent = document.getElementById('spCareerReviewContent');
      const whatsappBtn = document.getElementById('spCareerReviewWhatsappBtn');
      const copyBtn = document.getElementById('spCareerCopyTextBtn');
      const editBtn = document.getElementById('spCareerReviewEditBtn');

      // Fill in all required fields
      document.getElementById('spCareerRole').value = 'Sales Coordinator';
      document.getElementById('spCareerFullName').value = 'Priya Sharma';
      document.getElementById('spCareerEmail').value = 'priya.sharma@example.com';
      document.getElementById('spCareerMobile').value = '9876543210';
      document.getElementById('spCareerCity').value = 'Mumbai';
      document.getElementById('spCareerExp').value = '1 - 2 years';
      document.getElementById('spCareerCurrentRole').value = 'Client Care Associate';
      document.getElementById('spCareerHighestQual').value = 'Bachelor of Arts (Psychology)';
      document.getElementById('spCareerSkills').value = 'Fluency in English & Hindi, CRM management, active listening, client coordination';
      document.getElementById('spCareerPortfolio').value = 'https://www.linkedin.com/in/priyasharma';
      document.getElementById('spCareerNotice').value = 'Immediate';
      document.getElementById('spCareerExpectedComp').value = 'As per industry standards';
      document.getElementById('spCareerWhy').value = 'I strongly resonate with SPOUZY\\'s compassionate, evidence-based approach to relationship guidance and would love to support clients through empathetic coordination.';
      document.getElementById('spCareerConsent').checked = true;

      // Submit form
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

      const isModalVisible = modal.style.display === 'flex';
      const reviewText = reviewContent.innerText;

      // Capture WhatsApp parameters
      let capturedWaUrl = '';
      const originalOpen = window.open;
      window.open = function(url) {
        capturedWaUrl = url;
      };
      whatsappBtn.click();
      window.open = originalOpen;

      // Test Edit button
      editBtn.click();
      const isModalClosed = modal.style.display === 'none';

      // Re-open modal for screenshot
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

      return {
        isModalVisible,
        hasRoleBadge: reviewText.includes('Sales Coordinator'),
        hasCandidateName: reviewText.includes('Priya Sharma'),
        hasPhone: reviewText.includes('+91 9876543210'),
        hasResume: reviewText.includes('Priya_Sharma_Resume.pdf'),
        hasNotice: reviewText.includes('Important WhatsApp Document Notice'),
        capturedWaUrl,
        isModalClosedAfterEdit: isModalClosed
      };
    })()`);
    results.tests.formSubmission = formSubmissionTest;
    console.log('Form Submission Test:', formSubmissionTest);

    await captureScreenshot('16-careers-form.png');
    await captureScreenshot('17-careers-review-modal.png');

    // -------------------------------------------------------------------------
    // TEST 8: Responsive Layout & Zero Overflow Audit (1920, 1366, 768, 390)
    // -------------------------------------------------------------------------
    console.log('--- TEST 8: Responsive Layout & Zero Overflow Audit ---');
    const viewports = [
      { name: '1920x1080', width: 1920, height: 1080 },
      { name: '1366x768', width: 1366, height: 768 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '390x844', width: 390, height: 844, isMobile: true }
    ];

    // Close review modal before viewport checks
    await evaluate(`document.getElementById('spCareerReviewCloseBtn')?.click()`);

    for (const vp of viewports) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: !!vp.isMobile
      });
      await wait(600);

      const overflow = await evaluate(`(() => {
        const docW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        const mainW = document.querySelector('.sp-careers-container')?.offsetWidth;
        return {
          clientWidth: docW,
          scrollWidth: scrollW,
          hasHorizontalOverflow: scrollW > docW,
          mainContainerWidth: mainW
        };
      })()`);
      results.overflowChecks[vp.name] = overflow;
      console.log(`Viewport ${vp.name}:`, overflow);

      if (vp.name === '390x844') {
        await captureScreenshot('18-careers-mobile-390.png');
      }
    }

    // Save JSON report
    const reportPath = path.join(ARTIFACT_DIR, 'careers_verification_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
    console.log('Saved JSON report to: ' + reportPath);

  } catch (err) {
    console.error('Test execution failed:', err);
    results.error = err.message;
  } finally {
    if (client) client.close();
    if (cp) cp.kill();
    if (server) server.close();
    console.log('Test execution complete.');
  }
}

runCareersVerification();
