# WebdriverIO MCP — BiDi notes

Version verified: `@wdio/mcp` 4.0.1 (17 base tools + 6 gated tools),
Chrome 156.0.0.0 (from the session's user agent; the server provisions its
own Chrome for Testing + chromedriver).
Suite: `suite.cjs` — a minimal MCP client (JSON-RPC over stdio, no AI agent)
that scripts every tool call deterministically. Run with `node suite.cjs`
(needs the probe server on `PROBE_URL`, default `http://127.0.0.1:4333`).

## How it works

The server is spawned as `node node_modules/@wdio/mcp/lib/server.js` and
drives a local headless Chrome (1280x800) over WebDriver BiDi: session
logs show `Register BiDi handler`, `Connecting to webSocketUrl`, and
`Connected to Bidi protocol`, and browser mocks refuse to run unless
`browser.isBidi` is true. The suite therefore passes
`capabilities: { webSocketUrl: true }` to `start_session` (the documented
requirement for browser mocks). No `--no-sandbox` accommodation is needed
as root: unlike the Testplane MCP server, this server's Chrome launch
succeeds in the sandbox as-is, and chromedriver is auto-downloaded by the
server itself (156.0.8078.47 in the observed run).

## Tool → capability map (verified via tools/list)

| Capability | MCP tool(s) | Cell |
|---|---|---|
| Navigation events | `navigate` + `get_tabs` (URL check) | PASS |
| Console-log capture | — (no console tool) | SKIP |
| JS-error capture | — (no error tool) | SKIP |
| Network capture | — (no network-list tool) | SKIP |
| Script evaluation | `execute_script` (`return`-form) | PASS |
| Cookie get/set | `set_cookie` + `get_cookies` (gated `cookies` group) | PASS |
| Screenshot | `get_screenshot` (base64 PNG) | PASS |
| Dialog handling | — (no dialog tool) | SKIP |
| Input / click | `set_value` + `click_element` (CSS selectors) | PASS |
| Network interception | `mock` (gated `mocks` group) + `get_mock_calls` | PASS |

Base tools (17): `start_session`, `close_session`, `navigate`,
`switch_tab`, `switch_frame`, `scroll`, `click_element`, `set_value`,
`select_option`, `press_key`, `perform_actions`, `snapshot`,
`execute_script`, `get_screenshot`, `get_tabs`, `query_docs`,
`enable_tools`. Gated groups via `enable_tools` (the suite enables
`cookies` + `mocks` up front): cookies → `get_cookies`, `set_cookie`,
`delete_cookies`; mocks → `mock`, `get_mock_calls`, `manage_mock`.
The suite asserts the gated tools are present after enabling; their
absence is FAIL, not SKIP (they are documented server features).

## Design rule (same as the Firefox DevTools MCP entry)

Capabilities map to DEDICATED tools only. `execute_script` counts for
script-eval and is used to READ page state for assertions (greet-result,
fetch-result, location.href, user agent) — that is observation, not
simulation. It is never used to subscribe to console/network events to
fake a missing tool, which would misrepresent the MCP surface.

## Tool specifics

- `execute_script` takes a script string; values need `return`
  (`return 1 + 1` → `Result: 2`). Results arrive as text `Result: <value>`;
  the suite strips the prefix. A bare `1 + 1` is tried as fallback.
- `click_element` / `set_value` accept snapshot refs (`e12`) or CSS /
  XPath / text selectors; the suite uses CSS selectors (`#btn-greet`,
  `#input-name`).
- `get_screenshot` returns a base64 PNG (16,474 bytes decoded in the
  verified run); the suite checks the PNG signature, not just length.
- `set_cookie` requires the browser to already be on the target domain
  (domain defaults to current, path defaults to `/`); the suite navigates
  home first, then verifies via `get_cookies { name: 'probe' }`.
- `mock` for browsers takes a URL glob (`**/api/ping`), a behavior
  (`respond` here), a `value` (the response body — an object is sent as
  JSON), plus `statusCode` and `headers` overrides. The suite responds
  `{ ok: true, msg: 'intercepted' }` with status 200 and
  `Content-Type: application/json`, clicks Fetch, and verifies
  `fetch-result=intercepted` plus `mock-calls=1` via `get_mock_calls`.
- `get_tabs` returns `[{ handle, title, url, isActive }]`; the navigation
  cell checks the tab URL ends with `/second`.
- Dialog is SKIP without clicking: with no dialog tool, clicking Alert /
  Confirm would block the page with no handler. The SKIP is about the tool
  surface, demonstrated by the tool-list check, not by clicking.

## Gotchas observed

- **Server startup can stall.** One probe run sat 600s at `initialize`
  with the server process alive but unresponsive (cause undetermined;
  the suite run later completed in 33s). The suite guards this with a
  120s `initialize` timeout: a stalled server produces FAIL cells with
  the reason instead of a hung run, and a failed `start_session` reports
  every cell FAIL with the reason (same pattern as the Puppeteer suite's
  launch-failure path).
- **Shutdown:** call `close_session`, then close stdin (EOF), wait for the
  `exit` event (15s), then SIGKILL + destroy the stdout pipe — same
  pattern as the Firefox DevTools MCP suite. Every `tools/call` helper
  clears its timeout on settle, or node stays alive for the full timeout.
- **Session facts:** the server exposes no version tool, so the SESSION
  line reports the browser from `navigator.userAgent`
  (`Chrome/156.0.0.0`) and the tool counts (17 base, 23 after enabling).
  The runner's setup table reads the installed package version (4.0.1)
  for the tool version column.

## Piece 4 — input/context depth (verified 9/0/6 standalone)

- SKIP: drag-and-drop, hover. No drag or hover tool exists in the
  server tool list; `perform_actions` offers only
  click/fill/select/check/uncheck/press — no drag or hover
  primitive — and click is not a hover demonstration, so hover is
  not faked with a click.
- PASS: keyboard (`click_element '#key-target'` to focus, then
  `press_key { keys: 'ArrowRight' }` -> `arrow-right`).
- PASS: multi-tab (click `#link-newtab`, `get_tabs`, `switch_tab`,
  snapshot asserts `Second page`, switch back). Two suite bugs were
  found and fixed here, both verified by probes:
  - **Live mock crashes the server on new-tab creation.** With the
    network-intercept mock still registered, clicking the new-tab
    link timed out and the server process exited 1: the mock's
    `#handleResponseStarted` calls `network.provideResponse` for the
    new tab's navigation request, which fails `no such request` as
    an unhandled exception that kills the whole server. The suite
    now calls `manage_mock { action: 'restore', url: '**/api/ping' }`
    right after the intercept cell (best-effort; a missing mock
    errors `mock not found` and is ignored). With restore first, the
    same sequence passes in <1s per call. `manage_mock` actions are
    `clear|reset|restore` — there is no `remove` action.
  - **Tab index is array position, not a field.** `get_tabs`
    returns `[{handle, title, url, isActive}]` with no `index`
    field; the suite's old fallback parsed the first digits of a
    handle as the index. It now uses `findIndex` on the URL.
- PASS: iframe (`switch_frame { selector: '#probe-frame' }`,
  `click_element '#inner-btn'`, `execute_script` reads
  `inner-clicked` — observation only — then `switch_frame {}` back
  to the top document).
