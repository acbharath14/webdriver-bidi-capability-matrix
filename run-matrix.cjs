// Top-level matrix runner: starts the probe server, runs every implemented
// tool suite, parses their output lines, and GENERATES MATRIX.md
// (plus matrix-results.json) from those outputs. Results are never
// hand-written: a cell is PASS/FAIL/SKIP only if the tool's suite printed
// it; a missing cell is NOT-RUN (e.g. the tool crashed mid-run).
//
// Output contract per suite:
//   RESULT <key> <PASS|FAIL|SKIP> [detail]   one line per capability
//   TIMING <key> <ms>                        wall ms for that capability
//     (including its own page/context setup, excluding browser launch;
//     the suite resets its baseline after session start)
//   SESSION <k=v>...                         session facts the suite knows
//     (e.g. browser version, server version); last value wins per key
//   SUMMARY <pass> <fail> <skip>
// The runner additionally records setup versions itself (tool package
// version from the installed node_modules, plus --version probes of the
// binaries the run actually used) and renders them in MATRIX.md, so a
// generated report always says which versions produced it.
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
const FF_CANDIDATE = path.join(ROOT, 'tools', 'firefox', 'firefox', 'firefox');
const FIREFOX_BIN = process.env.FIREFOX_PATH || (fs.existsSync(FF_CANDIDATE) ? FF_CANDIDATE : '');
const GECKO_JS_CANDIDATE = path.join(ROOT, 'tools', 'mcp', 'node_modules', 'geckodriver', 'bin', 'geckodriver.js');
const GECKODRIVER_JS = process.env.GECKODRIVER_JS || (fs.existsSync(GECKO_JS_CANDIDATE) ? GECKO_JS_CANDIDATE : null);

const CAPABILITIES = ['navigation', 'console-log', 'js-error', 'network-capture', 'script-eval', 'cookie', 'screenshot', 'dialog', 'input-click', 'network-intercept', 'drag-and-drop', 'hover', 'keyboard', 'multi-tab', 'iframe'];
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
  'drag-and-drop': 'Drag and drop',
  'hover': 'Hover',
  'keyboard': 'Keyboard input',
  'multi-tab': 'Multi-tab / context',
  'iframe': 'Iframe interaction',
};

