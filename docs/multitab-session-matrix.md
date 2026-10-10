# Multi-tab session acceptance matrix — Penpot MCP

This is a **pending live-host test**, not evidence that current ChatGPT desktop supports optional `sessionId`.

1. Read the actual schemas of `execute_code` and `export_shape`. Record support/absence of `sessionId` for each. `high_level_overview` and `penpot_api_info` are documentation calls and do not select a design.
2. Create **two disposable Penpot files** A and B and connect both browser tabs. Capture the server-reported IDs when supported; never guess ID-to-file mapping.
3. Explicitly choose A and inspect/file-pin A. Perform one *authorized*, disposable change, read back the same ID and export from A. Confirm B is unchanged.
4. Disconnect A, retain B, attempt a follow-up mutation/export. **Expected**: fail closed; never fall back to B.
5. Reconnect A, re-identify its session and confirm A's file/page/shape IDs before resuming.
6. Repeat with **two tabs showing the same file/page**. File/page checks alone cannot distinguish their sessions. When routing is not supported, disconnect one tab before any write/export and mark atomic export routing as unverified.

| Mode | Expected | Evidence state |
| --- | --- | --- |
| One tab, with `sessionId` exposed | Existing task works without prompting | Unverified on ChatGPT desktop |
| Two tabs and exposed IDs | User-selected ID persists through read/write/export | Unverified |
| Chosen session disappears | Mutation and export must stop | Unverified |
| Two tabs, no selector exposed | Do not authorize ambiguous write/export | Documented fail-closed policy |
| Two tabs same file/page | Must not infer session from identical file/page IDs | Unverified |

The checked-in preflight JS example in `penpot-use/SKILL.md` is covered by a synthetic test. It is not a new session API and cannot force a host without `sessionId` to provide atomic routing. Keep issue #5 open until the real acceptance matrix is run.
