# Testplane — BiDi notes

Version verified: `testplane` 9.3.4 (stable; BiDi support landed in 8.27.0).
Testplane is built on a WebdriverIO fork (`@testplane/webdriverio`), so its
BiDi transports mirror WebdriverIO v9 — see `../webdriverio/NOTES.md` for the
per-capability transport map. The differences below are Testplane-specific.

Suite: `tests/matrix.testplane.js` + `testplane.config.cjs`, run via the
wrapper `node run.cjs` (the test writes `results.json` incrementally — see
"Flake" — and the wrapper prints the shared RESULT/SUMMARY contract from it).

## BiDi enablement (documented stable opt-in)

```js
desiredCapabilities: {
  browserName: 'chrome',
  browserVersion: '156.0.8078.47',
  webSocketUrl: true,
}
```

Testplane validates `browserVersion` against its BiDi minimum (Chrome >= 128)
when `webSocketUrl` is `true`. The suite asserts `isBidi` up front and SKIPs
every BiDi cell if BiDi did not connect.

## `isolation: false` — required in this setup

Testplane defaults `isolation` to true for Chrome >= 93 (its config `map`
resolves an unset value via `isSupportIsolation`). With BiDi, isolation runs
`_performBidiIsolation`, which needs a CDP connection through `getPuppeteer`
(`se:cdp`). Chromedriver 156 returns **no `se:cdp` capability at all** in this
setup — verified by raw session probes, both with and without
`webSocketUrl: true` — so browser init fails after Testplane's 5s CDP timeout
("Unable to establish a CDP connection in 5000 ms"). This happens identically
against Testplane's own local grid and against an external chromedriver.

Setting `isolation: false` removes the CDP requirement from browser init
entirely. The matrix suite uses one browser session and navigates fresh per
capability, so isolation buys nothing here. On a Mac with a grid/driver that
does provide `se:cdp`, isolation could be left at its default — but that path
is unverified here.

## Driver provisioning

- Default (`TESTPLANE_GRID_URL` unset): the wrapper starts the cached
  chromedriver on port 9515 and points Testplane at it; `CHROME_BIN` points at
  the cached Chrome-for-Testing binary. On a normal Mac, leave both unset and
  Testplane uses its own local grid (which downloads and manages Chrome +
  driver itself).
- `browserVersion` in desiredCapabilities is passed through to the driver;
  chromedriver ignores it (it launches its own Chrome).

## Dialog: SKIP + flake (read before re-running)

- Dialog cell: SKIP. Dialog events fire for all three prompts
  (`alert:probe-alert`, `confirm:probe-confirm` × 2), but `accept()` /
  `dismiss()` fail with `no such alert` and both confirm legs end `dismissed`
  — the prompt is auto-dismissed before handling runs. Upstream WebdriverIO
  9.32 handles the identical flow fine through the same chromedriver, so this
  is specific to Testplane's wrapper/fork path, not to the probe page or the
  driver. (Selenium shows the same `no such alert` signature through its own
  mapper path; see `../selenium/NOTES.md`.)
- Flake: the dialog step intermittently crashes the run outright — an
  unhandled `browsingContext.handleUserPrompt failed: no such alert` rejection
  from the framework's own call path terminates the master/worker (observed
  in 3 of 4 runs; 1 run completed with the full 7 PASS / 3 SKIP). Registering
  the dialog listener up front (before any navigation) did not remove the
  flake. Mitigations in place: the dialog handler catches its own errors, and
  the test writes `results.json` incrementally, so a crash still leaves
  partial results and the matrix generator marks unrun cells NOT-RUN instead
  of inventing them. If a run crashes at dialog, re-running usually completes;
  the committed matrix uses a completed run.
- Because of the flake, Testplane's `input-click` (SKIP) and
  `network-intercept` (PASS) cells come from the completed run; in a crashed
  run they show as NOT-RUN.

## Sandbox vs normal Mac

- `--headless` + `--no-sandbox` (root only) and `CHROME_BIN` are sandbox-only
  accommodations; a normal user account with a system Chrome needs none of
  them. The `isolation: false` + `se:cdp` finding may not apply on a Mac —
  it is a statement about chromedriver 156 in this sandbox, not about
  Testplane generally.

## Piece 4 — input/context depth (7/0/8)

The five new cells are all SKIP with Classic demonstrations, same
stance as the WDIO v9 stack they share: Classic dragAndDrop, moveTo,
keys('ArrowRight'), window handles, and switchFrame all work; no BiDi
surface exists for them in Testplane's WDIO fork. Note the dialog
flake: the suite's dialog cell intermittently kills the run with an
unhandled `handleUserPrompt` rejection (chromedriver mapper
auto-dismiss race); rerunning usually gets past it.
