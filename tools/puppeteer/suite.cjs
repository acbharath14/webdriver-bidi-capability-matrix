// Puppeteer suite for the BiDi capability matrix (25.16.0, BiDi protocol).
// Run from this directory: node suite.cjs
// Env: PROBE_URL (default http://127.0.0.1:4333)
// Output contract: one `RESULT <key> <PASS|FAIL|SKIP> [detail]` line and
// one `TIMING <key> <ms>` line per capability, a `SESSION <k=v>...` line
// with session facts, then a `SUMMARY <pass> <fail> <skip>` line.
// Exit 1 on any FAIL.
//
// Notes:
// - BiDi is opt-in for Chrome: launch({ protocol: 'webDriverBiDi' }).
//   Firefox defaults to BiDi; this suite is Chrome-first (sandbox has
//   Chrome for Testing 156 cached; Puppeteer downloaded its own copy).
// - --no-sandbox is added only when running as root (sandbox), so the
//   same script runs unmodified on a normal user account (e.g. a Mac).
// - A capability that throws UnsupportedOperation over BiDi is SKIP
//   (not FAIL): the tool's stable BiDi does not cover it.
const puppeteer = require('puppeteer');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
const ARGS = [];
if (typeof process.getuid === 'function' && process.getuid() === 0) ARGS.push('--no-sandbox');

