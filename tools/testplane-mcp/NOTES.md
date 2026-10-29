# Testplane MCP — BiDi notes

Version verified: `@testplane/mcp` 0.9.0 (24 tools), Chrome
server-managed by the server itself (version not surfaced by the suite;
the runner records the `Chrome (server-managed)` label).
Suite: `suite.cjs` — a minimal MCP client (JSON-RPC over stdio, no AI agent)
that scripts every tool call deterministically. Run with `node suite.cjs`
(needs the probe server on `PROBE_URL`, default `http://127.0.0.1:4333`).

## How it works

The server is spawned as `node node_modules/@testplane/mcp/build/cli.js`
and drives a local headless Chrome. The suite calls `launch` FIRST with
`{ headless: true, desiredCapabilities: { browserName: 'chrome',
'goog:chromeOptions': { args: ['--no-sandbox'] } } }` and then
`navigate` — see the root note below. No user-provided driver is needed:
the server provisions its own Chrome + chromedriver.

## Tool → capability map (verified via tools/list + live run)

| Capability | MCP tool(s) | Cell |
|---|---|---|
| Navigation events | `navigate` + `run-code` (href check) | PASS |
| Console-log capture | `console` — but WARNING/SEVERE only (see below) | SKIP |
| JS-error capture | `console` (uncaught errors surface as SEVERE) | PASS |
| Network capture | — (no network-list tool) | SKIP |
| Script evaluation | `run-code` (function form, bare fallback) | PASS |
| Cookie get/set | — (no cookie tool) | SKIP |
| Screenshot | `screenshot` (saved PNG file) | PASS |
| Dialog handling | — (no dialog tool) | SKIP |
| Input / click | `type` + `click` (CSS selectors) | PASS |
| Network interception | — (no mock/intercept tool) | SKIP |

All 24 tools: `navigate`, `click`, `hover`, `type`, `select`, `wait`,
`snapshot`, `screenshot`, `console`, `list-tabs`, `switch-tab`,
`new-tab`, `close-tab`, `launch`, `attach`, `attach-repl`,
`close-browser`, `save-state`, `restore-state`, `run-code`,
`test-results`, `inspect-result`, `time-travel-snapshot`,
`time-travel-export-html`.

## Design rule (same as the other MCP entries)

Capabilities map to DEDICATED tools only. `run-code` counts for
script-eval and is used to READ page state for assertions (href, title,
greet-result) — that is observation, not simulation. It is never used to
subscribe to console/network events to fake a missing tool, which would
misrepresent the MCP surface.

## Tool specifics

- `launch` takes `headless`, `desiredCapabilities` (free-form WebDriver
  capabilities, e.g. `goog:chromeOptions`), `gridUrl` (default `local`,
  which lets Testplane manage Chrome and Firefox automatically), and
  `windowSize`. The suite passes `--no-sandbox` via
  `goog:chromeOptions` (see below).
- `run-code` takes `code` (an expression like `1 + 1` or a function
  like `(browser) => browser.execute(() => 1 + 1)`) or a `file`. The
  function form is tried first; results arrive as a JSON envelope
  (`{ "result": <value> }`), which the suite unwraps.
- `console` takes no arguments, is Chromium-only, and returns only
  *unseen* messages since the previous call (each call consumes what it
  returns). Verified level behavior: `console.warn` (WARNING),
  `console.error` (SEVERE), and uncaught exceptions (SEVERE, e.g.
  `probe-thrown`) all surface; `console.log` (INFO, e.g. `probe-log`)
  never does, even after a sleep. Hence console-log is SKIP (the tool
  exists, but INFO capture is absent) while js-error is PASS. The
  favicon 404 appears as a SEVERE network entry on the first console
  call of a session; the suite searches for specific markers, so that
  noise is ignored.
- `screenshot` takes an optional `filePath` (defaults to the tmp
  directory, honoring `TMPDIR`). With no `filePath` it saves a PNG file
  and reports the path (18,601 bytes in the verified run); the suite
  reads that file and checks the PNG signature. It does not return
  inline image content.
- `type` takes a locator (`selector` here) plus `value` — the text to
  type. Its `text` field is a getByText LOCATOR, not the value.
- `click` takes a locator (`selector` here) or testing-library fields
  (`role`/`text`/`labelText`/…), mutually exclusive with `selector`.
- `snapshot` returns a YAML DOM snapshot (script tags omitted by
  default). The suite does not need it for assertions (run-code reads
  page state instead).
- `save-state` / `restore-state` persist browser state across sessions;
  they are not cookie get/set tools, so cookie stays SKIP.
- Dialog is SKIP without clicking: with no dialog tool, clicking Alert /
  Confirm would block the page with no handler. The SKIP is about the
  tool surface, demonstrated by the tool-list check, not by clicking.

## Gotchas observed

- **Root launch.** As root, plain `navigate` (auto-launch) fails with
  `session not created: Chrome instance exited` — Chrome refuses to
  start without `--no-sandbox`. The suite therefore calls `launch`
  explicitly with `--no-sandbox` first. This is an environment
  accommodation, not a capability finding: on a normal desktop account
  the same launch works with or without the flag, and the flag is
  harmless there, so the suite always passes it to keep sandbox and
  Mac behavior identical.
- **A probe hang that was NOT a server bug.** An early probe awaited
  the `notifications/initialized` notification through the request
  sender, which registers a waiter for a response a notification never
  receives — so it hung 300s with the server already connected. The
  suite sends notifications fire-and-forget (no waiter); the server
  answers `initialize` promptly.
- **Shutdown:** call `close-browser`, then close stdin (EOF), wait for
  the `exit` event (15s), then SIGKILL + destroy the stdout pipe — same
  pattern as the other MCP suites. Every `tools/call` helper clears its
  timeout on settle, or node stays alive for the full timeout.
- **Session facts:** the server exposes no version tool, so the SESSION
  line reports the tool count (24) and the absence flags
  (`has-cookie-tool=false has-intercept-tool=false`). The runner's
  setup table reads the installed package version (0.9.0) for the tool
  version column.

## Piece 4 — input/context depth (verified 7/0/8 standalone)

- SKIP: drag-and-drop, keyboard, iframe. No drag, press-key, or
  frame tool exists in the 24-tool list (assumption-check FAILs if
  one appears); `type` is text-only and cannot send ArrowRight, and
  `run-code` is observation-only by the matrix design rule, so it
  cannot substitute for frame interaction.
- PASS: hover (`hover { selector: '#hover-target' }` -> `hovered`
  via `run-code` read-back).
- PASS: multi-tab (click `#link-newtab`, `list-tabs`, `switch-tab
  { tabNumber: 2 }` — deterministic, the suite opens exactly one
  tab before this cell and tabs are 1-based — snapshot asserts
  `Second page`, `close-tab { tabNumber: 2 }`, `switch-tab
  { tabNumber: 1 }`).
