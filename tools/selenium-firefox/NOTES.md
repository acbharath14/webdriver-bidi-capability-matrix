# Selenium (Firefox) — notes

Firefox variant of `tools/selenium/suite.cjs`: the same 10 capabilities
through the same BiDi modules (BrowsingContext, Input, Storage,
Network, ScriptManager, LogInspector, BrowsingContextInspector), only
the session differs — `firefox.Options` (`-headless`, workdir Firefox
binary when present) + `Capabilities.firefox()` with `webSocketUrl:
true` (BiDi enablement, as on Chrome).

## Driver resolution (in order)

1. `GECKODRIVER_BIN` env, when it points at an existing binary.
2. The geckodriver package's TMPDIR download cache
   (`$TMPDIR/geckodriver`, e.g. the sandbox's scratch tmp dir).
3. Otherwise no explicit service — Selenium Manager resolves and
   downloads geckodriver itself (the standard path on a Mac).

## Session facts

- SESSION browser is `Firefox/` + the session's browser version
  (158.0.1 in the sandbox).
- Driver column: the probed geckodriver version when the runner finds
  one, else `Selenium Manager resolved`.

## Verified outcome (standalone run, sandbox)

13/0/2 with the Piece 4 input/context cells (9/0/1 on the original
10). Dialog is SKIP with the same signature as the Chrome entry:
`userPromptOpened` fires, but `handleUserPrompt` fails `no such
alert` and the confirm lands `dismissed` — the prompt is
auto-dismissed before handling code runs. Finding: the dialog
auto-dismiss issue is a BiDi-mapper pattern, not a chromedriver-only
quirk — geckodriver's mapper behaves the same. BiDi network
interception, by contrast, works on Firefox (PASS).

## Piece 4 — input/context depth

- PASS: drag is NOT among them — see below. Hover (BiDi pointer
  move), keyboard (PUA `'\uE014'` for Right, as on Chrome — a plain
  `'ArrowRight'` value produces no keydown event in the mapper),
  multi-tab (event filter: BrowsingContextInfo with no parent; the
  inspector forwards every BiDi message, and `getTopLevelContexts()`
  maps `.id` incorrectly in selenium-webdriver 4.51.0).
- PASS, diverging from Chrome: iframe. Where the Chrome entry SKIPs
  (BiDi input click in a frame context is a mapper no-op), the
  geckodriver mapper delivers the frame click and
  `inner-result=inner-clicked` — so the Firefox cell is PASS. This is
  a genuine Firefox-over-Chrome win for Selenium's mapper.
- SKIP: drag-and-drop. The BiDi pointer sequence runs without error
  on Firefox but the drop handler never fires, while the identical
  Chrome cell passes. Firefox BiDi pointer input does not translate
  into HTML5 drag events — same limitation as the Vibium, Puppeteer,
  and WDIO Firefox cells. By the iframe precedent (mapper no-op ->
  SKIP, demonstrated, with a poll so a future fix flips this to
  PASS), a poll timeout is SKIP, not FAIL.
