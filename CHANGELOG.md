# Changelog

## Unreleased

Development changes are unnumbered. The first release will be `0.1.0` at deployment.

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
