// Preflight: preliminary checks for the matrix repo's required setup.
//
// Run standalone:  node scripts/preflight.cjs [--tool <name>]...
// Run automatically: node run-matrix.cjs invokes this first (unless
// --no-preflight or PREFLIGHT=0), so a fresh clone just works.
//
// What it does:
//  - Requires Node.js 20+ (fatal if not).
//  - For each tool directory, checks whether its entry point resolves.
//    Anything missing is INSTALLED on the spot with `npm ci` from the
//    tool's own lockfile. An install failure is fatal: a matrix run with
//    known-missing dependencies would only produce NOT-RUN noise.
//  - Browsers and drivers are CHECKED, not installed: they are
//    platform-specific and several tools manage their own (Puppeteer and
//    Vibium download Chrome themselves; Selenium Manager resolves its own
//    driver). A missing one prints a WARNING with the exact fix command
//    and the run continues — the affected tools report their own cells.
//    On macOS, browsers are usually .app bundles, not PATH binaries, so
//    the checks below also look in /Applications and ~/Applications.
//
// Exit 0 when setup is complete (or was completed by this run), 1 otherwise.

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const TOOLS = [
  { name: 'vibium', dir: 'tools/vibium', check: (d) => resolveOk('vibium/sync', d) },
  { name: 'puppeteer', dir: 'tools/puppeteer', check: (d) => resolveOk('puppeteer', d) },
  { name: 'selenium', dir: 'tools/selenium', check: (d) => resolveOk('selenium-webdriver', d) },
  { name: 'webdriverio', dir: 'tools/webdriverio', check: (d) => resolveOk('webdriverio', d) },
  { name: 'testplane', dir: 'tools/testplane', check: (d) => fs.existsSync(path.join(d, 'node_modules', 'testplane', 'bin', 'testplane')) },
  { name: 'cypress', dir: 'tools/cypress', check: (d) => fs.existsSync(path.join(d, 'node_modules', '.bin', process.platform === 'win32' ? 'cypress.cmd' : 'cypress')) },
  { name: 'mcp', dir: 'tools/mcp', check: (d) => fs.existsSync(path.join(d, 'node_modules', '@mozilla', 'firefox-devtools-mcp', 'dist', 'index.js')) },
  { name: 'wdio-mcp', dir: 'tools/wdio-mcp', check: (d) => fs.existsSync(path.join(d, 'node_modules', '.bin', process.platform === 'win32' ? 'wdio-mcp.cmd' : 'wdio-mcp')) },
  { name: 'testplane-mcp', dir: 'tools/testplane-mcp', check: (d) => fs.existsSync(path.join(d, 'node_modules', '@testplane', 'mcp', 'build', 'cli.js')) },
  { name: 'vibium-firefox', dir: 'tools/vibium-firefox', check: (d) => resolveOk('vibium/sync', d) },
  { name: 'puppeteer-firefox', dir: 'tools/puppeteer-firefox', check: (d) => resolveOk('puppeteer', d) },
  { name: 'selenium-firefox', dir: 'tools/selenium-firefox', check: (d) => resolveOk('selenium-webdriver', d) },
  { name: 'webdriverio-firefox', dir: 'tools/webdriverio-firefox', check: (d) => resolveOk('webdriverio', d) },
  { name: 'testplane-firefox', dir: 'tools/testplane-firefox', check: (d) => fs.existsSync(path.join(d, 'node_modules', 'testplane', 'bin', 'testplane')) },
];

function resolveOk(request, dir) {
  try {
    require.resolve(request, { paths: [dir] });
    return true;
  } catch (e) {
    return false;
  }
}

function commandExists(cmd) {
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(probe, [cmd], { stdio: 'ignore' });
    return r.status === 0;
  } catch (e) {
    return false;
  }
}

// macOS .app bundle check: on a Mac, Chrome/Firefox live in
// /Applications (or ~/Applications) and are invisible to `which`.
// Returns false on non-macOS platforms, so other systems are unaffected.
function macAppBundle(appName) {
  if (process.platform !== 'darwin') return false;
  return fs.existsSync(path.join('/Applications', appName))
    || fs.existsSync(path.join(os.homedir(), 'Applications', appName));
}

