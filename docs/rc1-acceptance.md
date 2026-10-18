# Versioned RC desktop acceptance — 2026-10-18

Status: **Versioned Windows Codex engine installation and single-tab edit/read-back/export passed; recovery remains blocked.** MIT and packaged-license checks passed. This certifies only the supported extracted-archive/local-marketplace engine path, not ChatGPT GUI archive import.

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

Recovery requires read-only verification of the original file/page/target, confirmation x remains 24 after the failed write, restoration of the entire saved task pin after plugin reload, and only then a fresh guarded continuation/export. Reload/reconnect initially remained connecting; the original test file was closed and reopened, preserving its original IDs. Repeated reads through fresh installed-RC desktop engines still returned No Penpot instance connected. Therefore post-reconnect pin restoration, proof that x remains 24 (no replay), and resumed edit/export are NOT PASSED in this run. Do not substitute the earlier single-tab recovery evidence for this exact-artifact result.

GUI archive import, model-driven ChatGPT desktop behavior, macOS/Linux GUI hosts, atomic multi-tab isolation, automatic reconnect reliability and byte-identical archive rebuilds are not verified. The preservation assertions cover the listed fixture properties, not every possible Penpot document property.

## Local validation

- npm test: 120 passed, 7 platform skips, 0 failures.
- Focused manifest/SemVer regressions: 3 passed.
- npm run check; npm run package (25 files); npm run build and generated bridge parity: passed.
- npm audit --audit-level=high: 0 vulnerabilities.
- Plugin-byte commit 8c56b187b948eb33acdc70f859c0551c18bfe021 passed Windows/Ubuntu Node 22 push and PR CI. Final acceptance-document commit CI must also pass; its result is recorded in the PR body. Local Node 24 results do not substitute for it.
