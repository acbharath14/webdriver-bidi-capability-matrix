# WebDriver BiDi capability matrix

> Generated from actual suite runs by `node run-matrix.cjs` — do not hand-edit.
> Generated: 2026-10-26T03:27:37.642Z (UTC). Probe app: local Node server on port 4333.
> Scope: stable releases only, BiDi-supporting tools only (see README.md for the exclusion list).

## Capability × tool

| Capability | Vibium | Puppeteer | Selenium | WebdriverIO | Testplane | Cypress | Firefox DevTools MCP |
|---|---|---|---|---|---|---|---|
| Navigation events | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| Console-log capture | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS |
| JS-error capture | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| Network request/response capture | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS |
| Script evaluation | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| Cookie get/set | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP |
| Screenshot | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ✅ PASS |
| Dialog handling | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP |
| Input / click | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ✅ PASS |
| Network interception | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP |

## Per-tool summary

| Tool | PASS | FAIL | SKIP | NOT-RUN | Run status | Notes |
|---|---|---|---|---|---|---|
| Vibium | 10 | 0 | 0 | 0 | ok (9s) | [notes](tools/vibium/NOTES.md) |
| Puppeteer | 10 | 0 | 0 | 0 | ok (6s) | [notes](tools/puppeteer/NOTES.md) |
| Selenium | 9 | 0 | 1 | 0 | ok (5s) | [notes](tools/selenium/NOTES.md) |
| WebdriverIO | 8 | 0 | 2 | 0 | ok (7s) | [notes](tools/webdriverio/NOTES.md) |
| Testplane | 7 | 0 | 3 | 0 | ok (18s) | [notes](tools/testplane/NOTES.md) |
| Cypress | 7 | 0 | 3 | 0 | ok (29s) | [notes](tools/cypress/NOTES.md) |
| Firefox DevTools MCP | 7 | 0 | 3 | 0 | ok (28s) | [notes](tools/mcp/NOTES.md) |

## Per-tool evidence (detail strings from the runs)

### Vibium

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second
- Console-log capture: **PASS** — type=log text="probe-log"
- JS-error capture: **PASS** — message="Error: probe-thrown"
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe
- Cookie get/set: **PASS** — probe=chocochip via context API
- Screenshot: **PASS** — bytes=19620 png-signature=yes
- Dialog handling: **PASS** — dismissed=dismissed confirmed=confirmed
- Input / click: **PASS** — Hello, Ada
- Network interception: **PASS** — pattern=**/api/ping fetch-result=intercepted

### Puppeteer

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second
- Console-log capture: **PASS** — type=log text="probe-log"
- JS-error capture: **PASS** — message="Error: probe-thrown"
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe
- Cookie get/set: **PASS** — probe=chocochip via page cookie API
- Screenshot: **PASS** — bytes=20386 png-signature=yes
- Dialog handling: **PASS** — dismissed=dismissed confirmed=confirmed
- Input / click: **PASS** — Hello, Ada
- Network interception: **PASS** — fetch-result=intercepted

