---
name: penpot-design-to-code
description: Translate a selected Penpot board, screen or component into faithful responsive HTML/CSS or the existing frontend stack, using live design evidence and preserving project and design-system conventions.
---

# Penpot design to code

First read and follow [penpot-use](../penpot-use/SKILL.md), including live connection, inspection, target pinning and verification. Keep Penpot read-only unless the user also requests design edits.

## Establish the implementation

Inspect the target board and a rendered preview, then its hierarchy, flex/grid settings, dimensions, spacing, text metrics, token names and resolved values, component/variant sources, assets and documented interactions. Inspect responsive sibling boards when present. Distinguish measured design facts from inferred breakpoints and behavior; a static board does not prove responsive or interactive behavior.

If a code workspace is supplied, read its instructions and the existing entry point, components, styles, tokens, asset handling and scripts before editing. Reuse the project's stack and installed dependencies. If no stack is specified and no project is available, default to a small semantic HTML/CSS implementation and state that assumption. Do not scaffold a new application or add a UI library for a single screen.

## Translate faithfully

1. Use documented `penpot.generateStyle` and `penpot.generateMarkup` when useful to extract evidence. Inspect the relevant live API first. Generated output is a reference, not a guarantee of semantic, accessible or maintainable code.
2. Map Penpot components to existing code components and tokens to existing variables. Keep semantic token names and explain unresolved mappings. Prefer CSS flex/grid for layout and native controls for behavior. Avoid arbitrary absolute positioning except for genuinely fixed artwork or overlays.
3. Preserve content, visual hierarchy, typography, colors, spacing, radii, icon proportions and observed states. Use approved project assets or supported Penpot exports; do not silently substitute logos, fonts or unrelated stock imagery. Do not assume the remote server can import local files or save exports directly to a local path.
4. Implement observed responsive rules. If only one viewport is known, use a conservative layout that fits content and label breakpoint choices as assumptions. Include keyboard access, visible focus, semantic labels and appropriate alt text; distinguish these code improvements from features evidenced by the design.
5. Implement only requested interactions. Do not invent backend calls, analytics, authentication, persistence or production data. Label any necessary placeholder content or behavior.

## Validate and deliver

Run the smallest existing build/type/lint check applicable to changed files. Render the implementation when browser tools are available and compare it with the Penpot preview at observed desktop/mobile sizes. Check overflow, text wrapping, asset/font availability, keyboard focus and documented interactions. Correct discrepancies introduced by the implementation.

Report changed files, reused components/token mappings, checks performed and remaining assumptions. If the host lacks workspace or browser tools, deliver code or a precise implementation specification and state which checks could not run. Do not claim visual parity from a successful build alone or claim Penpot was updated when only code changed.
