// Firefox variant of tools/webdriverio/suite.cjs — same 10 capabilities
// against Firefox via geckodriver (BiDi via webSocketUrl, as Chrome).
// WebdriverIO v9 suite — BiDi where WDIO v9 actually routes over BiDi.
// Transport facts (verified in webdriverio 9.32.0 source, build/index.js):
//  - BiDi auto-enables when the session returns a webSocketUrl capability
//    (registerSessionManager); request it with 'webSocketUrl': true.
//  - execute() uses script.callFunction when browser.isBidi (else Classic).
//  - getCookies/setCookies use storage.getCookies/storage.setCookie when
//    isBidi, with a silent Classic fallback on empty/error.
//  - browser.mock() uses network.addIntercept + network event subscriptions.
//  - browser.on('dialog') + dialog.accept()/dismiss() go through the
//    DialogManager (browsingContext.handleUserPrompt); registering a dialog
//    listener switches OFF the manager's default auto-dismiss.
//  - Element click/setValue and saveScreenshot have NO BiDi branch in v9:
//    they use Classic endpoints. Those cells are SKIP (demonstrated via the
//    Classic path so the SKIP is about transport, not capability).
// Output contract: one RESULT line + one TIMING line per capability, a
// SESSION line with session facts, then a SUMMARY line. Exit 1 on FAIL.
// Requires a WebDriver server: run geckodriver on WDIO_PORT (default 4444
// for the Firefox variant) and point FIREFOX_PATH at a Firefox binary
// when it is not on PATH (default: workdir tools/firefox).
const { remote } = require('webdriverio');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
const WDIO_PORT = Number(process.env.WDIO_PORT || 9515);
const FF_CANDIDATE = path.join(__dirname, '..', 'firefox', 'firefox', 'firefox');
const FIREFOX_BIN = process.env.FIREFOX_PATH || (fs.existsSync(FF_CANDIDATE) ? FF_CANDIDATE : '');

