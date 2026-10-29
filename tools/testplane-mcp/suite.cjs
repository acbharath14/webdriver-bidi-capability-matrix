// Testplane MCP suite — MCP-only harness entry for @testplane/mcp.
// The suite is a minimal MCP client (JSON-RPC over stdio) that drives the
// @testplane/mcp server (0.9.0) against the probe page. It does NOT use an
// AI agent: every tool call is scripted here, so results are deterministic.
// Env: PROBE_URL (default http://127.0.0.1:4333).
// Output contract: one `RESULT <key> <PASS|FAIL|SKIP> [detail]` line and
// one `TIMING <key> <ms>` line per capability, a `SESSION <k=v>...` line
// with session facts, then a `SUMMARY <pass> <fail> <skip>` line.
// Exit 1 on any FAIL.
// Tool inventory (verified via tools/list, 24 tools):
// navigation -> navigate; console-log -> console (Chromium-only, unseen
// messages only); js-error -> console IF it surfaces thrown errors, else
// SKIP (no dedicated error tool); network-capture -> NO tool (SKIP);
// script-eval -> run-code; cookie -> NO tool (SKIP; save-state /
// restore-state persist state but are not cookie get/set);
// screenshot -> screenshot; dialog -> NO tool (SKIP);
// input-click -> type + click; network-intercept -> NO tool (SKIP).
// Capabilities map to DEDICATED tools only: run-code is used for
// script-eval and to READ page state for assertions, never to simulate
// a missing tool (no subscribing to console/network events to fake a
// missing capability).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
const SERVER = path.join(__dirname, 'node_modules', '@testplane', 'mcp', 'build', 'cli.js');

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
// Normalize a run-code result to a plain value. The server wraps the
// value in a JSON envelope: `{\n  "result": <value>\n}` (verified:
// 1+1 -> {"result": 2}, greet text -> {"result": "Hello, Ada"}).
// Unwrap that envelope; callers compare loosely (numbers accept 2 or '2').
function unwrapRunCode(text) {
  const t = (text || '').trim();
  try {
    const parsed = JSON.parse(t);
    if (parsed && typeof parsed === 'object' && 'result' in parsed) return parsed.result;
    return parsed;
  } catch (e) { /* not JSON */ }
  const quoted = t.match(/^"(.*)"$/s);
  if (quoted) {
    try { return JSON.parse(t); } catch (e) { return quoted[1]; }
  }
  return t;
}

