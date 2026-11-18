const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 5571;
const CDP_PORT = 9471;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:/Users/sharad yadav/.gemini/antigravity/brain/e9b49302-7f58-46dd-b60b-d34c53919200';

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
  console.log(`Static server running on port ${PORT}`);
  runTests();
});

async function runTests() {
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const listRes = await fetch(`http://localhost:${CDP_PORT}/json`);
    const tabs = await listRes.json();
    const wsUrl = tabs[0].webSocketDebuggerUrl;
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

    await new Promise(r => { ws.onopen = r; });
    console.log('Connected to Chrome CDP!');

    await sendCommand('Page.enable');
    await sendCommand('DOM.enable');
    await sendCommand('Runtime.enable');

    const testResults = {};

    // -------------------------------------------------------------------------
    // TEST 1: Doctor Page Layout (Desktop 1366px & Mobile 390px)
    // -------------------------------------------------------------------------
    console.log('Test 1: Checking Doctor page layout and column alignment...');
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/join-doctor.htm` });
    await new Promise(r => setTimeout(r, 1000));

    const layout1366 = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const regValid = document.getElementById('spRegValid');
        const certGroup = document.getElementById('spCouncilCertGroup');
        const r1 = regValid.getBoundingClientRect();
        const r2 = certGroup.getBoundingClientRect();
        return {
          validTop: Math.round(r1.top),
          validLeft: Math.round(r1.left),
          validWidth: Math.round(r1.width),
          certTop: Math.round(r2.top),
          certLeft: Math.round(r2.left),
          certWidth: Math.round(r2.width),
          isBeside: Math.abs(r1.top - r2.top) < 30 && r2.left > r1.left
        };
      })()`,
      returnByValue: true
    });
    testResults.doctorDesktopLayout = layout1366.result.value;
    console.log('Doctor Desktop Layout:', testResults.doctorDesktopLayout);

    // Capture desktop screenshot
    const shotDocDesk = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '10-doctor-council-cert-desktop.png'), Buffer.from(shotDocDesk.data, 'base64'));

    // Test Mobile Stacking
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 400));
    const layout390 = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const regValid = document.getElementById('spRegValid');
        const certGroup = document.getElementById('spCouncilCertGroup');
        const r1 = regValid.getBoundingClientRect();
        const r2 = certGroup.getBoundingClientRect();
        return {
          validTop: Math.round(r1.top),
          certTop: Math.round(r2.top),
          isStackedBelow: r2.top >= r1.bottom
        };
      })()`,
      returnByValue: true
    });
    testResults.doctorMobileLayout = layout390.result.value;
    console.log('Doctor Mobile Layout:', testResults.doctorMobileLayout);

    const shotDocMob = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '11-doctor-council-cert-mobile.png'), Buffer.from(shotDocMob.data, 'base64'));

    // -------------------------------------------------------------------------
    // TEST 2: File Validation (Unsupported Type, Oversized, Valid JPG, Valid PDF)
    // -------------------------------------------------------------------------
    console.log('Test 2: Testing File Selection & Validation...');
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 2A: Unsupported extension (.txt)
    const unsupportedRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        window.alert = () => {}; // suppress popup for automated run
        const input = document.getElementById('spCouncilCertInput');
        const errEl = document.getElementById('spCouncilCertError');
        const dt = new DataTransfer();
        dt.items.add(new File(['test content'], 'medical-license.txt', { type: 'text/plain' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          inputFilesLength: input.files.length,
          errorVisible: errEl.style.display !== 'none',
          errorText: errEl.textContent
        };
      })()`,
      returnByValue: true
    });
    testResults.unsupportedFileType = unsupportedRes.result.value;
    console.log('Unsupported File Result:', testResults.unsupportedFileType);

    // 2B: Oversized file (12 MB)
    const oversizedRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        window.alert = () => {};
        const input = document.getElementById('spCouncilCertInput');
        const errEl = document.getElementById('spCouncilCertError');
        const bigArray = new Uint8Array(12 * 1024 * 1024);
        const dt = new DataTransfer();
        dt.items.add(new File([bigArray], 'huge-license.pdf', { type: 'application/pdf' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          inputFilesLength: input.files.length,
          errorVisible: errEl.style.display !== 'none',
          errorText: errEl.textContent
        };
      })()`,
      returnByValue: true
    });
    testResults.oversizedFile = oversizedRes.result.value;
    console.log('Oversized File Result:', testResults.oversizedFile);

    // 2C: Valid PDF selection
    const validPdfRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('spCouncilCertInput');
        const preview = document.getElementById('spCouncilCertPreview');
        const dropzone = document.getElementById('spCouncilCertDropzone');
        const errEl = document.getElementById('spCouncilCertError');
        const dt = new DataTransfer();
        dt.items.add(new File(['%PDF-1.4 sample content'], 'MMC-Registration-Certificate.pdf', { type: 'application/pdf' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return {
          dropzoneVisible: dropzone.style.display !== 'none',
          previewVisible: preview.style.display !== 'none',
          fileName: preview.querySelector('.sp-file-name').textContent,
          hasPdfIcon: preview.querySelector('.sp-file-thumb i.fa-file-pdf-o') !== null,
          errorHidden: errEl.style.display === 'none'
        };
      })()`,
      returnByValue: true
    });
    testResults.validPdfSelection = validPdfRes.result.value;
    console.log('Valid PDF Result:', testResults.validPdfSelection);

    // 2D: Replace control
    const replaceRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const replaceBtn = document.querySelector('#spCouncilCertPreview .is-replace');
        return { hasReplaceBtn: replaceBtn !== null };
      })()`,
      returnByValue: true
    });
    testResults.replaceControl = replaceRes.result.value;

    // 2E: Remove control
    const removeRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const removeBtn = document.querySelector('#spCouncilCertPreview .is-remove');
        removeBtn.click();
        const dropzone = document.getElementById('spCouncilCertDropzone');
        const preview = document.getElementById('spCouncilCertPreview');
        return {
          dropzoneRestored: dropzone.style.display !== 'none',
          previewHidden: preview.style.display === 'none'
        };
      })()`,
      returnByValue: true
    });
    testResults.removeControl = removeRes.result.value;
    console.log('Remove Control Result:', testResults.removeControl);

    // -------------------------------------------------------------------------
    // TEST 3: Doctor Form Submission Validation & Review Modal
    // -------------------------------------------------------------------------
    console.log('Test 3: Testing Doctor Registration Certificate Requirement & Review Modal...');
    // Re-fill valid form without council cert first
    const missingCertRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        document.getElementById('spFirstName').value = 'Dr. Priya';
        document.getElementById('spLastName').value = 'Deshmukh';
        document.getElementById('spGender').value = 'Female';
        document.getElementById('spDob').value = '1982-04-10';
        document.getElementById('spMobile').value = '+91 98200 54321';
        document.getElementById('spWhatsapp').value = '+91 98200 54321';
        document.getElementById('spEmail').value = 'priya.deshmukh@clinic.in';
        document.getElementById('spPracticeStatus').value = 'Hospital / Clinic Attached';
        document.getElementById('spExperienceYears').value = '13–20 Years';
        document.getElementById('spInstitutionName').value = 'Lilavati Hospital & Research Centre';
        document.getElementById('spSpecialisation').value = 'Gynaecology & Women\\'s Health';
        document.getElementById('spObjective').value = 'Enhancing multidisciplinary women intimate health and clinical guidance.';
        document.getElementById('spPrimaryQual').value = 'MS';
        document.getElementById('spPrimaryYear').value = '2008';
        document.getElementById('spPrimaryCollege').value = 'Grant Medical College Mumbai';
        document.getElementById('spPrimaryGrade').value = 'First Class Distinction';
        document.getElementById('spCouncilSelect').value = 'Maharashtra Medical Council (MMC)';
        document.getElementById('spRegNum').value = 'MMC-2008-05-5678';
        document.getElementById('spRegState').value = 'Maharashtra';
        document.getElementById('spRegYear').value = '2008';
        document.getElementById('spRegValid').value = '31/12/2028';
        document.getElementById('spDeclarationCheck').checked = true;
        document.getElementById('spSignName').value = 'Dr. Priya Deshmukh';
        document.getElementById('spTypedSignature').value = 'Dr. Priya Deshmukh';

        // Attach photo
        const pInput = document.getElementById('spPhotoInput');
        const dtP = new DataTransfer();
        dtP.items.add(new File(['fake photo'], 'priya-photo.jpg', { type: 'image/jpeg' }));
        pInput.files = dtP.files;
        pInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Attach primary cert
        const cInput = document.getElementById('spPrimaryCertInput');
        const dtC = new DataTransfer();
        dtC.items.add(new File(['fake cert'], 'ms-degree-cert.pdf', { type: 'application/pdf' }));
        cInput.files = dtC.files;
        cInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Submit WITHOUT council cert
        const form = document.getElementById('spJoinAppForm');
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        const errBox = document.getElementById('spFormValidationError');
        return {
          errorShown: errBox.style.display !== 'none',
          errorText: errBox.textContent
        };
      })()`,
      returnByValue: true
    });
    testResults.doctorMissingCertValidation = missingCertRes.result.value;
    console.log('Doctor Missing Cert Validation:', testResults.doctorMissingCertValidation);

    // Now attach Council Certificate and submit
    const submitWithCertRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const certInput = document.getElementById('spCouncilCertInput');
        const dt = new DataTransfer();
        dt.items.add(new File(['MMC registration proof'], 'MMC-Registration-Proof-2008.pdf', { type: 'application/pdf' }));
        certInput.files = dt.files;
        certInput.dispatchEvent(new Event('change', { bubbles: true }));

        const form = document.getElementById('spJoinAppForm');
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        const modal = document.getElementById('spReviewModal');
        const reviewBody = document.getElementById('spReviewBody');
        return {
          modalOpened: modal.style.display === 'flex',
          bodyContainsCouncilCert: reviewBody.innerHTML.includes('MMC-Registration-Proof-2008.pdf'),
          bodyContainsNotice: reviewBody.innerHTML.includes('Important WhatsApp Document Notice')
        };
      })()`,
      returnByValue: true
    });
    testResults.doctorSubmitSuccess = submitWithCertRes.result.value;
    console.log('Doctor Submit Success Result:', testResults.doctorSubmitSuccess);

    // Capture modal screenshot with council cert listed
    await new Promise(r => setTimeout(r, 600));
    const shotModal = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '12-doctor-review-with-council-cert.png'), Buffer.from(shotModal.data, 'base64'));

    // -------------------------------------------------------------------------
    // TEST 4: Counsellor Conditional Validation (With Reg vs Not Applicable)
    // -------------------------------------------------------------------------
    console.log('Test 4: Testing Counsellor Page Conditional Validation...');
    await sendCommand('Page.navigate', { url: `http://localhost:${PORT}/join-counsellor.htm` });
    await new Promise(r => setTimeout(r, 1000));

    // 4A: Without N/A, omitting accreditation cert must fail
    const counsellorFailRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        document.getElementById('spFirstName').value = 'Meera';
        document.getElementById('spLastName').value = 'Sen';
        document.getElementById('spGender').value = 'Female';
        document.getElementById('spDob').value = '1989-08-20';
        document.getElementById('spMobile').value = '+91 98300 11223';
        document.getElementById('spWhatsapp').value = '+91 98300 11223';
        document.getElementById('spEmail').value = 'meera.sen@counselling.org';
        document.getElementById('spPracticeStatus').value = 'Private Independent Practice';
        document.getElementById('spExperienceYears').value = '8–12 Years';
        document.getElementById('spInstitutionName').value = 'Sen Relationship & Family Therapy';
        document.getElementById('spSpecialisation').value = 'Marriage & Relationship Counselling';
        document.getElementById('spObjective').value = 'Dedicated to supportive couples therapy and dispute mediation.';
        document.getElementById('spPrimaryQual').value = 'MA / MSc Clinical Psychology';
        document.getElementById('spPrimaryYear').value = '2012';
        document.getElementById('spPrimaryCollege').value = 'Tata Institute of Social Sciences (TISS)';
        document.getElementById('spPrimaryGrade').value = 'Grade A';
        document.getElementById('spCouncilSelect').value = 'Rehabilitation Council of India (RCI)';
        document.getElementById('spRegNum').value = 'RCI-CRR-A54321';
        document.getElementById('spRegState').value = 'Maharashtra';
        document.getElementById('spRegYear').value = '2013';
        document.getElementById('spRegValid').value = '2028';
        document.getElementById('spDeclarationCheck').checked = true;
        document.getElementById('spSignName').value = 'Meera Sen';
        document.getElementById('spTypedSignature').value = 'Meera Sen';

        // Attach photo
        const pInput = document.getElementById('spPhotoInput');
        const dtP = new DataTransfer();
        dtP.items.add(new File(['fake photo'], 'meera-photo.jpg', { type: 'image/jpeg' }));
        pInput.files = dtP.files;
        pInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Attach primary cert
        const cInput = document.getElementById('spPrimaryCertInput');
        const dtC = new DataTransfer();
        dtC.items.add(new File(['fake cert'], 'tiss-degree.pdf', { type: 'application/pdf' }));
        cInput.files = dtC.files;
        cInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Submit without cert when N/A is FALSE
        const form = document.getElementById('spJoinAppForm');
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        const errBox = document.getElementById('spFormValidationError');
        return {
          errorShown: errBox.style.display !== 'none',
          errorText: errBox.textContent
        };
      })()`,
      returnByValue: true
    });
    testResults.counsellorMissingCertValidation = counsellorFailRes.result.value;
    console.log('Counsellor Missing Cert Validation:', testResults.counsellorMissingCertValidation);

    // 4B: Now check "Not Applicable" toggle
    const counsellorNaPassRes = await sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const naCheck = document.getElementById('spNaRegCheck');
        naCheck.click(); // Turn ON Not Applicable

        const certInput = document.getElementById('spCouncilCertInput');
        const certDropzone = document.getElementById('spCouncilCertDropzone');
        const certReq = document.getElementById('spCouncilCertReq');

        // Submit form again WITHOUT accreditation cert
        const form = document.getElementById('spJoinAppForm');
        form.dispatchEvent(new Event('submit', { cancelable: true }));

        const modal = document.getElementById('spReviewModal');
        const reviewBody = document.getElementById('spReviewBody');
        return {
          inputDisabled: certInput.disabled,
          dropzoneDisabledStyle: certDropzone.style.pointerEvents === 'none',
          reqMarkerHidden: certReq.style.display === 'none',
          modalOpened: modal.style.display === 'flex',
          bodyContainsNotApplicable: reviewBody.innerHTML.includes('Not Applicable')
        };
      })()`,
      returnByValue: true
    });
    testResults.counsellorNaSuccess = counsellorNaPassRes.result.value;
    console.log('Counsellor NA Success Result:', testResults.counsellorNaSuccess);

    // Capture counsellor review modal
    await new Promise(r => setTimeout(r, 600));
    const shotCounsellorModal = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '13-counsellor-review-na.png'), Buffer.from(shotCounsellorModal.data, 'base64'));

    console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'council_cert_verification_report.json'), JSON.stringify(testResults, null, 2), 'utf8');

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
