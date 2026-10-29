# Testplane (Firefox) — notes

Firefox variant of `tools/testplane/`: the same test file (same 10
capabilities), only the config and the wrapper differ. Config:
`browserName: 'firefox'`, `browserVersion: '158.0.1'`,
`webSocketUrl: true`, `moz:firefoxOptions` (`-headless`, workdir
Firefox binary when present), `isolation: false` (one session,
navigate fresh per capability, as on Chrome). Wrapper: starts
geckodriver on port 4444 (via the geckodriver npm package's bin,
which downloads the binary on first use) and points Testplane at it
via `TESTPLANE_GRID_URL`, mirroring the Chrome wrapper's
chromedriver pattern; it waits for the port to bind instead of a
fixed sleep, since the first run downloads the binary.

## Session facts

- SESSION browser is `Firefox/` + the test file's recorded browser
  version (158.0.1 in the sandbox); `isBidi=true`.
- Driver column: the probed geckodriver version when the runner finds
  one, else `local grid (Testplane-managed)`.

## Verified outcome (standalone run, sandbox)

6/1/8 with the Piece 4 input/context cells (6/1/3 on the original
10).

- PASS: navigation, console-log, js-error, network-capture,
  script-eval, cookie.
- SKIP (same as Chrome): screenshot and input-click (Classic-only in
  the WDIO v9 stack Testplane is built on), and dialog — dialog
  events fire but `accept()`/`dismiss()` fail `no such alert` and
  both legs land `dismissed` (same auto-dismiss signature as
  Chrome). Unlike the Chrome entry, the Firefox run completes all
  10 cells: the Chrome run's dialog-step crash does not reproduce
  on Firefox/geckodriver.
- FAIL: network-intercept, same root cause as the
  webdriverio-firefox entry (WDIO mock provides the response body at
  `responseStarted`; Firefox's `network.provideResponse` only accepts
  a body in `beforeRequestSent`). The difference is in how the FAIL
  is recorded: Testplane's worker terminates the whole run on an
  unhandled rejection, so the unguarded Firefox run recorded 9 cells
  and then died at this cell with exactly that error. Attempting the
  call would kill the run before SUMMARY, so the variant test file
  records the demonstrated FAIL directly (with the reason cited)
  instead of re-triggering the worker termination. The sibling
  webdriverio-firefox suite demonstrates the same failure cleanly
  with SUMMARY, since a plain WDIO suite can capture the rejection.

## Piece 4 — input/context depth

- SKIP (same stance as screenshot/input-click): hover, keyboard,
  multi-tab, iframe. The WDIO v9 stack Testplane is built on exposes
  no BiDi surface for any of them; the Classic paths work and are
  demonstrated in the detail strings.
- SKIP: drag-and-drop, with a Firefox twist. On Chrome, Classic
  dragAndDrop works (dropped) and the cell is SKIP for lack of a
  BiDi surface. On Firefox, Classic dragAndDrop itself runs without
  error but the drop handler never fires — the same Firefox
  pointer-drag limitation as the other Firefox cells. The cell stays
  SKIP with the Classic outcome in the detail.
- Build note: the first Piece 4 copy of the test file was scrambled
  — cells 11-15 landed inside the dialog handler instead of after
  network-intercept, so the dialog cell ran them in dialog context
  and the run died at dialog. The file was rebuilt from the correct
  Chrome test file with only two differences: the network-intercept
  FAIL-by-construction cell and the drag SKIP-on-Classic-timeout
  cell (diff against the Chrome file proves this). A rerun after
  the rebuild still hit the known Testplane dialog flake once
  (worker terminated at dialog with `handleUserPrompt: no such
  alert`); the next rerun completed all 15 cells.
