---
name: penpot-design-system
description: Inspect, create or update Penpot tokens, themes, colors, typography, components and variants, including a scoped system from existing code while preserving aliases, library ownership and dependent instances.
---

# Penpot design system

First read and follow [penpot-use](../penpot-use/SKILL.md). A request to inspect, compare or propose a cleanup remains read-only. Preserve conventions discovered in the connected file; do not impose a new token scale or component taxonomy.

## Choose the deliverable

- **Tokens or foundations:** create only the requested tokens, themes, colors or typography; do not also generate components or specimen boards.
- **One component or family:** reuse compatible foundations, add only missing tokens, and build the requested states and variants.
- **A system from code:** inspect the existing source and build the requested foundations and component families in dependency order.

For any creation sourced from code, including tokens alone or one component, read [Build from code](references/build-from-code.md) for source mapping, creation and executable inspection/token examples.

For new reusable components, use this skill; use [penpot-generate-design](../penpot-generate-design/SKILL.md) when composing screens from those components. A request for a system does not authorize publishing or connecting a shared library.

## Inspect ownership and usage

Read the local and already-connected libraries; identify which library owns each relevant asset. Inspect token sets, their order/activation, themes, token names/types, raw values, aliases and resolved values. Inspect representative bindings and component main instances, copies, variant axes/value combinations and errors. Use documented helpers such as `penpotUtils.tokenOverview`, `findTokensByName` and `createVariantContainer` before custom logic.

Do not assume the same token name across sets is a duplicate: overrides and set precedence may be intentional. Similar appearance does not prove interchangeable component semantics. Report the pages/libraries and instances actually inspected; do not claim an exhaustive usage search from a sample. Unavailable usage evidence is a limitation.

## Make a scoped maintenance change

1. Describe the smallest change and its affected assets, sets/themes and dependent instances. Reuse existing semantic names and values. Add a token/component/variant only when the request needs one and no suitable one exists.
2. Before a rename, delete, merge, detach, reorder, theme activation or broad restyle, establish an explicit before/after mapping, target IDs/count, known dependency impact, verification and recovery plan. Perform destructive bulk work only when authorization clearly covers that plan. Reuse existing authorization; clarify materially unknown scope instead of adding routine approvals.
3. Keep shared-library ownership intact. Do not modify an upstream library, connect a new one, detach instances or materialize aliases into hardcoded values as a workaround for missing access. Report the ownership/access limitation and continue read-only analysis where useful.
4. Use `penpot_api_info` for the relevant token/library/variant APIs. Apply existing tokens to explicit intended properties; direct style writes can remove bindings. Preserve unrelated bindings, set precedence, aliases and active themes. Avoid accidental activation toggles on rerun.
5. Preserve component identity, source links, variant axis order, overrides and intended states. Creating a variant group moves main components into its container; account for this in the plan. Use the documented helper or required API sequence and check uniqueness of variant combinations and `variantError`.

## Verify system behavior

Re-read the touched catalog entries, names, raw/resolved values, aliases, set order/activation and themes. Allow asynchronous token application to settle; inspect both `shape.tokens` and actual properties. If a binding is still missing after updates settle, re-resolve the same retained shape and token IDs in the guarded file/page and reapply only the already-authorized binding; read back both the binding and value again. Do not create another clone/token or infer the failure cause from a successful retry. Stop and report a persistent mismatch rather than retrying indefinitely. Check representative dependent instances and requested themes/variants, then inspect their rendered previews for regression. Export again after a recovery write before claiming its final visual result.

For dependency-sensitive changes, verify every affected reference within the declared scope when the API permits it. If references outside that scope cannot be inspected, report the limitation and do not declare a merge or deletion safe based on guesswork.

Report asset IDs/names, before/after mapping, verified usage scope and unresolved issues. Keep proposals distinct from applied changes. Do not claim a successful catalog update proves all dependent designs are correct.
