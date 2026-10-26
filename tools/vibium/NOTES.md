# Vibium — BiDi notes

Version verified: `vibium` 26.8.21 (JS sync client, stable release).
Suite: `suite.cjs` — run with `node suite.cjs` (needs the probe server on
`PROBE_URL`, default `http://127.0.0.1:4333`). No driver needed: Vibium
manages Chrome for Testing itself (cached at `~/.cache/vibium/`).

## Gotchas (observed, not assumed)

- Sandbox runs as root, so Chrome needs `--no-sandbox`: the suite sets
  `VIBIUM_CHROME_ARGS=--no-sandbox` automatically when root, and runs
  `headless: true`. A normal user account runs unmodified.
- `waitForLoad('load')` times out even on fully loaded pages — the suite
  never relies on it; it polls for visible outcomes instead.
- `onDialog()` is first-wins: repeated calls do NOT replace the handler
  (observed: a dismiss set after an accept was ignored). The dialog test
  therefore uses one fresh page per dialog decision.
- `find()` accepts CSS selectors (including attribute selectors) plus a
  `{timeout}` option; `findAll()` returns an array; `isVisible()` and
  `waitForURL()` work as documented.

## Result shape

10/10 PASS in the sandbox run, including network interception via
`route('**/api/ping', ...)` and dialog accept + dismiss on fresh pages.
