// Testplane 9 config for the BiDi capability matrix — FIREFOX variant.
// Same 10 capabilities against Firefox via geckodriver (gridUrl).
// BiDi is enabled the documented stable way: desiredCapabilities
// webSocketUrl: true + browserVersion (Testplane validates the version
// against its BiDi minimum — Chrome >= 128). No gridUrl is set, so
// Testplane runs its own local grid and manages the Chrome + driver
// downloads itself. --no-sandbox is added only when running as root
// (sandbox); a normal Mac user account does not need it.
const path = require('node:path');
const fs = require('node:fs');
const FF_CANDIDATE = path.join(__dirname, '..', 'firefox', 'firefox', 'firefox');
const FIREFOX_BIN = process.env.FIREFOX_BIN || process.env.FIREFOX_PATH || (fs.existsSync(FF_CANDIDATE) ? FF_CANDIDATE : null);

module.exports = {
  baseUrl: process.env.PROBE_URL || 'http://127.0.0.1:4333',
  // gridUrl is omitted entirely when TESTPLANE_GRID_URL is unset, so
  // Testplane uses its own local grid. (The Firefox wrapper sets
  // TESTPLANE_GRID_URL to its geckodriver when it manages one, in
  // which case the key is present as before.)
  ...(process.env.TESTPLANE_GRID_URL ? { gridUrl: process.env.TESTPLANE_GRID_URL } : {}),
  browsers: {
    firefox: {
      headless: true,
      // Isolation off, as in the Chrome config: the matrix suite uses
      // one browser session and navigates fresh per capability, so
      // per-test isolation is unnecessary (and for Chrome it would pull
      // in a CDP connection that the grid does not provide).
      isolation: false,
      desiredCapabilities: {
        browserName: 'firefox',
        browserVersion: '158.0.1',
        webSocketUrl: true,
        'moz:firefoxOptions': {
          args: ['-headless'],
          // Wrapper sets FIREFOX_BIN to the workdir Firefox binary in the
          // sandbox; on a normal Mac this is omitted (system Firefox).
          ...(FIREFOX_BIN ? { binary: FIREFOX_BIN } : {}),
        },
      },
    },
  },
  sets: {
    matrix: {
      files: ['tests/matrix.testplane.js'],
      browsers: ['firefox'],
    },
  },
};
