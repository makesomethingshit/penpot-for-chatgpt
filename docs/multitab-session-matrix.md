# Multi-tab session compatibility matrix — Penpot MCP

**Historical and future compatibility coverage; not the revised #5 closure criterion.** #5 was narrowed to guarded work and recovery on **one explicitly established active SaaS tab**. Its bounded single-tab acceptance is recorded in [the 2026-10-17 closure assessment](issue-4-5-acceptance.md#5-revised-single-active-tab-closure-assessment--2026-10-17). The selector-capable matrix below remains unverified as an **optional future capability**, not a reason to keep #5 open. [2026-10-13 live checks](issue-4-5-acceptance.md) exercised the selector-free SaaS with safe refusals and explicit-target exports, but do not establish multi-session atomic routing or actual SaaS `sessionId` support.

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

The checked-in preflight JS example in `penpot-use/SKILL.md` is covered by a synthetic test. It is not a new session API and cannot force a host without `sessionId` to provide atomic routing. The live acceptance linked above records correct operation or safe refusal for the current host; unsupported simultaneous routing must not be marked as a successful isolation test.

Reload recovery uses the confirmed replacement session ID when supported, verifies the original file/page/targets, and resumes writes/exports only after successful verification. `test/session-routing-policy.test.mjs` covers that transition, actionable unknown-inventory retry, independent tool selectors, same-file ambiguity and blocked writes before recovery inspection. The current legacy-host recovery and refusal paths were also exercised live as linked above; routed multi-session acceptance remains unsupported on that server.


Latest guard regressions: selector-free legacy reload can restore the original saved IDs only after explicit intended-singleton confirmation/re-selection; restoration never captures a new selection. Unrouted exports require an immediately preceding guarded target read-back and singleton evidence, including when execute_code retains its own selector. Initial unpinned read discovery consumes a task-scoped allowance before calling Penpot; repeated or interrupted unscoped discovery is rejected. Explicit routes and confirmed recovery reads remain available. These are executable policy tests, not proof of atomic routing in a live ChatGPT host.

## Scope after closing #5

The completed issue covers the real **single-active-tab** contract only: establish and confirm the intended tab, pin file/page/shape IDs, guard writes and explicit-ID exports, fail closed on ambiguity, and restore the original pin after an interrupted connection using user confirmation and fresh read-only inspection. See [#5](https://github.com/makesomethingshit/penpot-for-chatgpt/issues/5) and its [bounded live acceptance](issue-4-5-acceptance.md#5-revised-single-active-tab-closure-assessment--2026-10-17).

Do not infer atomic multi-tab isolation from matching file/page IDs, browser focus, an apparently remaining singleton, policy tests or Codex app-server success. Current selector-free SaaS does not expose a supported tab-routing selector. The table is retained to guide future work **if** a remote host supplies supported session IDs; that would require separately scoped implementation and real host acceptance, rather than reinterpreting #5 as unfinished. ChatGPT desktop model-driven GUI replay was not run.