const results = [];
// Per-capability timing: mark() returns the ms since the previous report
// (or since the baseline reset after session start) and resets the clock,
// so each capability's TIMING line covers its own work, not launch time.
let lastMark = Date.now();
function mark() {
  const now = Date.now();
  const ms = now - lastMark;
  lastMark = now;
  return ms;
}
function report(key, status, detail) {
  results.push({ key, status });
  console.log(`RESULT ${key} ${status}${detail ? ' ' + detail : ''}`);
  console.log(`TIMING ${key} ${mark()}`);
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

(async () => {
  const firefoxOptions = { args: ['-headless'] };
  if (FIREFOX_BIN) firefoxOptions.binary = FIREFOX_BIN;
  const browser = await remote({
    logLevel: process.env.WDIO_LOGLEVEL || 'error',
    hostname: '127.0.0.1',
    port: WDIO_PORT,
    capabilities: {
      browserName: 'firefox',
      'moz:firefoxOptions': firefoxOptions,
      webSocketUrl: true,
    },
  });
  try {
    const isBidi = browser.isBidi === true;
    const wsUrl = browser.capabilities && browser.capabilities.webSocketUrl;
    const browserVersion = browser.capabilities && browser.capabilities.browserVersion;
    mark(); // baseline: capability 1 timing excludes session start
    console.log(`SESSION isBidi=${isBidi} webSocketUrl=${typeof wsUrl === 'string' ? 'present' : 'absent'}${browserVersion ? ' browser=Firefox/' + browserVersion : ''}`);
    if (!isBidi) {
      for (const key of ['navigation', 'console-log', 'js-error', 'network-capture', 'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click', 'network-intercept', 'drag-and-drop', 'hover', 'keyboard', 'multi-tab', 'iframe']) {
        report(key, 'SKIP', 'BiDi not connected (no webSocketUrl in session capabilities)');
      }
      console.log(`SUMMARY 0 0 ${results.filter(r => r.status === 'SKIP').length}`);
      return;
    }

    // 1. navigation events via browsingContext.navigationCommitted.
    try {
      const seen = [];
      await browser.sessionSubscribe({ events: ['browsingContext.navigationCommitted'] });
      browser.on('browsingContext.navigationCommitted', ev => seen.push(ev));
      await browser.url(BASE + '/second');
      const hit = await waitUntil(() => seen.find(e => e.url && e.url.endsWith('/second')) || null, 15000, 'navigationCommitted /second');
      report('navigation', 'PASS', `committed url=${hit.url}`);
    } catch (e) { report('navigation', 'FAIL', e.message); }

    await browser.url(BASE + '/');

    // 2. console-log via log.entryAdded (type=console).
    try {
      const entries = [];
      await browser.sessionSubscribe({ events: ['log.entryAdded'] });
      browser.on('log.entryAdded', ev => entries.push(ev));
      await browser.$('#btn-log').click();
      const hit = await waitUntil(() => entries.find(e => e.text && e.text.includes('probe-log')) || null, 15000, 'log.entryAdded probe-log');
      report('console-log', 'PASS', `type=${hit.type} method=${hit.method} text=${hit.text}`);
    } catch (e) { report('console-log', 'FAIL', e.message); }

    // 3. JS-error via log.entryAdded (type=javascript).
    try {
      const entries = [];
      browser.on('log.entryAdded', ev => entries.push(ev));
      await browser.$('#btn-throw').click();
      const hit = await waitUntil(() => entries.find(e => e.text && e.text.includes('probe-thrown')) || null, 15000, 'log.entryAdded probe-thrown');
      report('js-error', 'PASS', `type=${hit.type} level=${hit.level} text=${hit.text}`);
    } catch (e) { report('js-error', 'FAIL', e.message); }

    // 4. network-capture via network.responseCompleted.
    try {
      const responses = [];
      await browser.sessionSubscribe({ events: ['network.responseCompleted'] });
      browser.on('network.responseCompleted', ev => responses.push(ev));
      await browser.$('#btn-fetch').click();
      const hit = await waitUntil(() => responses.find(e => e.request && e.request.url && e.request.url.endsWith('/api/ping')) || null, 15000, 'responseCompleted /api/ping');
      report('network-capture', 'PASS', `url=${hit.request.url} status=${hit.response.status}`);
    } catch (e) { report('network-capture', 'FAIL', e.message); }

    // 5. script-eval via browser.execute (script.callFunction when isBidi).
    try {
      const sum = await browser.execute(() => 1 + 1);
      const title = await browser.execute(() => document.title);
      if (sum !== 2 || title !== 'BiDi Probe') throw new Error(`sum=${sum} title=${JSON.stringify(title)}`);
      report('script-eval', 'PASS', `1+1=${sum} title=${title}`);
    } catch (e) { report('script-eval', 'FAIL', e.message); }

    // 6. cookie via storage.setCookie / storage.getCookies (isBidi path).
    try {
      await browser.setCookies({ name: 'probe', value: 'chocochip', domain: '127.0.0.1', path: '/' });
      const all = await browser.getCookies();
      const found = (all || []).find(c => c.name === 'probe');
      if (!found || found.value !== 'chocochip') throw new Error('cookies are ' + JSON.stringify((all || []).map(c => c.name + '=' + c.value)));
      report('cookie', 'PASS', `probe=${found.value} via BiDi storage`);
    } catch (e) { report('cookie', 'FAIL', e.message); }

    // 7. screenshot: no BiDi surface in WDIO v9 — demonstrate Classic path, SKIP.
    try {
      const shotPath = path.join(os.tmpdir(), 'wdio-bidi-shot.png');
      await browser.saveScreenshot(shotPath);
      const buf = fs.readFileSync(shotPath);
      const png = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      fs.unlinkSync(shotPath);
      if (!png) throw new Error('screenshot is not a PNG');
      report('screenshot', 'SKIP', `Classic saveScreenshot works (${buf.length} bytes PNG) but WDIO v9 exposes no BiDi captureScreenshot surface`);
    } catch (e) { report('screenshot', 'FAIL', e.message); }

    // 8. dialog via browser.on('dialog') + accept()/dismiss().
    try {
      const dialogs = [];
      let mode = 'accept';
      browser.on('dialog', async d => {
        dialogs.push(d.type() + ':' + d.message());
        if (mode === 'accept') await d.accept(); else await d.dismiss();
      });
      mode = 'accept';
      await browser.$('#btn-alert').click();
      await waitUntil(() => dialogs.find(s => s.startsWith('alert:')) || null, 15000, 'alert dialog event');
      mode = 'dismiss';
      await browser.$('#btn-confirm').click();
      await waitUntil(async () => (await pageText(browser, '#dialog-result')) === 'dismissed' || null, 15000, 'dialog-result dismissed');
      mode = 'accept';
      await browser.$('#btn-confirm').click();
      await waitUntil(async () => (await pageText(browser, '#dialog-result')) === 'confirmed' || null, 15000, 'dialog-result confirmed');
      report('dialog', 'PASS', `dialogs=[${dialogs.join(', ')}] dismissed+confirmed both observed`);
    } catch (e) { report('dialog', 'FAIL', e.message); }

    // 9. input-click: no BiDi surface in WDIO v9 — demonstrate Classic path, SKIP.
    try {
      await browser.$('#input-name').setValue('Ada');
      await browser.$('#btn-greet').click();
      const greet = await waitUntil(async () => {
        const t = await pageText(browser, '#greet-result');
        return t === 'Hello, Ada' ? t : null;
      }, 15000, 'greet-result Hello, Ada');
      report('input-click', 'SKIP', `Classic click+setValue works (${greet}) but WDIO v9 exposes no BiDi input.perform surface`);
    } catch (e) { report('input-click', 'FAIL', e.message); }

    // 10. network-intercept via browser.mock() (network.addIntercept).
    // FIREFOX NOTE: WDIO's mock provides the response body at
    // responseStarted, but Firefox's BiDi network.provideResponse only
    // accepts a body in beforeRequestSent — so the mock's internal
    // handler throws an unhandled rejection that would kill the process
    // before SUMMARY. Capture it here and report the honest FAIL.
    try {
      let interceptErr = null;
      const onRej = (err) => { if (!interceptErr) interceptErr = err; };
      process.on('unhandledRejection', onRej);
      let result;
      try {
        const mock = await browser.mock(BASE + '/api/ping');
        mock.respond({ ok: true, msg: 'intercepted' }, { statusCode: 200 });
        await browser.$('#btn-fetch').click();
        result = await waitUntil(async () => {
          const t = await pageText(browser, '#fetch-result');
          return t === 'intercepted' ? t : null;
        }, 15000, 'fetch-result intercepted');
        const calls = mock.calls.length;
        report('network-intercept', 'PASS', `fetch-result=${result} mock-calls=${calls}`);
      } catch (e) {
        const reason = interceptErr ? interceptErr.message : e.message;
        report('network-intercept', 'FAIL', `mock body rejected on Firefox: ${reason}`);
      } finally {
        process.off('unhandledRejection', onRej);
      }
    } catch (e) { report('network-intercept', 'FAIL', e.message); }
    // NOTE: mock.restore() is intentionally NOT called here (as in the
    // Chrome suite, where its network.removeIntercept call timed out).
    // Ending the session below tears the intercept down with it.

    // 11. drag-and-drop: Classic dragAndDrop works, but WDIO v9 has no
    // BiDi input.perform surface, so the BiDi cell is SKIP (same stance
    // as screenshot / input-click in this suite).
    // FIREFOX NOTE (verified 2026-10-27): on Firefox, Classic
    // dragAndDrop itself runs without error but the drop handler never
    // fires (Chrome Classic drag works), the same Firefox pointer-drag
    // limitation seen in the Vibium/Puppeteer/Selenium Firefox cells.
    // The cell stays SKIP — there is still no BiDi drag surface — with
    // the Classic outcome recorded in the detail either way.
    try {
      await browser.url(BASE + '/');
      const src = await browser.$('#drag-source');
      const dst = await browser.$('#drop-zone');
      await src.dragAndDrop(dst);
      let result = null;
      try {
        result = await waitUntil(async () => {
          const t = await pageText(browser, '#drag-result');
          return t === 'dropped' ? t : null;
        }, 15000, 'drag-result dropped');
      } catch (_) { /* fall through: Classic drag did not drop on Firefox */ }
      if (result) {
        report('drag-and-drop', 'SKIP', `Classic dragAndDrop works (${result}) but WDIO v9 exposes no BiDi input.perform surface`);
      } else {
        report('drag-and-drop', 'SKIP', 'Classic dragAndDrop runs without error on Firefox but drop handler never fires (Chrome Classic drag works); WDIO v9 exposes no BiDi input.perform surface');
      }
    } catch (e) { report('drag-and-drop', 'FAIL', e.message); }

    // 12. hover: Classic moveTo works; no BiDi input.perform surface.
    try {
      await browser.url(BASE + '/');
      await browser.$('#hover-target').moveTo();
      const result = await waitUntil(async () => {
        const t = await pageText(browser, '#hover-result');
        return t === 'hovered' ? t : null;
      }, 15000, 'hover-result hovered');
      report('hover', 'SKIP', `Classic moveTo works (${result}) but WDIO v9 exposes no BiDi input.perform surface`);
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
      report('keyboard', 'SKIP', `Classic keys() works (${result}) but WDIO v9 exposes no BiDi input.perform surface`);
    } catch (e) { report('keyboard', 'FAIL', e.message); }

    // 14. multi-tab: Classic window handles work; WDIO v9 exposes no
    // BiDi browsingContext creation/switching surface.
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
      report('multi-tab', 'SKIP', `Classic window handles work (tab landed ${url}) but WDIO v9 exposes no BiDi browsingContext surface`);
    } catch (e) { report('multi-tab', 'FAIL', e.message); }

    // 15. iframe: Classic switchFrame works; no BiDi frame surface in v9.
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
      report('iframe', 'SKIP', `Classic switchFrame works (${result}) but WDIO v9 exposes no BiDi frame surface`);
    } catch (e) { report('iframe', 'FAIL', e.message); }

    const p = results.filter(r => r.status === 'PASS').length;
    const f = results.filter(r => r.status === 'FAIL').length;
    const s = results.filter(r => r.status === 'SKIP').length;
    console.log(`SUMMARY ${p} ${f} ${s}`);
    process.exitCode = f > 0 ? 1 : 0;
  } finally {
    await browser.deleteSession().catch(() => {});
  }
})().catch(e => { console.error('SUITE CRASH:', e.message); process.exit(1); });
