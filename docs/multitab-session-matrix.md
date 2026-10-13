# Multi-tab session acceptance matrix — Penpot MCP

This is a **pending live-host test**, not evidence that current ChatGPT desktop supports optional `sessionId`.

1. Read the actual schemas of `execute_code` and `export_shape`. Record support/absence of `sessionId` for each independently, and compare each result with the tools the scenario actually invokes; support in one tool does not imply support in the other. `high_level_overview` and `penpot_api_info` are documentation calls and do not select a design.
2. Create **two disposable Penpot files** A and B and connect both browser tabs. Capture the server-reported IDs when supported; never guess ID-to-file mapping.
3. Explicitly choose A and inspect/file-pin A. Perform one *authorized*, disposable change, read back the same ID and export from A. Confirm B is unchanged.
4. Disconnect A, retain B, attempt a follow-up mutation/export. **Expected**: fail closed; known empty or unknown supported inventory fails even with a pinned A route, and a legacy host without selectors must not resume merely because one tab remains. Never fall back to B.
5. To resume, reconnect the intended tab. If reload creates a new session ID, have the user confirm it belongs to that intended tab, replace the stale route pin with the confirmed ID, and reselect it. Then perform a fresh read-only inspection of its file/page/shape IDs before any mutation or export. If B is chosen as a new target, record that explicit choice; a legacy host cannot prove that a remaining B is A.
6. Repeat with **two tabs showing the same file/page**. File/page checks alone cannot distinguish their sessions. When routing is not supported, treat matching IDs as insufficient continuity evidence, require the explicit recovery steps above, and mark atomic export routing as unverified.

| Mode | Expected | Evidence state |
| --- | --- | --- |
| One known tab, with `sessionId` exposed by every invoked scoped tool | Existing task works without prompting; retain one selector per supported operation | Unverified on ChatGPT desktop |
| Initial unknown inventory, supported invoked tools, read-only discovery | Allow server auto-selection only for the discovery call; stop on ambiguity/no session | Documented policy; live behavior unverified |
| Multi-operation with partial selector support | Keep the selector for each supported operation; reject or downgrade unsupported export independently | Documented policy |
| Two tabs and exposed IDs | User-selected ID persists through read/write/export | Unverified |
| Supported routing with known zero IDs | Stop, including when a previously pinned ID exists | Documented fail-closed policy |
| Supported routing with unknown inventory | Require an explicit ID or an initial read-only discovery; do not treat `[]` as known empty | Documented policy |
| Chosen session disappears | Mutation and export must stop | Unverified |
| Interrupted route recovery read | After confirmation and re-selection, allow one read-only `execute_code` inspection with pending verification; keep mutation/export blocked until a fresh inspection is verified | Documented fail-closed policy |
| Legacy host with unknown inventory | Require explicit one-connected-tab confirmation; after interruption also require intended-target confirmation, re-selection and re-inspection | Documented fail-closed policy |
| Two tabs, no selector exposed | Do not authorize ambiguous write/export | Documented fail-closed policy |
| Two tabs same file/page | Must not infer session from identical file/page IDs | Unverified |

The checked-in preflight JS example in `penpot-use/SKILL.md` is covered by a synthetic test. It is not a new session API and cannot force a host without `sessionId` to provide atomic routing. Keep issue #5 open until the real acceptance matrix is run.

Reload recovery uses the confirmed replacement session ID for the pending read, verifies the original file/page/targets, and resumes writes/exports only after successful verification. `test/session-routing-policy.test.mjs` covers that transition, actionable unknown-inventory retry, independent tool selectors, same-file ambiguity and blocked writes before recovery inspection. Live ChatGPT multi-tab acceptance remains unverified; #5 stays open.


Latest guard regressions: selector-free legacy reload can restore the original saved IDs only after explicit intended-singleton confirmation/re-selection; restoration never captures a new selection. Unrouted exports require an immediately preceding guarded target read-back and singleton evidence, including when execute_code retains its own selector. Initial unpinned read discovery consumes a task-scoped allowance before calling Penpot; repeated or interrupted unscoped discovery is rejected. Explicit routes and confirmed recovery reads remain available. These are executable policy tests, not proof of atomic routing in a live ChatGPT host.
