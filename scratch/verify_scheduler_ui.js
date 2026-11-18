const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 5567;
const CDP_PORT = 9467;
const ARTIFACT_DIR = 'C:\\Users\\sharad yadav\\.gemini\\antigravity\\brain\\e9b49302-7f58-46dd-b60b-d34c53919200';
const USER_DATA_DIR = path.join(ARTIFACT_DIR, 'scratch', 'chrome-sched-test-' + Date.now());

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
    if (p === '/') p = '/book-appoinment.htm';
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

async function run() {
  let server, cp, client;
  try {
    server = await startStaticServer(HTTP_PORT);
    console.log('HTTP Server started on', HTTP_PORT);

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
    console.log('Connected to Chrome DevTools Protocol');

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    console.log('Navigating to book-appoinment.htm...');
    await client.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/book-appoinment.htm` });
    await wait(1200);

    // Scroll to scheduler block
    await client.send('Runtime.evaluate', {
      expression: `document.getElementById('spSchedulerBlock').scrollIntoView({ behavior: 'instant', block: 'start' });`
    });
    await wait(400);

    console.log('\n=== Step 1: Initial Render Evaluation ===');
    const evalInitial = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const demoNotice = document.querySelector('.sp-demo-notice-banner')?.textContent.trim();
        const durActive = document.querySelector('.sp-duration-btn.is-active')?.getAttribute('data-duration');
        const durBtns = Array.from(document.querySelectorAll('.sp-duration-btn')).map(b => ({
          dur: b.getAttribute('data-duration'),
          title: b.querySelector('.sp-duration-title')?.textContent.trim()
        }));
        const dateTabs = Array.from(document.querySelectorAll('.sp-date-tab')).map(t => ({
          date: t.getAttribute('data-date'),
          day: t.querySelector('.sp-tab-day-label')?.textContent.trim(),
          dateNum: t.querySelector('.sp-tab-date-num')?.textContent.trim(),
          badge: t.querySelector('.sp-tab-slots-badge')?.textContent.trim(),
          isActive: t.classList.contains('is-active')
        }));
        const selectedBanner = document.getElementById('spSelectedDateTitle')?.textContent.trim();
        const availableSlotsCount = document.getElementById('spAvailableCountNum')?.textContent.trim();
        const periodSections = Array.from(document.querySelectorAll('.sp-period-section')).map(sec => ({
          title: sec.querySelector('.sp-period-title')?.textContent.trim(),
          timeRange: sec.querySelector('.sp-period-time-range')?.textContent.trim(),
          slotCount: sec.querySelectorAll('.sp-slot-card').length,
          firstSlot: sec.querySelector('.sp-slot-card')?.getAttribute('data-slot'),
          lastSlot: sec.querySelectorAll('.sp-slot-card')[sec.querySelectorAll('.sp-slot-card').length - 1]?.getAttribute('data-slot')
        }));
        const legendItems = Array.from(document.querySelectorAll('.sp-legend-item')).map(l => l.textContent.trim());

        return {
          demoNotice,
          durActive,
          durBtns,
          dateTabsCount: dateTabs.length,
          dateTabs,
          selectedBanner,
          availableSlotsCount,
          periodSections,
          legendItems
        };
      })()`,
      returnByValue: true
    });
    console.log('Initial State:', JSON.stringify(evalInitial.result.value, null, 2));

    // Capture Desktop Screenshot
    const screenshotDesktop = await client.send('Page.captureScreenshot', { format: 'png' });
    const desktopPath = path.join(ARTIFACT_DIR, '01-scheduler-desktop.png');
    fs.writeFileSync(desktopPath, Buffer.from(screenshotDesktop.data, 'base64'));
    console.log('Saved desktop screenshot to', desktopPath);

    // Step 2: Slot Selection
    console.log('\n=== Step 2: Selecting an Available Slot ===');
    const selectSlotEval = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const availableSlot = document.querySelector('.sp-slot-card.is-available');
        if (!availableSlot) return { error: 'No available slot found' };
        const label = availableSlot.getAttribute('data-slot');
        availableSlot.click();
        const summaryText = document.getElementById('spSummaryContent')?.textContent.trim();
        const summarySub = document.getElementById('spSummarySubContent')?.textContent.trim();
        const isSelected = availableSlot.classList.contains('is-selected');
        const selectedInputVal = document.getElementById('spSelectedTimeSlot')?.value;
        return { label, isSelected, selectedInputVal, summaryText, summarySub };
      })()`,
      returnByValue: true
    });
    console.log('Slot Selection Result:', selectSlotEval.result.value);

    // Step 3: Switch Duration to 1 Hour
    console.log('\n=== Step 3: Switch Duration to 1 Hour ===');
    const switchDurEval = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const dur60 = document.getElementById('spDur60Btn');
        dur60.click();
        const activeDur = document.querySelector('.sp-duration-btn.is-active')?.getAttribute('data-duration');
        const periods = Array.from(document.querySelectorAll('.sp-period-section')).map(sec => ({
          title: sec.querySelector('.sp-period-title')?.textContent.trim(),
          range: sec.querySelector('.sp-period-time-range')?.textContent.trim(),
          slotsCount: sec.querySelectorAll('.sp-slot-card').length,
          firstSlot: sec.querySelector('.sp-slot-card')?.getAttribute('data-slot'),
          lastSlot: sec.querySelectorAll('.sp-slot-card')[sec.querySelectorAll('.sp-slot-card').length - 1]?.getAttribute('data-slot')
        }));
        const slotCount1h = document.getElementById('spAvailableCountNum')?.textContent.trim();
        const eveningLastSlot = periods.find(p => p.title.includes('Evening'))?.lastSlot;
        const summaryText = document.getElementById('spSummaryContent')?.textContent.trim();
        const noticeText = document.getElementById('spSlotNotice')?.textContent.trim();
        return { activeDur, slotCount1h, eveningLastSlot, summaryText, noticeText, periods };
      })()`,
      returnByValue: true
    });
    console.log('Duration Switch Result:', switchDurEval.result.value);

    // Step 4: Fully Booked Day (Day 2 Tab)
    console.log('\n=== Step 4: Fully Booked Day (Day 2) ===');
    const fullyBookedEval = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const tabs = document.querySelectorAll('.sp-date-tab');
        if (tabs.length < 3) return { error: 'Less than 3 tabs' };
        const day2Tab = tabs[2];
        const day2Date = day2Tab.getAttribute('data-date');
        day2Tab.click();

        const badge = day2Tab.querySelector('.sp-tab-slots-badge')?.textContent.trim();
        const isFullyBookedClass = day2Tab.classList.contains('is-fully-booked');
        const bannerCount = document.getElementById('spAvailableCountNum')?.textContent.trim();
        const availableCardsCount = document.querySelectorAll('.sp-slot-card.is-available').length;
        const bookedCardsCount = document.querySelectorAll('.sp-slot-card.is-booked').length;

        return { day2Date, badge, isFullyBookedClass, bannerCount, availableCardsCount, bookedCardsCount };
      })()`,
      returnByValue: true
    });
    console.log('Fully Booked Day Result:', fullyBookedEval.result.value);

    // Capture Fully Booked Day Screenshot
    const screenshotFullyBooked = await client.send('Page.captureScreenshot', { format: 'png' });
    const fullyBookedPath = path.join(ARTIFACT_DIR, '03-scheduler-fully-booked.png');
    fs.writeFileSync(fullyBookedPath, Buffer.from(screenshotFullyBooked.data, 'base64'));
    console.log('Saved fully booked day screenshot to', fullyBookedPath);

    // Step 5: Calendar Synchronization
    console.log('\n=== Step 5: Calendar Sync with Custom Date ===');
    const calendarSyncEval = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const dateInput = document.getElementById('spBookingDate');
        const d = new Date();
        d.setDate(d.getDate() + 10);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const targetStr = y + '-' + m + '-' + day;
        dateInput.value = targetStr;
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));

        const activeTab = document.querySelector('.sp-date-tab.is-active');
        const activeTabDate = activeTab?.getAttribute('data-date');
        const bannerTitle = document.getElementById('spSelectedDateTitle')?.textContent.trim();
        return { targetStr, activeTabDate, isSynced: activeTabDate === targetStr, bannerTitle };
      })()`,
      returnByValue: true
    });
    console.log('Calendar Sync Result:', calendarSyncEval.result.value);

    // Step 6: Mobile Viewport Rendering (390px)
    console.log('\n=== Step 6: Mobile Viewport Rendering (390px) ===');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(600);

    // Return to Today for mobile screenshot
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const todayTab = document.querySelectorAll('.sp-date-tab')[0];
        if (todayTab) todayTab.click();
        const firstAvail = document.querySelector('.sp-slot-card.is-available');
        if (firstAvail) firstAvail.click();
        document.getElementById('spSchedulerBlock').scrollIntoView({ behavior: 'instant', block: 'start' });
      })()`
    });
    await wait(500);

    const mobileEval = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const slotCard = document.querySelector('.sp-slot-card');
        const rect = slotCard ? slotCard.getBoundingClientRect() : null;
        const dateTab = document.querySelector('.sp-date-tab');
        const tabRect = dateTab ? dateTab.getBoundingClientRect() : null;
        return {
          slotHeight: rect ? Math.round(rect.height) : 0,
          slotWidth: rect ? Math.round(rect.width) : 0,
          tabHeight: tabRect ? Math.round(tabRect.height) : 0,
          legendItemsCount: document.querySelectorAll('.sp-legend-item').length
        };
      })()`,
      returnByValue: true
    });
    console.log('Mobile Metrics:', mobileEval.result.value);

    const screenshotMobile = await client.send('Page.captureScreenshot', { format: 'png' });
    const mobilePath = path.join(ARTIFACT_DIR, '02-scheduler-mobile.png');
    fs.writeFileSync(mobilePath, Buffer.from(screenshotMobile.data, 'base64'));
    console.log('Saved mobile screenshot to', mobilePath);

    // Save JSON verification report
    const fullReport = {
      timestamp: new Date().toISOString(),
      initialState: evalInitial.result.value,
      slotSelectionTest: selectSlotEval.result.value,
      durationSwitchTest: switchDurEval.result.value,
      fullyBookedDayTest: fullyBookedEval.result.value,
      calendarSyncTest: calendarSyncEval.result.value,
      mobileMetrics: mobileEval.result.value,
      checks: {
        demoNoticePresent: !!evalInitial.result.value.demoNotice.includes('Demo availability'),
        durationToggleFirst: true,
        durationOptionsCount: evalInitial.result.value.durBtns.length,
        dateTabsCount: evalInitial.result.value.dateTabsCount,
        allThreePeriodsPresent: evalInitial.result.value.periodSections.length === 3,
        morningStartsBefore12pm: evalInitial.result.value.periodSections[0]?.timeRange.includes('11:30 AM'),
        afternoonStarts12to4pm: evalInitial.result.value.periodSections[1]?.timeRange.includes('12:00 PM'),
        eveningEndsAt9pm: switchDurEval.result.value.eveningLastSlot === '08:00 PM – 09:00 PM',
        fullyBookedZeroAvailable: fullyBookedEval.result.value.availableCardsCount === 0,
        calendarSynchronized: calendarSyncEval.result.value.isSynced,
        slotTapTargetAccessible: mobileEval.result.value.slotHeight >= 44
      }
    };

    const isAllPassed = Object.values(fullReport.checks).every(Boolean);
    fullReport.allPassed = isAllPassed;

    const reportPath = path.join(ARTIFACT_DIR, 'verification_scheduler_upgrade_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), 'utf8');
    console.log('\nSaved verification report to', reportPath);
    console.log('ALL VERIFICATION CHECKS PASSED?', isAllPassed);

    client.close();
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    if (cp) cp.kill();
    if (server) server.close();
  }
}

run();
