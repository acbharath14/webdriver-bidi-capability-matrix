# WebDriver BiDi capability matrix

> Generated from actual suite runs by `node run-matrix.cjs` — do not hand-edit.
> Generated: 2026-10-28T03:47:07.980Z (UTC). Probe app: local Node server on port 4333. Node 24.22.1.
> Scope: stable releases only, BiDi-supporting tools only (see README.md for the exclusion list).

## Capability × tool

| Capability | Vibium | Vibium (Firefox) | Puppeteer | Puppeteer (Firefox) | Selenium | Selenium (Firefox) | WebdriverIO | WebdriverIO (Firefox) | Testplane | Testplane (Firefox) | Cypress | Firefox DevTools MCP | WebdriverIO MCP | Testplane MCP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Navigation events | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| Console-log capture | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP |
| JS-error capture | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS |
| Network request/response capture | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP |
| Script evaluation | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| Cookie get/set | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP |
| Screenshot | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| Dialog handling | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP |
| Input / click | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS |
| Network interception | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ❌ FAIL | ✅ PASS | ❌ FAIL | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP |
| Drag and drop | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP |
| Hover | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ✅ PASS |
| Keyboard input | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ✅ PASS | ⏭️ SKIP |
| Multi-tab / context | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ✅ PASS | ✅ PASS |
| Iframe interaction | ✅ PASS | ✅ PASS | ✅ PASS | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP | ✅ PASS | ⏭️ SKIP |

## Per-tool summary

| Tool | PASS | FAIL | SKIP | NOT-RUN | Run status | Notes |
|---|---|---|---|---|---|---|
| Vibium | 15 | 0 | 0 | 0 | ok (14s) | [notes](tools/vibium/NOTES.md) |
| Vibium (Firefox) | 14 | 0 | 1 | 0 | ok (26s) | [notes](tools/vibium-firefox/NOTES.md) |
| Puppeteer | 15 | 0 | 0 | 0 | ok (9s) | [notes](tools/puppeteer/NOTES.md) |
| Puppeteer (Firefox) | 14 | 0 | 1 | 0 | ok (27s) | [notes](tools/puppeteer-firefox/NOTES.md) |
| Selenium | 13 | 0 | 2 | 0 | ok (14s) | [notes](tools/selenium/NOTES.md) |
| Selenium (Firefox) | 13 | 0 | 2 | 0 | ok (25s) | [notes](tools/selenium-firefox/NOTES.md) |
| WebdriverIO | 8 | 0 | 7 | 0 | ok (11s) | [notes](tools/webdriverio/NOTES.md) |
| WebdriverIO (Firefox) | 7 | 1 | 7 | 0 | exit 1 | [notes](tools/webdriverio-firefox/NOTES.md) |
| Testplane | 7 | 0 | 8 | 0 | ok (14s) | [notes](tools/testplane/NOTES.md) |
| Testplane (Firefox) | 6 | 1 | 8 | 0 | exit 1 | [notes](tools/testplane-firefox/NOTES.md) |
| Cypress | 8 | 0 | 7 | 0 | ok (23s) | [notes](tools/cypress/NOTES.md) |
| Firefox DevTools MCP | 11 | 0 | 4 | 0 | ok (30s) | [notes](tools/mcp/NOTES.md) |
| WebdriverIO MCP | 9 | 0 | 6 | 0 | ok (47s) | [notes](tools/wdio-mcp/NOTES.md) |
| Testplane MCP | 7 | 0 | 8 | 0 | ok (89s) | [notes](tools/testplane-mcp/NOTES.md) |

## Per-capability timing (ms)

> Wall time per capability in milliseconds, including that capability's own page/context setup, excluding browser launch. A dash means the suite printed no timing for that cell (crashed run or older output). Suite totals are in the summary table above.

