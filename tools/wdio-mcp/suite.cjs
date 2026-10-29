// WebdriverIO MCP suite — MCP-only harness entry for @wdio/mcp.
// The suite is a minimal MCP client (JSON-RPC over stdio) that drives the
// @wdio/mcp server (4.0.1) against the probe page. It does NOT use an AI
// agent: every tool call is scripted here, so results are deterministic.
// Env: PROBE_URL (default http://127.0.0.1:4333).
// Output contract: one `RESULT <key> <PASS|FAIL|SKIP> [detail]` line and
// one `TIMING <key> <ms>` line per capability, a `SESSION <k=v>...` line
// with session facts, then a `SUMMARY <pass> <fail> <skip>` line.
// Exit 1 on any FAIL.
// Tool inventory (verified via tools/list, 17 base tools + gated groups):
// navigation -> navigate; console-log -> NO tool (SKIP); js-error -> NO
// tool (SKIP); network-capture -> NO tool (SKIP); script-eval ->
// execute_script; cookie -> set_cookie + get_cookies (gated 'cookies'
// group); screenshot -> get_screenshot; dialog -> NO tool (SKIP);
// input-click -> set_value + click_element; network-intercept -> mock
// (gated 'mocks' group) + get_mock_calls. Capabilities map to DEDICATED
// tools only: execute_script is used for script-eval and to READ page
// state for assertions, never to simulate a missing tool.
const { spawn } = require('node:child_process');
const path = require('node:path');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
const SERVER = path.join(__dirname, 'node_modules', '@wdio', 'mcp', 'lib', 'server.js');

const CAPABILITIES = [
  'navigation', 'console-log', 'js-error', 'network-capture',
  'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click',
  'network-intercept', 'drag-and-drop', 'hover', 'keyboard',
  'multi-tab', 'iframe',
];

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
  // Single-line details: the RESULT contract is one line per capability.
  const clean = String(detail || '').replace(/\s*\n\s*/g, ' | ');
  console.log(`RESULT ${key} ${status}${clean ? ' ' + clean : ''}`);
  console.log(`TIMING ${key} ${mark()}`);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitUntil(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await sleep(500);
  }
  throw new Error('timed out waiting for ' + label);
}

class Mcp {
  constructor(child) {
    this.child = child;
    this.nextId = 1;
    this.pending = new Map();
    this.buf = '';
    child.stdout.on('data', d => {
      this.buf += d.toString();
      let idx;
      while ((idx = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, idx).trim();
        this.buf = this.buf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch (e) { continue; }
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
        }
      }
    });
  }
  call(method, params, timeoutMs) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('MCP call timed out: ' + method)); }
      }, timeoutMs || 120000);
      // Clear on settle: an uncleared timer keeps node alive for its full
      // duration after the work is done.
      this.pending.set(id, {
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); },
      });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  notify(method, params) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }
  async tool(name, args) {
    const res = await this.call('tools/call', { name, arguments: args || {} });
    if (res && res.isError) throw new Error('tool ' + name + ' returned isError: ' + textOf(res).slice(0, 300));
    return res;
  }
}
function textOf(res) {
  if (!res || !Array.isArray(res.content)) return JSON.stringify(res);
  return res.content.map(c => {
    if (c.type === 'text') return c.text;
    if (c.type === 'image') return `[image ${c.mimeType || ''} ${(c.data || '').length} chars]`;
    return `[${c.type}]`;
  }).join('\n');
}
// execute_script results arrive as text like "Result: <value>". Strip the
// prefix so callers compare plain values.
function unwrapEval(text) {
  const t = (text || '').trim();
  const m = t.match(/^Result:\s*([\s\S]*)$/);
  return m ? m[1].trim() : t;
}

