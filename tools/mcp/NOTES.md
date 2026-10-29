# Firefox DevTools MCP — BiDi notes

Version verified: `@mozilla/firefox-devtools-mcp` 0.10.6 (developer preset,
49 tools), Firefox 158.0.1 (downloaded, see below).
Suite: `suite.cjs` — a minimal MCP client (JSON-RPC over stdio, no AI agent)
that scripts every tool call deterministically. Run with `node suite.cjs`
(needs the probe server on `PROBE_URL`, default `http://127.0.0.1:4333`).

## How it works

The server controls Firefox through WebDriver BiDi via Selenium WebDriver
(per its README) and is launched headless with `--firefox-path` pointing at
the bundled Firefox and `--tool-preset developer` (the preset that adds the
network, console, debugging and profiler modules — `basic` alone would still
cover most cells, but `developer` is what exposes `list_network_requests`
and the debugger tools). The suite prints the server version, tool count, and
whether a cookie/intercept tool exists, up front.

## Tool → capability map (verified via tools/list)

| Capability | MCP tool(s) | Cell |
|---|---|---|
| Navigation events | `navigate_page` + `evaluate_script` (location.href) | PASS |
| Console-log capture | `list_console_messages` (textContains filter) | PASS |
| JS-error capture | `list_console_messages` (level error, `Error: probe-thrown`) | PASS |
| Network capture | `list_network_requests` (urlContains, always-on capture) | PASS |
| Script evaluation | `evaluate_script` (function string) | PASS |
| Cookie get/set | — (no cookie tool in the 49-tool list) | SKIP (demo via `evaluate_script` + `document.cookie`) |
| Screenshot | `screenshot_page` (base64 PNG) | PASS |
| Dialog handling | `accept_dialog` / `dismiss_dialog` | SKIP (see below) |
| Input / click | `take_snapshot` + `fill_by_uid` + `click_by_uid` | PASS |
| Network interception | — (list/get only) | SKIP |

Snapshots print one line per element — `uid=e1 button "Log" text="Log"` —
so UIDs are extracted by label with a regex. UIDs go stale on navigation, so
the suite takes a fresh snapshot before every interaction.
`evaluate_script` results arrive wrapped as
`Script ran on page and returned:\n```json\n"<value-as-JSON>"\n``` —
the suite extracts the fenced block, then JSON-parses repeatedly.

## Dialog: why SKIP

`accept_dialog` / `dismiss_dialog` exist, but handling fails with
`Failed to accept/dismiss dialog` (returned as `isError`). Probing showed
the mechanism: prompts are auto-dismissed before the tool runs — a clicked
`confirm()` always ends `dismissed`, and the accept leg can never produce
`confirmed`. Same signature as Selenium/Testplane through chromedriver's
mapper, but here through Firefox/geckodriver's BiDi path. SKIP with the
reason, not FAIL: the tools exist; the driver layer blocks the accept path.

## Cookie / intercept: why SKIP

Neither capability has a tool in the server's list (verified: 49 tools,
developer preset). `set_network_cache` is cache control, not interception.
The cookie SKIP is demonstrated via `evaluate_script` + `document.cookie`
round-tripping, so the SKIP is about the tool surface, not the browser.

## Gotchas observed

- **Uncleared MCP timeouts hang node.** Every `tools/call` helper that sets
  a timeout MUST clear it on settle, or node stays alive for the full
  timeout after the work is done. This bug made early probes run exactly as
  long as their longest timeout (120s, then 300s) and looked like a slow
  server — the server itself starts in under a second.
- **Shutdown:** call `close_firefox_session`, then close stdin (EOF), wait
  for the `exit` event (15s), then SIGKILL + destroy the stdout pipe.
  SIGTERM alone also works (the server logs `Firefox instance reset`), but
  the EOF + exit-wait path is deterministic and leaves no Firefox behind
  (verified with `pgrep -x firefox` after every run).
- The server writes its log to the `--log-file` path (here, the OS temp dir).

## Firefox provisioning

Firefox is downloaded from Mozilla (`download.mozilla.org`, latest stable,
linux64) and extracted under `tools/firefox/` (gitignored — ~200MB, never
committed). The suite uses it via `--firefox-path`; set `FIREFOX_PATH` to
override. On a Mac, point `FIREFOX_PATH` at the system Firefox (or leave the
bundled download in place). Firefox needs no `--no-sandbox` accommodation as
root, unlike Chrome.

## Piece 4 — input/context depth (11/0/4)

- drag-and-drop PASS via drag_by_uid_to_uid (HTML5 drag events).
- hover PASS via hover_by_uid.
- keyboard PASS via press_key ArrowRight, focused on the target via
  its snapshot uid.
- multi-tab PASS via new_page + select_page + get_page_text +
  close_page (new tab showed 'Second page'; returned to tab 0).
- iframe SKIP: no frame tool exists in the server's 49-tool list;
  the snapshot shows the iframe element but no tool can switch into
  it or click inside, and evaluate_script is observation-only by the
  matrix design rule.
- Parser fix (same pass): the snapshot renders plain divs as
  `uid=e24 div text="Drag me"` (no bare quoted label), which the old
  `parseSnapshot` regex missed — it now also captures the `text=`
  form. Button/input/link labels are unaffected (no collisions with
  the added span/div texts).
