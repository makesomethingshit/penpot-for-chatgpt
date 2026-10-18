# Release candidate checklist — 0.1.0-rc.1

**State: source candidate, not published or tagged.** Versioned manifests and passing CI do not themselves certify compatibility or authorize public distribution.

## Required before Ready / release

- [ ] **Project license choice by the copyright holder.** No top-level LICENSE is present; third-party notices in `plugin/server/THIRD_PARTY_NOTICES.txt` license dependencies, not original code. Obtain explicit approval of the terms, add an actual LICENSE and matching manifest license fields if appropriate. Do not choose legal terms without approval.
- [ ] **Host version and package acceptance.** Import/install the exact `0.1.0-rc.1` candidate archive through a documented, supported desktop plugin flow. Record OS, client and plugin host versions, Git SHA, artifact SHA-256 and any limitations.
- [ ] **Single-tab design workflow.** On a disposable Penpot file, verify discovery of all five skills, Node.js 22+, MCP bridge initialization, official tool schemas and read-only file/page inspection. Then execute a scoped guarded edit, same-shape-ID read-back, explicit-ID PNG export and unrelated-neighbor preservation.
- [ ] **Recovery safety.** Interrupt the connected tab and confirm edits/exports stop without fallback or automatic mutation replay. Reconnect the original tab, re-inspect original IDs, restore the entire task pin, and resume only after verification. Distinguish stale key from tab disconnect.
- [ ] **Credential/privacy controls.** No MCP URL/token, private designs or credential paths in artifacts, logs or screenshots. Confirm documented Windows DPAPI and POSIX user-file setup constraints.
- [ ] **Windows and Ubuntu CI on final commit.** `npm ci --ignore-scripts`, `npm audit --audit-level=high`, `npm run build`, `git diff --exit-code -- plugin/server`, `npm test`, `npm run check`, `npm run package`.
- [ ] **Archive integrity.** Check `dist/penpot-for-chatgpt-0.1.0-rc.1.tar.gz` and `dist/SHA256SUMS`, the packaged allowlist, read-back parity and the three manifests plus npm/lock release version.
- [ ] **Publication approval.** Review attribution/brand rights, CHANGELOG/README, #36's outstanding real-host account UX acceptance, package contents and distribution venue. Create a Git tag/GitHub prerelease only after these gates pass.

## Not certified by versioning

Independent desktop/local-stdio integration using Penpot SaaS MCP URL authentication, **not OAuth**. Only one established active tab is supported. The observed live SaaS tools have no `sessionId`; atomic multi-tab routing is unsupported. The browser may require manual reopening. The host's receive-buffer limit can be below the bridge's 64 MiB budget. Actual ChatGPT desktop GUI/model-driven acceptance and macOS/Linux GUI-host behavior remain unverified.

See [single-tab host evidence](issue-4-5-acceptance.md), [host limits](host-compatibility.md), [security](../SECURITY.md) and [CI](../.github/workflows/check.yml).
