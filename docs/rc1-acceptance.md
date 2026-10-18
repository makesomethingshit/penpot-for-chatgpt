# Versioned RC desktop acceptance — 2026-10-18

Status: **Versioned Windows Codex engine installation and single-tab edit/read-back/export passed; scoped interruption/recovery acceptance passed.** MIT and packaged-license checks passed. This certifies only the supported extracted-archive/local-marketplace engine path, not ChatGPT GUI archive import.

## Exact artifact and host

- Candidate: 0.1.0-rc.1, packaged plugin bytes at Git commit 8c56b187b948eb33acdc70f859c0551c18bfe021. Subsequent acceptance-document updates do not alter those bytes; the archive checksum identifies this specific build.
- Artifact: dist/penpot-for-chatgpt-0.1.0-rc.1.tar.gz
- SHA-256: 30cb414f1617c8a9e621dec702c07c5d81bfcc9e8b8aadd445b12b0205de5368
- OS/runtime: Windows x64, Node.js 24.18.0.
- Actual desktop executable: OpenAI Codex bundled codex.exe, codex-cli 0.163.0-alpha.10.2. This is the desktop engine version, not a claimed GUI build.
- Installation: extract the archive, wrap the extracted plugin in the existing local marketplace format, then use plugin marketplace add / plugin add with a new isolated CODEX_HOME. No production plugin installation or credential setup was changed. The profile isolates plugin installation, not the external Penpot account/tab.

## Verified

- Portable and compatibility manifests report 0.1.0-rc.1 and MIT; the installed cache uses 0.1.0-rc.1.
- All 25 archive files matched the installed cache byte for byte, including the full LICENSE and dependency notices.
- Root and plugin LICENSE are identical. Metadata checks reject license mismatch or a missing lockfile license; fixtures reject missing/truncated plugin LICENSE. The archive allowlist requires LICENSE and extraction read-back compares its bytes.
- A fresh actual desktop app-server initialized, discovered all five enabled plugin skills, and started the installed penpot MCP automatically in an ephemeral thread.
- mcpServerStatus/list reported connected and discovered high_level_overview, penpot_api_info, execute_code and export_shape. The installed bridge successfully returned the overview.
- No model turn was started. Test scripts and raw host results remain local, outside repository history; no credentials, private designs or screenshots are committed.

## Live single-tab workflow

The initial no-instance failures were followed by a browser log transition from connecting to Connected to MCP server and a Disconnect menu. Without changing the key, saved configuration or package, both the registered remote MCP and installed RC read the same disposable file/page successfully. The earlier absence of a visible plugin frame did not prove a startup failure: the integrated plugin runs in the background. The observed failure boundary was pending browser connection; the internal reason for the delay was not established.

All following design operations used mcpServer/tool/call through the actual desktop engine with the installed archive, not a separately launched SDK bridge:

- Created two rectangles only in the newly created empty test file, with fixed file/page guards: an 80x48 blue target and a 32x32 yellow neighbor.
- Pinned file/page/target IDs. In a same-execution guard, moved target x=10 to x=24 and compared the neighbor before/after.
- A separate installed-host read resolved the same target ID and asserted x=24; neighbor ID/name/x/y/width/height/fills and root child count stayed unchanged (two children).
- Guarded read-back immediately preceded explicit-target-ID PNG export. The installed RC returned one PNG; its 80x48 blue rectangle was visually inspected.
- Intentional browser Disconnect made both an attempted guarded x=24 to x=25 edit and an explicit-ID export return No Penpot instance connected, with no image. The requests were not replayed by the harness.

## Recovery and remaining limits

After the delayed browser connection completed, both the registered remote MCP and the exact installed RC read the original file/page successfully. No key, configuration or package change was needed. This was an observed manual reload/close-reopen/Connect recovery; it does not establish reliable automatic reconnection or identify the internal cause of the delay.

Through fresh actual desktop engine processes using the same installed archive:

1. Read-only recovery inspection resolved the original saved file/page/target IDs and neighbor. The target remained x=24, not the attempted disconnected x=25; root count remained two. This verifies no replay of that failed fixture write.
2. The reloaded plugin had no stored task pin. Restored the entire original fileId/pageId/targetIds only after verifying the IDs and state; no current-selection substitution or invented session selector was used.
3. A new same-execution guarded continuation moved x=24 to x=26. A separate read-back asserted the same target ID and x=26, neighbor ID/name/x/y/width/height/fills and root count unchanged.
4. Immediately after guarded read-back, explicit-original-target-ID export returned one 80x48 PNG, visually verified as the expected blue rectangle.
5. Local assert-based evidence checks verified original IDs, x=24 before continuation, missing pin after reload, full pin restoration, x=26 afterward, neighbor preservation and PNG dimensions. Raw results and PNG remain outside repository history.

**Recovery acceptance: PASS for this exact artifact and bounded single-tab fixture.** Safe refusal during interruption and verified restoration/resumption are established. This does not prove absence of every possible unknown-outcome or concurrent-tab failure; those transport/policy regressions retain separate automated coverage.

GUI archive import, model-driven ChatGPT desktop behavior, macOS/Linux GUI hosts, atomic multi-tab isolation, automatic reconnect reliability and byte-identical archive rebuilds are not verified. The preservation assertions cover the listed fixture properties, not every possible Penpot document property.

## Local validation

- npm test: 120 passed, 7 platform skips, 0 failures.
- Focused manifest/SemVer regressions: 3 passed.
- npm run check; npm run package (25 files); npm run build and generated bridge parity: passed.
- npm audit --audit-level=high: 0 vulnerabilities.
- Plugin-byte commit 8c56b187b948eb33acdc70f859c0551c18bfe021 passed Windows/Ubuntu Node 22 push and PR CI. Final acceptance-document commit CI must also pass; its result is recorded in the PR body. Local Node 24 results do not substitute for it.
