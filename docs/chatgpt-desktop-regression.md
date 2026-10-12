# ChatGPT desktop — final main real-design regression

**Status: NOT RUN on current main as of this PR.** This is a reproducible acceptance protocol, not a claim that a synthetic CI check exercised ChatGPT or the live Penpot tab. The existing [Codex fixture record](real-design-regression.md) is different evidence.

## Preconditions
- Use the **already working** ChatGPT desktop plugin; do not reinstall or re-enter valid credentials.
- Confirm loaded plugin SHA and installed bridge SHA match the PR-under-test; note the desktop app version.
- Use one **disposable** Penpot file with nested layout, text, a component instance, tokens and an unrelated neighboring board. Record IDs/hashes privately; never publish private file names or tokens.
- Inspect `high_level_overview` and needed `penpot_api_info` before modifying anything; pin the intended file/page/shape scope. Do not infer a session ID from an API that lacks one.

## Five workflows (each requires exact read-back and visual evidence)
| Skill | Action on disposable fixture | Pass invariant |
| --- | --- | --- |
| penpot-use | Read selected subtree; modify one text property | Target ID unchanged; neighbor unchanged |
| penpot-generate-design | Clone as responsive variant, trigger controlled failure after ID capture, retry by captured ID | No duplicate variant; original/neighbor unchanged |
| penpot-design-system | Create/reuse one test-only token; bind to a test instance; reread alias and asset | Binding resolved; original component ID preserved |
| penpot-audit | Inspect flow and exported screenshot | No shape mutation, findings tied to evidence |
| penpot-design-to-code | Generate into a throwaway code workspace; run project build and visual comparison | Source Penpot file unchanged, code build passes, differences noted |

For each workflow, record **scope, operation, stable IDs, before/after properties, unrelated neighbor snapshot, visual inspection and failure/recovery limits**. For build-dependent work, provide the actual project build command and result. Do not equate a synthetic test or a generated picture with a visually inspected result.

## Machine-readable result

Create a local JSON file (do not commit raw customer content) with keys `host`, `commit`, `environment`, and `workflows` holding the five skill names. Each has `status: "pass" | "fail" | "unverified"`. For pass also provide `scope`, `steps`, `notes`, `readBack`, `visualEvidence`, `unrelatedPreserved: true` and any skill-specific flags:
- audit/design-to-code: `readOnlyUnchanged: true`
- generate-design: `retryNoDuplicate: true`
- design-system: `bindingPreserved: true`
- design-to-code: `buildChecked: true`

`host` and `environment` must be nonempty text, and `commit` must be the full 40-character commit SHA. A `pass` or `fail` workflow must provide nonempty text for `scope`, `steps` and `notes`; a `pass` must also provide nonempty text for `readBack` and `visualEvidence`. An `unverified` workflow only requires its status.

Check the structure using `node scripts/regression-evidence.mjs path/to/evidence.json`. The CLI resolves its own and the invoked path's real filesystem paths, so direct execution through a symlink or junction still validates evidence; importing the module has no CLI side effect. It validates evidence **shape**, not its truth. The user/maintainer must inspect actual host logs, artifacts, before/after IDs and screenshots before marking a case passed.

## Remaining
The issue cannot be closed until final-SHA ChatGPT desktop replay is performed and sanitised pass/fail evidence is recorded. Codex fixture evidence or Node CI does not substitute for that.


## Request follow-up (2026-10-12)

The symlink CLI defect is fixed by comparing real filesystem paths. A registered remote MCP read confirmed that the existing disposable fixture remains connected, but that call was issued from a local Codex task. The running desktop executable is ChatGPT.exe in OpenAI.Codex 26.1007.2314.0; this process identity alone does not prove that this PR package or its five skills ran in a ChatGPT conversation. Actual final-SHA ChatGPT workflow replay is still unavailable from this calling task. Do not copy the older Codex fixture results into a ChatGPT pass record, and do not close #1 on the CLI fix alone.
