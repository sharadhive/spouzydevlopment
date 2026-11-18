const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5567;
const CDP_PORT = 9467;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-join-test-' + Date.now());

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
    if (p === '/') p = '/join-doctor.htm';
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

async function verifyForms() {
  let server, cp, client;
  const report = {
    timestamp: new Date().toISOString(),
    doctorPage: {},
    counsellorPage: {},
    checks: {}
  };

  try {
    server = await startStaticServer(HTTP_PORT);
    cp = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1440,1100'
    ]);

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

    if (!client) throw new Error('Could not connect to CDP');
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    // =========================================================================
    // PART A: DOCTOR REGISTRATION PAGE (join-doctor.htm)
    // =========================================================================
    console.log('\n========================================');
    console.log('Testing join-doctor.htm');
    console.log('========================================');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/join-doctor.htm` });
    await wait(1200);

    const docInspect = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const title = document.title;
        const h1 = document.querySelector('h1')?.textContent.trim();
        const roleAttr = document.getElementById('spJoinAppForm')?.getAttribute('data-role');
        const sectionsCount = document.querySelectorAll('.sp-reg-section-card').length;
        const sectionTitles = Array.from(document.querySelectorAll('.sp-reg-section-title')).map(s => s.textContent.trim());
        const primaryQualOptions = Array.from(document.querySelectorAll('#spPrimaryQual option')).map(o => o.value);
        const councilOptions = Array.from(document.querySelectorAll('#spCouncilSelect option')).map(o => o.value);
        const hasPhotoDropzone = !!document.getElementById('spPhotoDropzone');
        const hasSigCanvas = !!document.getElementById('spSigCanvas');
        const defaultDate = document.getElementById('spDeclDate')?.value;

        return {
          title,
          h1,
          roleAttr,
          sectionsCount,
          sectionTitles,
          primaryQualOptionsSample: primaryQualOptions.slice(0, 5),
          councilOptionsSample: councilOptions.slice(0, 5),
          hasPhotoDropzone,
          hasSigCanvas,
          defaultDate
        };
      })()`,
      returnByValue: true
    });
    console.log('Doctor Page Initial Inspection:', JSON.stringify(docInspect.result.value, null, 2));
    report.doctorPage.inspection = docInspect.result.value;

    // Capture Desktop Screenshot of Doctor page
    const docScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    const docScreenshotPath = path.join(ARTIFACT_DIR, '04-join-doctor-desktop.png');
    fs.writeFileSync(docScreenshotPath, Buffer.from(docScreenshot.data, 'base64'));
    console.log('Saved doctor page screenshot to', docScreenshotPath);

    // Test WhatsApp sync and additional qualification on Doctor form
    console.log('\nTesting form interactions on join-doctor.htm...');
    const docInteractions = await client.send('Runtime.evaluate', {
      expression: `(() => {
        // 1. Test WhatsApp sync
        const mobile = document.getElementById('spMobile');
        const wa = document.getElementById('spWhatsapp');
        const sameCheck = document.getElementById('spSameAsMobile');
        mobile.value = '+91 98200 12345';
        sameCheck.checked = true;
        sameCheck.dispatchEvent(new Event('change', { bubbles: true }));
        const waSyncedValue = wa.value;

        // 2. Test Additional Qualification Add
        const addBtn = document.getElementById('spAddQualBtn');
        addBtn.click();
        const addCardsCount = document.querySelectorAll('.sp-qual-card').length;

        // 3. Fill required fields to test validation and submission
        document.getElementById('spFirstName').value = 'Vikramaditya';
        document.getElementById('spLastName').value = 'Kulkarni';
        document.getElementById('spDob').value = '1982-05-14';
        document.getElementById('spEmail').value = 'dr.kulkarni@spouzy-clinic.com';
        document.getElementById('spInstitutionName').value = 'KEM Hospital & Private Andrology Clinic';
        document.getElementById('spSpecialisation').value = 'Andrology & Male Sexual Health';
        document.getElementById('spObjective').value = 'Collaborate on evidence-based male intimacy therapy and clinical consultations.';
        document.getElementById('spPrimaryCollege').value = 'Grant Government Medical College, Mumbai';
        document.getElementById('spPrimaryYear').value = '2006';
        document.getElementById('spPrimaryGrade').value = 'First Class with Distinction';
        document.getElementById('spRegNum').value = 'MMC/2006/04/1892';
        document.getElementById('spRegYear').value = '2006';
        document.getElementById('spRegValid').value = 'Permanent';
        document.getElementById('spDeclarationCheck').checked = true;
        document.getElementById('spTypedSignature').value = 'Dr. Vikramaditya Kulkarni';

        // Mock attached files in attachedFiles cache for testing
        const fileEvt = new Event('change', { bubbles: true });
        // Trigger photo preview
        const photoPreview = document.getElementById('spPhotoPreview');
        photoPreview.style.display = 'flex';
        photoPreview.querySelector('.sp-file-name').textContent = 'dr_kulkarni_headshot.jpg';
        photoPreview.querySelector('.sp-file-size').textContent = '1.4 MB';

        const certPreview = document.getElementById('spPrimaryCertPreview');
        certPreview.style.display = 'flex';
        certPreview.querySelector('.sp-file-name').textContent = 'mbbs_degree_certificate.pdf';
        certPreview.querySelector('.sp-file-size').textContent = '2.8 MB';

        // Set in-memory attachedFiles on form element
        // Directly trigger submit through form
        // To bypass file object check in test, let's create File objects or mock them
        const fakeFile1 = new File(['dummy photo'], 'dr_kulkarni_headshot.jpg', { type: 'image/jpeg' });
        const fakeFile2 = new File(['dummy cert'], 'mbbs_degree_certificate.pdf', { type: 'application/pdf' });

        const photoInput = document.getElementById('spPhotoInput');
        const dt1 = new DataTransfer();
        dt1.items.add(fakeFile1);
        photoInput.files = dt1.files;
        photoInput.dispatchEvent(new Event('change', { bubbles: true }));

        const certInput = document.getElementById('spPrimaryCertInput');
        const dt2 = new DataTransfer();
        dt2.items.add(fakeFile2);
        certInput.files = dt2.files;
        certInput.dispatchEvent(new Event('change', { bubbles: true }));

        return {
          waSyncedValue,
          addCardsCount,
          photoAttached: photoPreview.querySelector('.sp-file-name').textContent,
          certAttached: certPreview.querySelector('.sp-file-name').textContent
        };
      })()`,
      returnByValue: true
    });
    console.log('Doctor Interactions Result:', docInteractions.result.value);
    report.doctorPage.interactions = docInteractions.result.value;

    // Submit form and inspect review modal
    console.log('Submitting Doctor Form...');
    const docSubmitRes = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const submitBtn = document.getElementById('spRegSubmitBtn');
        submitBtn.click();

        const modal = document.getElementById('spReviewModal');
        const isModalVisible = modal && modal.style.display !== 'none';
        const reviewTitle = document.getElementById('spReviewTitle')?.textContent.trim();
        const reviewBodyText = document.getElementById('spReviewBody')?.textContent.trim();
        return { isModalVisible, reviewTitle, hasKulkarni: reviewBodyText.includes('Vikramaditya Kulkarni'), reviewBodySample: reviewBodyText.slice(0, 300) };
      })()`,
      returnByValue: true
    });
    console.log('Doctor Submit & Review Result:', docSubmitRes.result.value);
    report.doctorPage.submitResult = docSubmitRes.result.value;

    // Capture Review Modal Screenshot
    await wait(300);
    const docModalScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    const docModalScreenshotPath = path.join(ARTIFACT_DIR, '05-join-doctor-review-modal.png');
    fs.writeFileSync(docModalScreenshotPath, Buffer.from(docModalScreenshot.data, 'base64'));
    console.log('Saved doctor review modal screenshot to', docModalScreenshotPath);

    // =========================================================================
    // PART B: COUNSELLOR REGISTRATION PAGE (join-counsellor.htm)
    // =========================================================================
    console.log('\n========================================');
    console.log('Testing join-counsellor.htm');
    console.log('========================================');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/join-counsellor.htm` });
    await wait(1200);

    const counselInspect = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const title = document.title;
        const h1 = document.querySelector('h1')?.textContent.trim();
        const roleAttr = document.getElementById('spJoinAppForm')?.getAttribute('data-role');
        const sectionsCount = document.querySelectorAll('.sp-reg-section-card').length;
        const sectionTitles = Array.from(document.querySelectorAll('.sp-reg-section-title')).map(s => s.textContent.trim());
        const primaryQualOptions = Array.from(document.querySelectorAll('#spPrimaryQual option')).map(o => o.value);
        const hasNaRegCheck = !!document.getElementById('spNaRegCheck');
        const councilOptions = Array.from(document.querySelectorAll('#spCouncilSelect option')).map(o => o.value);

        return {
          title,
          h1,
          roleAttr,
          sectionsCount,
          sectionTitles,
          primaryQualOptionsSample: primaryQualOptions.slice(0, 5),
          hasNaRegCheck,
          councilOptionsSample: councilOptions.slice(0, 5)
        };
      })()`,
      returnByValue: true
    });
    console.log('Counsellor Page Initial Inspection:', JSON.stringify(counselInspect.result.value, null, 2));
    report.counsellorPage.inspection = counselInspect.result.value;

    // Capture Desktop Screenshot of Counsellor page
    const counselScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    const counselScreenshotPath = path.join(ARTIFACT_DIR, '06-join-counsellor-desktop.png');
    fs.writeFileSync(counselScreenshotPath, Buffer.from(counselScreenshot.data, 'base64'));
    console.log('Saved counsellor page screenshot to', counselScreenshotPath);

    // Test Counsellor "Not Applicable" Registration Checkbox
    console.log('\nTesting Counsellor Not Applicable Registration Toggle...');
    const naTestRes = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const naCheck = document.getElementById('spNaRegCheck');
        const regNumInput = document.getElementById('spRegNum');
        naCheck.checked = true;
        naCheck.dispatchEvent(new Event('change', { bubbles: true }));

        const isRegNumDisabled = regNumInput.disabled;
        const regNumVal = regNumInput.value;

        return { isRegNumDisabled, regNumVal };
      })()`,
      returnByValue: true
    });
    console.log('Not Applicable Toggle Result:', naTestRes.result.value);
    report.counsellorPage.naToggle = naTestRes.result.value;

    // Test Mobile Viewport for Counsellor Page (390px)
    console.log('\nTesting Mobile Viewport (390px) on join-counsellor.htm...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(500);

    const mobileScreenshot = await client.send('Page.captureScreenshot', { format: 'png' });
    const mobileScreenshotPath = path.join(ARTIFACT_DIR, '07-join-counsellor-mobile.png');
    fs.writeFileSync(mobileScreenshotPath, Buffer.from(mobileScreenshot.data, 'base64'));
    console.log('Saved counsellor mobile screenshot to', mobileScreenshotPath);

    // =========================================================================
    // PART C: NAVIGATION LINK VERIFICATION
    // =========================================================================
    console.log('\nVerifying "Join Our Team" navigation links sitewide...');
    const navLinksCheck = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const links = Array.from(document.querySelectorAll('a[href*="join-"]')).map(a => ({
          href: a.getAttribute('href'),
          text: a.textContent.trim()
        }));
        return links;
      })()`,
      returnByValue: true
    });
    console.log('Join Links:', navLinksCheck.result.value);
    report.navLinks = navLinksCheck.result.value;

    // Overall Verification Checks
    report.checks = {
      doctorPageTitleCorrect: docInspect.result.value.title.includes('Doctor'),
      doctorHeadingCorrect: docInspect.result.value.h1 === 'Join SPOUZY as a Doctor',
      doctorRoleFixed: docInspect.result.value.roleAttr === 'doctor',
      doctorHasMedicalQuals: docInspect.result.value.primaryQualOptionsSample.includes('MBBS'),
      doctorHasAll6Sections: docInspect.result.value.sectionsCount === 6,
      counsellorPageTitleCorrect: counselInspect.result.value.title.includes('Counsellor'),
      counsellorHeadingCorrect: counselInspect.result.value.h1 === 'Join SPOUZY as a Counsellor',
      counsellorRoleFixed: counselInspect.result.value.roleAttr === 'counsellor',
      counsellorHasPsychQuals: counselInspect.result.value.primaryQualOptionsSample.some(q => q.includes('Psychology')),
      counsellorHasNaRegOption: counselInspect.result.value.hasNaRegCheck,
      counsellorHasAll6Sections: counselInspect.result.value.sectionsCount === 6,
      sameAsMobileSyncWorks: docInteractions.result.value.waSyncedValue === '+91 98200 12345',
      doctorReviewModalWorks: docSubmitRes.result.value.isModalVisible,
      counsellorNaToggleWorks: naTestRes.result.value.isRegNumDisabled && naTestRes.result.value.regNumVal === 'Not Applicable'
    };

    const allPassed = Object.values(report.checks).every(Boolean);
    report.allPassed = allPassed;
    console.log('\n========================================');
    console.log('ALL REGISTRATION CHECKS PASSED?', allPassed);
    console.log('========================================');

    const reportPath = path.join(ARTIFACT_DIR, 'verification_doctor_counsellor_forms_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('Saved JSON report to', reportPath);

    client.close();
  } catch(err) {
    console.error('Error during verification:', err);
  } finally {
    if (cp) cp.kill();
    if (server) server.close();
  }
}

verifyForms();
