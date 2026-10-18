# Versioned RC desktop acceptance — 2026-10-18

Status: **PARTIAL; release blocker remains open.** MIT selection and packaged-license verification passed. Versioned package installation/startup passed in the actual Windows Codex desktop engine; live design acceptance did not pass.

## Exact artifact and host

- Candidate: 0.1.0-rc.1, based on Git commit 7ebf16b3510fb111a97477e40a8694c35c429374 plus the MIT/license-verification changes in this PR. The final PR commit contains the tested plugin bytes; the archive checksum identifies this specific build.
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

## Blocked / not established

The installed RC's read-only execute_code returned No Penpot instance connected for user token. The registered remote Penpot MCP independently returned the same error. Tool discovery and connected transport therefore do not establish an active design or a successful remote design operation.

A new empty Penpot test file was opened. Connect here, browser reload and a second Connect here were attempted; both the registered remote MCP and a fresh installed-RC desktop engine still returned the same error. No credential rotation was performed. Connection recovery must succeed and be confirmed by file/page read-back before design mutation or export. No design mutation was attempted through MCP.

Remaining release acceptance: successful pinned file/page inspection, guarded edit and same-shape-ID read-back, explicit-ID PNG export with neighbor preservation, and interruption/reconnect recovery on this exact package. GUI archive import, model-driven ChatGPT desktop behavior, macOS/Linux GUI hosts and byte-identical archive rebuilds are not verified.

## Local validation

- npm test: 120 passed, 7 platform skips, 0 failures.
- Focused manifest/SemVer regressions: 3 passed.
- npm run check; npm run package (25 files); npm run build and generated bridge parity: passed.
- npm audit --audit-level=high: 0 vulnerabilities.
- Final-SHA Windows/Ubuntu Node 22 CI must be checked after push; local Node 24 results do not substitute for it.
