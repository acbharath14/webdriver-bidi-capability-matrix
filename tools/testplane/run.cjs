// Wrapper: runs the Testplane CLI, then prints the shared RESULT/SUMMARY
// contract from the JSON the test file wrote. Testplane's own exit code is
// ignored — the matrix cares about per-capability results, and the test
// never throws on a capability FAIL by design.
// Sandbox note: Testplane's own local grid fails here (its BiDi-isolation
// step needs a CDP connection that never comes up — see NOTES.md), so the
// wrapper starts the cached chromedriver on 9515 and points Testplane at it
// via TESTPLANE_GRID_URL. On a normal Mac the local grid is the default
// (leave TESTPLANE_GRID_URL unset and no chromedriver is started).
const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const outFile = process.env.TESTPLANE_RESULTS || path.join(dir, 'results.json');
try { fs.unlinkSync(outFile); } catch (e) { /* first run */ }

const CACHE = '/home/hatch/.cache/vibium/chrome-for-testing/156.0.8078.47';
const chromedriverBin = process.env.CHROMEDRIVER_BIN || (fs.existsSync(CACHE + '/chromedriver') ? CACHE + '/chromedriver' : null);
let drv = null;
const env = { ...process.env, TESTPLANE_RESULTS: outFile };
if (chromedriverBin && !process.env.TESTPLANE_GRID_URL) {
  drv = spawn(chromedriverBin, ['--port=9515'], { stdio: 'ignore' });
  env.TESTPLANE_GRID_URL = 'http://127.0.0.1:9515';
  if (!env.CHROME_BIN && fs.existsSync(CACHE + '/chrome')) env.CHROME_BIN = CACHE + '/chrome';
  spawnSync('sleep', ['2']); // let chromedriver bind before testplane connects
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
console.log(`SESSION isBidi=${data.isBidi} webSocketUrl=${data.webSocketUrl}`);
for (const r of data.results) {
  console.log(`RESULT ${r.key} ${r.status}${r.detail ? ' ' + r.detail : ''}`);
}
const p = data.results.filter(r => r.status === 'PASS').length;
const f = data.results.filter(r => r.status === 'FAIL').length;
const s = data.results.filter(r => r.status === 'SKIP').length;
console.log(`SUMMARY ${p} ${f} ${s}`);
process.exit(f > 0 ? 1 : 0);
