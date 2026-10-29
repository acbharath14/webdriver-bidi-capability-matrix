// Wrapper (FIREFOX variant): runs the Testplane CLI, then prints the shared
// RESULT/SUMMARY/TIMING/SESSION contract from the JSON the test file wrote.
// Testplane's own exit code is ignored — the matrix cares about
// per-capability results, and the test never throws on a capability FAIL
// by design.
// The wrapper starts geckodriver on 4444 (via the @mozilla
// firefox-devtools-mcp tree's geckodriver package, which downloads the
// binary on first use) and points Testplane at it via TESTPLANE_GRID_URL,
// mirroring the Chrome wrapper's chromedriver pattern. On a normal Mac
// the local grid is the default (leave TESTPLANE_GRID_URL unset).
const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const outFile = process.env.TESTPLANE_RESULTS || path.join(dir, 'results.json');
try { fs.unlinkSync(outFile); } catch (e) { /* first run */ }

const geckoJs = process.env.GECKODRIVER_JS || path.join(dir, '..', 'mcp', 'node_modules', 'geckodriver', 'bin', 'geckodriver.js');
let drv = null;
const env = { ...process.env, TESTPLANE_RESULTS: outFile };
if (fs.existsSync(geckoJs) && !process.env.TESTPLANE_GRID_URL) {
  drv = spawn('node', [geckoJs, '--port=4444'], { stdio: 'ignore' });
  env.TESTPLANE_GRID_URL = 'http://127.0.0.1:4444';
  const ffCandidate = path.join(dir, '..', 'firefox', 'firefox', 'firefox');
  if (!env.FIREFOX_BIN && fs.existsSync(ffCandidate)) env.FIREFOX_BIN = ffCandidate;
  // Wait for geckodriver to bind (it downloads the binary on first use).
  for (let i = 0; i < 30; i++) {
    const r = spawnSync('curl', ['-s', '-o', '/dev/null', 'http://127.0.0.1:4444/']);
    if (r.status === 0) break;
    spawnSync('sleep', ['1']);
  }
}

const cli = spawnSync('node', ['node_modules/testplane/bin/testplane', '--config', 'testplane.config.cjs'], {
  cwd: dir,
  env,
  encoding: 'utf8',
  timeout: 600000,
  maxBuffer: 20 * 1024 * 1024,
});
if (drv) drv.kill();
if (cli.stdout) process.stdout.write(cli.stdout);
if (cli.stderr) process.stderr.write(cli.stderr);

let data;
try {
  data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
} catch (e) {
  console.error('TESTPLANE WRAPPER: no results file — testplane run failed (see output above)');
  process.exit(1);
}
console.log(`SESSION isBidi=${data.isBidi} webSocketUrl=${data.webSocketUrl}${data.browserVersion ? ' browser=Firefox/' + data.browserVersion : ''}`);
for (const r of data.results) {
  console.log(`RESULT ${r.key} ${r.status}${r.detail ? ' ' + r.detail : ''}`);
  if (typeof r.ms === 'number') console.log(`TIMING ${r.key} ${r.ms}`);
}
const p = data.results.filter(r => r.status === 'PASS').length;
const f = data.results.filter(r => r.status === 'FAIL').length;
const s = data.results.filter(r => r.status === 'SKIP').length;
console.log(`SUMMARY ${p} ${f} ${s}`);
process.exit(f > 0 ? 1 : 0);
