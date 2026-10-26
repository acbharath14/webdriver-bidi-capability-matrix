# Cypress (Firefox-only BiDi) — notes

Version verified: `cypress` 16.2.0, Firefox 158.0.1 (downloaded, see below).
Suite: `cypress/e2e/matrix.cy.js` + `cypress.config.cjs`, run via the
wrapper `node run.cjs` (the spec records results through `cy.task` into
`results.json`; the wrapper prints the shared RESULT/SUMMARY contract).

## BiDi, honestly framed

Cypress drives Firefox over WebDriver BiDi (since Cypress 14.1, Firefox
135+). That is the transport — but Cypress spec APIs expose **no raw BiDi
event subscription**. So this entry measures "Cypress-on-Firefox completes
the probe capabilities" with transport notes per cell, not "raw BiDi events":

| Capability | Cypress path | Cell |
|---|---|---|
| Navigation events | `cy.visit('/second')` + `cy.url()` | PASS |
| Console-log capture | — (no spec-level log subscription; console output only in runner logs) | SKIP |
| JS-error capture | `Cypress.on('uncaught:exception')` receives the thrown error (return `false` to keep the test green) | PASS |
| Network capture | — (`cy.intercept` is Cypress's proxy, not a BiDi subscription) | SKIP (fetch demoed, `fetch-result=pong`) |
| Script evaluation | `cy.window()` + page JS evaluation | PASS |
| Cookie get/set | `cy.setCookie` / `cy.getCookie` | PASS |
| Screenshot | `cy.screenshot()` (viewport) | PASS |
| Dialog handling | `window:alert` / `window:confirm` handlers (return value decides accept/dismiss) | PASS |
| Input / click | `cy.get().type()` / `.click()` | PASS |
| Network interception | — (`cy.intercept` stubs work, but through the proxy, not BiDi) | SKIP (stub demoed, `fetch-result=intercepted`) |

## Firefox provisioning

Firefox is downloaded from Mozilla (`download.mozilla.org`, latest stable,
linux64) and extracted under `tools/firefox/` (gitignored, shared with the
MCP entry). The wrapper puts that directory on PATH so
`cypress run --browser firefox` detects it; set `CYPRESS_FIREFOX_PATH` to a
binary path to pass `--browser <path>` instead. On a Mac with a system
Firefox, neither is needed (`--browser firefox` finds it).

## Cypress binary install quirk (sandbox)

`npx cypress install` failed twice here: the downloader produced a
truncated file (247,332,846 bytes vs the expected 251,358,204, checksum
mismatch) — sandbox egress behavior, not a Cypress defect. The workaround
that worked: download the zip with curl, then install from the local file:

```sh
curl -sL -o cypress.zip "https://cdn.cypress.io/desktop/16.2.0/linux-x64/cypress.zip"
CYPRESS_INSTALL_BINARY=./cypress.zip npx cypress install
```

(The zip is deleted after install; the binary lives in `~/.cache/Cypress`.)

## Cypress traps avoided in the spec

- **Queue-time assignment:** plain variable assignments in a test body run
  at queue time, before any command executes — so a confirm-answer variable
  set to `false` then `true` would read `true` for both legs. The dialog
  test sets the answer inside `.then()` callbacks, which run in queue order.
  One variable-driven `window:confirm` handler (not two stacked handlers)
  decides dismiss vs accept.
- **No hard assertions for capability verdicts:** each test observes page
  state via `.then()` and records PASS/FAIL/SKIP through the `record` task,
  so a capability failure is a FAIL cell, not an aborted run. (If a Cypress
  command itself errors — e.g. the probe server is down — that test records
  nothing and the wrapper reports NOT-RUN.)
- **Multi-line details break the RESULT contract:** Cypress wraps app errors
  multi-line, so the config's `record` task flattens newlines to ` | `
  before writing `results.json`.
- `supportFile: false`, `video: false`, `screenshotOnRunFailure: false`
  keep runs quiet; `testIsolation` is left at its default (each test gets a
  fresh page, so each test visits first).
