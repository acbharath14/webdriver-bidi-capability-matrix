// Wrapper: runs Cypress against Firefox and prints the shared
// RESULT/SUMMARY contract from the results.json the spec wrote via tasks.
// Firefox: the bundled download lives in ../firefox/firefox/firefox; it is
// put on PATH so `cypress run --browser firefox` detects it. If detection
// fails, set CYPRESS_FIREFOX_PATH to the binary and the wrapper passes it
// as --browser <path> instead.
// Env: PROBE_URL (default http://127.0.0.1:4333).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const outFile = process.env.CYPRESS_RESULTS || path.join(dir, 'results.json');
try { fs.unlinkSync(outFile); } catch (e) { /* first run */ }

const bundledFirefoxDir = path.join(dir, '..', 'firefox', 'firefox');
const env = { ...process.env };
if (fs.existsSync(path.join(bundledFirefoxDir, 'firefox')) && !env.PATH.split(':').includes(bundledFirefoxDir)) {
  env.PATH = bundledFirefoxDir + ':' + env.PATH;
}
const browserArg = process.env.CYPRESS_FIREFOX_PATH || 'firefox';

const cli = spawnSync('npx', ['cypress', 'run', '--browser', browserArg], {
  cwd: dir,
  env,
  encoding: 'utf8',
  timeout: 600000,
  maxBuffer: 20 * 1024 * 1024,
});
if (cli.stdout) process.stdout.write(cli.stdout);
if (cli.stderr) process.stderr.write(cli.stderr);

let data;
try {
  data = JSON.parse(fs.readFileSync(outFile, 'utf8'));
} catch (e) {
  console.error('CYPRESS WRAPPER: no results file — cypress run failed (see output above)');
  process.exit(1);
}
for (const r of data.results) {
  console.log(`RESULT ${r.key} ${r.status}${r.detail ? ' ' + r.detail : ''}`);
}
const p = data.results.filter(r => r.status === 'PASS').length;
const f = data.results.filter(r => r.status === 'FAIL').length;
const s = data.results.filter(r => r.status === 'SKIP').length;
console.log(`SUMMARY ${p} ${f} ${s}`);
process.exit(f > 0 ? 1 : 0);
