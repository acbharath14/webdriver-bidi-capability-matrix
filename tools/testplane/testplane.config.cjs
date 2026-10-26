// Testplane 9 config for the BiDi capability matrix.
// BiDi is enabled the documented stable way: desiredCapabilities
// webSocketUrl: true + browserVersion (Testplane validates the version
// against its BiDi minimum — Chrome >= 128). No gridUrl is set, so
// Testplane runs its own local grid and manages the Chrome + driver
// downloads itself. --no-sandbox is added only when running as root
// (sandbox); a normal Mac user account does not need it.
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

module.exports = {
  baseUrl: process.env.PROBE_URL || 'http://127.0.0.1:4333',
  // gridUrl: null (default) = Testplane's own local grid. In the sandbox
  // the local grid's CDP connection fails (see tools/testplane/NOTES.md),
  // so the runner sets TESTPLANE_GRID_URL to a chromedriver it starts.
  gridUrl: process.env.TESTPLANE_GRID_URL || null,
  browsers: {
    chrome: {
      headless: true,
      // Testplane defaults isolation to true for Chrome >= 93; with BiDi
      // that runs _performBidiIsolation, which needs a CDP connection via
      // getPuppeteer (se:cdp) — and chromedriver 156 provides no se:cdp
      // here, so init fails after a 5s CDP timeout. The matrix suite uses
      // one browser session and navigates fresh per capability, so
      // isolation is unnecessary; turning it off removes the CDP
      // requirement from browser init entirely.
      isolation: false,
      desiredCapabilities: {
        browserName: 'chrome',
        browserVersion: '156.0.8078.47',
        webSocketUrl: true,
        'goog:chromeOptions': {
          args: isRoot ? ['--no-sandbox'] : [],
          // Runner sets CHROME_BIN to the cached Chrome-for-Testing binary
          // in the sandbox; on a normal Mac this is omitted (system Chrome).
          ...(process.env.CHROME_BIN ? { binary: process.env.CHROME_BIN } : {}),
        },
      },
    },
  },
  sets: {
    matrix: {
      files: ['tests/matrix.testplane.js'],
      browsers: ['chrome'],
    },
  },
};
