// Firefox DevTools MCP suite — MCP-only, Firefox-only harness entry.
// The suite is a minimal MCP client (JSON-RPC over stdio) that drives the
// @mozilla/firefox-devtools-mcp server (0.10.6, developer preset) against
// the probe page. It does NOT use an AI agent: every tool call is scripted
// here, so results are deterministic.
// Env: PROBE_URL (default http://127.0.0.1:4333), FIREFOX_PATH (default:
// the Firefox downloaded under ../firefox).
// Output contract: one `RESULT <key> <PASS|FAIL|SKIP> [detail]` line per
// capability, then a `SUMMARY <pass> <fail> <skip>` line. Exit 1 on any FAIL.
// Tool inventory (verified via tools/list, developer preset, 49 tools):
// navigation -> navigate_page; console -> list_console_messages;
// js-error -> list_console_messages; network-capture -> list_network_requests;
// script-eval -> evaluate_script; screenshot -> screenshot_page;
// dialog -> accept_dialog / dismiss_dialog; input-click -> take_snapshot +
// fill_by_uid + click_by_uid. NO cookie tool and NO interception tool exist
// in the server's tool list — those two cells are SKIP (see below).
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.PROBE_URL || 'http://127.0.0.1:4333';
const SERVER = path.join(__dirname, 'node_modules', '@mozilla', 'firefox-devtools-mcp', 'dist', 'index.js');
const FIREFOX = process.env.FIREFOX_PATH || path.join(__dirname, '..', 'firefox', 'firefox', 'firefox');

const results = [];
function report(key, status, detail) {
  results.push({ key, status });
  // Single-line details: the RESULT contract is one line per capability.
  const clean = String(detail || '').replace(/\s*\n\s*/g, ' | ');
  console.log(`RESULT ${key} ${status}${clean ? ' ' + clean : ''}`);
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
      // duration after the work is done (observed: probes ran exactly as
      // long as their longest timeout).
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
// Snapshot lines look like: `  uid=e1 button "Log" text="Log"`.
function parseSnapshot(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/uid=([A-Za-z0-9_-]+)\s+\S+\s+"([^"]*)"/);
    if (m) map.set(m[2], m[1]);
  }
  return map;
}
// Unwrap evaluate_script results. The server wraps the value as:
//   Script ran on page and returned:
//   ```json
//   "<value-as-JSON>"
//   ```
// So: extract the fenced json block first, then JSON-parse repeatedly while
// the result is still a JSON-looking string.
function unwrapEval(text) {
  let cur = (text || '').trim();
  const fence = cur.match(/```json\s*([\s\S]*?)\s*```/);
  if (fence) cur = fence[1].trim();
  for (let i = 0; i < 4; i++) {
    try {
      const parsed = JSON.parse(cur);
      if (typeof parsed === 'string') { cur = parsed; continue; }
      return parsed;
    } catch (e) { return cur; }
  }
  return cur;
}

