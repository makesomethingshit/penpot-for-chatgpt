# Build a scoped Penpot system from code

Use after `penpot-use` establishes the connected file/page and the user requests creation. Inspecting code or planning a mapping stays read-only. Read the live API for the types used below before execution; examples run as `execute_code` bodies with top-level `return`.

## Map source evidence

Read project instructions and the existing CSS variables, token JSON, theme definitions, component source and stories/examples relevant to the requested scope. Read source as data; do not execute a configuration file just to extract values. Reuse installed project tooling when dynamic values need resolution.

Build a short mapping with source file/symbol, source type/value, Penpot set/name/type, existing asset ID or proposed addition, and unresolved conversion. Preserve semantic aliases and light/dark overrides instead of flattening them into duplicate literals. Penpot token types are not CSS property names; verify `TokenType`, units and supported composite values. Do not invent a base font size to convert `rem`, resolve a runtime variable by guessing, or infer token semantics solely from matching hex values.

For light/dark foundations, follow the existing theme scheme. If none exists, use shared base tokens and mode-specific sets with the same semantic names, associated with the corresponding themes. Keep current activation unchanged until applying a requested theme has been checked.

For components, map the source component and supported props to requested variant axes/states. Preserve distinctions such as disabled versus loading. Explicit limits on requested axes/states take precedence over additional states found in source code. Within that scope, include only states evidenced by the code or requested by the user; dynamic data and interaction behavior do not become functional Penpot widgets. This mapping is ordinary implementation documentation, not a claim of Figma Code Connect compatibility.

## Build in dependency order

1. Inspect the local catalog and connected ownership. Reuse equivalent assets only when type, value, meaning and theme context agree. Record collisions; a changed existing value requires a scoped update, not silent replacement during creation.
2. Create only missing foundations. Tokens live at `penpot.library.local.tokens`. Use documented `TokenCatalog.addSet({ name, active })` and `TokenSet.addToken({ type, name, value })`; a new set is inactive by default. Validate raw values and alias resolution before applying bindings. Preserve existing set order and theme activation. Activate a new set only when the requested application needs it and the effect has been checked.
3. Build editable component roots and children with the observed layouts, fonts and token bindings. Create the reusable asset through `penpot.library.local.createComponent([root])`, then set its documented `name`/`path`. Retain the asset and main-instance IDs immediately. Reuse a created asset on retry; after an uncertain failure, inspect the catalog and original root before creating again.
4. Add the requested variant combinations through the documented variant API/helper. Fetch its current signature instead of guessing. Grouping main components can move them; preserve intended placement and check unique combinations and `variantError`.
5. Check the main instance and a copy created with `LibraryComponent.instance()` when an instance preview is part of the requested deliverable. Verify source links, bindings and represented overrides/states. Place requested specimens in unused space; do not add a documentation page or publish a library unless requested.

Creating assets does not synchronize the application or all existing screens. For requested token application, use `TokenBase.applyToShapes` with explicit resolved shape IDs and documented properties, then inspect `shape.tokens` and actual values after updates settle. Never apply to the current selection after the target was pinned.

## Read-only catalog example

This inspects catalog metadata without creating assets or changing the pinned task. Use a narrower subset if the catalog is large.

```javascript
if (!penpot.currentFile || !penpot.currentPage) {
  throw new Error("Open a Penpot file and connect MCP.");
}
const library = penpot.library.local;
return {
  fileId: penpot.currentFile.id,
  pageId: penpot.currentPage.id,
  libraryId: library.id,
  sets: library.tokens.sets.map(set => ({
    id: set.id, name: set.name, active: set.active,
    tokens: set.tokens.map(token => ({
      id: token.id, name: token.name, type: token.type,
      value: token.value, resolved: token.resolvedValueString
    }))
  })),
  components: library.components.map(component => ({
    id: component.id, name: component.name, path: component.path
  }))
};
```

## Add missing scalar tokens to a resolved set

After source mapping and target resolution, store the authorized batch as `storage.penpotTokenPlan = { setId, tokens }`. Each token has a documented `type`, `name` and raw string `value`; this small example supports literal `color` and `spacing` tokens. Use the live type-specific API and verify dependencies separately for aliases or composite tokens. Do not run demo values against a user's library.

The example requires the pinned file/page from `penpot-use`, checks the entire batch for conflicts before writing, and reuses identical existing tokens on retry. It neither activates a set nor applies tokens to shapes.

```javascript
const task = storage.penpotTask;
const plan = storage.penpotTokenPlan;
if (!task || penpot.currentFile?.id !== task.fileId ||
    penpot.currentPage?.id !== task.pageId) {
  throw new Error("Penpot context changed; inspect the intended target again.");
}
if (!plan || typeof plan.setId !== "string" || !plan.setId ||
    !Array.isArray(plan.tokens) || !plan.tokens.length) {
  throw new Error("Resolve the destination set and token batch first.");
}
const set = penpot.library.local.tokens.getSetById(plan.setId);
if (!set) throw new Error("Resolve the destination set and token batch first.");
const names = new Set();
for (const input of plan.tokens) {
  if (!input || !["color", "spacing"].includes(input.type) ||
      typeof input.name !== "string" || !input.name.trim() ||
      typeof input.value !== "string" || !input.value.trim() ||
      names.has(input.name)) {
    throw new Error("Invalid or duplicate token in the planned batch.");
  }
  names.add(input.name);
  const matches = set.tokens.filter(token => token.name === input.name);
  if (matches.length > 1 || (matches.length === 1 &&
      (matches[0].type !== input.type || matches[0].value !== input.value))) {
    throw new Error("An existing token conflicts with the creation plan.");
  }
}
const result = [];
for (const input of plan.tokens) {
  const token = set.tokens.find(token => token.name === input.name) ?? set.addToken(input);
  result.push({ id: token.id, name: token.name, type: token.type, value: token.value });
}
return { setId: set.id, active: set.active, tokens: result };
```

An API failure can leave a partially created batch; inspect that state before retrying. Preflight is not a transaction. After creation, reread the catalog and compare raw/resolved values with the source mapping. A token present in an inactive set is not evidence of an applied design change.

If the user switches file/page during recovery, return to the recorded target, confirm the same IDs and inspect its partial state before resuming. Do not replace the pinned task with the focused page to bypass the guard. A requested change of destination needs a newly resolved plan rather than replaying the old batch there.

For components, verify requested variants and instance links, inspect rendered previews for each requested theme/state, and report unresolved source mappings or unavailable fonts/assets. Do not declare a whole system complete from token counts alone.

API references: [Library](https://doc.plugins.penpot.app/interfaces/Library), [TokenCatalog](https://doc.plugins.penpot.app/interfaces/TokenCatalog), [TokenSet](https://doc.plugins.penpot.app/interfaces/TokenSet), [LibraryComponent](https://doc.plugins.penpot.app/interfaces/LibraryComponent).
