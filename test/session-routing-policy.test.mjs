import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const doc = await readFile(new URL('../plugin/skills/penpot-use/SKILL.md', import.meta.url), 'utf8');
const block = doc.split('### Session-routing decision preflight')[1]?.match(/```javascript\n([\s\S]*?)\n```/)?.[1];
assert.ok(block, 'host-side preflight must remain executable');
function preflight({
  executeCodeSupports = false,
  exportShapeSupports = false,
  usesExecuteCode = true,
  usesExportShape = false,
  inventoryKnown = false,
  reported = [],
  chosen,
  readOnlyDiscovery = false,
  confirmedOneConnectedTab = false,
  interrupted = false,
  intendedTargetConfirmed = false,
  reselected = false,
  reinspected = false
} = {}) {
  const script = block
    .replace('const usesExecuteCode = true;', 'const usesExecuteCode = ' + JSON.stringify(usesExecuteCode) + ';')
    .replace('const usesExportShape = false;', 'const usesExportShape = ' + JSON.stringify(usesExportShape) + ';')
    .replace('const executeCodeSupportsSessionId = false;', 'const executeCodeSupportsSessionId = ' + JSON.stringify(executeCodeSupports) + ';')
    .replace('const exportShapeSupportsSessionId = false;', 'const exportShapeSupportsSessionId = ' + JSON.stringify(exportShapeSupports) + ';')
    .replace('const sessionInventoryKnown = false;', 'const sessionInventoryKnown = ' + JSON.stringify(inventoryKnown) + ';')
    .replace('const reportedIds = [];', 'const reportedIds = ' + JSON.stringify(reported) + ';')
    .replace('const chosenId = undefined;', 'const chosenId = ' + JSON.stringify(chosen) + ';')
    .replace('const readOnlyDiscovery = false;', 'const readOnlyDiscovery = ' + JSON.stringify(readOnlyDiscovery) + ';')
    .replace('const confirmedOneConnectedTab = false;', 'const confirmedOneConnectedTab = ' + JSON.stringify(confirmedOneConnectedTab) + ';')
    .replace('const interruptedAfterPinnedSession = false;', 'const interruptedAfterPinnedSession = ' + JSON.stringify(interrupted) + ';')
    .replace('const intendedTargetConfirmed = false;', 'const intendedTargetConfirmed = ' + JSON.stringify(intendedTargetConfirmed) + ';')
    .replace('const reselectedAfterInterruption = false;', 'const reselectedAfterInterruption = ' + JSON.stringify(reselected) + ';')
    .replace('const reinspectedAfterInterruption = false;', 'const reinspectedAfterInterruption = ' + JSON.stringify(reinspected) + ';');
  return new Function(script)();
}

test('single tab stays automatic when both scoped tools support route selection', () => {
  assert.equal(preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-a'] }).sessionId, 'session-a');
});

test('multiple sessions fail closed without a routing selector or explicit choice', () => {
  assert.throws(() => preflight({ inventoryKnown: true, reported: ['session-a', 'session-b'] }), /no route selector/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-a', 'session-b'] }), /Choose the intended/);
});

test('selector support is required only for the tools this task invokes', () => {
  assert.equal(preflight({ executeCodeSupports: true, exportShapeSupports: false, inventoryKnown: true, reported: ['session-a', 'session-b'], chosen: 'session-b' }).sessionId, 'session-b');
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: false, usesExportShape: true, inventoryKnown: true, reported: ['session-a', 'session-b'], chosen: 'session-b' }), /does not expose session routing/);
});

test('a pinned session is retained; missing session never silently falls back to another', () => {
  assert.equal(preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-a', 'session-b'], chosen: 'session-b' }).sessionId, 'session-b');
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-a'], chosen: 'session-b' }), /unavailable/);
  assert.throws(() => preflight({ inventoryKnown: true, reported: ['session-a'], chosen: 'session-a' }), /does not expose session routing/);
});

test('unknown inventory is distinct from known empty and permits initial supported read-only discovery', () => {
  assert.equal(preflight({ executeCodeSupports: true, exportShapeSupports: true, readOnlyDiscovery: true }).autoSelectedReadOnly, true);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true }), /No Penpot sessions are connected/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true }), /explicitly confirm exactly one connected tab/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, confirmedOneConnectedTab: true }), /explicitly confirm exactly one connected tab/);
});

test('a pinned supported route fails closed when disconnect leaves zero reported sessions', () => {
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, chosen: 'session-a' }), /No Penpot sessions are connected/);
});

test('a remaining B cannot replace disconnected pinned A, even with the same file and page', () => {
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-b'], chosen: 'session-a' }), /unavailable/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-b'], chosen: 'session-a', interrupted: true }), /confirm, reselect and re-inspect/);
  assert.throws(() => preflight({ inventoryKnown: false, confirmedOneConnectedTab: true, interrupted: true }), /confirm, reselect and re-inspect/);
  assert.match(doc, /same file and page IDs.*cannot be distinguished/);
});

test('interrupted legacy routing resumes only after intended-target confirmation and fresh reinspection', () => {
  const recovery = { confirmedOneConnectedTab: true, interrupted: true, intendedTargetConfirmed: true, reselected: true, reinspected: true };
  assert.equal(preflight(recovery).sessionId, undefined);
  for (const missing of ['intendedTargetConfirmed', 'reselected', 'reinspected']) {
    assert.throws(() => preflight({ ...recovery, [missing]: false }), /confirm, reselect and re-inspect/);
  }
});

test('legacy unknown inventory requires explicit one-connected-tab confirmation', () => {
  assert.throws(() => preflight({}), /explicitly confirm exactly one connected tab/);
  assert.equal(preflight({ confirmedOneConnectedTab: true }).sessionId, undefined);
  assert.equal(preflight({ inventoryKnown: true, reported: ['session-a'] }).sessionId, undefined);
});

test('identical file and page IDs pass the context guard but do not prove legacy session continuity', () => {
  const pinned = { fileId: 'file-a', pageId: 'page-a' };
  const remaining = { fileId: 'file-a', pageId: 'page-a' };
  assert.deepEqual(remaining, pinned);
  assert.throws(() => preflight({ confirmedOneConnectedTab: true, interrupted: true }), /confirm, reselect and re-inspect/);
});
