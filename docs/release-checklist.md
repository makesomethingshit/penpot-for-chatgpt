# Release candidate checklist — 0.1.0-rc.1

**State: source candidate, not published or tagged.** Versioned manifests and passing CI do not themselves certify compatibility or authorize public distribution.

## Required before Ready / release

- [x] **Project license choice.** The copyright holder selected MIT on 2026-10-18. Root `LICENSE` and `plugin/LICENSE` contain the same complete notice; npm, lockfile root-package metadata and both plugin manifests declare `MIT`. Penpot artwork and dependency notices retain their respective rights.
- [x] **Packaged license verification on tested candidate.** Run `npm run check` to enforce matching MIT metadata and byte-equal source/plugin LICENSE; run `npm run package` to require `LICENSE` in the archive allowlist and compare the extracted file with source. Confirm the extracted notice includes the copyright and full permission/warranty clauses, and preserve `server/THIRD_PARTY_NOTICES.txt`. Artifact SHA-256 and installed LICENSE parity are recorded in [the 2026-10-18 acceptance evidence](rc1-acceptance.md). Re-run these checks whenever packaged files change.
- [ ] **Host version and package acceptance (partial; blocked).** Import/install the exact `0.1.0-rc.1` candidate archive through a documented, supported desktop plugin flow. Record OS, client and plugin host versions, Git SHA, artifact SHA-256 and any limitations. [Current evidence](rc1-acceptance.md): isolated extracted-archive installation, 25-file/license parity, five enabled skills and four-tool automatic startup passed in actual Codex desktop engine 0.163.0-alpha.10.2. Live design reads failed with `No Penpot instance connected`; full design/recovery acceptance and GUI import are not passed.
- [ ] **Single-tab design workflow.** On a disposable Penpot file, verify discovery of all five skills, Node.js 22+, MCP bridge initialization, official tool schemas and read-only file/page inspection. Then execute a scoped guarded edit, same-shape-ID read-back, explicit-ID PNG export and unrelated-neighbor preservation.
- [ ] **Recovery safety.** Interrupt the connected tab and confirm edits/exports stop without fallback or automatic mutation replay. Reconnect the original tab, re-inspect original IDs, restore the entire task pin, and resume only after verification. Distinguish stale key from tab disconnect.
- [ ] **Credential/privacy controls.** No MCP URL/token, private designs or credential paths in artifacts, logs or screenshots. Confirm documented Windows DPAPI and POSIX user-file setup constraints.
- [ ] **Windows and Ubuntu CI on final commit.** `npm ci --ignore-scripts`, `npm audit --audit-level=high`, `npm run build`, `git diff --exit-code -- plugin/server`, `npm test`, `npm run check`, `npm run package`.
- [ ] **Archive integrity.** Check `dist/penpot-for-chatgpt-0.1.0-rc.1.tar.gz` and `dist/SHA256SUMS`, the packaged allowlist, read-back parity and the three manifests plus npm/lock release version.
- [ ] **Publication approval.** Review attribution/brand rights, CHANGELOG/README, #36's outstanding real-host account UX acceptance, package contents and distribution venue. Create a Git tag/GitHub prerelease only after these gates pass.

## Not certified by versioning

Independent desktop/local-stdio integration using Penpot SaaS MCP URL authentication, **not OAuth**. Only one established active tab is supported. The observed live SaaS tools have no `sessionId`; atomic multi-tab routing is unsupported. The browser may require manual reopening. The host's receive-buffer limit can be below the bridge's 64 MiB budget. Actual ChatGPT desktop GUI/model-driven acceptance and macOS/Linux GUI-host behavior remain unverified.

See [single-tab host evidence](issue-4-5-acceptance.md), [host limits](host-compatibility.md), [security](../SECURITY.md) and [CI](../.github/workflows/check.yml).
