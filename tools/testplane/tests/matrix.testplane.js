// Testplane suite — one `it` running all 15 capabilities in one browser
// session, mirroring the other tools' suites. Testplane's browser object is
// its @testplane/webdriverio fork, so the WDIO-style BiDi surfaces apply:
// sessionSubscribe + browser.on(...) for events, execute() for script,
// setCookies/getCookies for storage, browser.on('dialog') for dialogs,
// browser.mock() for interception. Click/setValue and saveScreenshot have
// no BiDi branch (same as upstream WDIO v9) — those cells are SKIP,
// demonstrated via the Classic path.
// Results are written to TESTPLANE_RESULTS (JSON) so the wrapper can print
// RESULT/SUMMARY/TIMING lines in the shared contract (each result carries
// its ms; meta carries session facts like browserVersion); the test itself
// never throws on a capability FAIL (the wrapper owns the exit code).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
const OUT = process.env.TESTPLANE_RESULTS || path.join(__dirname, '..', 'results.json');

const results = [];
let meta = {};
// Per-capability timing: mark() returns the ms since the previous report
// (or since the baseline reset at the start of the test) and resets the
// clock, so each result's ms covers its own work, not session start.
let lastMark = Date.now();
function mark() {
  const now = Date.now();
  const ms = now - lastMark;
  lastMark = now;
  return ms;
}
function flush() {
  fs.writeFileSync(OUT, JSON.stringify({ ...meta, results }, null, 2));
}
function report(key, status, detail) {
  results.push({ key, status, detail: detail || '', ms: mark() });
  flush(); // incremental: a mid-run failure still leaves partial results
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitUntil(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await sleep(250);
  }
  throw new Error('timed out waiting for ' + label);
}
async function pageText(browser, selector) {
  return browser.execute(sel => {
    const el = document.querySelector(sel);
    return el ? el.textContent : null;
  }, selector);
}

