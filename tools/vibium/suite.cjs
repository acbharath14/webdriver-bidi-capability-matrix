// Vibium suite for the BiDi capability matrix (stable 26.8.21, JS sync client).
// Run from this directory: node suite.cjs
// Env: PROBE_URL (default http://127.0.0.1:4333)
// Output contract: one `RESULT <key> <PASS|FAIL|SKIP> [detail]` line and
// one `TIMING <key> <ms>` line per capability, a `SESSION <k=v>...` line
// with session facts, then a `SUMMARY <pass> <fail> <skip>` line.
// Exit 1 on any FAIL.
//
// Notes (observed, not assumed):
// - Sandbox runs as root, so Chrome needs --no-sandbox; this is auto-set
//   only when running as root, so the same script runs unmodified on a
//   normal user account (e.g. a Mac).
// - waitForLoad('load') times out even on fully loaded pages, so this
//   suite never relies on it; it polls for visible outcomes instead.
// - @refs go stale after find re-maps in the CLI; this suite uses CSS
//   selectors directly, so it is unaffected.
// - onDialog() is first-wins: repeated calls do NOT replace the handler
//   (observed: a dismiss set after an accept was ignored). The dialog
//   test therefore uses one fresh page per dialog decision.
const { browser } = require('vibium/sync');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
if (!process.env.VIBIUM_CHROME_ARGS && typeof process.getuid === 'function' && process.getuid() === 0) {
  process.env.VIBIUM_CHROME_ARGS = '--no-sandbox';
}

const results = [];
// Per-capability timing: mark() returns the ms since the previous report
// (or since the baseline reset after browser start) and resets the clock,
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
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
// Poll fn until it returns truthy or the timeout elapses. Each iteration
// calls a cheap page API so the sync bridge pumps BiDi events.
function waitUntil(page, fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const v = fn();
      if (v) return v;
    } catch (e) { lastErr = e; }
    try { page.title(); } catch (_) { /* pump only */ }
    sleep(200);
  }
  throw new Error(`timed out waiting for ${label}${lastErr ? ' (last: ' + lastErr.message + ')' : ''}`);
}
function textOf(page, selector) {
  return page.find(selector).text();
}

const CAPABILITIES = [
  'navigation', 'console-log', 'js-error', 'network-capture',
  'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click',
  'network-intercept', 'drag-and-drop', 'hover', 'keyboard',
  'multi-tab', 'iframe',
];

let bro = null;
try {
  bro = browser.start({ headless: true });
} catch (e) {
  for (const key of CAPABILITIES) report(key, 'FAIL', 'browser start failed: ' + e.message);
  const f = results.filter(r => r.status === 'FAIL').length;
  console.log(`SUMMARY 0 ${f} 0`);
  process.exit(1);
}
mark(); // baseline: capability 1 timing excludes browser start
console.log('SESSION browser=Vibium-managed-Chrome-for-Testing');

function freshPage() {
  const page = bro.newPage();
  page.go(BASE + '/');
  return page;
}

