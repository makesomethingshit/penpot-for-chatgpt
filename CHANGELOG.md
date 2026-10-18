# Changelog

## Unreleased

No release has been tagged or published. The release checklist must be completed first.

## 0.1.0-rc.1 (candidate; not tagged)

- Synchronize npm, lockfile, portable plugin, and Codex compatibility version metadata.
- Pin the directly imported `eventsource-parser` dependency rather than relying on a transitive SDK installation.
- Validate prerelease SemVer, enforce release-version and direct parser lockfile parity, and test the actual package checker against invalid or mismatched metadata.
- Add guided credential connect/status/disconnect and host-side read-only live-tab verification instructions (#38, #39).
- Align the single-active-tab acceptance record with scoped recovery and documented multi-tab limitations (#40).
- Add a release checklist covering licensing, real desktop-host acceptance, security, and publication boundaries.

- Five design skills with a bundled stdio-to-HTTP bridge and Windows DPAPI setup.
- Refuse HTTP redirects for the SDK's GET and reconnect paths as well as POST.
- Bound the Windows credential-decryption subprocess to ten seconds.
- Add a pinned bridge build and generated third-party notices.
- Add built-in Node tests, package validation, and Windows/Linux CI configuration.
- Add a Codex marketplace, private GitHub installation/update instructions and verified author/source links.
- Verify packaged file lists and content; include SHA-256 checksums and downloadable CI artifacts.
- Add contributor instructions and consistent text line endings.
- Synchronize manifests and replace publisher placeholders.
- Share URL validation between setup and the bridge, rejecting duplicate and blank tokens.
- Report safe configuration errors and avoid inherited PowerShell module-path conflicts during DPAPI decryption.
- Verify Windows setup, encrypted credential round-trip and preservation on invalid input.
- Extend the existing design-system skill with scoped code-to-system creation, source mappings and executable catalog/token examples; retain five skills.
- Bound remote JSON/error bodies, SSE events and output backlog; terminate on overflow without exposing credentials. Add malicious-stream, stalled-output and large-image regressions.
- Reuse parsed request bodies and the guarded request-failure path in the bridge.

- Scope initial inspection to pinned targets; paginate shallow page inventories and test payload reductions.
- Document native MCP session routing and legacy-host limits without inventing session APIs.
- Add read-only local diagnostics reusing the existing URL/DPAPI resolver.
- Validate portable manifests against external Agent Plugins 1.0.0 schemas and add invalid-package regressions.
- Record five real-design workflow checks, partial-failure recovery, preservation and host/visual limitations.
- Record additional Codex fixture evidence, raw HTML duplicate IDs and token-binding retry limitations; require post-recovery read-back and preview.
