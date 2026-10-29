# Vibium (Firefox) — notes

Firefox variant of `tools/vibium/suite.cjs`: the same 10 capabilities,
the same Vibium sync API, only the launch differs —
`browser.start({ engine: 'firefox', headless: true })` instead of the
default Chrome engine. Vibium provisions its own Firefox
(`~/.cache/vibium/firefox/release/158.0.1` in the sandbox); no
`--no-sandbox` flag is needed and none is passed.

## Session facts

- SESSION browser comes from `navigator.userAgent` on a probe page
  (parsed before the timing baseline, so capability timings stay pure).
  The UA reports `Firefox/158.0` (major.minor only); the provisioned
  build is 158.0.1. The setup table therefore shows
  `Vibium-managed-Firefox/158.0`.
- Driver column: `n/a (BiDi direct)` — Vibium drives the browser over
  BiDi itself, same as the Chrome entry.

## Verified outcome (standalone run, sandbox)

14/0/1 with the Piece 4 input/context cells (10/0/0 on the original
10). Dialog (both legs) and network interception via Vibium's own API
pass on Firefox.

## Piece 4 — input/context depth

- PASS: hover (`hover`), keyboard (`press('ArrowRight')` after
  click-to-focus), multi-tab (page-count growth; the newest page is
  the tab), iframe (`page.frame('/iframe-inner')` + click inside).
- SKIP: drag-and-drop. `dragTo` runs without error on Firefox but the
  drop handler never fires — two full suite runs timed out waiting
  for `dropped`, and a standalone probe with `scrollIntoView` before
  `dragTo` also left `drag-result` at `no-drag-yet`, while the
  identical Chrome cell passes in <1s. By the selenium iframe
  precedent (mapper no-op -> SKIP, demonstrated, with a poll so a
  future Vibium version that delivers drag on Firefox flips this to
  PASS), a poll timeout is SKIP, not FAIL. This is the same Firefox
  pointer-drag limitation seen in the Puppeteer, Selenium, and WDIO
  Firefox cells: Firefox BiDi pointer input does not translate into
  HTML5 drag events.
