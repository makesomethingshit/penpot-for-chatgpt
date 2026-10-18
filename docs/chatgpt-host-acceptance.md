# ChatGPT host acceptance gate (#43)

**Status: NOT TESTED / NO CHATGPT HOST COMPATIBILITY CLAIM.** This is an acceptance protocol, not a completed run. Codex app-server/desktop engine evidence in `rc1-acceptance.md` is real but does not prove ChatGPT GUI or model-driven behavior.

## Gate 0: supported installation surface

1. Verify from current first-party product documentation whether the selected ChatGPT host/version can install **this exact form** of local plugin, MCP bridge and five skills.
2. Record the **actual** installation UX/API, platform, host version and whether the user can invoke the connected tools from a chat. Do not equate Codex plugin installation with ChatGPT plugin availability.
3. If the host has no supported installation path, record **UNSUPPORTED**, stop invasive testing, and update compatibility/release claims. Do not invent an install workaround or mark acceptance complete.

## Fixtures and evidence hygiene

- Use a disposable Penpot file with a page and two visibly distinct shapes: one target and one neighboring control.
- Create explicit file ID, page ID and target ID pin with a read-only probe; capture target and neighbor properties and the root child count. Preserve this initial snapshot through the full run. After the successful guarded move, independently verify the target position, unchanged neighbor and root child count against that initial snapshot; any unexpected change is FAIL and must not become a new baseline. Only then take the pre-disconnect snapshot and choose a distinct attempted edit value absent from it.
- Use a private test profile and official MCP URL. Do not commit credentials, URL query tokens, private design names, raw screenshots or raw tool logs; publish a redacted summary and artifact/checksum.
- Record the exact plugin source SHA and **freshly generated archive SHA-256**. Checksums from previously tested archives only cover those bytes. After host reload/startup, identify the installation actually loaded by the running bridge and skills; compare its complete packaged file list and SHA-256 values against the extracted candidate (including manifests, bridge and all five skills), or record an equivalent immutable host-reported loaded artifact digest. Same-version discovery or hashing the input archive alone is insufficient. If loaded-byte identity cannot be established, record NOT TESTED and block candidate acceptance.

## Acceptance matrix

| Check | Required observation | Result |
| --- | --- | --- |
| Install | Supported host path; running bridge/skills tied to candidate by installed-file byte parity or immutable loaded artifact digest | NOT TESTED |
| Discovery | Five skills exposed; Penpot MCP launches; live schemas queried | NOT TESTED |
| Account/transport | Locally valid credential, real remote tool discovery | NOT TESTED |
| Tab identity | Only intended tab, read-only file/page IDs match pinned fixture | NOT TESTED |
| Guarded mutation | Move target with same-execution file/page/target guards | NOT TESTED |
| Independent readback | Same ID has new position; neighbor and root child count unchanged from initial pinned snapshot; verify before taking disconnect baseline | NOT TESTED |
| Export | Explicit target ID yields PNG with correct dimensions/content | NOT TESTED |
| Disconnect safety | Otherwise-valid guarded edit of pinned target and same previously successful explicit-target export fail at disconnected-host boundary; no image; confirm no mutation during recovery | NOT TESTED |
| Recovery | Reload/reconnect; read-only IDs, target/neighbor properties and root count match pre-disconnect snapshot; failed edit value absent, no delayed replay; only then restore pin | NOT TESTED |
| Resume after recovery | In a later model turn, use restored pin for a fresh guarded move with a new value distinct from successful/failed prior values; independently read back same ID, unchanged neighbor/root count, then explicit-ID PNG export | NOT TESTED |
| Host frame limit | Actual receiver behavior or a documented, explicit unknown | NOT TESTED |
| Privacy | No URL/token leakage in logs, docs, issue or archive | NOT TESTED |
| Model interaction | One recorded real chat/model conversation drives guarded mutation, independent readback, export, post-disconnect failed edit/export, recovery comparison and later-turn resumed move/readback/export above; no ambiguous tab choice | NOT TESTED |

The operator may perform physical disconnect/reload/reconnect and provide evidence, but the recorded model conversation must invoke and evaluate every workflow operation above. Unrelated read-only model calls plus operator-driven low-level tests do not satisfy this gate. After reconnect, wait for the original request to settle and repeat the read-only snapshot comparison after the observation interval (record its duration and timeout rationale); if the request cannot be shown settled or delayed replay cannot be excluded, record NOT TESTED and do not write. Any target/neighbor/root mismatch or presence of the failed edit value is FAIL, even if the edit reported an error; do not retry it automatically.

Before disconnect, retain the successful guarded edit request and explicit-target export arguments. After confirmed disconnect, reuse their valid file/page/target IDs, guards and export arguments; change only the edit value to the distinct attempted value. A malformed request, invalid target, missing guard or schema/validation failure does not prove disconnect safety. Record evidence that each request reached the disconnected-host boundary; if that boundary cannot be established, record NOT TESTED.

After recovery comparisons pass and the full pin is restored, the model must use it in a later turn for a fresh guarded move, never a replay of the failed edit. Require independent same-ID readback of the new value, neighbor/root count preservation against the validated baseline, absence of the failed value, and a fresh explicit-ID PNG export with expected dimensions/content before PASS. A read-only reconnect or merely restoring a pin is insufficient.

A failure should include the *observed boundary* (installation, credential, transport, tab, tool, host receiver or model behavior). Do not infer its underlying cause without evidence.

## Ready / release decision

- **PASS:** Supported host is identified and each required operation and safety invariant is observed with the **same candidate bytes**; remaining unsupported capabilities are explicitly scoped.
- **FAIL:** A supported, tested path violates an invariant; block the host-specific compatibility claim until fixed.
- **UNSUPPORTED:** No official host surface supports the proposed installation/invocation; do not advertise ChatGPT functionality or silently substitute Codex results.
- **NOT TESTED:** Evidence is missing; do not promote a hypothesis to compatibility acceptance.

Record: host/version/build, OS, source SHA, archive SHA-256, loaded installation identity and per-file hashes/artifact digest, installed manifest/tool discovery, redacted end-to-end model conversation, redacted fixture IDs, initial/pre-disconnect/post-recovery snapshots, successful and disconnect request equivalence with observed failure boundary, later-turn resumed move/readback/export assertions, failure/recovery summary, evidence custody and operator. Share a concise sanitized result in issue #43 and only then update `docs/host-compatibility.md`, `docs/release-checklist.md`, README and release statements as warranted.

Related: [account onboarding host acceptance](account-onboarding-acceptance.md) (#36); merged source release candidate #41; Windows Codex engine acceptance `docs/rc1-acceptance.md`. Atomic multi-tab isolation and unreliably automatic reconnect remain **out of scope**.
