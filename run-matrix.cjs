// Top-level matrix runner: starts the probe server, runs every implemented
// tool suite, parses their RESULT/SUMMARY lines, and GENERATES MATRIX.md
// (plus matrix-results.json) from those outputs. Results are never
// hand-written: a cell is PASS/FAIL/SKIP only if the tool's suite printed
// it; a missing cell is NOT-RUN (e.g. the tool crashed mid-run).
//
// Usage: node run-matrix.cjs [--tool <name>]... [--skip <name>]...
//   --tool limits the run to the named tools (repeatable).
//   --skip excludes the named tools (repeatable).
// Env: PROBE_PORT (default 4333), CHROMEDRIVER_BIN / CHROME_BIN overrides
//   for the cached Chrome-for-Testing paths (sandbox defaults apply).
// Exit: 1 if any FAIL or any tool produced no parseable output, else 0.
//   SKIP and NOT-RUN cells do not fail the run, but NOT-RUN prints a warning.
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PROBE_PORT || 4333);
const BASE = `http://127.0.0.1:${PORT}`;
const CACHE = '/home/hatch/.cache/vibium/chrome-for-testing/156.0.8078.47';
const CHROMEDRIVER = process.env.CHROMEDRIVER_BIN || (fs.existsSync(CACHE + '/chromedriver') ? CACHE + '/chromedriver' : null);
const CHROME_BIN = process.env.CHROME_BIN || (fs.existsSync(CACHE + '/chrome') ? CACHE + '/chrome' : '');

const CAPABILITIES = ['navigation', 'console-log', 'js-error', 'network-capture', 'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click', 'network-intercept'];
const CAP_LABELS = {
  'navigation': 'Navigation events',
  'console-log': 'Console-log capture',
  'js-error': 'JS-error capture',
  'network-capture': 'Network request/response capture',
  'script-eval': 'Script evaluation',
  'cookie': 'Cookie get/set',
  'screenshot': 'Screenshot',
  'dialog': 'Dialog handling',
  'input-click': 'Input / click',
  'network-intercept': 'Network interception',
};

