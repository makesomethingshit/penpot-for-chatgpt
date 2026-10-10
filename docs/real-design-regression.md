# Real-design regression record

Verified 2026-10-11 (Asia/Seoul), source base `b4d04a7`, with local changes in this checkout. Environment: Windows, Node.js 24.18.0, Codex desktop, registered remote `mcp__penpot` for `design.penpot.app`. The user connected the intended file; no reinstall or credential entry was performed. These are manual workflow checks, not an automated end-to-end run of a freshly installed package. ChatGPT desktop replay remains unverified. The changed package was subsequently installed in local Codex; its host skill/MCP discovery and installed bridge read-only fixture access passed (see host-compatibility.md).

Only a newly created disposable page and synthetic local assets were written. Existing page IDs/content stayed in in-memory storage; private names, credentials and design content were not copied into this record.

## Fixture

The new `Plugin regression 2026-10-11` page is `c5df1da3-e653-80b5-8008-c4edf56c4d5e`. It contains a 480 x 360 desktop board with nested column flex, a 160 x 48 component instance, an active test-only token set with a base color/alias, an unaffected neighbor, and a 320 x 360 mobile variant. Names are synthetic.

| Object | Stable ID before/after |
| --- | --- |
| Desktop board | `c5df1da3-e653-80b5-8008-c4ee35a6569a` |
| Title | `c5df1da3-e653-80b5-8008-c4ee35cf7ef5` |
| Component main | `c5df1da3-e653-80b5-8008-c4ee35e09120` |
| Component asset | `c5df1da3-e653-80b5-8008-c4ee35f54257` |
| Desktop instance | `c5df1da3-e653-80b5-8008-c4ee35f7d55c` |
| Neighbor | `c5df1da3-e653-80b5-8008-c4ee35fab8ed` |
| Mobile variant, reused after failure | `c5df1da3-e653-80b5-8008-c4eee457d1a6` |
| Test token set | `c5df1da3-e653-80b5-8008-c4ee94aa3b57` |
| Base color / alias | `c5df1da3-e653-80b5-8008-c4ee94aef999` / `c5df1da3-e653-80b5-8008-c4ee94b2090d` |
| Spacing token, identical on rerun | `c5df1da3-e653-80b5-8008-c4f05d9330f9` |

## Observed results

| Workflow | Operation and exact read-back | Visual result / limitation |
| --- | --- | --- |
| penpot-use | Pinned the fixture file/page and title ID; changed `Fixture title` to `Verified title`. Read back exact characters, retained title ID and instance fill binding. Initial targeted structure contained the desktop board only. | Exported and inspected the 480 x 360 PNG; title and button were visible without clipping. |
| penpot-generate-design | Cloned the desktop board and immediately stored its ID, then deliberately threw a synthetic error. On the next call resolved that ID, renamed/resized it to 320 x 360, and set only its nested container's horizontal sizing to fill. Four top-level fixture boards remained; source structure was equal before/after. | Exported and inspected mobile PNG; same title/button, fitting the smaller board. |
| penpot-design-system | Read test catalog, added base `#151035` and alias `{regression.20261011.primary}`, applied alias to the test instance's fill. Read-back returned alias resolution `#151035`, `tokens.fill = regression.20261011.action` and the same component asset ID in desktop/mobile copies. Executed the checked-in scalar-token example twice; both returned the same spacing token ID and one matching catalog entry. | Desktop/mobile PNGs retained the button appearance. No existing library was connected, published or detached. |
| penpot-audit | Read desktop structure, text bounds, flex settings, bindings and containment. `analyzeDescendants` reported no formal containment violations. Shape snapshot was equal before/after audit. | Inspected exported preview. This does not establish keyboard/screen-reader behavior or accessibility compliance. |
| penpot-design-to-code | Used live documented `generateMarkup` / `generateStyle` as reference; manually translated measured values into one semantic HTML/CSS fixture in a throwaway sibling workspace. Preserved the token alias in CSS; parser assertions passed for one screen, one heading/action and unique IDs. Penpot shape snapshot stayed equal after extraction. | Browser comparison showed expected 24px padding, 16px gap, 160 x 48 button, 360px board height. At 320px, DOM measured width 320 and no horizontal overflow. Source Sans Pro was unavailable in the code browser, so fallback typography differed; pixel parity is unverified. No application build system was needed for the static HTML. |

Final read-back: original page shape/property snapshot equal, original seven top-level IDs equal, neighbor bounds/fills equal, four fixture boards, one spacing token. The property snapshot covered IDs, parents, bounds, text, fills/strokes, token bindings and component asset IDs; it does not cover every possible Penpot property or file-version metadata.

The synthetic partial failure is a deliberate retry scenario, not an upstream production defect. A wrong-ID export failed without a result; export was then repeated with the actual returned variant ID. No uninspected image is counted as verified.

## Repeat the checks

Use an already connected disposable file; preserve its existing pages. Read the live overview/API before operations. Create a new page with `penpot.createPage()`, retain its ID immediately, and `await penpot.openPage(page)` before creating shapes. Capture original-page and neighbor property snapshots in storage, not in logs.

Run each specialist through the shared `penpot-use` guards. Use the checked-in initial inspection and scalar-token code examples directly. For responsive creation/retry, retain the created ID before the deliberate failure:

```javascript
const task = storage.penpotTask;
if (!task || penpot.currentFile?.id !== task.fileId || penpot.currentPage?.id !== task.pageId) {
  throw new Error("Fixture context changed.");
}
const source = penpotUtils.findShape(shape => shape.id === task.targetIds[0], penpot.currentPage.root);
if (!source) throw new Error("Source is missing.");
if (storage.regressionVariantId) throw new Error("Inspect the retained variant before retrying.");
const variant = source.clone();
storage.regressionVariantId = variant.id;
throw new Error("Synthetic failure after retaining the created ID.");
```

The retry must resolve `storage.regressionVariantId` in the same guarded page, modify that object, and assert source/neighbor snapshots and component/token links are preserved. Never replay the clone call blindly. Export both board IDs and inspect the images. Record unavailable checks rather than marking them passed.

The fixture page/assets are retained for review. They are disposable but were not automatically deleted. Issue #1 remains incomplete until the required installed ChatGPT desktop workflow is replayed or the accepted host scope is explicitly changed.

## Initial inspection payload (#6)

`node --test test/skill-inspection.test.mjs` executes the actual fenced skill examples against 100 sibling boards with 20 text children each. The old root-depth-2 response is 106,385 JSON bytes; the targeted response is 1,193 bytes, with no unrelated descendants (98.88% smaller). It also checks explicit-ID precedence, missing targets, pinned selection, page guards and no-selection inventory.

The live fixture returned 1,627 versus 946 JSON **characters** for root versus targeted reads. This second measurement is character count, not a byte or latency claim. A first attempt to use `TextEncoder` in the plugin sandbox failed because it was unavailable; no design mutation occurred. No execution-time benchmark or large-production-file slowdown was measured. Inventory uses batches of 50 direct children with total/next-offset; wide subtrees still need staged reads.