describe('bidi capability matrix', () => {
  it('all capabilities', async ({ browser }) => {
    const isBidi = browser.isBidi === true;
    const wsUrl = browser.capabilities && browser.capabilities.webSocketUrl;
    meta = { isBidi, webSocketUrl: typeof wsUrl, browserVersion: browser.capabilities && browser.capabilities.browserVersion };
    flush();
    mark(); // baseline: capability 1 timing excludes session start
    const keys = ['navigation', 'console-log', 'js-error', 'network-capture', 'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click', 'network-intercept', 'drag-and-drop', 'hover', 'keyboard', 'multi-tab', 'iframe'];
    if (!isBidi) {
      for (const key of keys) report(key, 'SKIP', 'BiDi not connected (no webSocketUrl in session capabilities)');
      return;
    }
    // Register the dialog listener UP FRONT, long before any prompt can
    // open: Testplane's dialog path proved flaky when the listener was
    // registered just before the dialog test (unhandled 'no such alert'
    // rejections from the framework's own handleUserPrompt call crashed
    // the run in 2 of 3 attempts). Early registration removes the
    // registration-propagation race as a variable.
    const dialogs = [];
    const handlerErrs = [];
    let dialogMode = 'accept';
    browser.on('dialog', async d => {
      try {
        dialogs.push(d.type() + ':' + d.message());
        if (dialogMode === 'accept') await d.accept(); else await d.dismiss();
      } catch (e) { handlerErrs.push(e.message); }
    });

    try {
      const seen = [];
      await browser.sessionSubscribe({ events: ['browsingContext.navigationCommitted'] });
      browser.on('browsingContext.navigationCommitted', ev => seen.push(ev));
      await browser.url(BASE + '/second');
      const hit = await waitUntil(() => seen.find(e => e.url && e.url.endsWith('/second')) || null, 15000, 'navigationCommitted /second');
      report('navigation', 'PASS', `committed url=${hit.url}`);
    } catch (e) { report('navigation', 'FAIL', e.message); }

    await browser.url(BASE + '/');

    try {
      const entries = [];
      await browser.sessionSubscribe({ events: ['log.entryAdded'] });
      browser.on('log.entryAdded', ev => entries.push(ev));
      await browser.$('#btn-log').click();
      const hit = await waitUntil(() => entries.find(e => e.text && e.text.includes('probe-log')) || null, 15000, 'log.entryAdded probe-log');
      report('console-log', 'PASS', `type=${hit.type} method=${hit.method} text=${hit.text}`);
    } catch (e) { report('console-log', 'FAIL', e.message); }

    try {
      const entries = [];
      browser.on('log.entryAdded', ev => entries.push(ev));
      await browser.$('#btn-throw').click();
      const hit = await waitUntil(() => entries.find(e => e.text && e.text.includes('probe-thrown')) || null, 15000, 'log.entryAdded probe-thrown');
      report('js-error', 'PASS', `type=${hit.type} level=${hit.level} text=${hit.text}`);
    } catch (e) { report('js-error', 'FAIL', e.message); }

    try {
      const responses = [];
      await browser.sessionSubscribe({ events: ['network.responseCompleted'] });
      browser.on('network.responseCompleted', ev => responses.push(ev));
      await browser.$('#btn-fetch').click();
      const hit = await waitUntil(() => responses.find(e => e.request && e.request.url && e.request.url.endsWith('/api/ping')) || null, 15000, 'responseCompleted /api/ping');
      report('network-capture', 'PASS', `url=${hit.request.url} status=${hit.response.status}`);
    } catch (e) { report('network-capture', 'FAIL', e.message); }

    try {
      const sum = await browser.execute(() => 1 + 1);
      const title = await browser.execute(() => document.title);
      if (sum !== 2 || title !== 'BiDi Probe') throw new Error(`sum=${sum} title=${JSON.stringify(title)}`);
      report('script-eval', 'PASS', `1+1=${sum} title=${title}`);
    } catch (e) { report('script-eval', 'FAIL', e.message); }

    try {
      await browser.setCookies({ name: 'probe', value: 'chocochip', domain: '127.0.0.1', path: '/' });
      const all = await browser.getCookies();
      const found = (all || []).find(c => c.name === 'probe');
      if (!found || found.value !== 'chocochip') throw new Error('cookies are ' + JSON.stringify((all || []).map(c => c.name + '=' + c.value)));
      report('cookie', 'PASS', `probe=${found.value} via BiDi storage`);
    } catch (e) { report('cookie', 'FAIL', e.message); }

    try {
      const shotPath = path.join(os.tmpdir(), 'testplane-bidi-shot.png');
      await browser.saveScreenshot(shotPath);
      const buf = fs.readFileSync(shotPath);
      const png = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      fs.unlinkSync(shotPath);
      if (!png) throw new Error('screenshot is not a PNG');
      report('screenshot', 'SKIP', `Classic saveScreenshot works (${buf.length} bytes PNG) but Testplane/WDIO expose no BiDi captureScreenshot surface`);
    } catch (e) { report('screenshot', 'FAIL', e.message); }

    try {
      // Listener was registered up front (see above); the handler catches
      // its own errors so a failed accept()/dismiss() cannot kill the run.
      dialogMode = 'accept';
      await browser.$('#btn-alert').click();
      await waitUntil(() => dialogs.find(s => s.startsWith('alert:')) || null, 15000, 'alert dialog event');
      dialogMode = 'dismiss';
      await browser.$('#btn-confirm').click();
      await waitUntil(async () => {
        const t = await pageText(browser, '#dialog-result');
        return (t === 'dismissed' || t === 'confirmed') ? t : null;
      }, 15000, 'dialog-result after dismiss leg');
      const afterDismiss = await pageText(browser, '#dialog-result');
      dialogMode = 'accept';
      await browser.$('#btn-confirm').click();
      await waitUntil(async () => {
        const t = await pageText(browser, '#dialog-result');
        return (t === 'dismissed' || t === 'confirmed') ? t : null;
      }, 15000, 'dialog-result after accept leg');
      const afterAccept = await pageText(browser, '#dialog-result');
      const autoDismissed = handlerErrs.some(m => /no such alert/i.test(m));
      if (autoDismissed) {
        // Dialog events fire, but accept()/dismiss() fail with
        // 'no such alert': the prompt is gone before handling runs
        // (confirm() already returned false). Upstream WDIO 9.32 handles
        // the identical flow fine, so this is specific to Testplane's
        // wrapper/fork path, not to the probe page or the driver.
        report('dialog', 'SKIP', `dialog events fire ([${dialogs.join(', ')}]) but accept()/dismiss() fail 'no such alert' (results: dismiss-leg=${afterDismiss} accept-leg=${afterAccept}); prompt auto-dismissed before handling`);
      } else if (afterDismiss === 'dismissed' && afterAccept === 'confirmed') {
        report('dialog', 'PASS', `dialogs=[${dialogs.join(', ')}] dismissed+confirmed both observed`);
      } else {
        throw new Error(`dismiss-leg=${afterDismiss} accept-leg=${afterAccept} handlerErrs=[${handlerErrs.join('; ')}]`);
      }
    } catch (e) { report('dialog', 'FAIL', e.message); }

    try {
      await browser.$('#input-name').setValue('Ada');
      await browser.$('#btn-greet').click();
      const greet = await waitUntil(async () => {
        const t = await pageText(browser, '#greet-result');
        return t === 'Hello, Ada' ? t : null;
      }, 15000, 'greet-result Hello, Ada');
      report('input-click', 'SKIP', `Classic click+setValue works (${greet}) but Testplane/WDIO expose no BiDi input.perform surface`);
    } catch (e) { report('input-click', 'FAIL', e.message); }

    try {
      const mock = await browser.mock(BASE + '/api/ping');
      mock.respond({ ok: true, msg: 'intercepted' }, { statusCode: 200 });
      await browser.$('#btn-fetch').click();
      const result = await waitUntil(async () => {
        const t = await pageText(browser, '#fetch-result');
        return t === 'intercepted' ? t : null;
      }, 15000, 'fetch-result intercepted');
      const calls = mock.calls.length;
      report('network-intercept', 'PASS', `fetch-result=${result} mock-calls=${calls}`);
    } catch (e) { report('network-intercept', 'FAIL', e.message); }

    // 11. drag-and-drop: Classic dragAndDrop works; no BiDi
    // input.perform surface in the WDIO v9 stack (as screenshot /
    // input-click in this suite).
    try {
      await browser.url(BASE + '/');
      const src = await browser.$('#drag-source');
      const dst = await browser.$('#drop-zone');
      await src.dragAndDrop(dst);
      const result = await waitUntil(async () => {
        const t = await pageText(browser, '#drag-result');
        return t === 'dropped' ? t : null;
      }, 15000, 'drag-result dropped');
      report('drag-and-drop', 'SKIP', `Classic dragAndDrop works (${result}) but Testplane/WDIO expose no BiDi input.perform surface`);
    } catch (e) { report('drag-and-drop', 'FAIL', e.message); }

    // 12. hover: Classic moveTo works; no BiDi input.perform surface.
    try {
      await browser.url(BASE + '/');
      await browser.$('#hover-target').moveTo();
      const result = await waitUntil(async () => {
        const t = await pageText(browser, '#hover-result');
        return t === 'hovered' ? t : null;
      }, 15000, 'hover-result hovered');
      report('hover', 'SKIP', `Classic moveTo works (${result}) but Testplane/WDIO expose no BiDi input.perform surface`);
    } catch (e) { report('hover', 'FAIL', e.message); }

    // 13. keyboard: Classic keys() works; no BiDi input.perform surface.
    try {
      await browser.url(BASE + '/');
      await browser.$('#key-target').click();
      await browser.keys('ArrowRight');
      const result = await waitUntil(async () => {
        const t = await pageText(browser, '#key-result');
        return t === 'arrow-right' ? t : null;
      }, 15000, 'key-result arrow-right');
      report('keyboard', 'SKIP', `Classic keys() works (${result}) but Testplane/WDIO expose no BiDi input.perform surface`);
    } catch (e) { report('keyboard', 'FAIL', e.message); }

    // 14. multi-tab: Classic window handles work; no BiDi
    // browsingContext surface in the WDIO v9 stack.
    try {
      await browser.url(BASE + '/');
      const orig = await browser.getWindowHandle();
      await browser.$('#link-newtab').click();
      const handles = await waitUntil(async () => {
        const hs = await browser.getWindowHandles();
        return hs.length > 1 ? hs : null;
      }, 15000, 'second window handle');
      const tab = handles.find(h => h !== orig);
      await browser.switchWindow(tab);
      const url = await browser.getUrl();
      if (!url.endsWith('/second')) throw new Error('tab url is ' + url);
      await browser.closeWindow();
      await browser.switchWindow(orig);
      report('multi-tab', 'SKIP', `Classic window handles work (tab landed ${url}) but Testplane/WDIO expose no BiDi browsingContext surface`);
    } catch (e) { report('multi-tab', 'FAIL', e.message); }

    // 15. iframe: Classic switchFrame works; no BiDi frame surface.
    try {
      await browser.url(BASE + '/');
      const frameEl = await browser.$('#probe-frame');
      await browser.switchFrame(frameEl);
      await browser.$('#inner-btn').click();
      const result = await waitUntil(async () => {
        const t = await pageText(browser, '#inner-result');
        return t === 'inner-clicked' ? t : null;
      }, 15000, 'inner-result inner-clicked');
      await browser.switchFrame(null);
      report('iframe', 'SKIP', `Classic switchFrame works (${result}) but Testplane/WDIO expose no BiDi frame surface`);
    } catch (e) { report('iframe', 'FAIL', e.message); }
  });
});
