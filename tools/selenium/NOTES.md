# Selenium (JS bindings) — BiDi notes

Version verified: `selenium-webdriver` 4.51.0, Chrome for Testing 156 + chromedriver 156 (cached).
Suite: `suite.cjs` — run with `node suite.cjs` (needs the probe server on `PROBE_URL`, default `http://127.0.0.1:4333`, and a chromedriver reachable by Selenium Manager or on PATH; in the sandbox the cached chromedriver is used).

## BiDi enablement (documented stable opt-in)

`capabilities.set('webSocketUrl', true)` on the Chrome session. Without it,
the BiDi connection is never established and every BiDi call fails with
"WebDriver instance must support BiDi protocol". Chrome binary / driver
paths are taken from `CHROME_BIN` / `CHROMEDRIVER_BIN` when set, else Selenium
Manager resolves them.

## What each capability uses

- **Navigation** — `BrowsingContext.navigate()` to `/second`, URL asserted.
- **Console-log / JS-error** — `LogInspector` + `onConsoleEntry` /
  `onJavascriptException`. Gotcha: the inspector factory requires a context id
  (string or string array) — passing `null` fails with "browsingContexts
  should be string or string array". Pass the tab's context id.
- **Network-capture** — `Network` + `responseCompleted` events; the raw event
  object is reported (ids, request/response shapes).
- **Script-eval** — `ScriptManager.evaluateFunctionInBrowsingContext()` with
  `awaitPromise: false`; the result is a `RemoteValue` — unwrap `.result.value`.
- **Cookie** — `Storage` + `PartialCookie` + `BrowsingContextPartitionDescriptor`.
  Gotchas, all verified against the installed package source:
  - `BytesValue` is constructed, not factory-made:
    `new BytesValue(BytesValue.Type.STRING, 'chocochip')` from
    `selenium-webdriver/bidi/networkTypes`. (`LocalValue.createStringValue`
    is a different class, for script arguments.)
  - `AddInterceptParameters`, `ProvideResponseParameters`, `PartialCookie`
    are `{ ClassName }` exports — destructure them; the bare `require()` gives
    an object, not a constructor.
  - `getCookies()` returns `Cookie` objects whose `.value` is a BytesValue-like
    object (`{type, value}`), not a plain string — unwrap `.value` before
    comparing.
- **Screenshot** — `BrowsingContext.captureScreenshot()` (base64 PNG, signature
  checked).
- **Dialog** — SKIP (see below). Observation via `BrowsingContextInspector`
  `onUserPromptOpened` works; handling does not.
- **Input-click** — `Input.perform()` with pointer actions; the pointer-move
  origin accepts a `WebElement` (auto-converted to a BiDi element origin).
- **Network-intercept** — `Network.addIntercept()` with
  `AddInterceptParameters('beforeRequestSent').urlStringPattern(...)` +
  `beforeRequestSent` handler calling `provideResponse()` with a `BytesValue`
  body and status 200. The handler body is wrapped in try/catch: an exception
  inside a network callback otherwise crashes the whole suite (observed).

## Dialog: why SKIP

`BrowsingContext.handleUserPrompt()` always fails with `no such alert` under
the chromedriver 156 mapper, even though `userPromptOpened` events fire with
the correct context id. The prompt is already gone by handling time: a
`confirm()` clicked via BiDi input returns `false` (auto-dismissed) without
any handling call. The Classic `switchTo().alert()` path fails identically
(`no such alert`). So programmatic accept/dismiss is not usable through
Selenium + chromedriver here — SKIP with the reason, not a PASS (the accept
path can never run) and not a FAIL (the BiDi API exists; the driver layer
blocks it). Contrast: WebdriverIO 9.32 handles the identical probe flow fine
through the same chromedriver, so this is specific to Selenium's mapper path.

## Sandbox vs normal Mac

- `--headless` + `--no-sandbox` are added only when running as root (sandbox);
  a normal user account runs the same suite unmodified.
- Selenium Manager downloads are not needed in the sandbox (cached driver +
  binary are used); on a Mac, Selenium Manager resolves Chrome/chromedriver
  automatically.
