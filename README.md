# WebDriver BiDi capability matrix

Which automation tools can actually do what over **WebDriver BiDi** — measured
by running the same probe page through each tool, not by reading docs.

## What this is

- A tiny **probe app** (`apps/probe/`) with deterministic triggers for ten
  capabilities: navigation events, console-log capture, JS-error capture,
  network request/response capture, script evaluation, cookie get/set,
  screenshot, dialog handling, input/click, and network interception.
- One **suite per tool** (`tools/<tool>/`), each using that tool's own
  idiomatic API and printing one `RESULT <capability> <PASS|FAIL|SKIP>` line
  per capability plus a `SUMMARY` line.
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

| Tool | Version verified | Headline result |
|---|---|---|
| Vibium (JS client) | 26.8.21 | 10/10 PASS |
| Puppeteer | 25.16.0 | 10/10 PASS |
| Selenium (JS bindings) | 4.51.0 | 9 PASS, 1 SKIP (dialog) |
| WebdriverIO | 9.32.0 | 8 PASS, 2 SKIP (screenshot, input-click) |
| Testplane | 9.3.4 | 7 PASS, 3 SKIP (screenshot, dialog, input-click) |
| Cypress (Firefox-only BiDi) | 16.2.0 + Firefox 158.0.1 | 7 PASS, 3 SKIP (console-log, network-capture, network-intercept) |
| Firefox DevTools MCP | 0.10.6 + Firefox 158.0.1 | 7 PASS, 3 SKIP (cookie, dialog, network-intercept) |

Tools **excluded on purpose** (not implemented, not oversights):

| Tool | Why excluded |
|---|---|
| Playwright | Its BiDi support is experimental only, not stable. |
| Chrome DevTools MCP | It drives Chrome over CDP (via Puppeteer), not BiDi. |
| Nightwatch | No verified first-class BiDi API found — only indirect/inherited BiDi through internals. |

Nothing in scope is pending: every BiDi-supporting tool above has a suite
and a NOTES.md. Cypress and the MCP entry are Firefox-only by nature (see
their NOTES.md for the transport caveats — Cypress specs expose no raw BiDi
events, and the MCP entry is a scripted client, not an AI agent).

## How to run

Requirements: Node.js 20+ and Chrome (or Chrome for Testing). Each tool
manages its own browser/driver except where its NOTES.md says otherwise.

```sh
# Full matrix: starts the probe server, runs every suite, regenerates MATRIX.md
node run-matrix.cjs

# One tool only
node run-matrix.cjs --tool vibium
node run-matrix.cjs --tool selenium

# Skip a tool
node run-matrix.cjs --skip testplane
```

Per-tool suites also run standalone (they need the probe server running):

```sh
node apps/probe/server.mjs 4333   # in one terminal
node tools/vibium/suite.cjs       # in another (or puppeteer / selenium)
```

WebdriverIO and Testplane need a chromedriver; see their NOTES.md for the
ports and environment variables (`WDIO_PORT`, `CHROME_BIN`,
`TESTPLANE_GRID_URL`). Cypress and the MCP entry need Firefox — the sandbox
uses a Mozilla download under `tools/firefox/` (gitignored); on a Mac, a
system Firefox works (see their NOTES.md).

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

## Layout

```
apps/probe/          zero-dependency Node server + probe page (port 4333)
tools/vibium/        Vibium JS sync client suite + NOTES.md
tools/puppeteer/     Puppeteer suite (protocol: 'webDriverBiDi') + NOTES.md
tools/selenium/      selenium-webdriver suite + NOTES.md
tools/webdriverio/   WebdriverIO v9 suite + NOTES.md
tools/testplane/     Testplane config + test + NOTES.md
tools/cypress/       Cypress spec (Firefox) + config + wrapper + NOTES.md
tools/mcp/           MCP client suite (Firefox DevTools MCP) + NOTES.md
tools/firefox/       downloaded Firefox binary (gitignored, not committed)
run-matrix.cjs       runner + MATRIX.md generator
MATRIX.md            generated report (do not hand-edit)
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