function main() {
  const args = process.argv.slice(2);
  const only = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool') only.push(args[++i]);
  }
  const tools = TOOLS.filter((t) => only.length === 0 || only.includes(t.name));
  if (tools.length === 0) {
    console.error('PREFLIGHT: no matching tools (unknown --tool name?)');
    return 1;
  }

  let failed = false;

  // Node version.
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    console.error(`PREFLIGHT FAIL: Node.js ${process.versions.node} found, 20+ required.`);
    return 1;
  }
  console.log(`PREFLIGHT: Node.js ${process.versions.node} OK`);

  // Tool dependencies: install whatever is missing.
  for (const tool of tools) {
    const dir = path.join(ROOT, tool.dir);
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      console.error(`PREFLIGHT FAIL: ${tool.dir} has no package.json — run from the repo root.`);
      failed = true;
      continue;
    }
    if (tool.check(dir)) {
      console.log(`PREFLIGHT: ${tool.name} dependencies OK`);
      continue;
    }
    console.log(`PREFLIGHT: ${tool.name} dependencies missing — installing (npm ci in ${tool.dir})...`);
    let r;
    try {
      r = spawnSync('npm', ['ci'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
    } catch (e) {
      console.error(`PREFLIGHT FAIL: could not run npm for ${tool.name}: ${e.message}`);
      failed = true;
      continue;
    }
    if (r.status !== 0) {
      console.error(`PREFLIGHT FAIL: npm ci failed for ${tool.name} (exit ${r.status}). Fix the error above, then re-run.`);
      failed = true;
      continue;
    }
    if (!tool.check(dir)) {
      console.error(`PREFLIGHT FAIL: ${tool.name} still not resolvable after npm ci — check the install output above.`);
      failed = true;
      continue;
    }
    console.log(`PREFLIGHT: ${tool.name} installed OK`);
  }
  if (failed) return 1;

  // Browsers and drivers: warnings only, with the fix command.
  const chromeOk = commandExists('google-chrome') || commandExists('chrome') || commandExists('chromium') || commandExists('chromium-browser')
    || macAppBundle('Google Chrome.app') || macAppBundle('Chromium.app');
  if (!chromeOk) {
    console.log('PREFLIGHT WARNING: no system Chrome found. Puppeteer and Vibium download their own Chrome, and Selenium Manager resolves its own driver; WDIO/Testplane need CHROME_BIN or a system Chrome. (Not fatal — continuing.)');
  }
  const chromedriverOk = (process.env.CHROMEDRIVER_BIN && fs.existsSync(process.env.CHROMEDRIVER_BIN)) || commandExists('chromedriver');
  if (!chromedriverOk) {
    console.log('PREFLIGHT WARNING: no chromedriver found (CHROMEDRIVER_BIN unset and none on PATH). WebdriverIO needs one on WDIO_PORT; Testplane falls back to its own local grid on a Mac. Set CHROMEDRIVER_BIN to a chromedriver binary to silence this. (Not fatal — continuing.)');
  }
  const firefoxOk = (process.env.FIREFOX_PATH && fs.existsSync(process.env.FIREFOX_PATH))
    || (process.env.CYPRESS_FIREFOX_PATH && fs.existsSync(process.env.CYPRESS_FIREFOX_PATH))
    || fs.existsSync(path.join(ROOT, 'tools', 'firefox', 'firefox', 'firefox'))
    || commandExists('firefox')
    || macAppBundle('Firefox.app');
  if (!firefoxOk) {
    console.log('PREFLIGHT WARNING: no Firefox found (no FIREFOX_PATH, no CYPRESS_FIREFOX_PATH, no bundled tools/firefox/, none on PATH). Cypress and the MCP entry need one — install Firefox, or set FIREFOX_PATH to its binary. Those two tools will NOT-RUN without it. (Not fatal — continuing.)');
  }

  console.log('PREFLIGHT OK');
  return 0;
}

process.exit(main());