const results = [];
// Per-capability timing: mark() returns the ms since the previous report
// (or since the baseline reset after browser launch) and resets the clock,
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
function isUnsupported(e) {
  return /UnsupportedOperation|not supported/i.test(e.message || '');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitUntil(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { lastErr = e; }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}${lastErr ? ' (last: ' + lastErr.message + ')' : ''}`);
}
async function pageText(page, selector) {
  return page.$eval(selector, el => el.textContent);
}

const CAPABILITIES = [
  'navigation', 'console-log', 'js-error', 'network-capture',
  'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click',
  'network-intercept', 'drag-and-drop', 'hover', 'keyboard',
  'multi-tab', 'iframe',
];

(async () => {
  let browser = null;
  try {
    browser = await puppeteer.launch({ protocol: 'webDriverBiDi', headless: true, args: ARGS });
  } catch (e) {
    for (const key of CAPABILITIES) report(key, 'FAIL', 'browser launch failed: ' + e.message);
    console.log(`SUMMARY 0 ${CAPABILITIES.length} 0`);
    process.exit(1);
  }
  mark(); // baseline: capability 1 timing excludes browser launch
  // Puppeteer 25 appends a build revision after /@; the table shows the
  // release version only.
  console.log('SESSION browser=' + (await browser.version()).split('/@')[0]);

  async function freshPage() {
    const page = await browser.newPage();
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    return page;
  }

  try {
    // 1. navigation
    try {
      const page = await freshPage();
      await page.click('#link-second');
      await page.waitForSelector('#second-title', { timeout: 10000 });
      const url = page.url();
      if (!url.endsWith('/second')) throw new Error('url is ' + url);
      report('navigation', 'PASS', 'landed ' + url);
      await page.close();
    } catch (e) { report('navigation', 'FAIL', e.message); }

    // 2. console-log
    try {
      const page = await freshPage();
      const msgs = [];
      page.on('console', m => msgs.push(m));
      await page.click('#btn-log');
      const found = await waitUntil(() => msgs.find(m => m.text().includes('probe-log')), 10000, 'probe-log console message');
      report('console-log', 'PASS', `type=${found.type()} text=${JSON.stringify(found.text())}`);
      await page.close();
    } catch (e) { report('console-log', 'FAIL', e.message); }

    // 3. js-error
    try {
      const page = await freshPage();
      const errs = [];
      page.on('pageerror', err => errs.push(err));
      await page.click('#btn-throw');
      const found = await waitUntil(() => errs.find(err => (err.message || '').includes('probe-thrown')), 10000, 'probe-thrown error');
      report('js-error', 'PASS', `message=${JSON.stringify(found.message)}`);
      await page.close();
    } catch (e) { report('js-error', 'FAIL', e.message); }

    // 4. network-capture
    try {
      const page = await freshPage();
      const responses = [];
      page.on('response', r => responses.push(r));
      await page.click('#btn-fetch');
      const found = await waitUntil(() => responses.find(r => r.url().includes('/api/ping') && r.status() === 200), 10000, '/api/ping 200 response');
      report('network-capture', 'PASS', `url=${found.url()} status=${found.status()}`);
      await page.close();
    } catch (e) { report('network-capture', 'FAIL', e.message); }

    // 5. script-eval
    try {
      const page = await freshPage();
      const value = await page.evaluate('1 + 1');
      if (value !== 2) throw new Error('evaluate returned ' + JSON.stringify(value));
      const title = await page.evaluate('document.title');
      if (title !== 'BiDi Probe') throw new Error('title is ' + JSON.stringify(title));
      report('script-eval', 'PASS', '1+1=2, title=BiDi Probe');
      await page.close();
    } catch (e) { report('script-eval', 'FAIL', e.message); }

    // 6. cookie
    try {
      const page = await freshPage();
      await page.setCookie({ name: 'probe', value: 'chocochip', url: BASE + '/' });
      const cookies = await page.cookies();
      const found = cookies.find(c => c.name === 'probe');
      if (!found || found.value !== 'chocochip') {
        throw new Error('cookies are ' + JSON.stringify(cookies.map(c => c.name + '=' + c.value)));
      }
      report('cookie', 'PASS', 'probe=chocochip via page cookie API');
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('cookie', 'SKIP', 'BiDi does not cover cookies: ' + e.message);
      else report('cookie', 'FAIL', e.message);
    }

    // 7. screenshot
    try {
      const page = await freshPage();
      const png = await page.screenshot();
      const isPng = png.length > 1000 && png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47;
      if (!isPng) throw new Error('screenshot bytes=' + png.length);
      report('screenshot', 'PASS', `bytes=${png.length} png-signature=yes`);
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('screenshot', 'SKIP', 'BiDi does not cover screenshots: ' + e.message);
      else report('screenshot', 'FAIL', e.message);
    }

    // 8. dialog: one listener, mutable mode (a dialog must be handled once).
    try {
      const page = await freshPage();
      let mode = 'accept';
      page.on('dialog', async d => {
        if (mode === 'dismiss') await d.dismiss();
        else await d.accept();
      });
      await page.click('#btn-alert');
      mode = 'dismiss';
      await page.click('#btn-confirm');
      const dismissed = await waitUntil(async () => {
        const t = await pageText(page, '#dialog-result');
        return t === 'dismissed' ? t : null;
      }, 10000, 'dialog-result dismissed');
      mode = 'accept';
      await page.click('#btn-confirm');
      const confirmed = await waitUntil(async () => {
        const t = await pageText(page, '#dialog-result');
        return t === 'confirmed' ? t : null;
      }, 10000, 'dialog-result confirmed');
      report('dialog', 'PASS', `dismissed=${dismissed} confirmed=${confirmed}`);
      await page.close();
    } catch (e) { report('dialog', 'FAIL', e.message); }

    // 9. input-click
    try {
      const page = await freshPage();
      await page.type('#input-name', 'Ada');
      await page.click('#btn-greet');
      const greet = await waitUntil(async () => {
        const t = await pageText(page, '#greet-result');
        return t === 'Hello, Ada' ? t : null;
      }, 10000, 'greet-result Hello, Ada');
      report('input-click', 'PASS', greet);
      await page.close();
    } catch (e) { report('input-click', 'FAIL', e.message); }

    // 10. network-intercept
    try {
      const page = await freshPage();
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (req.url().includes('/api/ping')) {
          req.respond({ contentType: 'application/json', body: JSON.stringify({ ok: true, msg: 'intercepted' }) });
        } else {
          req.continue();
        }
      });
      await page.click('#btn-fetch');
      const result = await waitUntil(async () => {
        const t = await pageText(page, '#fetch-result');
        return t === 'intercepted' ? t : null;
      }, 10000, 'fetch-result intercepted');
      report('network-intercept', 'PASS', `fetch-result=${result}`);
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('network-intercept', 'SKIP', 'BiDi does not cover interception: ' + e.message);
      else report('network-intercept', 'FAIL', e.message);
    }

    // 11. drag-and-drop: mouse drag from source to target center.
    try {
      const page = await freshPage();
      const src = await page.$('#drag-source');
      const dst = await page.$('#drop-zone');
      const sb = await src.boundingBox();
      const db = await dst.boundingBox();
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.mouse.down();
      await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 10 });
      await page.mouse.up();
      const result = await waitUntil(async () => {
        const t = await pageText(page, '#drag-result');
        return t === 'dropped' ? t : null;
      }, 10000, 'drag-result dropped');
      report('drag-and-drop', 'PASS', `drag-result=${result}`);
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('drag-and-drop', 'SKIP', 'BiDi does not cover input drag: ' + e.message);
      else report('drag-and-drop', 'FAIL', e.message);
    }

    // 12. hover: page.hover, assert mouseover handler ran.
    try {
      const page = await freshPage();
      await page.hover('#hover-target');
      const result = await waitUntil(async () => {
        const t = await pageText(page, '#hover-result');
        return t === 'hovered' ? t : null;
      }, 10000, 'hover-result hovered');
      report('hover', 'PASS', `hover-result=${result}`);
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('hover', 'SKIP', 'BiDi does not cover input hover: ' + e.message);
      else report('hover', 'FAIL', e.message);
    }

    // 13. keyboard: focus the target, press ArrowRight, assert handler.
    try {
      const page = await freshPage();
      await page.click('#key-target');
      await page.keyboard.press('ArrowRight');
      const result = await waitUntil(async () => {
        const t = await pageText(page, '#key-result');
        return t === 'arrow-right' ? t : null;
      }, 10000, 'key-result arrow-right');
      report('keyboard', 'PASS', `key-result=${result}`);
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('keyboard', 'SKIP', 'BiDi does not cover input keys: ' + e.message);
      else report('keyboard', 'FAIL', e.message);
    }

    // 14. multi-tab: click the target=_blank link, capture the new
    // target via targetcreated (precise: other pages sit idle), assert.
    try {
      const page = await freshPage();
      const created = [];
      const onCreated = (t) => created.push(t);
      browser.on('targetcreated', onCreated);
      await page.click('#link-newtab');
      const target = await waitUntil(() => created.find(t => t.type() === 'page') || null, 10000, 'new tab target');
      browser.off('targetcreated', onCreated);
      const tab = await target.page();
      await tab.waitForSelector('#second-title', { timeout: 10000 });
      if (!tab.url().endsWith('/second')) throw new Error('tab url is ' + tab.url());
      report('multi-tab', 'PASS', `tab landed ${tab.url()}`);
      await tab.close();
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('multi-tab', 'SKIP', 'BiDi does not cover tab targets: ' + e.message);
      else report('multi-tab', 'FAIL', e.message);
    }

    // 15. iframe: find the frame by URL, click inside, assert.
    try {
      const page = await freshPage();
      await page.waitForSelector('#probe-frame', { timeout: 10000 });
      const frame = page.frames().find(f => f.url().includes('/iframe-inner'));
      if (!frame) throw new Error('frame /iframe-inner not found');
      await frame.click('#inner-btn');
      const result = await waitUntil(async () => {
        const t = await frame.$eval('#inner-result', el => el.textContent);
        return t === 'inner-clicked' ? t : null;
      }, 10000, 'inner-result inner-clicked');
      report('iframe', 'PASS', `inner-result=${result}`);
      await page.close();
    } catch (e) {
      if (isUnsupported(e)) report('iframe', 'SKIP', 'BiDi does not cover frames: ' + e.message);
      else report('iframe', 'FAIL', e.message);
    }
  } finally {
    await browser.close();
  }

  const p = results.filter(r => r.status === 'PASS').length;
  const f = results.filter(r => r.status === 'FAIL').length;
  const s = results.filter(r => r.status === 'SKIP').length;
  console.log(`SUMMARY ${p} ${f} ${s}`);
  process.exit(f > 0 ? 1 : 0);
})().catch(e => {
  console.error('suite crashed: ' + (e && e.message));
  process.exit(1);
});
