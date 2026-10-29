# WebdriverIO (Firefox) — notes

Firefox variant of `tools/webdriverio/suite.cjs`: the same 10
capabilities through the same WDIO v9 BiDi paths, only the session
differs — geckodriver (runner starts it on port 4444 via the
geckodriver npm package's bin, which downloads the binary on first
use) + `browserName: 'firefox'` + `moz:firefoxOptions` (`-headless`,
workdir Firefox binary when present) + `webSocketUrl: true`. The
session connects over BiDi (`isBidi=true`, `webSocketUrl` present),
so the cells run for real rather than hitting the suite's
no-BiDi SKIP-all fallback.

## Session facts

- SESSION browser is `Firefox/` + the session's browser version
  (158.0.1 in the sandbox).
- Driver column: the probed geckodriver version when the runner finds
  one, else `not probed`.

## Verified outcome (standalone run, sandbox)

7/1/7 with the Piece 4 input/context cells (7/1/2 on the original
10).

- PASS: navigation, console-log, js-error, network-capture,
  script-eval, cookie, dialog. Dialog is a genuine Firefox PASS:
  WDIO's DialogManager observes and handles alert + confirm (both
  legs) on Firefox.
- SKIP (same as Chrome): screenshot and input-click. WDIO v9 exposes
  no BiDi surface for captureScreenshot or input.perform; the
  Classic paths work (demonstrated in the detail strings) but the
  cells are about BiDi transport, so they stay SKIP.
- FAIL: network-intercept. WDIO's `browser.mock()` provides the
  response body at the `responseStarted` phase, but Firefox's BiDi
  `network.provideResponse` only accepts a body in
  `beforeRequestSent` — so the mock's internal handler throws an
  unhandled rejection (`unsupported operation - The "body" parameter
  is only supported for the beforeRequestSent phase at the moment`).
  The variant suite captures that rejection around the cell and
  reports the FAIL with the real reason instead of letting the
  process die before SUMMARY (the unguarded run did exactly that:
  9 cells, then a crash). This is a Firefox-BiDi limitation meeting
  a Chrome-phase assumption in WDIO's mock, not a missing surface —
  hence FAIL, not SKIP.

## Piece 4 — input/context depth

- SKIP (same stance as screenshot/input-click): hover, keyboard,
  multi-tab, iframe. WDIO v9 exposes no BiDi surface for any of
  them; the Classic paths work and are demonstrated in the detail
  strings (moveTo -> hovered, keys -> arrow-right, window handles ->
  tab landed /second, switchFrame -> inner-clicked).
- SKIP: drag-and-drop, with a Firefox twist. On Chrome, Classic
  dragAndDrop works (dropped) and the cell is SKIP for lack of a
  BiDi surface. On Firefox, Classic dragAndDrop itself runs without
  error but the drop handler never fires — the same Firefox
  pointer-drag limitation as the Vibium, Puppeteer, Selenium, and
  Testplane Firefox cells. The cell stays SKIP (still no BiDi drag
  surface) with the Classic outcome recorded in the detail, rather
  than FAIL, so the same browser limitation is not FAIL in one
  column and SKIP in another.