| Capability | Vibium | Vibium (Firefox) | Puppeteer | Puppeteer (Firefox) | Selenium | Selenium (Firefox) | WebdriverIO | WebdriverIO (Firefox) | Testplane | Testplane (Firefox) | Cypress | Firefox DevTools MCP | WebdriverIO MCP | Testplane MCP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Navigation events | 823 | 635 | 484 | 1129 | 425 | 709 | 246 | 325 | 197 | 295 | 270 | 4691 | 1572 | 10275 |
| Console-log capture | 315 | 519 | 516 | 617 | 335 | 676 | 917 | 633 | 719 | 322 | 347 | 342 | 0 | 20691 |
| JS-error capture | 322 | 499 | 314 | 495 | 511 | 361 | 308 | 102 | 368 | 70 | 778 | 229 | 1 | 5257 |
| Network request/response capture | 823 | 672 | 469 | 626 | 501 | 481 | 363 | 95 | 332 | 73 | 304 | 257 | 0 | 0 |
| Script evaluation | 329 | 174 | 185 | 325 | 232 | 279 | 11 | 6 | 17 | 6 | 199 | 80 | 689 | 5148 |
| Cookie get/set | 665 | 287 | 223 | 315 | 263 | 246 | 37 | 12 | 18 | 6 | 333 | 103 | 693 | 1 |
| Screenshot | 567 | 266 | 305 | 395 | 347 | 428 | 71 | 80 | 57 | 72 | 597 | 138 | 732 | 5218 |
| Dialog handling | 1370 | 1373 | 408 | 1141 | 357 | 509 | 232 | 679 | 364 | 617 | 530 | 6502 | 0 | 1 |
| Input / click | 424 | 318 | 363 | 657 | 444 | 355 | 160 | 104 | 210 | 106 | 425 | 231 | 1392 | 5319 |
| Network interception | 654 | 310 | 268 | 630 | 561 | 568 | 329 | 15340 | 358 | 0 | 281 | 0 | 928 | 0 |
| Drag and drop | 818 | 10664 | 443 | 10579 | 372 | 10851 | 363 | 15405 | 393 | 15338 | 274 | 174 | 5 | 0 |
| Hover | 371 | 339 | 331 | 508 | 320 | 279 | 281 | 263 | 323 | 260 | 247 | 129 | 0 | 5303 |
| Keyboard input | 511 | 400 | 270 | 560 | 395 | 605 | 240 | 206 | 342 | 216 | 296 | 120 | 1075 | 0 |
| Multi-tab / context | 682 | 448 | 542 | 784 | 611 | 1076 | 432 | 273 | 692 | 325 | 109 | 509 | 1445 | 6152 |
| Iframe interaction | 521 | 384 | 346 | 671 | 5642 | 527 | 321 | 209 | 402 | 290 | 298 | 0 | 1977 | 0 |

## Setup recorded for this run

> Versions actually observed in this run, not claimed. Tool versions are the installed package versions (declared range when not installed); browser versions come from the suite's session when it reports one, otherwise from a `--version` probe of the binary the run used. "not probed" means the run exposed no version for that slot. Install steps per tool: see the NOTES.md links in the summary table.

| Tool | Tool version | Browser | Driver |
|---|---|---|---|
| Vibium | vibium 26.8.21 | Vibium-managed-Chrome-for-Testing | n/a (BiDi direct) |
| Vibium (Firefox) | vibium 26.8.21 | Vibium-managed-Firefox/158.0 | n/a (BiDi direct) |
| Puppeteer | puppeteer 25.16.0 | Chrome/156.0.8078.47 | n/a (BiDi direct) |
| Puppeteer (Firefox) | puppeteer 25.16.0 | firefox/158.0.1 | n/a (BiDi direct) |
| Selenium | selenium-webdriver 4.51.0 | 156.0.8078.47 | ChromeDriver 156.0.8078.47 |
| Selenium (Firefox) | selenium-webdriver 4.51.0 | Firefox/158.0.1 | geckodriver 0.37.1 |
| WebdriverIO | webdriverio 9.32.0 | 156.0.8078.47 | ChromeDriver 156.0.8078.47 |
| WebdriverIO (Firefox) | webdriverio 9.32.0 | Firefox/158.0.1 | geckodriver 0.37.1 |
| Testplane | testplane 9.3.4 | 156.0.8078.47 | ChromeDriver 156.0.8078.47 |
| Testplane (Firefox) | testplane 9.3.4 | Firefox/158.0.1 | geckodriver 0.37.1 |
| Cypress | cypress 16.2.0 | firefox/158.0.1 | n/a (Cypress drives Firefox) |
| Firefox DevTools MCP | @mozilla/firefox-devtools-mcp 0.10.6 | Mozilla Firefox 158.0.1 | geckodriver 0.37.1 |
| WebdriverIO MCP | @wdio/mcp 4.0.1 | Chrome/156.0.0.0 | server-managed (not probed) |
| Testplane MCP | @testplane/mcp 0.9.0 | Chrome (server-managed) | server-managed (not probed) |

