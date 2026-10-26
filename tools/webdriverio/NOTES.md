# WebdriverIO v9 — BiDi notes

Version verified: `webdriverio` 9.32.0, Chrome for Testing 156 + chromedriver 156.
Suite: `suite.cjs` — run with `node suite.cjs` (needs the probe server on
`PROBE_URL` and a chromedriver on `WDIO_PORT`, default 9515; `CHROME_BIN`
points at the Chrome binary when it is not on PATH).

## BiDi enablement (documented stable opt-in)

Request `'webSocketUrl': true` in capabilities. WDIO registers its BiDi
session managers (context, polyfill, shadow-root, network, dialog) only when
the session returns a `webSocketUrl` capability — the suite prints
`isBidi` + `webSocketUrl` presence up front and SKIPs every BiDi cell if BiDi
did not connect.

## Transport per capability (verified in the 9.32.0 source, not assumed)

BiDi-backed in v9:

- **Navigation events** — `sessionSubscribe(['browsingContext.navigationCommitted'])`
  + `browser.on(...)`. The browser object is an event emitter for BiDi events.
- **Console-log / JS-error** — `sessionSubscribe(['log.entryAdded'])` +
  `browser.on('log.entryAdded', ...)`; console entries have `type: 'console'`,
  JS exceptions `type: 'javascript'`.
- **Network-capture** — `sessionSubscribe(['network.responseCompleted'])` +
  `browser.on(...)`.
- **Script-eval** — `browser.execute()` uses `script.callFunction` when
  `browser.isBidi` (Classic `executeScript` otherwise).
- **Cookie** — `setCookies`/`getCookies` use `storage.setCookie` /
  `storage.getCookies` when `isBidi`, with a silent Classic fallback on
  empty/error. (A PASS here means set + get round-tripped; the fallback only
  triggers on empty/error, so a retrieved value is strong evidence for the
  BiDi path.)
- **Dialog** — `browser.on('dialog', ...)` + `dialog.accept()` / `dialog.dismiss()`
  through the DialogManager (`browsingContext.handleUserPrompt`). Registering
  a `dialog` listener switches OFF the manager's default auto-dismiss
  (accept: false). Both dismiss and accept were observed working here.
- **Network-intercept** — `browser.mock(url)` + `mock.respond(body,
  {statusCode})`, backed by `network.addIntercept` + network event
  subscriptions.

Classic-only in v9 (SKIP cells, demonstrated via the Classic path so the SKIP
is about transport, not capability):

- **Screenshot** — `saveScreenshot()` uses the Classic `takeScreenshot`
  endpoint; v9 exposes no `captureScreenshot` surface.
- **Input-click** — element `click()` / `setValue()` use Classic endpoints;
  v9 exposes no BiDi `input.perform` surface.

## Gotchas observed

- `mock.restore()` is intentionally NOT called: in this setup (WDIO 9.32 +
  chromedriver 156 mapper) its `network.removeIntercept` call timed out after
  180s (WDIO's default `bidiResponseTimeout`) and crashed the process with an
  unhandled rejection after SUMMARY had printed. Ending the session tears the
  intercept down with it. With restore skipped the suite runs in ~10s.
- `browser.mock()` URL patterns are parsed from the full URL (protocol,
  hostname, port, pathname) — pass the absolute probe URL, not a bare path.

## Sandbox vs normal Mac

- `--headless` + `--no-sandbox` are added only when running as root; a normal
  user account runs unmodified.
- Chromedriver is started externally here (the cached binary). On a Mac,
  point `WDIO_PORT` at any running chromedriver/selenium server, or adapt the
  runner to start one; `CHROME_BIN` is unnecessary with a system Chrome.
