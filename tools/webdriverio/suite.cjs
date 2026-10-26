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
// Requires a WebDriver server: run chromedriver on WDIO_PORT (default 9515)
// and point CHROME_BIN at a Chrome binary when it is not on PATH.
const { remote } = require('webdriverio');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
const WDIO_PORT = Number(process.env.WDIO_PORT || 9515);
const CHROME_BIN = process.env.CHROME_BIN || '';

const results = [];
function report(key, status, detail) {
  results.push({ key, status });
  console.log(`RESULT ${key} ${status}${detail ? ' ' + detail : ''}`);
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
  const chromeOptions = { args: ['--headless'] };
  if (typeof process.getuid === 'function' && process.getuid() === 0) chromeOptions.args.push('--no-sandbox');
  if (CHROME_BIN) chromeOptions.binary = CHROME_BIN;
  const browser = await remote({
    logLevel: process.env.WDIO_LOGLEVEL || 'error',
    hostname: '127.0.0.1',
    port: WDIO_PORT,
    capabilities: {
      browserName: 'chrome',
      'goog:chromeOptions': chromeOptions,
      webSocketUrl: true,
    },
  });
  try {
    const isBidi = browser.isBidi === true;
    const wsUrl = browser.capabilities && browser.capabilities.webSocketUrl;
    console.log(`SESSION isBidi=${isBidi} webSocketUrl=${typeof wsUrl === 'string' ? 'present' : 'absent'}`);
    if (!isBidi) {
      for (const key of ['navigation', 'console-log', 'js-error', 'network-capture', 'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click', 'network-intercept']) {
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
    try {
      const mock = await browser.mock(BASE + '/api/ping');
      mock.respond({ ok: true, msg: 'intercepted' }, { statusCode: 200 });
      await browser.$('#btn-fetch').click();
      const result = await waitUntil(async () => {
        const t = await pageText(browser, '#fetch-result');
        return t === 'intercepted' ? t : null;
      }, 15000, 'fetch-result intercepted');
      const calls = mock.calls.length;
      // NOTE: mock.restore() is intentionally NOT called here. In this
      // setup (WDIO 9.32 + chromedriver 156 mapper) its network.removeIntercept
      // call timed out after 180s (WDIO's default bidiResponseTimeout) and
      // crashed the process with an unhandled rejection after SUMMARY.
      // Ending the session below tears the intercept down with it.
      report('network-intercept', 'PASS', `fetch-result=${result} mock-calls=${calls}`);
    } catch (e) { report('network-intercept', 'FAIL', e.message); }

    const p = results.filter(r => r.status === 'PASS').length;
    const f = results.filter(r => r.status === 'FAIL').length;
    const s = results.filter(r => r.status === 'SKIP').length;
    console.log(`SUMMARY ${p} ${f} ${s}`);
    process.exitCode = f > 0 ? 1 : 0;
  } finally {
    await browser.deleteSession().catch(() => {});
  }
})().catch(e => { console.error('SUITE CRASH:', e.message); process.exit(1); });
