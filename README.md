# WebDriver BiDi capability matrix

Which automation tools can actually do what over **WebDriver BiDi** — measured
by running the same probe page through each tool, not by reading docs.

## What this is

- A tiny **probe app** (`apps/probe/`) with deterministic triggers for
  fifteen capabilities: navigation events, console-log capture, JS-error
  capture, network request/response capture, script evaluation, cookie
  get/set, screenshot, dialog handling, input/click, network interception,
  plus drag-and-drop, hover, keyboard input, multi-tab/context, and
  iframe interaction.
- One **suite per tool** (`tools/<tool>/`), each using that tool's own
  idiomatic API and printing one `RESULT <capability> <PASS|FAIL|SKIP>` line
  and one `TIMING <capability> <ms>` line per capability, a `SESSION` line
  with session facts (e.g. browser version), plus a `SUMMARY` line.
- A **runner** (`run-matrix.cjs`) that starts the probe server, runs every
  suite, and **generates `MATRIX.md` from the actual outputs**. The table is
  never hand-written: a capability with no observed result shows as NOT-RUN.

## Scope: stable releases only, BiDi-supporting tools only

"Stable" means a shipped tool release — not a finished W3C Recommendation
(the BiDi spec itself is still a Working Draft) and not a dev build or an
experimental flag presented as support. Where a tool needs a documented
stable opt-in for BiDi (Puppeteer's `protocol` option, Testplane's
`webSocketUrl`, Selenium's BiDi enablement), the suite uses it and the
tool's NOTES.md says so.

Tools included (each has a suite + NOTES.md):

| Tool | Version verified | Headline result (15 cells) |
|---|---|---|
| Vibium (JS client) | 26.8.21 | 15 PASS |
| Vibium (Firefox) | 26.8.21 + Firefox 158.0.1 | 14 PASS, 1 SKIP (drag-and-drop) |
| Puppeteer | 25.16.0 | 15 PASS |
| Puppeteer (Firefox) | 25.16.0 + Firefox 158.0.1 | 14 PASS, 1 SKIP (drag-and-drop) |
| Selenium (JS bindings) | 4.51.0 | 13 PASS, 2 SKIP (dialog, iframe) |
| Selenium (Firefox) | 4.51.0 + Firefox 158.0.1 | 13 PASS, 2 SKIP (dialog, drag-and-drop) |
| WebdriverIO | 9.32.0 | 8 PASS, 7 SKIP (screenshot, input-click, drag-and-drop, hover, keyboard, multi-tab, iframe) |
| WebdriverIO (Firefox) | 9.32.0 + Firefox 158.0.1 | 7 PASS, 1 FAIL (network-intercept), 7 SKIP |
| Testplane | 9.3.4 | 7 PASS, 8 SKIP (screenshot, dialog, input-click, drag-and-drop, hover, keyboard, multi-tab, iframe) |
| Testplane (Firefox) | 9.3.4 + Firefox 158.0.1 | 6 PASS, 1 FAIL (network-intercept), 8 SKIP |
| Cypress (Firefox-only BiDi) | 16.2.0 + Firefox 158.0.1 | 8 PASS, 7 SKIP (console-log, network-capture, network-intercept, drag-and-drop, hover, keyboard, multi-tab) |
| Firefox DevTools MCP | 0.10.6 + Firefox 158.0.1 | 11 PASS, 4 SKIP (cookie, dialog, network-intercept, iframe) |
| WebdriverIO MCP | 4.0.1 + Chrome (server-managed) | 9 PASS, 6 SKIP (console-log, js-error, network-capture, dialog, drag-and-drop, hover) |
| Testplane MCP | 0.9.0 + Chrome (server-managed) | 7 PASS, 8 SKIP (console-log, network-capture, cookie, dialog, network-intercept, drag-and-drop, keyboard, iframe) |

Cross-tool findings worth knowing before the table: on Firefox, pointer
drag never produces HTML5 drag events — Vibium, Puppeteer, Selenium, and
the WDIO stack all run their drag without error and never get a drop,
while every Chrome drag passes. The Firefox drag cells are therefore
SKIP (mapper no-op, demonstrated, with a poll so a future fix flips them
to PASS), not per-tool FAILs. Conversely, Selenium's iframe cell is SKIP
on Chrome (frame input is a mapper no-op there) but PASS on Firefox —
geckodriver delivers frame input where chromedriver's mapper does not.
And the two network-intercept FAILs (WebdriverIO and Testplane on
Firefox) share one root cause: their mock provides the response body at
`responseStarted`, but Firefox's BiDi `network.provideResponse` only
accepts a body in `beforeRequestSent`.

Tools **excluded on purpose** (not implemented, not oversights):

| Tool | Why excluded |
|---|---|
| Playwright | Its BiDi support is experimental only, not stable. |
| Chrome DevTools MCP | It drives Chrome over CDP (via Puppeteer), not BiDi. |
| Nightwatch | No verified first-class BiDi API found — only indirect/inherited BiDi through internals. |

Nothing in scope is pending: every BiDi-supporting tool above has a suite
and a NOTES.md, including a Firefox variant of each direct Chrome tool.
Cypress and the Firefox DevTools MCP entry are Firefox-only by nature
(see their NOTES.md for the transport caveats — Cypress specs expose no
raw BiDi events, and the MCP entries are scripted clients, not AI
agents). The WebdriverIO and Testplane MCP entries drive server-managed
Chrome instead; their Firefox support (wdio-mcp's `browser` parameter,
testplane-mcp's `browserName`) is a separate follow-up, not built here.

## How to run

Requirements: Node.js 20+ and Chrome (or Chrome for Testing). Each tool
manages its own browser/driver except where its NOTES.md says otherwise.

```sh
# First run (or any fresh clone): preflight checks the setup and installs
# any missing tool dependencies. The matrix runner does this automatically,
# so you can also skip straight to `node run-matrix.cjs`.
npm run preflight

# Full matrix: starts the probe server, runs every suite, regenerates MATRIX.md
node run-matrix.cjs

# One tool only
node run-matrix.cjs --tool vibium
node run-matrix.cjs --tool selenium

# Skip a tool
node run-matrix.cjs --skip testplane

# Skip the automatic preflight (dependencies already installed)
node run-matrix.cjs --no-preflight
```

Per-tool suites also run standalone (they need the probe server running):

```sh
node apps/probe/server.mjs 4333   # in one terminal
node tools/vibium/suite.cjs       # in another (or puppeteer / selenium)
```

WebdriverIO and Testplane need a chromedriver; see their NOTES.md for the
ports and environment variables (`WDIO_PORT`, `CHROME_BIN`,
`TESTPLANE_GRID_URL`). Cypress and the Firefox DevTools MCP entry need
Firefox — the sandbox uses a Mozilla download under `tools/firefox/`
(gitignored); on a Mac, a system Firefox works (see their NOTES.md). The
five `-firefox` variants need Firefox plus geckodriver (see each
variant's NOTES.md for the resolution order and ports; the runner
manages both in a full run). The
WebdriverIO and Testplane MCP entries need no user-provided driver: their
servers provision their own Chrome + chromedriver.

One known flake: Testplane's dialog step intermittently crashes its run
(unhandled `no such alert` rejection from the framework's own dialog path).
The runner retries a partial, FAIL-free run once and keeps the fuller
attempt; a cell still missing after that shows as NOT-RUN, never as a guess.

## How to read MATRIX.md

- **PASS** — the tool performed the capability over BiDi and the probe page
  showed the expected outcome. The detail string next to it is the observed
  evidence (event text, URL, status, values).
- **FAIL** — the tool attempted it over BiDi and it did not work.
- **SKIP** — the tool's stable BiDi does not cover the capability. SKIP is
  not a failure: some tools deliberately keep a capability on their Classic
  path (WebdriverIO/Testplane screenshots and clicks work fine — just not
  over BiDi). The detail string says what was demonstrated instead and why.
- **NOT-RUN** — the suite produced no result for that capability (for
  example, the run crashed partway). NOT-RUN is never upgraded to a guess;
  re-run the tool to fill it in.
- **Per-capability timing** — the timing table shows wall milliseconds per
  capability (including that capability's own page/context setup, excluding
  browser launch), so the speed comparison is per capability, not just the
  rough suite totals in the summary table.
- **Setup recorded for this run** — the setup table lists the tool, browser,
  and driver versions actually observed in that run (installed package
  versions; browser versions from the suite's session or a `--version`
  probe of the binary used). "not probed" means the run exposed no version
  for that slot — it is not a claim. Install steps per tool live in the
  tool's NOTES.md (linked in the summary table).

## Layout

```
apps/probe/          zero-dependency Node server + probe page (port 4333)
tools/vibium/        Vibium JS sync client suite + NOTES.md
tools/vibium-firefox/  Vibium suite, Firefox engine + NOTES.md
tools/puppeteer/     Puppeteer suite (protocol: 'webDriverBiDi') + NOTES.md
tools/puppeteer-firefox/  Puppeteer suite, Firefox + NOTES.md
tools/selenium/      selenium-webdriver suite + NOTES.md
tools/selenium-firefox/  selenium-webdriver suite, Firefox + NOTES.md
tools/webdriverio/   WebdriverIO v9 suite + NOTES.md
tools/webdriverio-firefox/  WebdriverIO v9 suite, Firefox + NOTES.md
tools/testplane/     Testplane config + test + NOTES.md
tools/testplane-firefox/  Testplane config + test, Firefox + NOTES.md
tools/cypress/       Cypress spec (Firefox) + config + wrapper + NOTES.md
tools/mcp/           MCP client suite (Firefox DevTools MCP) + NOTES.md
tools/wdio-mcp/      MCP client suite (WebdriverIO MCP, Chrome) + NOTES.md
tools/testplane-mcp/ MCP client suite (Testplane MCP, Chrome) + NOTES.md
tools/firefox/       downloaded Firefox binary (gitignored, not committed)
run-matrix.cjs       runner + MATRIX.md generator
scripts/preflight.cjs  setup checks + missing-dependency installs (auto-runs in run-matrix.cjs)
MATRIX.md            generated report (do not hand-edit)
matrix-results.json  machine-readable results: cells, timings, setup, sessions
```

## Sandbox vs a normal Mac

This scaffold was built and run in a Linux sandbox that runs as root, so the
suites add `--no-sandbox` only when root is detected and use cached
Chrome-for-Testing binaries when present. On a normal user account (for
example a Mac), the same suites run unmodified against a system Chrome —
except where a tool's NOTES.md calls out a sandbox-specific finding (notably
Testplane's `isolation: false` + missing `se:cdp` observation, which is a
statement about chromedriver 156 in the sandbox, not about Testplane
generally).
