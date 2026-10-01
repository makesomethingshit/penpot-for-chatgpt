---
name: penpot-audit
description: Review a Penpot screen, flow or design system for evidenced usability, layout, accessibility signals, naming and consistency issues; provide prioritized minimal fixes while keeping the design read-only unless fixes are explicitly requested.
---

# Penpot audit

First read and follow [penpot-use](../penpot-use/SKILL.md). An audit is read-only by default. Do not silently rename, reorganize, normalize tokens, detach components or fix the canvas while collecting findings.

## Establish the evidence

Inspect the requested selection, board, page or flow and a rendered preview. Read relevant structure, flex/grid behavior, text and actual text bounds, component/variant sources, tokens, library conventions and observable interactions. Inspect sibling viewports/states only where they are part of the requested scope. Report exactly which pages, boards, states and viewports were reviewed.

Assess the user's goal and observed design conventions before applying generic heuristics. Do not expand a single-screen audit into the whole file. Separate confirmed facts from assumptions, recommendations and checks unavailable through the design API.

## Review the requested scope

- **Layout and content:** hierarchy, spacing, alignment, clipping, unintended containment violations, text wrapping, readability and missing/ambiguous action labels. Check whether the content or its container causes a problem before proposing resizing. Intended overlays and artwork bleed are not automatically defects.
- **Consistency and systems:** component reuse, token bindings versus unexplained hardcoded values, typography/color conventions, meaningful names, redundant assets, variant collisions and alias resolution. Do not treat deliberate token overrides as duplicates.
- **Accessibility signals:** contrast where foreground/background, opacity and text size can be measured; focus/error/disabled states represented in the design; distinguishable status beyond color; target size and readable labels. State the exact measurements and applicable authoritative criterion when available. Consult current authoritative documentation before citing a standard; do not guess compliance thresholds.
- **Flow and states:** clear primary action, understandable navigation, recovery paths and empty/error/loading/success states that the brief calls for. Flag absent evidence as unverified behavior, not a proven runtime failure. A static design cannot establish keyboard order, screen-reader names, HTML semantics or functional interaction behavior.

Prefer a short set of consequential findings over cosmetic noise. One cause affecting many layers is one finding with representative IDs and the measured scope.

## Deliver an actionable review

For each finding, provide severity, target board/shape IDs, observed evidence, user impact, the smallest proposed correction and the check that would confirm it. Distinguish a confirmed defect from a plausible concern or stylistic preference. Avoid unsupported accessibility certification or a numeric quality score without a defined method.

If the user explicitly requests fixes, keep the audit findings and applied changes distinct. Follow `penpot-use` for mutation scope, preservation, bulk-change planning and read-back/visual verification. Fix only the authorized findings; use [penpot-design-system](../penpot-design-system/SKILL.md) for dependency-sensitive asset changes. Do not introduce a broader redesign as an audit fix.

Finish with the most important findings, inspected scope and material evidence limitations. If no issue is confirmed, say so for that scope and list only meaningful unverified checks.