try {
  // 1. navigation: click the link, assert landed URL + second-page marker.
  try {
    const page = freshPage();
    page.find('#link-second').click();
    page.waitForURL('/second', { timeout: 10000 });
    const marker = textOf(page, '#second-title');
    if (!page.url().endsWith('/second')) throw new Error('url is ' + page.url());
    if (marker !== 'Second page') throw new Error('marker is ' + JSON.stringify(marker));
    report('navigation', 'PASS', 'landed ' + page.url());
  } catch (e) { report('navigation', 'FAIL', e.message); }

  // 2. console-log: collect console events, trigger log, assert captured.
  try {
    const page = freshPage();
    page.onConsole('collect');
    page.find('#btn-log').click();
    const found = waitUntil(page, () => {
      const msgs = page.consoleMessages();
      return msgs.find(m => m.text.includes('probe-log'));
    }, 10000, 'probe-log console message');
    report('console-log', 'PASS', `type=${found.type} text=${JSON.stringify(found.text)}`);
  } catch (e) { report('console-log', 'FAIL', e.message); }

  // 3. js-error: collect error events, trigger a throw, assert captured.
  try {
    const page = freshPage();
    page.onError('collect');
    page.find('#btn-throw').click();
    const found = waitUntil(page, () => {
      const errs = page.errors();
      return errs.find(m => m.message.includes('probe-thrown'));
    }, 10000, 'probe-thrown error');
    report('js-error', 'PASS', `message=${JSON.stringify(found.message)}`);
  } catch (e) { report('js-error', 'FAIL', e.message); }

  // 4. network-capture: collect responses, trigger fetch, assert /api/ping 200.
  try {
    const page = freshPage();
    const responses = [];
    page.onResponse((r) => { responses.push(r); });
    page.find('#btn-fetch').click();
    const found = waitUntil(page, () => {
      return responses.find(r => r.url.includes('/api/ping') && r.status === 200);
    }, 10000, '/api/ping 200 response');
    report('network-capture', 'PASS', `url=${found.url} status=${found.status}`);
  } catch (e) { report('network-capture', 'FAIL', e.message); }

  // 5. script-eval: evaluate an expression over BiDi, assert the value.
  try {
    const page = freshPage();
    const value = page.evaluate('1 + 1');
    if (value !== 2) throw new Error('evaluate returned ' + JSON.stringify(value));
    const title = page.evaluate('document.title');
    if (title !== 'BiDi Probe') throw new Error('title is ' + JSON.stringify(title));
    report('script-eval', 'PASS', '1+1=2, title=BiDi Probe');
  } catch (e) { report('script-eval', 'FAIL', e.message); }

  // 6. cookie: set + read through the context cookie API (fresh context).
  try {
    const ctx = bro.newContext();
    const page = ctx.newPage();
    page.go(BASE + '/');
    ctx.setCookies([{ name: 'probe', value: 'chocochip', url: BASE + '/' }]);
    const cookies = ctx.cookies();
    const found = cookies.find(c => c.name === 'probe');
    if (!found || found.value !== 'chocochip') {
      throw new Error('cookies are ' + JSON.stringify(cookies.map(c => c.name + '=' + c.value)));
    }
    report('cookie', 'PASS', 'probe=chocochip via context API');
  } catch (e) { report('cookie', 'FAIL', e.message); }

  // 7. screenshot: capture, assert PNG bytes.
  try {
    const page = freshPage();
    const png = page.screenshot();
    const isPng = png.length > 1000 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47;
    if (!isPng) throw new Error('screenshot bytes=' + png.length);
    report('screenshot', 'PASS', `bytes=${png.length} png-signature=yes`);
  } catch (e) { report('screenshot', 'FAIL', e.message); }

  // 8. dialog: alert accept, confirm dismiss, confirm accept — each on a
  // fresh page because onDialog() is first-wins (see header notes).
  try {
    let page = freshPage();
    page.onDialog('accept');
    page.find('#btn-alert').click();
    page = freshPage();
    page.onDialog('dismiss');
    page.find('#btn-confirm').click();
    const dismissed = waitUntil(page, () => {
      const t = textOf(page, '#dialog-result');
      return t === 'dismissed' ? t : null;
    }, 10000, 'dialog-result dismissed');
    page = freshPage();
    page.onDialog('accept');
    page.find('#btn-confirm').click();
    const confirmed = waitUntil(page, () => {
      const t = textOf(page, '#dialog-result');
      return t === 'confirmed' ? t : null;
    }, 10000, 'dialog-result confirmed');
    report('dialog', 'PASS', `dismissed=${dismissed} confirmed=${confirmed}`);
  } catch (e) { report('dialog', 'FAIL', e.message); }

  // 9. input-click: fill + click + assert the greeting.
  try {
    const page = freshPage();
    page.find('#input-name').fill('Ada');
    page.find('#btn-greet').click();
    const greet = waitUntil(page, () => {
      const t = textOf(page, '#greet-result');
      return t === 'Hello, Ada' ? t : null;
    }, 10000, 'greet-result Hello, Ada');
    report('input-click', 'PASS', greet);
  } catch (e) { report('input-click', 'FAIL', e.message); }

  // 10. network-intercept: route /api/ping to a stubbed body, assert fetch
  // sees the stub. Two pattern forms are tried; PASS records which matched.
  try {
    const page = freshPage();
    let matchedPattern = null;
    for (const pattern of ['**/api/ping', '*api/ping*']) {
      page.route(pattern, {
        status: 200,
        body: JSON.stringify({ ok: true, msg: 'intercepted' }),
        headers: { 'content-type': 'application/json' },
      });
      page.find('#btn-fetch').click();
      try {
        const result = waitUntil(page, () => {
          const t = textOf(page, '#fetch-result');
          return t === 'intercepted' ? t : null;
        }, 5000, 'fetch-result intercepted');
        if (result) { matchedPattern = pattern; break; }
      } catch (_) { /* try next pattern */ }
      page.unroute(pattern);
      page.go(BASE + '/');
    }
    if (!matchedPattern) throw new Error('neither route pattern intercepted /api/ping');
    report('network-intercept', 'PASS', `pattern=${matchedPattern} fetch-result=intercepted`);
  } catch (e) { report('network-intercept', 'FAIL', e.message); }

  // 11. drag-and-drop: element dragTo, assert drop handler ran.
  try {
    const page = freshPage();
    page.find('#drag-source').dragTo(page.find('#drop-zone'));
    const result = waitUntil(page, () => {
      const t = textOf(page, '#drag-result');
      return t === 'dropped' ? t : null;
    }, 10000, 'drag-result dropped');
    report('drag-and-drop', 'PASS', `drag-result=${result}`);
  } catch (e) { report('drag-and-drop', 'FAIL', e.message); }

  // 12. hover: element hover, assert mouseover handler ran.
  try {
    const page = freshPage();
    page.find('#hover-target').hover();
    const result = waitUntil(page, () => {
      const t = textOf(page, '#hover-result');
      return t === 'hovered' ? t : null;
    }, 10000, 'hover-result hovered');
    report('hover', 'PASS', `hover-result=${result}`);
  } catch (e) { report('hover', 'FAIL', e.message); }

  // 13. keyboard: focus the target, press ArrowRight, assert key handler.
  try {
    const page = freshPage();
    const target = page.find('#key-target');
    target.click();
    target.press('ArrowRight');
    const result = waitUntil(page, () => {
      const t = textOf(page, '#key-result');
      return t === 'arrow-right' ? t : null;
    }, 10000, 'key-result arrow-right');
    report('keyboard', 'PASS', `key-result=${result}`);
  } catch (e) { report('keyboard', 'FAIL', e.message); }

  // 14. multi-tab: click the target=_blank link, find the new tab
  // (page count grows; the newest page is the tab), assert it landed.
  try {
    const page = freshPage();
    const before = bro.pages().length;
    page.find('#link-newtab').click();
    waitUntil(page, () => bro.pages().length > before, 10000, 'new tab page');
    const tab = bro.pages()[bro.pages().length - 1];
    if (!tab.url().endsWith('/second')) throw new Error('tab url is ' + tab.url());
    const marker = waitUntil(tab, () => {
      const t = textOf(tab, '#second-title');
      return t === 'Second page' ? t : null;
    }, 10000, 'second-title in new tab');
    report('multi-tab', 'PASS', `tab landed ${tab.url()} marker=${marker}`);
    try { tab.close(); } catch (_) { /* already closed */ }
  } catch (e) { report('multi-tab', 'FAIL', e.message); }

  // 15. iframe: switch into the frame by URL, click inside, assert.
  try {
    const page = freshPage();
    const frame = page.frame('/iframe-inner');
    if (!frame) throw new Error('frame /iframe-inner not found');
    frame.find('#inner-btn').click();
    const result = waitUntil(frame, () => {
      const t = frame.find('#inner-result').text();
      return t === 'inner-clicked' ? t : null;
    }, 10000, 'inner-result inner-clicked');
    report('iframe', 'PASS', `inner-result=${result}`);
  } catch (e) { report('iframe', 'FAIL', e.message); }
} finally {
  try { bro.stop(); } catch (_) { /* already stopped */ }
}

const p = results.filter(r => r.status === 'PASS').length;
const f = results.filter(r => r.status === 'FAIL').length;
const s = results.filter(r => r.status === 'SKIP').length;
console.log(`SUMMARY ${p} ${f} ${s}`);
process.exit(f > 0 ? 1 : 0);