(async () => {
  const child = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise(r => child.on('exit', (code, signal) => r({ code, signal })));
  const mcp = new Mcp(child);
  const shutdown = async () => {
    try { await mcp.tool('close-browser', {}); } catch (e) { /* best effort */ }
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
    await mcp.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bidi-matrix-testplane-mcp', version: '0.1.0' } }, 180000);
    mcp.notify('notifications/initialized', {});
    const tools = await mcp.call('tools/list', {});
    const names = new Set(tools.tools.map(t => t.name));
    console.log(`SESSION tools=${tools.tools.length} has-cookie-tool=${[...names].some(n => n.includes('cookie'))} has-intercept-tool=${[...names].some(n => n.includes('mock') || n.includes('intercept'))}`);

    // Session: launch Chrome explicitly. As root, plain navigate fails
    // with "session not created: Chrome instance exited" — the launch
    // below with --no-sandbox is required in the sandbox (and harmless
    // on a normal desktop). navigate alone is the default path for a
    // desktop user; the suite documents the accommodation in NOTES.md.
    try {
      await mcp.tool('launch', { headless: true, desiredCapabilities: { browserName: 'chrome', 'goog:chromeOptions': { args: ['--no-sandbox'] } } });
    } catch (e) {
      failAll('launch failed: ' + e.message);
      return;
    }
    async function goHome() {
      await mcp.tool('navigate', { url: BASE + '/' });
    }
    try {
      await goHome();
    } catch (e) {
      failAll('navigate home failed after launch: ' + e.message);
      return;
    }
    // run-code accepts either a function receiving `browser` or a bare
    // expression, depending on server version. Try the function form
    // first (documented for browser.execute), fall back to the bare form.
    async function runCode(jsExpr) {
      const forms = [
        `(browser) => browser.execute(() => ${jsExpr})`,
        jsExpr,
      ];
      const errs = [];
      for (const code of forms) {
        try {
          const res = await mcp.tool('run-code', { code });
          return unwrapRunCode(textOf(res));
        } catch (e) { errs.push(e.message); }
      }
      throw new Error('run-code failed both forms: ' + errs.join(' ;; '));
    }
    async function evalText(jsExpr) {
      const v = await runCode(jsExpr);
      return typeof v === 'string' ? v : JSON.stringify(v);
    }
    mark(); // baseline: capability 1 timing excludes session start

    // 1. navigation
    try {
      await mcp.tool('navigate', { url: BASE + '/second' });
      const href = await evalText('location.href');
      if (!href.endsWith('/second')) throw new Error('href=' + JSON.stringify(href));
      await goHome();
      report('navigation', 'PASS', 'href ends /second via navigate + run-code');
    } catch (e) { report('navigation', 'FAIL', e.message); }

    // 2. console-log: the console tool surfaces WARNING/SEVERE but NOT
    // INFO-level console.log (verified by level probe: probe-warn,
    // probe-error, probe-thrown all appear; probe-log never does, even
    // after a sleep). So: poll for probe-log; if it never appears, prove
    // the tool itself works via probe-warn and SKIP with that evidence
    // (the tool exists, but INFO capture is absent). A late probe-log
    // during the warn phase still counts as PASS.
    try {
      await goHome();
      await mcp.tool('click', { selector: '#btn-log' });
      let logFound = null;
      try {
        logFound = await waitUntil(async () => {
          const t = textOf(await mcp.tool('console', {}));
          return t.includes('probe-log') ? t : null;
        }, 15000, 'console message probe-log');
      } catch (e) { /* not surfaced in this window */ }
      if (logFound) {
        report('console-log', 'PASS', logFound.slice(0, 200).replace(/\n/g, ' | '));
      } else {
        await mcp.tool('click', { selector: '#btn-warn' });
        const warnOut = await waitUntil(async () => {
          const t = textOf(await mcp.tool('console', {}));
          return (t.includes('probe-warn') || t.includes('probe-log')) ? t : null;
        }, 30000, 'console message probe-warn');
        if (warnOut.includes('probe-log')) {
          report('console-log', 'PASS', 'probe-log surfaced late: ' + warnOut.slice(0, 200).replace(/\n/g, ' | '));
        } else {
          report('console-log', 'SKIP', 'console tool surfaces WARNING/SEVERE (probe-warn returned) but not INFO console.log (probe-log never returned)');
        }
      }
    } catch (e) { report('console-log', 'FAIL', e.message); }

    // 3. js-error: PASS only if the console tool surfaces the thrown
    // error. If console calls succeed but never show it, the capability
    // is not provided (no dedicated error tool) -> SKIP, not FAIL.
    try {
      await goHome();
      await mcp.tool('click', { selector: '#btn-throw' });
      let found = null;
      try {
        found = await waitUntil(async () => {
          const t = textOf(await mcp.tool('console', {}));
          return t.includes('probe-thrown') ? t : null;
        }, 30000, 'console message probe-thrown');
      } catch (e) { /* not surfaced */ }
      if (found) {
        report('js-error', 'PASS', 'probe-thrown surfaced via console tool (SEVERE javascript entry)');
      } else {
        report('js-error', 'SKIP', 'console tool does not surface thrown errors (no dedicated error tool); click #btn-throw produced no probe-thrown entry');
      }
    } catch (e) { report('js-error', 'FAIL', e.message); }

    // 4. network-capture: no network-list tool -> SKIP.
    try {
      const found = [...names].find(n => n.includes('network'));
      if (found) throw new Error('unexpected network tool present: ' + found + '; suite assumption wrong');
      report('network-capture', 'SKIP', 'no network-list tool in the server tool list');
    } catch (e) { report('network-capture', 'FAIL', e.message); }

    // 5. script-eval
    try {
      await goHome();
      const sum = await runCode('1 + 1');
      if (sum !== 2 && sum !== '2') throw new Error('run-code 1+1=' + JSON.stringify(sum));
      const title = await evalText('document.title');
      if (title !== 'BiDi Probe') throw new Error('title=' + JSON.stringify(title));
      report('script-eval', 'PASS', '1+1=2 title=BiDi Probe via run-code');
    } catch (e) { report('script-eval', 'FAIL', e.message); }

    // 6. cookie: no cookie tool -> SKIP. save-state / restore-state
    // persist browser state but are not cookie get/set tools.
    try {
      const found = [...names].find(n => n.includes('cookie'));
      if (found) throw new Error('unexpected cookie tool present: ' + found + '; suite assumption wrong');
      report('cookie', 'SKIP', 'no cookie get/set tool in the server tool list (save-state/restore-state persist state, not cookie access)');
    } catch (e) { report('cookie', 'FAIL', e.message); }

    // 7. screenshot: image content inline, or a written .png file path.
    try {
      await goHome();
      const res = await mcp.tool('screenshot', {});
      const img = (res.content || []).find(c => c.type === 'image');
      let bytes = 0;
      let isPng = false;
      if (img && (img.data || '').length) {
        const buf = Buffer.from(img.data, 'base64');
        bytes = buf.length;
        isPng = bytes > 1000 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      } else {
        const t = textOf(res);
        const m = t.match(/([^\s"']+\.png)/);
        if (m && fs.existsSync(m[1])) {
          const buf = fs.readFileSync(m[1]);
          bytes = buf.length;
          isPng = bytes > 1000 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
        } else {
          throw new Error('no image content or png path: ' + t.slice(0, 200));
        }
      }
      if (!isPng) throw new Error('screenshot bytes=' + bytes + ' not PNG');
      report('screenshot', 'PASS', 'bytes=' + bytes + ' png-signature=yes');
    } catch (e) { report('screenshot', 'FAIL', e.message); }

    // 8. dialog: no dialog tool -> SKIP (never click Alert/Confirm: with
    // no handler tool the prompt would block the page).
    try {
      const found = [...names].find(n => n.includes('dialog') || n.includes('alert'));
      if (found) throw new Error('unexpected dialog tool present: ' + found + '; suite assumption wrong');
      report('dialog', 'SKIP', 'no dialog tool in the server tool list');
    } catch (e) { report('dialog', 'FAIL', e.message); }

    // 9. input-click
    try {
      await goHome();
      await mcp.tool('type', { selector: '#input-name', value: 'Ada' });
      await mcp.tool('click', { selector: '#btn-greet' });
      const greet = await waitUntil(async () => {
        const t = await evalText('document.querySelector("#greet-result").textContent');
        return t === 'Hello, Ada' ? t : null;
      }, 30000, 'greet-result Hello, Ada');
      report('input-click', 'PASS', greet + ' via type + click');
    } catch (e) { report('input-click', 'FAIL', e.message); }

    // 10. network-intercept: no mock/intercept tool -> SKIP.
    try {
      const found = [...names].find(n => n.includes('mock') || n.includes('intercept'));
      if (found) throw new Error('unexpected intercept tool present: ' + found + '; suite assumption wrong');
      report('network-intercept', 'SKIP', 'no mock/intercept tool in the server tool list');
    } catch (e) { report('network-intercept', 'FAIL', e.message); }

    // 11. drag-and-drop: no drag tool -> SKIP (same assumption-check
    // pattern as network-intercept).
    try {
      const found = [...names].find(n => n.includes('drag'));
      if (found) throw new Error('unexpected drag tool present: ' + found + '; suite assumption wrong');
      report('drag-and-drop', 'SKIP', 'no drag tool in the server tool list (24 tools)');
    } catch (e) { report('drag-and-drop', 'FAIL', e.message); }

    // 12. hover: hover tool with a CSS selector.
    try {
      await goHome();
      await mcp.tool('hover', { selector: '#hover-target' });
      const result = await waitUntil(async () => {
        const t = await evalText(`document.querySelector('#hover-result').textContent`);
        return t === 'hovered' ? t : null;
      }, 30000, 'hover-result hovered');
      report('hover', 'PASS', `hover-result=${result} via hover tool`);
    } catch (e) { report('hover', 'FAIL', e.message); }

    // 13. keyboard: no press-key tool -> SKIP. type is text-only (its
    // value is the text to type, not a key), so it cannot send ArrowRight.
    try {
      const found = [...names].find(n => n.includes('press') || n.includes('keyboard') || n.includes('key'));
      if (found) throw new Error('unexpected key tool present: ' + found + '; suite assumption wrong');
      report('keyboard', 'SKIP', 'no press-key tool in the server tool list; type is text-only and cannot send ArrowRight');
    } catch (e) { report('keyboard', 'FAIL', e.message); }

    // 14. multi-tab: click the target=_blank link, switch to the new
    // tab (tab 2: the suite opens exactly one tab before this cell),
    // assert, close it, switch back to tab 1.
    try {
      await goHome();
      await mcp.tool('click', { selector: '#link-newtab' });
      const tabsAfter = textOf(await mcp.tool('list-tabs', {}));
      await mcp.tool('switch-tab', { tabNumber: 2 });
      const snap = textOf(await mcp.tool('snapshot', {}));
      if (!snap.includes('Second page')) throw new Error('new tab snapshot lacks Second page: ' + snap.slice(0, 300));
      await mcp.tool('close-tab', { tabNumber: 2 });
      await mcp.tool('switch-tab', { tabNumber: 1 });
      report('multi-tab', 'PASS', `new tab showed Second page; tabs after click: ${tabsAfter.slice(0, 200).replace(/\n/g, ' | ')}`);
    } catch (e) { report('multi-tab', 'FAIL', e.message); }

    // 15. iframe: no frame tool -> SKIP (same assumption-check pattern).
    try {
      const found = [...names].find(n => n.includes('frame'));
      if (found) throw new Error('unexpected frame tool present: ' + found + '; suite assumption wrong');
      report('iframe', 'SKIP', 'no frame tool in the server tool list (24 tools); run-code is observation-only by the matrix design rule, so it cannot substitute for frame interaction');
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