## Per-tool evidence (detail strings from the runs)

### Vibium

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second (823ms)
- Console-log capture: **PASS** — type=log text="probe-log" (315ms)
- JS-error capture: **PASS** — message="Error: probe-thrown" (322ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (823ms)
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe (329ms)
- Cookie get/set: **PASS** — probe=chocochip via context API (665ms)
- Screenshot: **PASS** — bytes=30244 png-signature=yes (567ms)
- Dialog handling: **PASS** — dismissed=dismissed confirmed=confirmed (1370ms)
- Input / click: **PASS** — Hello, Ada (424ms)
- Network interception: **PASS** — pattern=**/api/ping fetch-result=intercepted (654ms)
- Drag and drop: **PASS** — drag-result=dropped (818ms)
- Hover: **PASS** — hover-result=hovered (371ms)
- Keyboard input: **PASS** — key-result=arrow-right (511ms)
- Multi-tab / context: **PASS** — tab landed http://127.0.0.1:4333/second marker=Second page (682ms)
- Iframe interaction: **PASS** — inner-result=inner-clicked (521ms)

### Vibium (Firefox)

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second (635ms)
- Console-log capture: **PASS** — type=log text="probe-log" (519ms)
- JS-error capture: **PASS** — message="Error: probe-thrown" (499ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (672ms)
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe (174ms)
- Cookie get/set: **PASS** — probe=chocochip via context API (287ms)
- Screenshot: **PASS** — bytes=50889 png-signature=yes (266ms)
- Dialog handling: **PASS** — dismissed=dismissed confirmed=confirmed (1373ms)
- Input / click: **PASS** — Hello, Ada (318ms)
- Network interception: **PASS** — pattern=**/api/ping fetch-result=intercepted (310ms)
- Drag and drop: **SKIP** — dragTo runs without error on Firefox but drop handler never fires (Chrome cell passes); Vibium Firefox drag is a no-op (10664ms)
- Hover: **PASS** — hover-result=hovered (339ms)
- Keyboard input: **PASS** — key-result=arrow-right (400ms)
- Multi-tab / context: **PASS** — tab landed http://127.0.0.1:4333/second marker=Second page (448ms)
- Iframe interaction: **PASS** — inner-result=inner-clicked (384ms)

### Puppeteer

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second (484ms)
- Console-log capture: **PASS** — type=log text="probe-log" (516ms)
- JS-error capture: **PASS** — message="Error: probe-thrown" (314ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (469ms)
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe (185ms)
- Cookie get/set: **PASS** — probe=chocochip via page cookie API (223ms)
- Screenshot: **PASS** — bytes=32685 png-signature=yes (305ms)
- Dialog handling: **PASS** — dismissed=dismissed confirmed=confirmed (408ms)
- Input / click: **PASS** — Hello, Ada (363ms)
- Network interception: **PASS** — fetch-result=intercepted (268ms)
- Drag and drop: **PASS** — drag-result=dropped (443ms)
- Hover: **PASS** — hover-result=hovered (331ms)
- Keyboard input: **PASS** — key-result=arrow-right (270ms)
- Multi-tab / context: **PASS** — tab landed http://127.0.0.1:4333/second (542ms)
- Iframe interaction: **PASS** — inner-result=inner-clicked (346ms)

### Puppeteer (Firefox)

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second (1129ms)
- Console-log capture: **PASS** — type=log text="probe-log" (617ms)
- JS-error capture: **PASS** — message="Error: probe-thrown" (495ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (626ms)
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe (325ms)
- Cookie get/set: **PASS** — probe=chocochip via page cookie API (315ms)
- Screenshot: **PASS** — bytes=44404 png-signature=yes (395ms)
- Dialog handling: **PASS** — dismissed=dismissed confirmed=confirmed (1141ms)
- Input / click: **PASS** — Hello, Ada (657ms)
- Network interception: **PASS** — fetch-result=intercepted (630ms)
- Drag and drop: **SKIP** — mouse drag runs without error on Firefox but drop handler never fires (Chrome cell passes); Firefox BiDi pointer drag does not produce HTML5 drag events (10579ms)
- Hover: **PASS** — hover-result=hovered (508ms)
- Keyboard input: **PASS** — key-result=arrow-right (560ms)
- Multi-tab / context: **PASS** — tab landed http://127.0.0.1:4333/second (784ms)
- Iframe interaction: **PASS** — inner-result=inner-clicked (671ms)

### Selenium

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second (425ms)
- Console-log capture: **PASS** — probe-log (335ms)
- JS-error capture: **PASS** — Error: probe-thrown (511ms)
- Network request/response capture: **PASS** — {"_id":"AB42AB67DA08230E2759E912EF95E08A","_navigation":null,"_redirectCount":0,"_request":{"_request":"17418.3","_url":"http://127.0.0.1:4333/api/ping","_metho (501ms)
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe (232ms)
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage (263ms)
- Screenshot: **PASS** — bytes=21789 png-signature=yes (347ms)
- Dialog handling: **SKIP** — userPromptOpened fires (2 observed) but handleUserPrompt fails 'no such alert': chromedriver mapper auto-dismisses prompts (confirm->dismissed); Classic alert API fails identically; accept path unusable (357ms)
- Input / click: **PASS** — Hello, Ada (444ms)
- Network interception: **PASS** — fetch-result=intercepted (561ms)
- Drag and drop: **PASS** — drag-result=dropped (372ms)
- Hover: **PASS** — hover-result=hovered (320ms)
- Keyboard input: **PASS** — key-result=arrow-right (395ms)
- Multi-tab / context: **PASS** — tab landed http://127.0.0.1:4333/second marker=Second page (611ms)
- Iframe interaction: **SKIP** — BiDi input click in frame contexts is a mapper no-op (runs, no effect); script click in the same frame works (5642ms)

### Selenium (Firefox)

- Navigation events: **PASS** — landed http://127.0.0.1:4333/second (709ms)
- Console-log capture: **PASS** — probe-log (676ms)
- JS-error capture: **PASS** — Error: probe-thrown (361ms)
- Network request/response capture: **PASS** — {"_id":"035a7bc5-9d43-4c74-a32f-7f020f4a91c4","_navigation":null,"_redirectCount":0,"_request":{"_request":"28-5736eb4f-f849-4127-9e4c-080c00a3a241","_url":"htt (481ms)
- Script evaluation: **PASS** — 1+1=2, title=BiDi Probe (279ms)
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage (246ms)
- Screenshot: **PASS** — bytes=48075 png-signature=yes (428ms)
- Dialog handling: **SKIP** — userPromptOpened fires (1 observed) but handleUserPrompt fails 'no such alert': geckodriver mapper auto-dismisses prompts (confirm->dismissed); Classic alert API fails identically; accept path unusable (509ms)
- Input / click: **PASS** — Hello, Ada (355ms)
- Network interception: **PASS** — fetch-result=intercepted (568ms)
- Drag and drop: **SKIP** — BiDi pointer drag runs without error on Firefox but drop handler never fires (Chrome cell passes); Firefox BiDi pointer drag does not produce HTML5 drag events (10851ms)
- Hover: **PASS** — hover-result=hovered (279ms)
- Keyboard input: **PASS** — key-result=arrow-right (605ms)
- Multi-tab / context: **PASS** — tab landed http://127.0.0.1:4333/second marker=Second page (1076ms)
- Iframe interaction: **PASS** — inner-result=inner-clicked (527ms)

### WebdriverIO

- Navigation events: **PASS** — committed url=http://127.0.0.1:4333/second (246ms)
- Console-log capture: **PASS** — type=console method=log text=probe-log (917ms)
- JS-error capture: **PASS** — type=javascript level=error text=Error: probe-thrown (308ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (363ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe (11ms)
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage (37ms)
- Screenshot: **SKIP** — Classic saveScreenshot works (21494 bytes PNG) but WDIO v9 exposes no BiDi captureScreenshot surface (71ms)
- Dialog handling: **PASS** — dialogs=[alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm] dismissed+confirmed both observed (232ms)
- Input / click: **SKIP** — Classic click+setValue works (Hello, Ada) but WDIO v9 exposes no BiDi input.perform surface (160ms)
- Network interception: **PASS** — fetch-result=intercepted mock-calls=1 (329ms)
- Drag and drop: **SKIP** — Classic dragAndDrop works (dropped) but WDIO v9 exposes no BiDi input.perform surface (363ms)
- Hover: **SKIP** — Classic moveTo works (hovered) but WDIO v9 exposes no BiDi input.perform surface (281ms)
- Keyboard input: **SKIP** — Classic keys() works (arrow-right) but WDIO v9 exposes no BiDi input.perform surface (240ms)
- Multi-tab / context: **SKIP** — Classic window handles work (tab landed http://127.0.0.1:4333/second) but WDIO v9 exposes no BiDi browsingContext surface (432ms)
- Iframe interaction: **SKIP** — Classic switchFrame works (inner-clicked) but WDIO v9 exposes no BiDi frame surface (321ms)

### WebdriverIO (Firefox)

- Navigation events: **PASS** — committed url=http://127.0.0.1:4333/second (325ms)
- Console-log capture: **PASS** — type=console method=log text=probe-log (633ms)
- JS-error capture: **PASS** — type=javascript level=error text=Error: probe-thrown (102ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (95ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe (6ms)
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage (12ms)
- Screenshot: **SKIP** — Classic saveScreenshot works (50748 bytes PNG) but WDIO v9 exposes no BiDi captureScreenshot surface (80ms)
- Dialog handling: **PASS** — dialogs=[alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm] dismissed+confirmed both observed (679ms)
- Input / click: **SKIP** — Classic click+setValue works (Hello, Ada) but WDIO v9 exposes no BiDi input.perform surface (104ms)
- Network interception: **FAIL** — mock body rejected on Firefox: WebDriver Bidi command "network.provideResponse" failed with error: unsupported operation - The "body" parameter is only supported for the beforeRequestSent phase at the moment (15340ms)
- Drag and drop: **SKIP** — Classic dragAndDrop runs without error on Firefox but drop handler never fires (Chrome Classic drag works); WDIO v9 exposes no BiDi input.perform surface (15405ms)
- Hover: **SKIP** — Classic moveTo works (hovered) but WDIO v9 exposes no BiDi input.perform surface (263ms)
- Keyboard input: **SKIP** — Classic keys() works (arrow-right) but WDIO v9 exposes no BiDi input.perform surface (206ms)
- Multi-tab / context: **SKIP** — Classic window handles work (tab landed http://127.0.0.1:4333/second) but WDIO v9 exposes no BiDi browsingContext surface (273ms)
- Iframe interaction: **SKIP** — Classic switchFrame works (inner-clicked) but WDIO v9 exposes no BiDi frame surface (209ms)

### Testplane

- Navigation events: **PASS** — committed url=http://127.0.0.1:4333/second (197ms)
- Console-log capture: **PASS** — type=console method=log text=probe-log (719ms)
- JS-error capture: **PASS** — type=javascript level=error text=Error: probe-thrown (368ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (332ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe (17ms)
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage (18ms)
- Screenshot: **SKIP** — Classic saveScreenshot works (21494 bytes PNG) but Testplane/WDIO expose no BiDi captureScreenshot surface (57ms)
- Dialog handling: **SKIP** — dialog events fire ([alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm]) but accept()/dismiss() fail 'no such alert' (results: dismiss-leg=dismissed accept-leg=dismissed); prompt auto-dismissed before handling (364ms)
- Input / click: **SKIP** — Classic click+setValue works (Hello, Ada) but Testplane/WDIO expose no BiDi input.perform surface (210ms)
- Network interception: **PASS** — fetch-result=intercepted mock-calls=1 (358ms)
- Drag and drop: **SKIP** — Classic dragAndDrop works (dropped) but Testplane/WDIO expose no BiDi input.perform surface (393ms)
- Hover: **SKIP** — Classic moveTo works (hovered) but Testplane/WDIO expose no BiDi input.perform surface (323ms)
- Keyboard input: **SKIP** — Classic keys() works (arrow-right) but Testplane/WDIO expose no BiDi input.perform surface (342ms)
- Multi-tab / context: **SKIP** — Classic window handles work (tab landed http://127.0.0.1:4333/second) but Testplane/WDIO expose no BiDi browsingContext surface (692ms)
- Iframe interaction: **SKIP** — Classic switchFrame works (inner-clicked) but Testplane/WDIO expose no BiDi frame surface (402ms)

### Testplane (Firefox)

- Navigation events: **PASS** — committed url=http://127.0.0.1:4333/second (295ms)
- Console-log capture: **PASS** — type=console method=log text=probe-log (322ms)
- JS-error capture: **PASS** — type=javascript level=error text=Error: probe-thrown (70ms)
- Network request/response capture: **PASS** — url=http://127.0.0.1:4333/api/ping status=200 (73ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe (6ms)
- Cookie get/set: **PASS** — probe=chocochip via BiDi storage (6ms)
- Screenshot: **SKIP** — Classic saveScreenshot works (50748 bytes PNG) but Testplane/WDIO expose no BiDi captureScreenshot surface (72ms)
- Dialog handling: **SKIP** — dialog events fire ([alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm]) but accept()/dismiss() fail 'no such alert' (results: dismiss-leg=dismissed accept-leg=dismissed); prompt auto-dismissed before handling (617ms)
- Input / click: **SKIP** — Classic click+setValue works (Hello, Ada) but Testplane/WDIO expose no BiDi input.perform surface (106ms)
- Network interception: **FAIL** — mock body rejected on Firefox: network.provideResponse body only supported in beforeRequestSent; WDIO/Testplane mock provides body at responseStarted (worker-terminating unhandled rejection, reproduced) (0ms)
- Drag and drop: **SKIP** — Classic dragAndDrop runs without error on Firefox but drop handler never fires (Chrome Classic drag works); Testplane/WDIO expose no BiDi input.perform surface (15338ms)
- Hover: **SKIP** — Classic moveTo works (hovered) but Testplane/WDIO expose no BiDi input.perform surface (260ms)
- Keyboard input: **SKIP** — Classic keys() works (arrow-right) but Testplane/WDIO expose no BiDi input.perform surface (216ms)
- Multi-tab / context: **SKIP** — Classic window handles work (tab landed http://127.0.0.1:4333/second) but Testplane/WDIO expose no BiDi browsingContext surface (325ms)
- Iframe interaction: **SKIP** — Classic switchFrame works (inner-clicked) but Testplane/WDIO expose no BiDi frame surface (290ms)

### Cypress

- Navigation events: **PASS** — url=http://127.0.0.1:4333/second (270ms)
- Console-log capture: **SKIP** — no spec-level BiDi log-event surface in Cypress; console output only appears in runner logs (347ms)
- JS-error capture: **PASS** — captured=The following error originated from your application code, not from Cypress. | > probe-thrown | When Cypress detects uncaught errors originating from your application it will automatically fail the current test. | This behavior is configurable, and you can choose to turn this off by listening to the `uncaught:exception` event. (778ms)
- Network request/response capture: **SKIP** — fetch works (fetch-result=pong) but cy.intercept is proxy-based, not BiDi; no spec-level BiDi network subscription (304ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe (199ms)
- Cookie get/set: **PASS** — probe=chocochip (333ms)
- Screenshot: **PASS** — cy.screenshot viewport capture succeeded (597ms)
- Dialog handling: **PASS** — alert seen; confirm dismissed then confirmed via one variable-driven window:confirm handler; seen=[alert:probe-alert, confirm:probe-confirm, confirm:probe-confirm] (530ms)
- Input / click: **PASS** — typed Ada, clicked greet, Hello, Ada observed (425ms)
- Network interception: **SKIP** — cy.intercept stub works (fetch-result=intercepted) but via Cypress proxy, not BiDi interception (281ms)
- Drag and drop: **SKIP** — trigger dragstart/dragover/drop works (drag-result=dropped) but Cypress has no native drag or BiDi input API; synthetic events only (274ms)
- Hover: **SKIP** — trigger mouseover works (hover-result=hovered) but Cypress has no real hover or BiDi input API; synthetic events only (247ms)
- Keyboard input: **SKIP** — trigger keydown works (key-result=arrow-right) but cy.type() cannot target a non-input focusable element and trigger is synthetic, not BiDi input (296ms)
- Multi-tab / context: **SKIP** — Cypress is single-tab by architecture; it cannot open, switch to, or assert a new tab (109ms)
- Iframe interaction: **PASS** — inner-clicked via contentDocument iframe access (298ms)

### Firefox DevTools MCP

- Navigation events: **PASS** — href=http://127.0.0.1:4333/second (4691ms)
- Console-log capture: **PASS** — { |   "total": 1, |   "filtered": 1, |   "showing": 1, |   "hasMore": false, |   "filters": "textContains=\"probe-log\"", |   "messages": [ |     { |       "level": "info", |       "text": "probe-log", |       "source":  (342ms)
- JS-error capture: **PASS** — { |   "total": 2, |   "filtered": 1, |   "showing": 1, |   "hasMore": false, |   "filters": "textContains=\"probe-thrown\"", |   "messages": [ |     { |       "level": "error", |       "text": "Error: probe-thrown", |    (229ms)
- Network request/response capture: **PASS** — { |   "total": 1, |   "showing": 1, |   "hasMore": false, |   "requests": [ |     { |       "id": "42-99a49c95-a53e-4096-8ac7-9a26ea77f7d3", |       "url": "http://127.0.0.1:4333/api/ping", |       "method": "GET", |   (257ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe (80ms)
- Cookie get/set: **SKIP** — document.cookie round-trips via evaluate_script (probe=chocochip) but the server exposes no dedicated cookie tool (103ms)
- Screenshot: **PASS** — image image/png 67884 chars base64 (138ms)
- Dialog handling: **SKIP** — accept_dialog/dismiss_dialog exist but handling fails (Failed to accept/dismiss dialog); prompts auto-dismissed before the tool runs (confirm always dismissed, accept leg never confirmed); errs=[alert-accept: tool accept_dialog returned isError: Error: Failed to accept dialog: ; dismiss: tool dismiss_dialog returned isError: Error: Failed to dismiss dialog: ; accept: tool accept_dialog returned isError: Error: Failed to accept dialog: ] (6502ms)
- Input / click: **PASS** — Hello, Ada via fill_by_uid + click_by_uid (231ms)
- Network interception: **SKIP** — no interception tool in the server tool list (list/get only; set_network_cache is cache control, not interception) (0ms)
- Drag and drop: **PASS** — drag-result=dropped via drag_by_uid_to_uid (174ms)
- Hover: **PASS** — hover-result=hovered via hover_by_uid (129ms)
- Keyboard input: **PASS** — key-result=arrow-right via press_key ArrowRight (120ms)
- Multi-tab / context: **PASS** — new tab 1 showed Second page; returned to probe tab (509ms)
- Iframe interaction: **SKIP** — no frame tool in the server tool list (49 tools); snapshot shows the iframe element but no tool can switch into it or click inside; evaluate_script is observation-only by the matrix design rule (0ms)

### WebdriverIO MCP

- Navigation events: **PASS** — tab url ends /second (1572ms)
- Console-log capture: **SKIP** — no console tool in the server tool list (base 17 + gated 23 tools) (0ms)
- JS-error capture: **SKIP** — no error tool in the server tool list (1ms)
- Network request/response capture: **SKIP** — no network-list tool in the server tool list (mock records calls but does not list network traffic) (0ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe via execute_script (return-form) (689ms)
- Cookie get/set: **PASS** — probe=chocochip via set_cookie + get_cookies (693ms)
- Screenshot: **PASS** — bytes=26575 png-signature=yes (732ms)
- Dialog handling: **SKIP** — no dialog tool in the server tool list (0ms)
- Input / click: **PASS** — Hello, Ada via set_value + click_element (1392ms)
- Network interception: **PASS** — fetch-result=intercepted mock-calls=1 (928ms)
- Drag and drop: **SKIP** — no drag tool in the server tool list; perform_actions has only click/fill/select/check/uncheck/press, no drag primitive (5ms)
- Hover: **SKIP** — no hover tool in the server tool list; perform_actions has no hover primitive (0ms)
- Keyboard input: **PASS** — key-result=arrow-right via press_key ArrowRight (1075ms)
- Multi-tab / context: **PASS** — new tab index 1 showed Second page; returned to tab 0 (1445ms)
- Iframe interaction: **PASS** — inner-result=inner-clicked via switch_frame + click_element (1977ms)

### Testplane MCP

- Navigation events: **PASS** — href ends /second via navigate + run-code (10275ms)
- Console-log capture: **SKIP** — console tool surfaces WARNING/SEVERE (probe-warn returned) but not INFO console.log (probe-log never returned) (20691ms)
- JS-error capture: **PASS** — probe-thrown surfaced via console tool (SEVERE javascript entry) (5257ms)
- Network request/response capture: **SKIP** — no network-list tool in the server tool list (0ms)
- Script evaluation: **PASS** — 1+1=2 title=BiDi Probe via run-code (5148ms)
- Cookie get/set: **SKIP** — no cookie get/set tool in the server tool list (save-state/restore-state persist state, not cookie access) (1ms)
- Screenshot: **PASS** — bytes=22313 png-signature=yes (5218ms)
- Dialog handling: **SKIP** — no dialog tool in the server tool list (1ms)
- Input / click: **PASS** — Hello, Ada via type + click (5319ms)
- Network interception: **SKIP** — no mock/intercept tool in the server tool list (0ms)
- Drag and drop: **SKIP** — no drag tool in the server tool list (24 tools) (0ms)
- Hover: **PASS** — hover-result=hovered via hover tool (5303ms)
- Keyboard input: **SKIP** — no press-key tool in the server tool list; type is text-only and cannot send ArrowRight (0ms)
- Multi-tab / context: **PASS** — new tab showed Second page; tabs after click: ✅ Retrieved list of browser tabs |  | ## Browser Tabs |  |   1. Title: BiDi Probe; URL: http://127.0.0.1:4333/ (current) |  |   2. Title: BiDi Probe — Second; URL: http://127.0.0.1:4333/second  (6152ms)
- Iframe interaction: **SKIP** — no frame tool in the server tool list (24 tools); run-code is observation-only by the matrix design rule, so it cannot substitute for frame interaction (0ms)

## How to reproduce

```sh
npm run preflight              # checks setup, installs missing tool deps
node run-matrix.cjs            # full matrix (preflight runs automatically first)
node run-matrix.cjs --tool vibium   # one tool only
node run-matrix.cjs --no-preflight  # skip preflight (deps already installed)
```

Per-tool suites also run standalone; see each tool's NOTES.md for its setup (drivers, ports, env vars).