### Selenium

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second
- Console-log capture: **PASS** — probe-log
- JS-error capture: **PASS** — Error: probe-thrown
- Network request/response capture: **PASS** — {"_id":"C2147E5266ACD8D6E07B480AF0DC75E2","_navigation":null,"_redirectCount":0,"_request":{"_request":"3844.2","_url":"http://127.0.0.1:4333/api/ping","_method
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage
- Screenshot: **PASS** — bytes=18601 png-signature=yes
- Dialog handling: **SKIP** — userPromptOpened fires (1 observed) but handleUserPrompt fails 'no such alert': chromedriver mapper auto-dismisses prompts (confirm->dismissed); Classic alert API fails identically; accept path unusable
- Input / click: **PASS** — Hello, Ada
- Network interception: **PASS** — fetch-result=intercepted

### WebdriverIO

- Navigation events: **PASS** — committed url=http://127.0.0.1:4333/second
- Console-log capture: **PASS** — type=console method=log text=probe-log
- JS-error capture: **PASS** — type=javascript level=error text=Error: probe-thrown
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage
- Screenshot: **SKIP** — Classic saveScreenshot works (18298 bytes PNG) but WDIO v9 exposes no BiDi captureScreenshot surface
- Dialog handling: **PASS** — dialogs=[alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm] dismissed+confirmed both observed
- Input / click: **SKIP** — Classic click+setValue works (Hello, Ada) but WDIO v9 exposes no BiDi input.perform surface
- Network interception: **PASS** — fetch-result=intercepted mock-calls=1

### Testplane

- Navigation events: **PASS** — committed url=http://127.0.0.1:4333/second
- Console-log capture: **PASS** — type=console method=log text=probe-log
- JS-error capture: **PASS** — type=javascript level=error text=Error: probe-thrown
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage
- Screenshot: **SKIP** — Classic saveScreenshot works (18298 bytes PNG) but Testplane/WDIO expose no BiDi captureScreenshot surface
- Dialog handling: **SKIP** — dialog events fire ([alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm]) but accept()/dismiss() fail 'no such alert' (results: dismiss-leg=dismissed accept-leg=dismissed); prompt auto-dismissed before handling
- Input / click: **SKIP** — Classic click+setValue works (Hello, Ada) but Testplane/WDIO expose no BiDi input.perform surface
- Network interception: **PASS** — fetch-result=intercepted mock-calls=1

### Cypress

- Navigation events: **PASS** — url=http://127.0.0.1:4333/second
- Console-log capture: **SKIP** — no spec-level BiDi log-event surface in Cypress; console output only appears in runner logs
- JS-error capture: **PASS** — captured=The following error originated from your application code, not from Cypress. | > probe-thrown | When Cypress detects uncaught errors originating from your application it will automatically fail the current test. | This behavior is configurable, and you can choose to turn this off by listening to the `uncaught:exception` event.
- Network request/response capture: **SKIP** — fetch works (fetch-result=pong) but cy.intercept is proxy-based, not BiDi; no spec-level BiDi network subscription
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe
- Cookie get/set: **PASS** — probe=chocochip
- Screenshot: **PASS** — cy.screenshot viewport capture succeeded
- Dialog handling: **PASS** — alert seen; confirm dismissed then confirmed via one variable-driven window:confirm handler; seen=[alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm]
- Input / click: **PASS** — typed Ada, clicked greet, Hello, Ada observed
- Network interception: **SKIP** — cy.intercept stub works (fetch-result=intercepted) but via Cypress proxy, not BiDi interception

### Firefox DevTools MCP

- Navigation events: **PASS** — href=http://127.0.0.1:4333/second
- Console-log capture: **PASS** — { |   "total": 1, |   "filtered": 1, |   "showing": 1, |   "hasMore": false, |   "filters": "textContains=\"probe-log\"", |   "messages": [ |     { |       "level": "info", |       "text": "probe-log", |       "source": 
- JS-error capture: **PASS** — { |   "total": 2, |   "filtered": 1, |   "showing": 1, |   "hasMore": false, |   "filters": "textContains=\"probe-thrown\"", |   "messages": [ |     { |       "level": "error", |       "text": "Error: probe-thrown", |   
- Network request/response capture: **PASS** — { |   "total": 1, |   "showing": 1, |   "hasMore": false, |   "requests": [ |     { |       "id": "23-0b98a528-440d-4b29-86fe-85928972e2ef", |       "url": "http://127.0.0.1:4333/api/ping", |       "method": "GET", |  
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe
- Cookie get/set: **SKIP** — document.cookie round-trips via evaluate_script (probe=chocochip) but the server exposes no dedicated cookie tool
- Screenshot: **PASS** — image image/png 40796 chars base64
- Dialog handling: **SKIP** — accept_dialog/dismiss_dialog exist but handling fails (Failed to accept/dismiss dialog); prompts auto-dismissed before the tool runs (confirm always dismissed, accept leg never confirmed); errs=[alert-accept: tool accept_dialog returned isError: Error: Failed to accept dialog: ; dismiss: tool dismiss_dialog returned isError: Error: Failed to dismiss dialog: ; accept: tool accept_dialog returned isError: Error: Failed to accept dialog: ]
- Input / click: **PASS** — Hello, Ada via fill_by_uid + click_by_uid
- Network interception: **SKIP** — no interception tool in the server tool list (list/get only; set_network_cache is cache control, not interception)

## How to reproduce

```sh
npm run preflight              # checks setup, installs missing tool deps
node run-matrix.cjs            # full matrix (preflight runs automatically first)
node run-matrix.cjs --tool vibium   # one tool only
node run-matrix.cjs --no-preflight  # skip preflight (deps already installed)
```

Per-tool suites also run standalone; see each tool's NOTES.md for its setup (drivers, ports, env vars).
