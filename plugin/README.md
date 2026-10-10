# Penpot for ChatGPT

Unreleased development package. The first release will be numbered `0.1.0` at deployment.

Five Penpot design skills with a desktop bridge to the official SaaS MCP server. Requires Node.js 22+ on your desktop host's PATH and Agent Plugin installation support. Installation does not authenticate your Penpot account. This is an independent integration, not an official Penpot or OpenAI product.

## Setup

1. Install through your desktop host's supported plugin flow.
2. Enable **Your account > Integrations > MCP Server** in Penpot and copy the full URL. See the [official guide](https://help.penpot.app/mcp/).
3. On Windows, run `powershell.exe -NoProfile -File .\scripts\penpot-setup.ps1` from this directory and paste the URL into the hidden prompt. It stores the URL encrypted with DPAPI outside the package, in `%USERPROFILE%\.penpot-for-chatgpt\connection.json`, without a network request.
4. On macOS/Linux, set `PENPOT_MCP_URL` securely in your desktop host's process environment. No credential-store installer is included.
5. Open the intended file, choose **File > MCP Server > Connect**, keep the tab awake and reload your desktop MCP connection.
6. Ask: "Inspect the current Penpot page and list its boards without changing anything."

Only `https://design.penpot.app/mcp/stream` with your `userToken` is accepted. HTTP redirects are refused on every method. Never share your URL or credential file in chat, source control, issues or screenshots. Re-run setup when the key changes. Web/mobile cannot run this local stdio bridge.

## Skills

| Skill | Purpose |
| --- | --- |
| `penpot-use` | Inspect, edit within scope, export and verify. |
| `penpot-design-to-code` | Translate designs into the existing frontend or semantic HTML/CSS. |
| `penpot-generate-design` | Create screens and responsive variants using existing components/tokens. |
| `penpot-design-system` | Inspect, create or maintain tokens, themes, components and variants, including from code. |
| `penpot-audit` | Report evidenced usability, consistency and accessibility issues. |

Specialists follow `penpot-use`. Inspection/audit stays read-only; edits preserve unrelated work and require read-back and previews for visual verification. Code implementation needs workspace tools. Remote MCP exports cannot write directly to arbitrary local paths.

## Troubleshooting and attribution

- No tools: check Node.js 22+, your desktop host's PATH and local configuration.
- Authentication failure: check the configured URL/key in Penpot Integrations.
- Documentation succeeds but design calls fail: wake the tab and connect MCP in the intended file.
- Resource limit exceeded: JSON/error bodies, SSE events, individual network chunks and unread output are capped at 64 MiB. Reduce the export or results, then reload the host connection. Persistent SSE has no lifetime byte limit.

See the [source repository](https://github.com/makesomethingshit/penpot-for-chatgpt) for installation updates and development instructions. The repository is public; the project's source license is undecided.

Penpot owns the icon artwork from its [media kit](https://penpot.app/media-kit). It identifies the connected service and does not imply endorsement. Bundled software licenses are in `server/THIRD_PARTY_NOTICES.txt`.