(async () => {
  const child = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise(r => child.on('exit', (code, signal) => r({ code, signal })));
  const mcp = new Mcp(child);
  const shutdown = async () => {
    try { await mcp.tool('close_session', {}); } catch (e) { /* best effort */ }
    try { child.stdin.end(); } catch (e) { /* ignore */ }
    const done = await Promise.race([exited, new Promise(r => setTimeout(() => r('timeout'), 15000))]);
    if (done === 'timeout') {
      child.kill('SIGKILL');
      try { child.stdout.destroy(); } catch (e) { /* ignore */ }
    }
  };
  // If the server never comes up, report every cell FAIL (with the reason)
  // instead of crashing with no output: a missing server is a signal, and
  // the runner prints these lines as the tool's evidence.
  const failAll = (reason) => {
    for (const key of CAPABILITIES) report(key, 'FAIL', reason);
    console.log(`SUMMARY 0 ${CAPABILITIES.length} 0`);
    process.exitCode = 1;
  };
  try {
    await mcp.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bidi-matrix-wdio-mcp', version: '0.1.0' } }, 120000);
    mcp.notify('notifications/initialized', {});
    const baseTools = await mcp.call('tools/list', {});
    const baseNames = new Set(baseTools.tools.map(t => t.name));

    // Session: local Chrome, headless 1280x800, straight to the probe page.
    // capabilities {webSocketUrl: true} is the documented requirement for
    // browser mocks (the server checks browser.isBidi before mocking).
    let sessionText;
    try {
      const res = await mcp.tool('start_session', { platform: 'browser', browser: 'chrome', headless: true, navigationUrl: BASE + '/', capabilities: { webSocketUrl: true } });
      sessionText = textOf(res);
    } catch (e) {
      failAll('start_session failed: ' + e.message);
      return;
    }
    if (!sessionText.includes(BASE)) {
      failAll('start_session did not land on probe page: ' + sessionText.slice(0, 200));
      return;
    }
    // Gated groups: cookies + mocks. Absence here is a FAIL (the groups are
    // documented server features), not a SKIP.
    let gatedOk = true;
    let gatedErr = '';
    try {
      await mcp.tool('enable_tools', { groups: ['cookies', 'mocks'] });
    } catch (e) { gatedOk = false; gatedErr = e.message; }
    const allTools = await mcp.call('tools/list', {});
    const names = new Set(allTools.tools.map(t => t.name));
    console.log(`SESSION tools=${allTools.tools.length} base-tools=${baseTools.tools.length} has-cookie-tool=${names.has('set_cookie')} has-mock-tool=${names.has('mock')}`);

    async function goHome() {
      await mcp.tool('navigate', { url: BASE + '/' });
    }
    async function evalText(script) {
      return textOf(await mcp.tool('execute_script', { script }));
    }
    async function evalValue(script) {
      return unwrapEval(await evalText(script));
    }
    // Browser version for the SESSION line, from the user agent (the
    // server exposes no version tool; the runner's setup table uses this).
    try {
      const ua = await evalValue('return navigator.userAgent');
      const m = ua.match(/HeadlessChrome\/([\d.]+)/) || ua.match(/Chrome\/([\d.]+)/);
      if (m) console.log(`SESSION browser=Chrome/${m[1]}`);
    } catch (e) { /* browser version stays server-managed */ }
    mark(); // baseline: capability 1 timing excludes session start

    // 1. navigation
    try {
      await mcp.tool('navigate', { url: BASE + '/second' });
      const tabsText = textOf(await mcp.tool('get_tabs', {}));
      let landed = tabsText.includes('/second');
      if (!landed) {
        const href = await evalValue('return location.href');
        landed = href.endsWith('/second');
      }
      if (!landed) throw new Error('tabs=' + tabsText.slice(0, 200));
      await goHome();
      report('navigation', 'PASS', 'tab url ends /second');
    } catch (e) { report('navigation', 'FAIL', e.message); }

    // 2. console-log: no console tool in base or gated lists -> SKIP.
    try {
      const found = [...names].find(n => n.includes('console'));
      if (found) throw new Error('unexpected console tool present: ' + found + '; suite assumption wrong');
      report('console-log', 'SKIP', 'no console tool in the server tool list (base ' + baseTools.tools.length + ' + gated ' + allTools.tools.length + ' tools)');
    } catch (e) { report('console-log', 'FAIL', e.message); }

    // 3. js-error: no error tool -> SKIP.
    try {
      const found = [...names].find(n => n.includes('error'));
      if (found) throw new Error('unexpected error tool present: ' + found + '; suite assumption wrong');
      report('js-error', 'SKIP', 'no error tool in the server tool list');
    } catch (e) { report('js-error', 'FAIL', e.message); }

    // 4. network-capture: no network-list tool -> SKIP.
    try {
      const found = [...names].find(n => n.includes('network'));
      if (found) throw new Error('unexpected network tool present: ' + found + '; suite assumption wrong');
      report('network-capture', 'SKIP', 'no network-list tool in the server tool list (mock records calls but does not list network traffic)');
    } catch (e) { report('network-capture', 'FAIL', e.message); }

    // 5. script-eval
    try {
      await goHome();
      let val;
      let form;
      try {
        val = await evalValue('return 1 + 1');
        form = 'return-form';
      } catch (e) {
        val = await evalValue('1 + 1');
        form = 'bare-form';
      }
      if (val !== '2') throw new Error('eval 1+1=' + JSON.stringify(val));
      const title = await evalValue('return document.title');
      if (title !== 'BiDi Probe') throw new Error('title=' + JSON.stringify(title));
      report('script-eval', 'PASS', '1+1=2 title=BiDi Probe via execute_script (' + form + ')');
    } catch (e) { report('script-eval', 'FAIL', e.message); }

    // 6. cookie (gated)
    try {
      if (!gatedOk) throw new Error('enable_tools failed: ' + gatedErr);
      if (!names.has('set_cookie') || !names.has('get_cookies')) throw new Error('cookie tools missing after enable_tools');
      await goHome();
      await mcp.tool('set_cookie', { name: 'probe', value: 'chocochip' });
      const cookiesText = textOf(await mcp.tool('get_cookies', { name: 'probe' }));
      if (!cookiesText.includes('chocochip')) throw new Error('get_cookies=' + cookiesText.slice(0, 200));
      report('cookie', 'PASS', 'probe=chocochip via set_cookie + get_cookies');
    } catch (e) { report('cookie', 'FAIL', e.message); }

    // 7. screenshot
    try {
      await goHome();
      const res = await mcp.tool('get_screenshot', {});
      const img = (res.content || []).find(c => c.type === 'image');
      if (!img || !(img.data || '').length) throw new Error('no image content: ' + textOf(res).slice(0, 200));
      const buf = Buffer.from(img.data, 'base64');
      const isPng = buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      if (!isPng) throw new Error('screenshot bytes=' + buf.length + ' not PNG');
      report('screenshot', 'PASS', 'bytes=' + buf.length + ' png-signature=yes');
    } catch (e) { report('screenshot', 'FAIL', e.message); }

    // 8. dialog: no dialog tool -> SKIP (never click Alert/Confirm: with no
    // handler tool the prompt would block the page).
    try {
      const found = [...names].find(n => n.includes('dialog') || n.includes('alert'));
      if (found) throw new Error('unexpected dialog tool present: ' + found + '; suite assumption wrong');
      report('dialog', 'SKIP', 'no dialog tool in the server tool list');
    } catch (e) { report('dialog', 'FAIL', e.message); }

    // 9. input-click
    try {
      await goHome();
      await mcp.tool('set_value', { selector: '#input-name', value: 'Ada' });
      await mcp.tool('click_element', { selector: '#btn-greet' });
      const greet = await waitUntil(async () => {
        const t = await evalValue('return document.querySelector("#greet-result").textContent');
        return t === 'Hello, Ada' ? t : null;
      }, 30000, 'greet-result Hello, Ada');
      report('input-click', 'PASS', greet + ' via set_value + click_element');
    } catch (e) { report('input-click', 'FAIL', e.message); }

    // 10. network-intercept (gated mock)
    try {
      if (!gatedOk) throw new Error('enable_tools failed: ' + gatedErr);
      if (!names.has('mock')) throw new Error('mock tool missing after enable_tools');
      await goHome();
      await mcp.tool('mock', { url: '**/api/ping', behavior: 'respond', value: { ok: true, msg: 'intercepted' }, statusCode: 200, headers: { 'Content-Type': 'application/json' } });
      await mcp.tool('click_element', { selector: '#btn-fetch' });
      const result = await waitUntil(async () => {
        const t = await evalValue('return document.querySelector("#fetch-result").textContent');
        return t === 'intercepted' ? t : null;
      }, 30000, 'fetch-result intercepted');
      let calls = '?';
      try {
        const callsText = textOf(await mcp.tool('get_mock_calls', { url: '**/api/ping' }));
        const parsed = JSON.parse(callsText);
        calls = parsed.callCount;
      } catch (e) { /* calls evidence best-effort */ }
      report('network-intercept', 'PASS', 'fetch-result=' + result + ' mock-calls=' + calls);
    } catch (e) { report('network-intercept', 'FAIL', e.message); }

    // Remove the mock before the tab/frame cells. A live browser mock
    // crashes this server when a new tab is opened: the mock's
    // #handleResponseStarted calls network.provideResponse for the new
    // tab's navigation request, which fails with "no such request" as an
    // unhandled exception that kills the whole server process (verified
    // 2026-10-27: click #link-newtab timed out and the server exited 1
    // with the mock active; with manage_mock restore first, the same
    // sequence passes in <1s per call). Best-effort: if the mock was
    // never registered (intercept cell failed early), restore errors
    // "mock not found" and is ignored.
    try { await mcp.tool('manage_mock', { action: 'restore', url: '**/api/ping' }); } catch (e) { /* mock already gone */ }

    // 11. drag-and-drop: no drag tool -> SKIP. perform_actions offers
    // only click/fill/select/check/uncheck/press (no drag primitive),
    // so there is no dedicated drag surface to map this to.
    try {
      const hasDrag = ['drag', 'drag_and_drop', 'drag_element', 'drag_to', 'drag_and_drop_element'].some(n => names.has(n));
      if (hasDrag) throw new Error('unexpected drag tool present; suite assumption wrong');
      report('drag-and-drop', 'SKIP', 'no drag tool in the server tool list; perform_actions has only click/fill/select/check/uncheck/press, no drag primitive');
    } catch (e) { report('drag-and-drop', 'FAIL', e.message); }

    // 12. hover: no hover tool -> SKIP (same reasoning; click would
    // conflate hover with click, so it is not a hover demonstration).
    try {
      const hasHover = ['hover', 'hover_element', 'move_to', 'mouse_move'].some(n => names.has(n));
      if (hasHover) throw new Error('unexpected hover tool present; suite assumption wrong');
      report('hover', 'SKIP', 'no hover tool in the server tool list; perform_actions has no hover primitive');
    } catch (e) { report('hover', 'FAIL', e.message); }

    // 13. keyboard: press_key ArrowRight, focused on the target first.
    try {
      await goHome();
      await mcp.tool('click_element', { selector: '#key-target' });
      await mcp.tool('press_key', { keys: 'ArrowRight' });
      const result = await waitUntil(async () => {
        const t = await evalValue('return document.querySelector("#key-result").textContent');
        return t === 'arrow-right' ? t : null;
      }, 30000, 'key-result arrow-right');
      report('keyboard', 'PASS', `key-result=${result} via press_key ArrowRight`);
    } catch (e) { report('keyboard', 'FAIL', e.message); }

    // 14. multi-tab: click the target=_blank link, find the new tab in
    // get_tabs, switch to it, assert, switch back.
    try {
      await goHome();
      await mcp.tool('click_element', { selector: '#link-newtab' });
      const tabsText = textOf(await mcp.tool('get_tabs', {}));
      // get_tabs returns a JSON array [{handle, title, url, isActive}]
      // with NO index field; tab index is the array position (verified:
      // position 0 is /, position 1 is the new /second tab, and
      // switch_tab {index: 1} lands on it). Do NOT parse digits out of
      // the text: the first digits in the JSON are part of a handle.
      let tabIdx = null;
      try {
        const parsed = JSON.parse(tabsText);
        const arr = Array.isArray(parsed) ? parsed : (parsed.tabs || parsed.pages || null);
        if (arr) {
          const idx = arr.findIndex(t => String(t.url || t.URL || '').endsWith('/second'));
          if (idx >= 0) tabIdx = idx;
        }
      } catch (_) { /* tabIdx stays null -> FAIL below */ }
      if (tabIdx === null) throw new Error('new /second tab not found in get_tabs: ' + tabsText.slice(0, 300));
      await mcp.tool('switch_tab', { index: tabIdx });
      const snap = textOf(await mcp.tool('snapshot', {}));
      if (!snap.includes('Second page')) throw new Error('new tab snapshot lacks Second page: ' + snap.slice(0, 300));
      await mcp.tool('switch_tab', { index: 0 });
      report('multi-tab', 'PASS', `new tab index ${tabIdx} showed Second page; returned to tab 0`);
    } catch (e) { report('multi-tab', 'FAIL', e.message); }

    // 15. iframe: switch_frame to the iframe, click inside, read back
    // (execute_script only reads state here), switch back to top.
    try {
      await goHome();
      await mcp.tool('switch_frame', { selector: '#probe-frame' });
      await mcp.tool('click_element', { selector: '#inner-btn' });
      const result = await waitUntil(async () => {
        const t = await evalValue('return document.querySelector("#inner-result").textContent');
        return t === 'inner-clicked' ? t : null;
      }, 30000, 'inner-result inner-clicked');
      await mcp.tool('switch_frame', {});
      report('iframe', 'PASS', `inner-result=${result} via switch_frame + click_element`);
    } catch (e) { report('iframe', 'FAIL', e.message); }

    const p = results.filter(r => r.status === 'PASS').length;
    const f = results.filter(r => r.status === 'FAIL').length;
    const s = results.filter(r => r.status === 'SKIP').length;
    console.log(`SUMMARY ${p} ${f} ${s}`);
    process.exitCode = f > 0 ? 1 : 0;
  } finally {
    await shutdown();
  }
})().catch(e => { console.error('SUITE CRASH:', e.message); process.exit(1); });
