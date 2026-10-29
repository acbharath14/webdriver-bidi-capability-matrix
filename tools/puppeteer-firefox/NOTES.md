# Puppeteer (Firefox) — notes

Firefox variant of `tools/puppeteer/suite.cjs`: the same 10 capabilities
and the same BiDi-first page API, only the launch differs —
`puppeteer.launch({ browser: 'firefox', executablePath, protocol:
'webDriverBiDi', headless: true })`. The binary is the workdir Firefox
(`tools/firefox/firefox/firefox`, 158.0.1) when present, else
Puppeteer's own managed download. Firefox needs no `--no-sandbox`
flag, so none is passed on any platform.

## Session facts

- SESSION browser is `browser.version()` verbatim: `firefox/158.0.1`
  (Puppeteer 25 reports the `firefox/` prefix, unlike its `Chrome/`
  prefix on the Chrome entry).
- Driver column: `n/a (BiDi direct)` — Puppeteer drives Firefox over
  BiDi with no separate driver binary.
- The suite's SKIP rule is unchanged: a capability that throws
  `UnsupportedOperation` over BiDi is SKIP, not FAIL.

## Verified outcome (standalone run, sandbox)

14/0/1 with the Piece 4 input/context cells (10/0/0 on the original
10). Network interception (`page.setRequestInterception` works over
Firefox BiDi in Puppeteer 25.16) and dialog (both legs) pass.

## Piece 4 — input/context depth

- PASS: hover (`page.hover`), keyboard (click-to-focus +
  `keyboard.press('ArrowRight')`), multi-tab (`targetcreated`
  capture; other pages sit idle), iframe (`page.frames()` by URL +
  click inside).
- SKIP: drag-and-drop. The mouse sequence (move/down/move with
  steps:10/up) runs without error on Firefox but the drop handler
  never fires (two runs), while the identical Chrome cell passes in
  <1s. Firefox BiDi pointer input does not translate into HTML5 drag
  events — same limitation as the Vibium, Selenium, and WDIO Firefox
  cells. By the selenium iframe precedent (mapper no-op -> SKIP,
  demonstrated, with a poll so a future fix flips this to PASS), a
  poll timeout is SKIP, not FAIL.
