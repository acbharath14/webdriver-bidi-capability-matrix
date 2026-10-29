# Puppeteer — BiDi notes

Version verified: `puppeteer` 25.16.0, Chrome for Testing 156 (downloaded by
Puppeteer into `~/.cache/puppeteer/`).
Suite: `suite.cjs` — run with `node suite.cjs` (needs the probe server on
`PROBE_URL`, default `http://127.0.0.1:4333`).

## BiDi enablement (documented stable opt-in)

BiDi is opt-in for Chrome: `launch({ protocol: 'webDriverBiDi' })`.
(Firefox defaults to BiDi; this suite is Chrome-first — the sandbox has
Chrome cached and no Firefox.) A capability that throws
`UnsupportedOperation` over BiDi is reported SKIP, not FAIL: the tool's
stable BiDi does not cover it.

## Sandbox vs normal Mac

- `--no-sandbox` is added only when running as root; a normal user account
  runs unmodified.
- Puppeteer downloads its own Chrome + chrome-headless-shell on install;
  sandbox egress to those downloads worked.

## Result shape

10/10 PASS in the sandbox run, including network interception
(`setRequestInterception` + `respond`) and dialog handling.

## Piece 4 — input/context depth (15/0/0)

All five new capabilities pass over BiDi: drag-and-drop (mouse
move/down/move/up across element centers), hover (`page.hover`),
keyboard (click-to-focus + `keyboard.press('ArrowRight')`), multi-tab
(`targetcreated` capture for the new tab, assert it landed), iframe
(`page.frames()` by URL, click inside, assert). No gaps found.
