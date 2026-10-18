# Account onboarding: real-host acceptance (#36)

**Status: NOT TESTED on an actual ChatGPT GUI host.** This document is a repeatable verification plan, not a claim that the flow is complete. The existing `penpot-account.mjs` connect/status/disconnect guidance and automated tests are already on `main`; this work item remains open until supported-host acceptance is recorded.

## Boundary: four independent states

| State | How to check | Must not be confused with |
| --- | --- | --- |
| A. Host/runtime and installed bridge | Node.js 22+, bundle available; installed host discovers plugin | Remote authorization |
| B. Local credential | `node scripts/penpot-account.mjs status`; sanitized URL-structure validation | Remote authentication |
| C. Remote MCP authentication/tool discovery | Host lists live Penpot MCP tools after secure URL registration | File/tab connection |
| D. Intended single design tab | **Read-only** `execute_code` returns expected file/page IDs | Arbitrary open tab, stale task pin |

A and B can pass while C or D fails. A `VALID` local URL says nothing about authorization. The `doctor` command intentionally does **not** make network requests.

## Safe manual procedure

1. Use an isolated host profile and a disposable Penpot test file. Record host name, build, OS, Node version and installation method. Avoid personal designs and saved credentials in committed evidence.
2. From the **installed plugin directory**, run `node scripts/penpot-account.mjs connect`. Register the **official Penpot MCP URL privately** using the displayed OS-specific secure setup (Windows DPAPI or POSIX owner-only file). Do not paste the URL in chat, command arguments, issues or logs.
3. Run `node scripts/penpot-account.mjs status` to check local runtime/bundle and B only. Separately use the host plugin/skill discovery interface to verify this installed plugin and all five skills before marking A ready. A local status command cannot inspect GUI discovery; if host discovery fails, record A as failed and do not classify missing tools as a C authentication failure. Restart or reload the desktop MCP connection. Use the host's MCP discovery interface to check C, including expected tools `high_level_overview`, `penpot_api_info`, `execute_code`, and `export_shape`.
4. In Penpot, use File → MCP Server → Connect on **one intended tab only**. Retrieve the live `execute_code` tool schema. If the host supports an explicit session identifier, use the established identifier; otherwise stop if multiple tabs could own the request. Perform only the read-only file/page ID probe printed by `connect` to check D.
5. Disconnect the intended Penpot tab and confirm a new read-only probe fails without reusing the old pin. Reconnect the same tab and recheck the IDs before any write; credentials should not require re-entry.
6. Attempt a deliberately **structurally invalid replacement URL rejected by local validation**, and separately cancel secure setup; verify that the prior valid local credential is preserved on each supported OS. A structurally valid official URL with a revoked/fabricated token passes local validation and **replaces** the previous credential; test that fixture separately in the isolated profile, expect B ready/C failed, and restore the known-good credential privately afterward. Run the existing automated setup regressions in addition to live checks.
7. For explicit local disconnect, review what it removes and type the confirmation only in the isolated test profile. Check that only that user's local saved credential is removed; any environment override, already-running bridge and **remote token revocation** remain separate operations.

## Failure matrix (record actual results; do not infer)

| Fixture | Expected behavior | Live status |
| --- | --- | --- |
| Local runtime/bundle ready, host plugin/skill discovery fails | A fails; C not assessed from missing tools alone | NOT TESTED |
| No Node / no bundle | A not ready; no claim of remote success | NOT TESTED |
| No/invalid local URL | B not ready; sanitized output | NOT TESTED |
| Replace with locally valid URL but remotely rejected token | Previous credential replaced, B ready, C fails; privately restore known-good credential; do not print URL | NOT TESTED |
| MCP transport unavailable | C fails independently of B | NOT TESTED |
| Correct key, Penpot tab disconnected | C may pass, D fails; guide tab reconnect | NOT TESTED |
| Uncertain tab ownership / multiple active tabs | Do not edit/export or silently choose a tab | NOT TESTED |
| Replace setup canceled/structurally invalid | Previous stored credential preserved | NOT TESTED |
| Explicit local disconnect | Local file removal only; remote revocation not claimed | NOT TESTED |
| After reconnect | Re-read actual file/page IDs, establish a fresh target pin | NOT TESTED |

## Evidence to attach to #36

- Host/GUI build, OS, Node, plugin commit SHA and **installed artifact hash**:
- Supported install and MCP startup surface (or **UNSUPPORTED** with source):
- A/B/C/D results and nonsecret diagnostic excerpts:
- Test file/page ID comparisons (use synthetic labels in public docs):
- Failure/reconnect/cancellation outcomes:
- Windows and POSIX automated test links and limitations:
- Result: **PASS / FAIL / NOT TESTED / UNSUPPORTED**:

**Completion rule:** Do not close #36 on documentation alone. Confirm all applicable scenarios in a real supported desktop host, and preserve the existing safe no-replay and private-credential invariants. Cross-host/model-driven acceptance belongs separately to #43.
