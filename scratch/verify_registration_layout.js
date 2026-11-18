const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5570;
const CDP_PORT = 9470;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:/Users/sharad yadav/.gemini/antigravity/brain/e9b49302-7f58-46dd-b60b-d34c53919200';

// Simple static server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.htm';
  const filePath = path.join(__dirname, '..', reqPath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.webm': 'video/webm'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Static server running at http://localhost:${PORT}/`);
  runVerification();
});

async function runVerification() {
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--hide-scrollbars'
  ]);

  console.log('Spawning Chrome headless on CDP port', CDP_PORT);
  await new Promise(r => setTimeout(r, 1500));

  try {
    const listRes = await fetch(`http://localhost:${CDP_PORT}/json`);
    const tabs = await listRes.json();
    const wsUrl = tabs[0].webSocketDebuggerUrl;
    console.log('Connecting to WebSocket CDP:', wsUrl);

    const ws = new WebSocket(wsUrl);

    let messageId = 0;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++messageId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(r => {
      ws.onopen = r;
    });
    console.log('Connected to Chrome CDP!');

    await sendCommand('Page.enable');
    await sendCommand('DOM.enable');
    await sendCommand('Runtime.enable');

    const viewports = [
      { name: '1920', width: 1920, height: 1080 },
      { name: '1366', width: 1366, height: 768 },
      { name: '768', width: 768, height: 1024 },
      { name: '390', width: 390, height: 844 }
    ];

    const results = {
      doctorLayout: {},
      counsellorLayout: {},
      functionalTests: {}
    };

    // Helper: set viewport and capture screenshot
    async function capturePage(url, vp, filename) {
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });
      await sendCommand('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 1200));

      const screenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
      const savePath = path.join(ARTIFACTS_DIR, filename);
      fs.writeFileSync(savePath, Buffer.from(screenshot.data, 'base64'));
      console.log(`Saved screenshot: ${filename}`);

      // Evaluate layout metrics
      const metrics = await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const container = document.querySelector('.sp-reg-container');
          const cRect = container ? container.getBoundingClientRect() : null;
          const header = document.querySelector('.sp-header-modern');
          const hRect = header ? header.getBoundingClientRect() : null;
          const topbar = document.querySelector('.sp-topbar-modern');
          const tbRect = topbar ? topbar.getBoundingClientRect() : null;
          const navItems = document.querySelectorAll('.sp-menu-item').length;
          const titleInput = document.getElementById('spTitle');
          const firstNameInput = document.getElementById('spFirstName');
          const lastNameInput = document.getElementById('spLastName');
          const cards = document.querySelectorAll('.sp-reg-section-card');
          const c0 = cards[0] ? cards[0].getBoundingClientRect() : null;
          const bodyWidth = document.body.clientWidth;
          const docScrollWidth = document.documentElement.scrollWidth;

          return {
            windowWidth: window.innerWidth,
            bodyWidth: bodyWidth,
            docScrollWidth: docScrollWidth,
            hasHorizontalScroll: docScrollWidth > window.innerWidth,
            topbarVisible: tbRect ? tbRect.height > 0 : false,
            headerVisible: hRect ? hRect.height > 0 : false,
            headerHeight: hRect ? hRect.height : 0,
            menuItemCount: navItems,
            containerWidth: cRect ? Math.round(cRect.width) : 0,
            containerLeft: cRect ? Math.round(cRect.left) : 0,
            containerRight: cRect ? Math.round(window.innerWidth - cRect.right) : 0,
            isCentered: cRect ? Math.abs(cRect.left - (window.innerWidth - cRect.right)) <= 2 : false,
            card0Width: c0 ? Math.round(c0.width) : 0,
            titleWidth: titleInput ? Math.round(titleInput.getBoundingClientRect().width) : 0,
            firstNameWidth: firstNameInput ? Math.round(firstNameInput.getBoundingClientRect().width) : 0,
            lastNameWidth: lastNameInput ? Math.round(lastNameInput.getBoundingClientRect().width) : 0,
            titleHeight: titleInput ? Math.round(titleInput.getBoundingClientRect().height) : 0,
            inputFontSize: titleInput ? window.getComputedStyle(titleInput).fontSize : ''
          };
        })()`,
        returnByValue: true
      });

      return metrics.result.value;
    }

    // 1. Inspect Doctor page across 4 viewports
    for (const vp of viewports) {
      console.log(`Testing Doctor Page at ${vp.name}px...`);
      const metrics = await capturePage(
        `http://localhost:${PORT}/join-doctor.htm`,
        vp,
        `0${viewports.indexOf(vp) + 1}-join-doctor-${vp.name}.png`
      );
      results.doctorLayout[vp.name] = metrics;
      console.log(`Doctor [${vp.name}px]: containerWidth=${metrics.containerWidth}px, left=${metrics.containerLeft}px, right=${metrics.containerRight}px, centered=${metrics.isCentered}, horizontalScroll=${metrics.hasHorizontalScroll}`);
    }

    // 2. Inspect Counsellor page across 4 viewports
    for (const vp of viewports) {
      console.log(`Testing Counsellor Page at ${vp.name}px...`);
      const metrics = await capturePage(
        `http://localhost:${PORT}/join-counsellor.htm`,
        vp,
        `0${viewports.indexOf(vp) + 5}-join-counsellor-${vp.name}.png`
      );
      results.counsellorLayout[vp.name] = metrics;
      console.log(`Counsellor [${vp.name}px]: containerWidth=${metrics.containerWidth}px, left=${metrics.containerLeft}px, right=${metrics.containerRight}px, centered=${metrics.isCentered}, horizontalScroll=${metrics.hasHorizontalScroll}`);
    }

    // 3. Test functional interactions on Doctor Page
    console.log('Testing Functional Interactions on Doctor Page...');
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/join-doctor.htm` });
    await new Promise(r => setTimeout(r, 1000));

    // Test WhatsApp sync
    const waSyncRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const mob = document.getElementById('spMobile');
        const wa = document.getElementById('spWhatsapp');
        const chk = document.getElementById('spSameAsMobile');
        mob.value = '+91 98765 43210';
        chk.click();
        return { waValue: wa.value, isReadOnly: wa.readOnly };
      })()`,
      returnByValue: true
    });
    results.functionalTests.whatsappSync = waSyncRes.result.value;

    // Test Dynamic Qualification Repeater
    const addQualRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const addBtn = document.getElementById('spAddQualBtn');
        addBtn.click();
        const cards = document.querySelectorAll('#spAdditionalQualsContainer .sp-qual-card');
        return { count: cards.length };
      })()`,
      returnByValue: true
    });
    results.functionalTests.dynamicQualRepeater = addQualRes.result.value;

    // Fill form and open Review Modal
    const reviewModalRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        document.getElementById('spFirstName').value = 'Aarav';
        document.getElementById('spLastName').value = 'Mehta';
        document.getElementById('spGender').value = 'Male';
        document.getElementById('spDob').value = '1985-06-15';
        document.getElementById('spEmail').value = 'dr.aarav.mehta@clinic.org';
        document.getElementById('spPracticeStatus').value = 'Private Independent Practice';
        document.getElementById('spExperienceYears').value = '8–12 Years';
        document.getElementById('spInstitutionName').value = 'Mehta Intimate Care & Wellness';
        document.getElementById('spSpecialisation').value = 'Clinical Sexology & Intimate Health';
        document.getElementById('spObjective').value = 'Committed to evidence-based confidential sexual health care and couple guidance.';
        document.getElementById('spPrimaryQual').value = 'MBBS';
        document.getElementById('spPrimaryYear').value = '2009';
        document.getElementById('spPrimaryCollege').value = 'KEM Hospital & Seth GS Medical College';
        document.getElementById('spPrimaryGrade').value = 'First Class Distinction';
        document.getElementById('spCouncilSelect').value = 'Maharashtra Medical Council (MMC)';
        document.getElementById('spRegNum').value = 'MMC-2009-04-1234';
        document.getElementById('spRegState').value = 'Maharashtra';
        document.getElementById('spRegYear').value = '2009';
        document.getElementById('spRegValid').value = '31/12/2029';
        document.getElementById('spWorkMode').value = 'Both Online & In-Person';
        document.getElementById('spTimeFrom').value = '09:00';
        document.getElementById('spTimeTo').value = '17:00';
        document.getElementById('spDeclarationCheck').checked = true;
        document.getElementById('spSignName').value = 'Dr. Aarav Mehta';
        document.getElementById('spTypedSignature').value = 'Dr. Aarav Mehta';

        // Trigger file attachments
        const photoInput = document.getElementById('spPhotoInput');
        const dt = new DataTransfer();
        dt.items.add(new File(['fake photo'], 'dr-aarav-photo.jpg', { type: 'image/jpeg' }));
        photoInput.files = dt.files;
        photoInput.dispatchEvent(new Event('change', { bubbles: true }));

        const certInput = document.getElementById('spPrimaryCertInput');
        const dtCert = new DataTransfer();
        dtCert.items.add(new File(['fake cert'], 'mbbs-degree-certificate.pdf', { type: 'application/pdf' }));
        certInput.files = dtCert.files;
        certInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Submit form
        const form = document.getElementById('spJoinAppForm');
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        const modal = document.getElementById('spReviewModal');
        const reviewBody = document.getElementById('spReviewBody');
        return {
          modalDisplay: modal ? window.getComputedStyle(modal).display : 'none',
          bodyLength: reviewBody ? reviewBody.innerHTML.length : 0
        };
      })()`,
      returnByValue: true
    });
    results.functionalTests.reviewModal = reviewModalRes.result.value;

    // Capture screenshot of review modal
    await new Promise(r => setTimeout(r, 600));
    const modalShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '09-join-doctor-review-modal.png'), Buffer.from(modalShot.data, 'base64'));
    console.log('Saved screenshot: 09-join-doctor-review-modal.png');

    // 4. Test Counsellor Not Applicable Toggle
    console.log('Testing Counsellor Not Applicable Toggle...');
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/join-counsellor.htm` });
    await new Promise(r => setTimeout(r, 1000));
    const naTestRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const naCheck = document.getElementById('spNaRegCheck');
        const regInput = document.getElementById('spRegNum');
        const initialRequired = regInput.required;
        naCheck.click();
        const afterClickVal = regInput.value;
        const afterClickDisabled = regInput.disabled;
        return { initialRequired, afterClickVal, afterClickDisabled };
      })()`,
      returnByValue: true
    });
    results.functionalTests.counsellorNaToggle = naTestRes.result.value;

    console.log('\n=== ALL TESTS COMPLETE ===');
    console.log(JSON.stringify(results, null, 2));

    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'registration_ui_fix_verification.json'), JSON.stringify(results, null, 2), 'utf8');

    ws.close();
    chromeProcess.kill();
    server.close();
    process.exit(0);

  } catch (err) {
    console.error('Test error:', err);
    chromeProcess.kill();
    server.close();
    process.exit(1);
  }
}
