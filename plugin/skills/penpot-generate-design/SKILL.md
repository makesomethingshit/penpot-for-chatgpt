---
name: penpot-generate-design
description: Create or adapt Penpot screens, boards and responsive variants from a brief, reference or existing code while reusing the connected file's components, tokens and layout conventions and verifying the rendered result.
---

# Penpot generate design

First read and follow [penpot-use](../penpot-use/SKILL.md). Inspect the active file/page, requested references, target IDs, libraries and a representative rendered board before creation.

For building reusable components or a design system from code, use [penpot-design-system](../penpot-design-system/SKILL.md); return here to compose the requested screens from its assets.

## Fit the existing design

Extract the screen's purpose, audience, required content/actions and requested sizes. Read relevant source code or supplied references when available. Reuse observed navigation, grid, spacing, color, typography, component states and naming conventions. Distinguish supplied requirements and observed patterns from new layout/content choices.

Make reasonable reversible choices when the brief permits them and state them briefly. Ask only when a missing detail materially affects scope, structure, data loss, cost or privacy. If no design system exists, use a small coherent set of values for this screen; do not create a library or token migration unless requested.

## Create the requested screen

1. Describe the target page, board(s), dimensions, reused assets and intended changes. For a new screen or alternative, place the new board in unused canvas space and preserve existing boards. For an explicit in-place edit, keep its identity and apply the smallest change. Do not move unrelated boards to make room.
2. Fetch the live documentation for creation, text, layout, components and tokens as needed. Use real Penpot boards/shapes with semantic names. Recreate composed UI as editable text, components, icons and hierarchy; a screenshot of the whole UI is a visual reference, never a replacement board fill or flattened deliverable. Discrete supplied photos and artwork may remain image assets. Prefer flex/grid where the content flow calls for it. Reuse component instances and documented variants rather than redrawing them or detaching links.
3. Preserve existing token bindings and typography references. Select fonts that are actually available. Use actual supplied images/icons when supported; mark missing assets as placeholders rather than presenting invented assets as the user's brand.
4. Create only the requested boards, viewport variants and necessary states. Keep mobile structure appropriate to the content rather than scaling a desktop board. Do not add speculative dashboards, onboarding, payment steps or annotations.
5. Build in small batches, guard file/page context and retain created/touched IDs. Reuse the IDs on retries to avoid duplicate boards. Honor automatic layout and preserve text auto-sizing; do not hide overflowing text or shrink typography merely to make the geometry pass.

## Verify the rendered result

Re-read the created hierarchy, names, board sizes, components, token bindings and layouts. Check descendants against their intended board, text's actual rendered bounds, clipping, stacking, alignment and interactive target sizes. Inspect exported previews of each requested viewport, then correct issues introduced by creation. Verify existing neighboring boards remain intact where placement could affect them.

Report the created/edited board names and IDs, reused conventions, checks, deliberate assumptions and missing assets. A successful write or correct board count does not establish visual quality; label unrendered results as visually unverified.
