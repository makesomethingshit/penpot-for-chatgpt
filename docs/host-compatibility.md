# Host compatibility evidence

Checked 2026-10-12. Target formats: Agent Plugins 1.0.0 portable manifests and the existing Codex compatibility overlay. No release/version change is included.

`npm run check` now compiles the externally published JSON Schemas for portable `plugin.json` and `mcp.json`, using the already locked SDK dependency Ajv 8.20.0 resolved from the SDK package (including nested npm layouts). Offline schema snapshots are unchanged downloads from:

- https://agent-plugins.org/schemas/1.0.0/plugin.schema.json
- https://agent-plugins.org/schemas/1.0.0/mcp.schema.json

The schemas are self-contained JSON Schema 2020-12. Their version and canonical `$id` are kept intact. Refresh only against the named spec version and review changes. Spec source/license: https://github.com/agentplugins/agent-plugins-spec

A subset of OpenAI-specific interface requirements follows https://developers.openai.com/plugins/deploy/submission#manifest-fields: required display/short description <=30, long description <=4000, developer name <=80, nonempty category, optional unique starter prompts (at most three) of <=128 characters, and at most 20 capability labels of <=120 characters. Optional brand colors require #RRGGBB; icon paths require ./ prefix. Existing square PNG size/path checks remain. Public review URLs, brand contrast and app-mention detection in starter prompts remain manual submission checks. Compatibility skills/MCP paths must exist within the plugin. The portable and Codex interfaces, identities and stdio launch definitions remain synchronized.

`node --test test/manifests.test.mjs` executes the actual checker in a temporary package, rejecting invalid plugin names/unknown portable root fields, missing stdio commands, escaping cwd/skills/icon paths, oversized prompts and non-string capabilities. This tests external-schema constraints, not just equal manifests.

## Limits that remain visible

OpenAI's documented Codex release format requires a semantic version; the existing development overlay omits it by project policy. Portable schema validation permits omission. Passing development checks is therefore not proof of Codex release-format validation. Assigning the first version is release work and was not silently done here.

After explicit user authorization, Codex CLI `0.162.0-alpha.17.2` registered this local marketplace and installed `penpot-for-chatgpt@penpot-for-chatgpt`. Host-assigned cache version was `1.0.0`; source manifests remain unversioned, so this is not a project release.

The actual installed desktop executable's app-server returned all five enabled skills through `skills/list` with zero discovery errors, and `plugin/read` returned the `penpot` MCP entry. No model turn or external model was invoked. Installed `bridge.mjs`, `penpot-use/SKILL.md` and `penpot-doctor.mjs` hashes matched this checkout. The installed diagnostic passed with the existing credentials.

A direct SDK smoke check launched the installed MCP manifest's `node`, args and cwd after `${PLUGIN_ROOT}` substitution. Initialization and tool discovery succeeded; all four live SaaS schemas lacked `sessionId`. A read-only `execute_code` via this installed bridge confirmed access to the same fixture file/page. This proves the installed bridge launcher works; automatic plugin MCP startup inside a newly started desktop chat and archive import are not separately exercised.

The bundled bridge was built and its initialization/tool forwarding tested locally; Linux/macOS and final-SHA GitHub CI were not run locally. Both checked-in MCP formats use `node`, `${PLUGIN_ROOT}/server/bridge.mjs` and cwd `${PLUGIN_ROOT}`; no new endpoint, credential, launcher or capabilities are introduced. Issue #4 remains open for the deliberate unversioned overlay limitation and untested archive-import/automatic desktop-MCP lifecycle paths. Local installation, host skill/MCP discovery and installed bridge live access passed.

## Host-filtered custom variables on POSIX

`test/stdio-host-env.test.mjs` launches a real pinned `StdioClientTransport` child, verifying that `getDefaultEnvironment()` strips `PENPOT_MCP_URL` even when the parent has it; an explicit `env` override forwards it. On POSIX, the same file launches the actual bundled bridge with the filtered environment, reads a synthetic URL from a private `HOME` credential file, and uses a mock HTTP transport to verify initialization plus the SDK's GET reconnect. Missing files, unsafe modes and symlinks fail before startup, with no credential in stdout or stderr. These POSIX integration cases are explicitly skipped on Windows; the existing Windows SDK and DPAPI tests remain active. This is evidence for the bundled bridge and pinned JS SDK path, not a claim about every desktop host.

The secure setup script and mode/ownership-checked non-symlink user-local file were merged previously (#25). That fallback is intentionally independent of the custom environment variable. Windows DPAPI is unchanged. Do not put the token in the portable plugin manifest or in CI logs.

Pending for #11: run the exact manifest under a *real* macOS/Linux desktop host that filters environment, confirm local-file startup plus reconnect, and record the host/version. The POSIX tests establish the bundled bridge path under the pinned SDK, but do not establish ChatGPT desktop GUI behavior or real macOS/Linux desktop host versions.