const TOOLS = [
  { name: 'vibium', label: 'Vibium', notes: 'tools/vibium/NOTES.md', run: () => runNode('tools/vibium/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'vibium-firefox', label: 'Vibium (Firefox)', notes: 'tools/vibium-firefox/NOTES.md', run: () => runNode('tools/vibium-firefox/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'puppeteer', label: 'Puppeteer', notes: 'tools/puppeteer/NOTES.md', run: () => runNode('tools/puppeteer/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'puppeteer-firefox', label: 'Puppeteer (Firefox)', notes: 'tools/puppeteer-firefox/NOTES.md', run: () => runNode('tools/puppeteer-firefox/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'selenium', label: 'Selenium', notes: 'tools/selenium/NOTES.md', run: () => runNode('tools/selenium/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'selenium-firefox', label: 'Selenium (Firefox)', notes: 'tools/selenium-firefox/NOTES.md', run: () => runNode('tools/selenium-firefox/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'webdriverio', label: 'WebdriverIO', notes: 'tools/webdriverio/NOTES.md', run: runWebdriverIO },
  { name: 'webdriverio-firefox', label: 'WebdriverIO (Firefox)', notes: 'tools/webdriverio-firefox/NOTES.md', run: runWebdriverIOFirefox },
  { name: 'testplane', label: 'Testplane', notes: 'tools/testplane/NOTES.md', run: runTestplane },
  { name: 'testplane-firefox', label: 'Testplane (Firefox)', notes: 'tools/testplane-firefox/NOTES.md', run: runTestplaneFirefox },
  { name: 'cypress', label: 'Cypress', notes: 'tools/cypress/NOTES.md', run: () => runNode('tools/cypress/run.cjs', { PROBE_URL: BASE }) },
  { name: 'mcp', label: 'Firefox DevTools MCP', notes: 'tools/mcp/NOTES.md', run: () => runNode('tools/mcp/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'wdio-mcp', label: 'WebdriverIO MCP', notes: 'tools/wdio-mcp/NOTES.md', run: () => runNode('tools/wdio-mcp/suite.cjs', { PROBE_URL: BASE }) },
  { name: 'testplane-mcp', label: 'Testplane MCP', notes: 'tools/testplane-mcp/NOTES.md', run: () => runNode('tools/testplane-mcp/suite.cjs', { PROBE_URL: BASE }) },
];

// Nothing pending: every in-scope tool now has a suite, including the
// Firefox variants of the five Chrome tools. (Excluded tools —
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
async function runWebdriverIOFirefox() {
  // Geckodriver via the geckodriver npm package's bin (it downloads the
  // binary on first use); the suite connects to it on WDIO_PORT.
  if (!GECKODRIVER_JS) return { stdout: '', code: 1, error: 'no geckodriver package found (tools/mcp node_modules)' };
  const drv = spawn('node', [GECKODRIVER_JS, '--port=4444'], { stdio: 'ignore' });
  const up = await waitForHttp('http://127.0.0.1:4444/', 30000);
  if (!up) { drv.kill(); return { stdout: '', code: 1, error: 'geckodriver did not bind 4444' }; }
  const r = runNode('tools/webdriverio-firefox/suite.cjs', { PROBE_URL: BASE, WDIO_PORT: '4444', FIREFOX_PATH: FIREFOX_BIN });
  drv.kill();
  return r;
}
function runTestplaneFirefox() {
  // Testplane-Firefox's wrapper manages its own geckodriver (see its
  // NOTES.md); make sure it does not inherit a stale grid URL.
  const env = { ...process.env, PROBE_URL: BASE };
  delete env.TESTPLANE_GRID_URL;
  const r = spawnSync('node', ['tools/testplane-firefox/run.cjs'], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 600000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return { stdout: (r.stdout || '') + (r.stderr || ''), code: r.status };
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
  const timings = {};
  const session = {};
  for (const line of stdout.split('\n')) {
    const m = line.match(/^RESULT (\S+) (PASS|FAIL|SKIP)(?: (.*))?$/);
    if (m) { cells[m[1]] = m[2]; details[m[1]] = m[3] || ''; continue; }
    const t = line.match(/^TIMING (\S+) (\d+)$/);
    if (t) { timings[t[1]] = +t[2]; continue; }
    const s = line.match(/^SESSION (.+)$/);
    if (s) {
      for (const pair of s[1].trim().split(/\s+/)) {
        const eq = pair.indexOf('=');
        if (eq > 0) session[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  }
  const sm = stdout.match(/^SUMMARY (\d+) (\d+) (\d+)$/m);
  return { cells, details, timings, session, summary: sm ? { pass: +sm[1], fail: +sm[2], skip: +sm[3] } : null };
}

// ---- setup recording: versions actually observed in this run ----
// Primary dependency per tool (the version that matters, not the tool
// dir's own 1.0.0 wrapper version). Installed version wins; the declared
// range from package.json is the fallback when node_modules is absent.
const TOOL_DEPS = {
  vibium: 'vibium', puppeteer: 'puppeteer', selenium: 'selenium-webdriver',
  webdriverio: 'webdriverio', testplane: 'testplane', cypress: 'cypress',
  mcp: '@mozilla/firefox-devtools-mcp',
  'wdio-mcp': '@wdio/mcp', 'testplane-mcp': '@testplane/mcp',
  'vibium-firefox': 'vibium', 'puppeteer-firefox': 'puppeteer',
  'selenium-firefox': 'selenium-webdriver', 'webdriverio-firefox': 'webdriverio',
  'testplane-firefox': 'testplane',
};
function toolVersion(name) {
  const dep = TOOL_DEPS[name];
  try {
    const installed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', name, 'node_modules', dep, 'package.json'), 'utf8'));
    if (installed.version) return installed.version;
  } catch (e) { /* not installed; fall through to declared range */ }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', name, 'package.json'), 'utf8'));
    return (pkg.dependencies && pkg.dependencies[dep]) || 'unknown';
  } catch (e) { return 'unknown'; }
}
// First line of `<bin> --version`, or null when the binary is absent or
// the probe fails. Driver versions strip the parenthetical build hash so
// the table stays readable (full string stays in matrix-results.json only
// via the binary path, not the version text).
function probeVersion(bin, isDriver) {
  if (!bin || !fs.existsSync(bin)) return null;
  try {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15000 });
    let out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n')[0] || '';
    if (isDriver) out = out.split(' (')[0];
    return out || null;
  } catch (e) { return null; }
}
function firstExisting(candidates) {
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return null;
}
function buildSetup(toolName, session) {
  const chromeProbe = probeVersion(CHROME_BIN, false);
  const chromedriverProbe = probeVersion(CHROMEDRIVER, true);
  const firefoxBin = firstExisting([
    process.env.FIREFOX_PATH,
    process.env.CYPRESS_FIREFOX_PATH,
    path.join(ROOT, 'tools', 'firefox', 'firefox', 'firefox'),
  ]);
  const firefoxProbe = probeVersion(firefoxBin, false);
  const geckodriverBin = firstExisting([
    path.join(ROOT, 'tools', 'mcp', 'node_modules', '.bin', process.platform === 'win32' ? 'geckodriver.cmd' : 'geckodriver'),
    path.join(ROOT, 'tools', 'mcp', 'node_modules', '@mozilla', 'firefox-devtools-mcp', 'node_modules', '.bin', process.platform === 'win32' ? 'geckodriver.cmd' : 'geckodriver'),
  ]);
  const geckodriverProbe = probeVersion(geckodriverBin, true);

  // Browser: the suite's own SESSION value wins (it reports the browser
  // it actually drove); otherwise the probe of the binary the run used.
  let browser;
  if (session.browser) browser = session.browser;
  else if (toolName === 'vibium') browser = 'Chrome for Testing (Vibium-managed)';
  else if (toolName === 'cypress' || toolName === 'mcp') browser = firefoxProbe || 'not probed';
  else if (toolName === 'wdio-mcp' || toolName === 'testplane-mcp') browser = 'Chrome (server-managed)';
  else if (toolName.endsWith('-firefox')) browser = firefoxProbe || 'not probed';
  else browser = chromeProbe || 'not probed';
  // Driver: null means "no separate driver binary for this tool".
  let driver;
  if (toolName === 'vibium' || toolName === 'puppeteer' || toolName === 'vibium-firefox' || toolName === 'puppeteer-firefox') driver = 'n/a (BiDi direct)';
  else if (toolName === 'cypress') driver = 'n/a (Cypress drives Firefox)';
  else if (toolName === 'mcp') driver = geckodriverProbe || 'server-managed (not probed)';
  else if (toolName === 'selenium') driver = chromedriverProbe || 'not probed (Selenium Manager resolved)';
  else if (toolName === 'selenium-firefox') driver = geckodriverProbe || 'Selenium Manager resolved';
  else if (toolName === 'webdriverio') driver = chromedriverProbe || 'not probed';
  else if (toolName === 'webdriverio-firefox') driver = geckodriverProbe || 'not probed';
  else if (toolName === 'testplane') driver = chromedriverProbe || 'local grid (Testplane-managed)';
  else if (toolName === 'testplane-firefox') driver = geckodriverProbe || 'local grid (Testplane-managed)';
  else if (toolName === 'wdio-mcp' || toolName === 'testplane-mcp') driver = 'server-managed (not probed)';
  else driver = 'not probed';

  return {
    toolPackage: TOOL_DEPS[toolName],
    toolVersion: toolVersion(toolName),
    browser,
    driver,
    binaryPaths: { chrome: CHROME_BIN || null, chromedriver: CHROMEDRIVER || null, firefox: firefoxBin || null, geckodriver: geckodriverBin || null },
    session,
  };
}

(async () => {
  const args = process.argv.slice(2);
  const only = [];
  const skip = new Set();
  let noPreflight = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool') only.push(args[++i]);
    else if (args[i] === '--skip') skip.add(args[++i]);
    else if (args[i] === '--no-preflight') noPreflight = true;
  }
  const tools = TOOLS.filter(t => (only.length === 0 || only.includes(t.name)) && !skip.has(t.name));

  // Preflight: checks setup and installs any missing tool dependencies, so a
  // fresh clone just works. Skip with --no-preflight or PREFLIGHT=0.
  if (!noPreflight && process.env.PREFLIGHT !== '0') {
    console.log('Running preflight (installs any missing tool dependencies)...');
    const preArgs = [];
    for (const t of tools) preArgs.push('--tool', t.name);
    const pre = spawnSync('node', [path.join(ROOT, 'scripts', 'preflight.cjs'), ...preArgs], { stdio: 'inherit' });
    if (pre.status !== 0) {
      console.error('PREFLIGHT FAILED — fix the items above, then re-run. (Skip with --no-preflight or PREFLIGHT=0.)');
      process.exit(1);
    }
  }

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
      // Surface the runner-level failure reason (missing driver, crashed
      // run, thrown error) instead of failing silently with empty output.
      if (out.error) console.log(`ERROR ${tool.name}: ${out.error}`);
      results[tool.name] = {
        label: tool.label,
        notes: tool.notes,
        cells: parsed.cells,
        details: parsed.details,
        timings: parsed.timings,
        session: parsed.session,
        setup: buildSetup(tool.name, parsed.session),
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
  md += `> Generated from actual suite runs by \`node run-matrix.cjs\` — do not hand-edit.\n> Generated: ${stamp} (UTC). Probe app: local Node server on port ${PORT}. Node ${process.versions.node}.\n> Scope: stable releases only, BiDi-supporting tools only (see README.md for the exclusion list).\n\n`;
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
  md += '\n## Per-capability timing (ms)\n\n';
  md += '> Wall time per capability in milliseconds, including that capability\'s own page/context setup, excluding browser launch. A dash means the suite printed no timing for that cell (crashed run or older output). Suite totals are in the summary table above.\n\n';
  md += '| Capability |' + tools.map(t => ` ${t.label} |`).join('') + '\n';
  md += '|---|' + tools.map(() => '---|').join('') + '\n';
  for (const cap of CAPABILITIES) {
    md += `| ${CAP_LABELS[cap]} |`;
    for (const tool of tools) {
      const ms = results[tool.name] && results[tool.name].timings[cap];
      md += ` ${ms !== undefined ? ms : '—'} |`;
    }
    md += '\n';
  }
  md += '\n## Setup recorded for this run\n\n';
  md += '> Versions actually observed in this run, not claimed. Tool versions are the installed package versions (declared range when not installed); browser versions come from the suite\'s session when it reports one, otherwise from a `--version` probe of the binary the run used. "not probed" means the run exposed no version for that slot. Install steps per tool: see the NOTES.md links in the summary table.\n\n';
  md += '| Tool | Tool version | Browser | Driver |\n|---|---|---|---|\n';
  for (const tool of tools) {
    const s = results[tool.name].setup;
    md += `| ${tool.label} | ${s.toolPackage} ${s.toolVersion} | ${s.browser} | ${s.driver} |\n`;
  }
  md += '\n## Per-tool evidence (detail strings from the runs)\n\n';
  for (const tool of tools) {
    const r = results[tool.name];
    md += `### ${tool.label}\n\n`;
    for (const cap of CAPABILITIES) {
      const st = r.cells[cap] || 'NOT-RUN';
      const det = r.details[cap] ? ` — ${r.details[cap]}` : '';
      const tim = r.timings[cap] !== undefined ? ` (${r.timings[cap]}ms)` : '';
      md += `- ${CAP_LABELS[cap]}: **${st}**${det}${tim}\n`;
    }
    md += '\n';
  }
  if (PENDING.length > 0) {
    md += '## Pending tools (no results claimed)\n\n';
    for (const p of PENDING) md += `- **${p.label}**: ${p.reason}\n`;
    md += '\n';
  }
  md += '## How to reproduce\n\n';
  md += '```sh\nnpm run preflight              # checks setup, installs missing tool deps\nnode run-matrix.cjs            # full matrix (preflight runs automatically first)\nnode run-matrix.cjs --tool vibium   # one tool only\nnode run-matrix.cjs --no-preflight  # skip preflight (deps already installed)\n```\n\nPer-tool suites also run standalone; see each tool\'s NOTES.md for its setup (drivers, ports, env vars).\n';
  fs.writeFileSync(path.join(ROOT, 'MATRIX.md'), md);
  fs.writeFileSync(path.join(ROOT, 'matrix-results.json'), JSON.stringify({ generatedAt: stamp, probePort: PORT, nodeVersion: process.versions.node, results }, null, 2));
  console.log('\nwrote MATRIX.md + matrix-results.json');

  const anyFail = tools.some(t => CAPABILITIES.some(c => results[t.name].cells[c] === 'FAIL'));
  const anyNoOutput = tools.some(t => !results[t.name].ran);
  process.exit(anyFail || anyNoOutput ? 1 : 0);
})().catch(e => { console.error('RUNNER CRASH:', e.message); process.exit(1); });