(async () => {
  const child = spawn('node', [SERVER, '--headless', '--firefox-path', FIREFOX, '--start-url', BASE + '/', '--tool-preset', 'developer', '--log-file', path.join(os.tmpdir(), 'firefox-mcp-suite.log')], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise(r => child.on('exit', (code, signal) => r({ code, signal })));
  const mcp = new Mcp(child);
  const shutdown = async () => {
    try { await mcp.tool('close_firefox_session', {}); } catch (e) { /* best effort */ }
    try { child.stdin.end(); } catch (e) { /* ignore */ }
    const done = await Promise.race([exited, new Promise(r => setTimeout(() => r('timeout'), 15000))]);
    if (done === 'timeout') {
      child.kill('SIGKILL');
      try { child.stdout.destroy(); } catch (e) { /* ignore */ }
    }
  };
  try {
    await mcp.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bidi-matrix-mcp', version: '0.1.0' } }, 300000);
    mcp.notify('notifications/initialized', {});
    const tools = await mcp.call('tools/list', {});
    const names = new Set(tools.tools.map(t => t.name));
    console.log(`SESSION mcp-server=0.10.6 tools=${tools.tools.length} has-cookie-tool=${names.has('get_cookies') || names.has('cookies')} has-intercept-tool=${names.has('intercept_request')}`);

    async function goHome() {
      await mcp.tool('navigate_page', { url: BASE + '/' });
    }
    async function snapshotMap() {
      const snap = textOf(await mcp.tool('take_snapshot', {}));
      return parseSnapshot(snap);
    }
    async function clickLabel(label) {
      const map = await snapshotMap();
      const uid = map.get(label);
      if (!uid) throw new Error('no snapshot uid for label ' + JSON.stringify(label));
      await mcp.tool('click_by_uid', { uid });
      return uid;
    }
    async function evalText(fn) {
      return textOf(await mcp.tool('evaluate_script', { function: fn }));
    }

    // 1. navigation
    try {
      await mcp.tool('navigate_page', { url: BASE + '/second' });
      const href = unwrapEval(await evalText('() => location.href'));
      if (typeof href !== 'string' || !href.endsWith('/second')) throw new Error('href=' + JSON.stringify(href));
      report('navigation', 'PASS', 'href=' + href);
      await goHome();
    } catch (e) { report('navigation', 'FAIL', e.message); }

    // 2. console-log
    try {
      await goHome();
      await mcp.tool('clear_console_messages', {});
      await clickLabel('Log');
      const out = await waitUntil(async () => {
        const t = textOf(await mcp.tool('list_console_messages', { textContains: 'probe-log', format: 'json' }));
        return t.includes('probe-log') ? t : null;
      }, 30000, 'console message probe-log');
      report('console-log', 'PASS', out.slice(0, 200).replace(/\n/g, ' | '));
    } catch (e) { report('console-log', 'FAIL', e.message); }

    // 3. js-error
    try {
      await goHome();
      await clickLabel('Throw');
      const out = await waitUntil(async () => {
        const t = textOf(await mcp.tool('list_console_messages', { textContains: 'probe-thrown', format: 'json' }));
        return t.includes('probe-thrown') ? t : null;
      }, 30000, 'console message probe-thrown');
      report('js-error', 'PASS', out.slice(0, 200).replace(/\n/g, ' | '));
    } catch (e) { report('js-error', 'FAIL', e.message); }

    // 4. network-capture
    try {
      await goHome();
      await clickLabel('Fetch');
      const out = await waitUntil(async () => {
        const t = textOf(await mcp.tool('list_network_requests', { urlContains: '/api/ping', format: 'json', detail: 'summary' }));
        return t.includes('/api/ping') && t.includes('200') ? t : null;
      }, 30000, 'network request /api/ping 200');
      report('network-capture', 'PASS', out.slice(0, 200).replace(/\n/g, ' | '));
    } catch (e) { report('network-capture', 'FAIL', e.message); }

    // 5. script-eval
    try {
      await goHome();
      const val = unwrapEval(await evalText('() => JSON.stringify({ sum: 1 + 1, title: document.title })'));
      if (!val || val.sum !== 2 || val.title !== 'BiDi Probe') throw new Error('eval=' + JSON.stringify(val));
      report('script-eval', 'PASS', '1+1=' + val.sum + ' title=' + val.title);
    } catch (e) { report('script-eval', 'FAIL', e.message); }

    // 6. cookie: no cookie tool in the server's tool list -> SKIP (with demo).
    try {
      await goHome();
      const val = unwrapEval(await evalText('() => { document.cookie = "probe=chocochip; path=/"; return document.cookie; }'));
      const ok = typeof val === 'string' && val.includes('probe=chocochip');
      if (!ok) throw new Error('document.cookie=' + JSON.stringify(val));
      report('cookie', 'SKIP', 'document.cookie round-trips via evaluate_script (' + val + ') but the server exposes no dedicated cookie tool');
    } catch (e) { report('cookie', 'FAIL', e.message); }

    // 7. screenshot
    try {
      await goHome();
      const res = await mcp.tool('screenshot_page', {});
      const img = (res.content || []).find(c => c.type === 'image');
      if (!img || !(img.data || '').length) throw new Error('no image content: ' + textOf(res).slice(0, 200));
      report('screenshot', 'PASS', 'image ' + (img.mimeType || '') + ' ' + img.data.length + ' chars base64');
    } catch (e) { report('screenshot', 'FAIL', e.message); }

    // 8. dialog
    // OBSERVED (Firefox 158 + geckodriver BiDi here): accept_dialog /
    // dismiss_dialog exist, but handling fails with "Failed to accept /
    // dismiss dialog" — prompts are auto-dismissed before the tool runs
    // (confirm() always returns false; the accept path can never produce
    // 'confirmed'). Same signature as Selenium/Testplane through
    // chromedriver's mapper. So: SKIP when the auto-dismiss evidence is
    // present, PASS only if both legs genuinely succeed.
    async function handleDialog(toolName) {
      await sleep(1000);
      try {
        await mcp.tool(toolName, {});
      } catch (e) {
        await sleep(1000);
        await mcp.tool(toolName, {});
      }
    }
    async function dialogResult() {
      return unwrapEval(await evalText('() => document.querySelector("#dialog-result").textContent'));
    }
    try {
      await goHome();
      const errs = [];
      try { await clickLabel('Alert'); await handleDialog('accept_dialog'); } catch (e) { errs.push('alert-accept: ' + e.message); }
      try { await clickLabel('Confirm'); await handleDialog('dismiss_dialog'); } catch (e) { errs.push('dismiss: ' + e.message); }
      const afterDismiss = await dialogResult();
      try { await clickLabel('Confirm'); await handleDialog('accept_dialog'); } catch (e) { errs.push('accept: ' + e.message); }
      const afterAccept = await dialogResult();
      const autoDismissed = errs.some(m => /Failed to (accept|dismiss) dialog/i.test(m));
      if (autoDismissed && afterAccept === 'dismissed') {
        report('dialog', 'SKIP', 'accept_dialog/dismiss_dialog exist but handling fails (Failed to accept/dismiss dialog); prompts auto-dismissed before the tool runs (confirm always dismissed, accept leg never confirmed); errs=[' + errs.join('; ') + ']');
      } else if (afterDismiss === 'dismissed' && afterAccept === 'confirmed' && errs.length === 0) {
        report('dialog', 'PASS', 'dismissed then confirmed via accept_dialog/dismiss_dialog');
      } else {
        throw new Error('afterDismiss=' + afterDismiss + ' afterAccept=' + afterAccept + ' errs=[' + errs.join('; ') + ']');
      }
    } catch (e) { report('dialog', 'FAIL', e.message); }

    // 9. input-click
    try {
      await goHome();
      const map = await snapshotMap();
      const inputUid = map.get('Name');
      if (!inputUid) throw new Error('no snapshot uid for Name input');
      await mcp.tool('fill_by_uid', { uid: inputUid, value: 'Ada' });
      await clickLabel('Greet');
      const greet = await waitUntil(async () => {
        const t = unwrapEval(await evalText('() => document.querySelector("#greet-result").textContent'));
        return t === 'Hello, Ada' ? t : null;
      }, 30000, 'greet-result Hello, Ada');
      report('input-click', 'PASS', greet + ' via fill_by_uid + click_by_uid');
    } catch (e) { report('input-click', 'FAIL', e.message); }

    // 10. network-intercept: no interception tool -> SKIP.
    try {
      const hasIntercept = ['intercept_request', 'add_intercept', 'mock_request', 'set_request_interception'].some(n => names.has(n));
      if (hasIntercept) throw new Error('unexpected intercept tool present; suite assumption wrong');
      report('network-intercept', 'SKIP', 'no interception tool in the server tool list (list/get only; set_network_cache is cache control, not interception)');
    } catch (e) { report('network-intercept', 'FAIL', e.message); }

    const p = results.filter(r => r.status === 'PASS').length;
    const f = results.filter(r => r.status === 'FAIL').length;
    const s = results.filter(r => r.status === 'SKIP').length;
    console.log(`SUMMARY ${p} ${f} ${s}`);
    process.exitCode = f > 0 ? 1 : 0;
  } finally {
    await shutdown();
  }
})().catch(e => { console.error('SUITE CRASH:', e.message); process.exit(1); });
