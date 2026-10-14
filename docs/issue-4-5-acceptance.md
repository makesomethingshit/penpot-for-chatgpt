# Host and session acceptance — 2026-10-13

Installation acceptance for #4 and the selector-free safe-refusal subset of #5 were exercised on Windows x64, OpenAI Codex desktop package `26.1007.2314.0`, with its actual `codex.exe` app-server `0.162.0-alpha.17.2` and Node `24.18.0`. The tested plugin code commit is `f08b3758849caea437290992c1be12832f0c3830`. These are deterministic host API calls, not model-generated replay or tests of every ChatGPT host. #5 remains open: its intended-tab multi-session read/write/read-back/export criterion is not established by this run.

## Installation and external requirements (#4)

- Downloaded the canonical Agent Plugins 1.0.0 plugin/MCP schemas again and confirmed byte-identical checked-in snapshots. SHA-256: plugin `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883`; MCP `6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb`.
- Ran the real package checker against invalid manifests. New regressions reproduce and reject a wrong marketplace source type, a 24-byte fake PNG, and an external skills junction/symlink. Session policy also rejects non-string/empty selected or reported IDs. All four gaps failed before their fixes.
- Paths now resolve to their real locations before containment checks, including skill reference links. Icons check the complete PNG signature, IHDR, dimensions, size and IEND; this is header/container validation, not a general image decoder.
- Installed both the source and the extracted generated tar.gz through the documented local-marketplace path into isolated test `CODEX_HOME` profiles; the normal installation/configuration was preserved. `plugin/read` found the `penpot` MCP entry; `skills/list` found all five enabled skills with zero discovery errors.
- Started a fresh process of the installed desktop executable, then an ephemeral `thread/start`. Without manually starting the bridge or copying credentials, `mcpServerStatus/list` returned `penpot` as `connected` and discovered four tools. A real `mcpServer/tool/call` design read succeeded. No model turn was started.
- Compared the installed bridge, common skill, portable MCP manifest and Codex manifest with the tested source, then all 23 extracted archive files against its separately installed cache; all SHA-256 values matched. Actual host discovery, automatic MCP startup and design access verify `node`, installed `${PLUGIN_ROOT}` substitution and launcher/cwd behavior together.
- `npm run build`, generated-bridge consistency, `npm test`, `npm run check` and `npm run package` passed. Local full suite: 99 passed, 5 platform skips, 0 failures. Focused manifests/routing/inspection: 31 passed, 0 failures. Package read-back verified all 23 files; archive SHA-256 `ff47badff52e1cfb45830fcf313321d0525f9c31639718f4629de00f3675f693`.

Supported installation checked here: the local marketplace and the actual Codex desktop engine above. Archive import through a GUI, model-driven desktop interaction, macOS/Linux desktop installation and other host versions are **NOT RUN**. The development overlay intentionally remains unversioned; Codex's assigned cache label `1.0.0` is not a project release. Release-format acceptance and public submission remain outside this check. The supported alternative installation path was exercised instead of claiming archive-import support.

Sources: [Agent Plugins schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json), [MCP schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json), [OpenAI packaging and path rules](https://developers.openai.com/plugins/build/plugins), [interface constraints](https://developers.openai.com/plugins/deploy/submission#manifest-fields).

## Live legacy routing and safe refusal (#5)

The actual hosted server exposed these arguments:

| Tool | Live arguments | Selects a tab? |
| --- | --- | --- |
| `high_level_overview` | none | No; documentation only |
| `penpot_api_info` | `type`, optional `member` | No; documentation only |
| `execute_code` | `code` | No `sessionId` |
| `export_shape` | `shapeId`, optional `format`, `mode` | No `sessionId` |

The [current SaaS guide](https://help.penpot.app/mcp/) describes one active MCP tab and explicit ownership selection. This differs from upstream development's optional multi-session selectors. Do not fabricate session IDs or treat transport authentication as a tab ID.

Two new disposable files A/B were created; A1/A2 were separate browser tabs showing A's same file/page. Each file had exactly one 80×40 rectangle. Only A's name was changed; B's ID/name/size/fills/count were captured before and compared after all scenarios. No existing unrelated design was edited. IDs below are aliases; raw local evidence retains the disposable IDs without credentials.

| Scenario | Actual result | Status |
| --- | --- | --- |
| Explicit active A: inspect → authorized rename → same-ID read-back → explicit-ID PNG export | Correct blue 80×40 rectangle, preview inspected | PASS |
| B takes ownership after A was pinned | Common continuation guard returned `Penpot context changed; inspect the intended target again.`; export was not invoked after that failure | PASS — safe refusal |
| B after rejected A continuation, and after all subsequent A scenarios | ID/name/width/height/fills identical; count stayed one | PASS |
| A reload before task restoration | Mutation rejected; export not invoked | PASS — safe refusal |
| Explicitly reselect original A; read-only recovery | Original file/page/shape IDs verified and full task pin restored without capturing a new selection | PASS |
| A2 owns MCP with same file/page/shape as A1 | IDs matched but its task pin was absent; common mutation guard rejected; export not invoked; shared design unchanged | PASS — safe refusal |
| Installed fresh desktop engine on A2 | Actual plugin MCP call read A, then rejected the same guarded continuation | PASS — safe refusal |
| Reselect original A1 after fresh verification | Installed host performed authorized rename, same-ID read-back and explicit-ID PNG export; preview inspected | PASS |
| Simultaneous explicitly routed tabs, atomic legacy exports, or partial selectors | This server exposes no selectors; partial-selector policy has automated coverage only | UNSUPPORTED / NOT RUN live |

This completes #4's recorded installation acceptance and verifies correct operation or safe refusal on the current selector-free host. It does **not** complete #5's multi-session acceptance, establish atomic multi-tab isolation, add session management, or make unsupported exports safe. A failed guard never triggers an unscoped retry/export. Read-only fixtures and screenshots were retained locally; account URLs, tokens, screenshots and private design contents were not committed.

Reproduction: install the local marketplace into a separate host profile; start the actual desktop app-server and initialize its protocol; call `plugin/read`, `skills/list`, ephemeral `thread/start`, `mcpServerStatus/list`, then `mcpServer/tool/call` for overview/read. Use the shared mutation/recovery examples against disposable files only, explicitly switch MCP ownership in the browser, check rejected writes before re-inspection, and compare the untouched fixture afterward. Local evidence includes sanitized host results, routing results, before-fix failures, installed hashes and inspected PNG output.

