# Credential handling

The Penpot MCP URL contains your account's `userToken`; treat the entire URL as a password. Never include it in an issue, pull request, log or screenshot.

On Windows the setup script stores the connection outside the plugin, encrypted for the current Windows user with DPAPI. Processes running as that user can decrypt it. On macOS/Linux the bridge reads `PENPOT_MCP_URL` from its process environment; this project does not install a credential store there.

The bridge accepts only the official HTTPS SaaS endpoint and refuses redirects for GET and POST, including SDK reconnections. Local connection failures use generic messages. Successful remote tool results pass through unchanged; design content is visible to the AI host you use. There is no separate analytics or telemetry endpoint in this project.

If a key is exposed, regenerate it in Penpot Integrations and update the local configuration. Removing a credential from a file does not remove it from Git history.

Report security issues privately through GitHub's private vulnerability reporting if enabled after publication. If unavailable, contact the maintainer through an established private channel. Do not open a public issue containing credentials or a working exploit.

# Dependency and build checks

CI installs the lockfile with lifecycle scripts disabled, audits dependencies for high or critical advisories, rebuilds the checked-in bridge, and tests Windows and Linux. GitHub Actions are pinned to commit hashes, and checkout credentials are not persisted. Dependabot checks npm dependencies and Actions weekly; review its pull requests and regenerate the bridge for runtime dependency changes.