const TOOLS = [
  { name: 'vibium', label: 'Vibium', notes: 'tools/vibium/NOTES.md', run: () => runNode('tools/vibium/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'puppeteer', label: 'Puppeteer', notes: 'tools/puppeteer/NOTES.md', run: () => runNode('tools/puppeteer/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'selenium', label: 'Selenium', notes: 'tools/selenium/NOTES.md', run: () => runNode('tools/selenium/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'webdriverio', label: 'WebdriverIO', notes: 'tools/webdriverio/NOTES.md', run: runWebdriverIO },
  { name: 'testplane', label: 'Testplane', notes: 'tools/testplane/NOTES.md', run: runTestplane },
  { name: 'cypress', label: 'Cypress', notes: 'tools/cypress/NOTES.md', run: () => runNode('tools/cypress/run.cjs', { PROBE_URL: BASE }) },
  { name: 'mcp', label: 'Firefox DevTools MCP', notes: 'tools/mcp/NOTES.md', run: () => runNode('tools/mcp/suite.cjs', { PROBE_URL: BASE }) },
];

// Nothing pending: every in-scope tool now has a suite. (Excluded tools —
// Playwright, Chrome DevTools MCP, Nightwatch — are out of scope by design,
// see README.md; they are not "pending".)
const PENDING = [];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise(resolve => {
    const tick = () => {
      http.get(url, res => { res.resume(); resolve(res.statusCode < 500); }).on('error', () => {
        if (Date.now() > deadline) resolve(false); else setTimeout(tick, 250);
      });
    };
    tick();
  });
}
function runNode(script, extraEnv) {
  // NOTE: the script path must be absolute — cwd is the tool's directory,
  // so a relative script path would resolve inside the tool dir and fail
  // with MODULE_NOT_FOUND (this bug zeroed every tool's output once).
  const r = spawnSync('node', [path.join(ROOT, script)], {
    cwd: path.join(ROOT, path.dirname(script)),
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout: (r.stdout || '') + (r.stderr || ''), code: r.status };
}
async function startProbe() {
  const proc = spawn('node', ['apps/probe/server.mjs', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  const ok = await waitForHttp(BASE + '/', 10000);
  if (!ok) throw new Error('probe server did not come up on ' + BASE);
  return proc;
}
function startChromedriver(port) {
  const proc = spawn(CHROMEDRIVER, [`--port=${port}`], { stdio: 'ignore' });
  return proc;
}
async function runWebdriverIO() {
  if (!CHROMEDRIVER) return { stdout: '', code: 1, error: 'no chromedriver found (set CHROMEDRIVER_BIN)' };
  const drv = startChromedriver(9515);
  await sleep(2000);
  const r = runNode('tools/webdriverio/suite.cjs', { PROBE_URL: BASE, WDIO_PORT: '9515', CHROME_BIN });
  drv.kill();
  return r;
}
function runTestplane() {
  // Testplane's wrapper manages its own chromedriver (see its NOTES.md);
  // make sure it does not inherit a stale grid URL from the environment.
  const env = { ...process.env, PROBE_URL: BASE };
  delete env.TESTPLANE_GRID_URL;
  const r = spawnSync('node', ['tools/testplane/run.cjs'], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout: (r.stdout || '') + (r.stderr || ''), code: r.status };
}
function parseOutput(stdout) {
  const cells = {};
  const details = {};
  for (const line of stdout.split('\n')) {
    const m = line.match(/^RESULT (\S+) (PASS|FAIL|SKIP)(?: (.*))?$/);
    if (m) { cells[m[1]] = m[2]; details[m[1]] = m[3] || ''; }
  }
  const sm = stdout.match(/^SUMMARY (\d+) (\d+) (\d+)$/m);
  return { cells, details, summary: sm ? { pass: +sm[1], fail: +sm[2], skip: +sm[3] } : null };
}

(async () => {
  const args = process.argv.slice(2);
  const only = [];
  const skip = new Set();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool') only.push(args[++i]);
    else if (args[i] === '--skip') skip.add(args[++i]);
  }
  const tools = TOOLS.filter(t => (only.length === 0 || only.includes(t.name)) && !skip.has(t.name));

  const probe = await startProbe();
  console.log(`probe server on ${BASE}`);
  const results = {};
  try {
    for (const tool of tools) {
      const started = Date.now();
      console.log(`\n=== ${tool.name} ===`);
      let out;
      try {
        out = await tool.run();
      } catch (e) {
        out = { stdout: '', code: 1, error: e.message };
      }
      process.stdout.write(out.stdout);
      let parsed = parseOutput(out.stdout);
      // Flake retry (infrastructure only, never for FAILs): if a run
      // produced partial output with no FAILs, run once more and keep the
      // fuller of the two. This exists for Testplane, whose dialog step
      // intermittently crashes the run (see its NOTES.md).
      const missingCount = CAPABILITIES.filter(c => !(c in parsed.cells)).length;
      const failCount = Object.values(parsed.cells).filter(s => s === 'FAIL').length;
      if (missingCount > 0 && failCount === 0) {
        console.log(`RETRY ${tool.name}: first run missing ${missingCount} cell(s), retrying once`);
        let out2;
        try {
          out2 = await tool.run();
        } catch (e) {
          out2 = { stdout: '', code: 1, error: e.message };
        }
        process.stdout.write(out2.stdout);
        const parsed2 = parseOutput(out2.stdout);
        if (Object.keys(parsed2.cells).length > Object.keys(parsed.cells).length) {
          console.log(`RETRY ${tool.name}: second run fuller (${Object.keys(parsed2.cells).length} vs ${Object.keys(parsed.cells).length} cells), using it`);
          out = out2;
          parsed = parsed2;
        } else {
          console.log(`RETRY ${tool.name}: keeping first run (${Object.keys(parsed.cells).length} cells)`);
        }
      }
      results[tool.name] = {
        label: tool.label,
        notes: tool.notes,
        cells: parsed.cells,
        details: parsed.details,
        summary: parsed.summary,
        exitCode: out.code,
        error: out.error || null,
        durationMs: Date.now() - started,
        ran: Object.keys(parsed.cells).length > 0,
      };
      const missing = CAPABILITIES.filter(c => !(c in parsed.cells));
      if (missing.length > 0) console.log(`WARNING ${tool.name}: no result for ${missing.join(', ')} (NOT-RUN)`);
    }
  } finally {
    probe.kill();
  }

  // ---- generate MATRIX.md ----
  const stamp = new Date().toISOString();
  const cellSym = { PASS: '✅ PASS', FAIL: '❌ FAIL', SKIP: '⏭️ SKIP', 'NOT-RUN': '— NOT-RUN' };
  let md = '# WebDriver BiDi capability matrix\n\n';
  md += `> Generated from actual suite runs by \`node run-matrix.cjs\` — do not hand-edit.\n> Generated: ${stamp} (UTC). Probe app: local Node server on port ${PORT}.\n> Scope: stable releases only, BiDi-supporting tools only (see README.md for the exclusion list).\n\n`;
  md += '## Capability × tool\n\n';
  md += '| Capability |' + tools.map(t => ` ${t.label} |`).join('') + '\n';
  md += '|---|' + tools.map(() => '---|').join('') + '\n';
  for (const cap of CAPABILITIES) {
    md += `| ${CAP_LABELS[cap]} |`;
    for (const tool of tools) {
      const st = (results[tool.name] && results[tool.name].cells[cap]) || 'NOT-RUN';
      md += ` ${cellSym[st]} |`;
    }
    md += '\n';
  }
  md += '\n## Per-tool summary\n\n';
  md += '| Tool | PASS | FAIL | SKIP | NOT-RUN | Run status | Notes |\n|---|---|---|---|---|---|---|\n';
  for (const tool of tools) {
    const r = results[tool.name];
    const p = CAPABILITIES.filter(c => r.cells[c] === 'PASS').length;
    const f = CAPABILITIES.filter(c => r.cells[c] === 'FAIL').length;
    const s = CAPABILITIES.filter(c => r.cells[c] === 'SKIP').length;
    const n = CAPABILITIES.filter(c => !(c in r.cells)).length;
    const status = !r.ran ? 'no output' : (f > 0 ? `exit ${r.exitCode}` : `ok (${Math.round(r.durationMs / 1000)}s)`);
    md += `| ${tool.label} | ${p} | ${f} | ${s} | ${n} | ${status} | [notes](${tool.notes}) |\n`;
  }
  md += '\n## Per-tool evidence (detail strings from the runs)\n\n';
  for (const tool of tools) {
    const r = results[tool.name];
    md += `### ${tool.label}\n\n`;
    for (const cap of CAPABILITIES) {
      const st = r.cells[cap] || 'NOT-RUN';
      const det = r.details[cap] ? ` — ${r.details[cap]}` : '';
      md += `- ${CAP_LABELS[cap]}: **${st}**${det}\n`;
    }
    md += '\n';
  }
  if (PENDING.length > 0) {
    md += '## Pending tools (no results claimed)\n\n';
    for (const p of PENDING) md += `- **${p.label}**: ${p.reason}\n`;
    md += '\n';
  }
  md += '## How to reproduce\n\n';
  md += '```sh\nnode run-matrix.cjs            # full matrix (starts the probe server itself)\nnode run-matrix.cjs --tool vibium   # one tool only\n```\n\nPer-tool suites also run standalone; see each tool\'s NOTES.md for its setup (drivers, ports, env vars).\n';
  fs.writeFileSync(path.join(ROOT, 'MATRIX.md'), md);
  fs.writeFileSync(path.join(ROOT, 'matrix-results.json'), JSON.stringify({ generatedAt: stamp, probePort: PORT, results }, null, 2));
  console.log('\nwrote MATRIX.md + matrix-results.json');

  const anyFail = tools.some(t => CAPABILITIES.some(c => results[t.name].cells[c] === 'FAIL'));
  const anyNoOutput = tools.some(t => !results[t.name].ran);
  process.exit(anyFail || anyNoOutput ? 1 : 0);
})().catch(e => { console.error('RUNNER CRASH:', e.message); process.exit(1); });
