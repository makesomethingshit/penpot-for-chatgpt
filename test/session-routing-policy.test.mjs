import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const doc = await readFile(new URL('../plugin/skills/penpot-use/SKILL.md', import.meta.url), 'utf8');
const block = doc.split('### Session-routing decision preflight')[1]?.match(/```javascript\n([\s\S]*?)\n```/)?.[1];
assert.ok(block, 'host-side preflight must remain executable');
function preflight({
  executeCodeSupports = false,
  exportShapeSupports = false,
  invokedTools = ['execute_code'],
  currentInvokedTool = 'execute_code',
  currentOperation = 'read',
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
    .replace('const invokedTools = ["execute_code"];', 'const invokedTools = ' + JSON.stringify(invokedTools) + ';')
    .replace('const currentInvokedTool = "execute_code";', 'const currentInvokedTool = ' + JSON.stringify(currentInvokedTool) + ';')
    .replace('const currentOperation = "read";', 'const currentOperation = ' + JSON.stringify(currentOperation) + ';')
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
  assert.deepEqual(preflight({ executeCodeSupports: true, exportShapeSupports: true, invokedTools: ['execute_code', 'export_shape'], inventoryKnown: true, reported: ['session-a'] }).selectors, {
    execute_code: { sessionId: 'session-a' },
    export_shape: { sessionId: 'session-a' }
  });
  assert.equal(preflight({ executeCodeSupports: true, exportShapeSupports: true, invokedTools: ['execute_code'], inventoryKnown: true, reported: ['session-a'], chosen: 'session-a' }).selectors.execute_code.sessionId, 'session-a');
});

test('multiple sessions fail closed without a routing selector or explicit choice', () => {
  assert.throws(() => preflight({ inventoryKnown: true, reported: ['session-a', 'session-b'] }), /no route selector/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-a', 'session-b'] }), /Choose the intended/);
});

test('selector support is required only for the tools this task invokes', () => {
  const result = preflight({ executeCodeSupports: true, exportShapeSupports: false, invokedTools: ['execute_code', 'export_shape'], inventoryKnown: true, reported: ['session-a', 'session-b'], chosen: 'session-b' });
  assert.deepEqual(result.selectors, { execute_code: { sessionId: 'session-b' } });
  assert.deepEqual(result.unsupportedTools, ['export_shape']);
  assert.deepEqual(result.downgradedTools, []);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: false, currentInvokedTool: 'export_shape', currentOperation: 'export', invokedTools: ['execute_code', 'export_shape'], inventoryKnown: true, reported: ['session-a', 'session-b'], chosen: 'session-b' }), /does not expose session routing/);
  assert.deepEqual(preflight({ executeCodeSupports: true, exportShapeSupports: false, currentInvokedTool: 'export_shape', currentOperation: 'export', invokedTools: ['export_shape'], inventoryKnown: true, reported: ['session-a'] }).downgradedTools, ['export_shape']);
});

test('a pinned session is retained; missing session never silently falls back to another', () => {
  assert.equal(preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-a', 'session-b'], chosen: 'session-b' }).selectors.execute_code.sessionId, 'session-b');
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-a'], chosen: 'session-b' }), /unavailable/);
  assert.deepEqual(preflight({ inventoryKnown: true, reported: ['session-a'], chosen: 'session-a' }).downgradedTools, ['execute_code']);
});

test('unknown inventory is distinct from known empty and permits initial supported read-only discovery', () => {
  assert.equal(preflight({ executeCodeSupports: true, exportShapeSupports: true, readOnlyDiscovery: true }).autoSelectedReadOnly, true);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true }), /No Penpot sessions are connected/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true }), /explicit session ID.*read-only discovery/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, confirmedOneConnectedTab: true }), /explicit session ID.*read-only discovery/);
});

test('a pinned supported route fails closed when disconnect leaves zero reported sessions', () => {
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, chosen: 'session-a' }), /No Penpot sessions are connected/);
});

test('a remaining B cannot replace disconnected pinned A, even with the same file and page', () => {
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-b'], chosen: 'session-a' }), /unavailable/);
  assert.throws(() => preflight({ executeCodeSupports: true, exportShapeSupports: true, inventoryKnown: true, reported: ['session-b'], chosen: 'session-a', interrupted: true }), /unavailable/);
  assert.throws(() => preflight({ inventoryKnown: false, confirmedOneConnectedTab: true, interrupted: true }), /confirm, reselect and re-inspect/);
  assert.match(doc, /same file and page IDs.*cannot be distinguished/);
});

test('interrupted legacy routing resumes only after intended-target confirmation and fresh reinspection', () => {
  const recovery = { confirmedOneConnectedTab: true, interrupted: true, intendedTargetConfirmed: true, reselected: true, reinspected: true };
  assert.equal(preflight(recovery).selectors.execute_code, undefined);
  for (const missing of ['intendedTargetConfirmed', 'reselected', 'reinspected']) {
    assert.throws(() => preflight({ ...recovery, [missing]: false }), /confirm, reselect and re-inspect/);
  }
});

test('supported recovery read may establish verification, but supported writes and exports remain blocked until then', () => {
  const recovery = {
    executeCodeSupports: true,
    exportShapeSupports: true,
    inventoryKnown: true,
    reported: ['session-a'],
    chosen: 'session-a',
    readOnlyDiscovery: true,
    interrupted: true,
    intendedTargetConfirmed: true,
    reselected: true
  };
  assert.equal(preflight(recovery).recoveryPendingVerification, true);
  assert.throws(() => preflight({ ...recovery, currentOperation: 'write' }), /readOnlyDiscovery is allowed only/);
  assert.throws(() => preflight({ ...recovery, currentInvokedTool: 'export_shape', currentOperation: 'export', invokedTools: ['execute_code', 'export_shape'] }), /readOnlyDiscovery is allowed only/);
  assert.equal(preflight({ ...recovery, reinspected: true, readOnlyDiscovery: false, currentOperation: 'write' }).selectors.execute_code.sessionId, 'session-a');
});

test('legacy recovery read may establish verification, but legacy writes and exports remain blocked until then', () => {
  const recovery = {
    confirmedOneConnectedTab: true,
    interrupted: true,
    intendedTargetConfirmed: true,
    reselected: true,
    readOnlyDiscovery: true
  };
  assert.equal(preflight(recovery).recoveryPendingVerification, true);
  assert.throws(() => preflight({ ...recovery, currentOperation: 'write' }), /readOnlyDiscovery is allowed only/);
  assert.throws(() => preflight({ ...recovery, currentInvokedTool: 'export_shape', currentOperation: 'export', invokedTools: ['export_shape'] }), /readOnlyDiscovery is allowed only/);
  assert.deepEqual(preflight({ ...recovery, reinspected: true, readOnlyDiscovery: false, currentOperation: 'write' }).downgradedTools, ['execute_code']);
});

test('legacy unknown inventory requires explicit one-connected-tab confirmation', () => {
  assert.throws(() => preflight({}), /explicitly confirm exactly one connected tab/);
  assert.equal(preflight({ confirmedOneConnectedTab: true }).selectors.execute_code, undefined);
  assert.deepEqual(preflight({ inventoryKnown: true, reported: ['session-a'] }).downgradedTools, ['execute_code']);
});

test('identical file and page IDs pass the context guard but do not prove legacy session continuity', () => {
  const pinned = { fileId: 'file-a', pageId: 'page-a' };
  const remaining = { fileId: 'file-a', pageId: 'page-a' };
  assert.deepEqual(remaining, pinned);
  assert.throws(() => preflight({ confirmedOneConnectedTab: true, interrupted: true }), /confirm, reselect and re-inspect/);
});


test('supported unknown inventory gives an actionable ID or discovery recovery path', () => {
  const state = { executeCodeSupports: true };
  assert.throws(() => preflight(state), /explicit session ID.*read-only discovery/);
  assert.equal(preflight({ ...state, chosen: 'confirmed-session' }).selectors.execute_code.sessionId, 'confirmed-session');
  assert.equal(preflight({ ...state, readOnlyDiscovery: true }).autoSelectedReadOnly, true);
});

test('confirmed replacement session uses the new pin for recovery before writes or exports', () => {
  const recovery = {
    executeCodeSupports: true, exportShapeSupports: true,
    invokedTools: ['execute_code', 'export_shape'], inventoryKnown: true,
    reported: ['new-session', 'other-tab'], chosen: 'new-session',
    interrupted: true, intendedTargetConfirmed: true, reselected: true,
    readOnlyDiscovery: true
  };
  const read = preflight(recovery);
  assert.deepEqual(read.selectors, { execute_code: { sessionId: 'new-session' }, export_shape: { sessionId: 'new-session' } });
  assert.equal(read.recoveryPendingVerification, true);
  assert.throws(() => preflight({ ...recovery, readOnlyDiscovery: false, currentOperation: 'write' }), /re-inspect/);
  const verified = { ...recovery, reinspected: true, readOnlyDiscovery: false };
  assert.equal(preflight({ ...verified, currentOperation: 'write' }).selectors.execute_code.sessionId, 'new-session');
  assert.equal(preflight({ ...verified, currentInvokedTool: 'export_shape', currentOperation: 'export' }).selectors.export_shape.sessionId, 'new-session');
  assert.throws(() => preflight({ ...recovery, intendedTargetConfirmed: false }), /confirm, reselect/);
});


test('reconnect policy replaces stale pins only after confirmation of the intended tab and inspection', () => {
  assert.match(doc, /new session ID, the user must confirm/);
  assert.match(doc, /Set `chosenId` to that confirmed new ID/);
  assert.match(doc, /recovery inspection on the new route, verify its file\/page\/target/);
  assert.match(doc, /If those IDs differ, stop/);
});


test('mixed selector host keeps execute route while allowing only a confirmed-singleton export', () => {
  const route = {
    executeCodeSupports: true, exportShapeSupports: false,
    invokedTools: ['execute_code', 'export_shape'],
    inventoryKnown: false, reported: [], chosen: 'pinned-session',
    confirmedOneConnectedTab: true
  };
  const exec = preflight(route);
  assert.deepEqual(exec.selectors.execute_code, { sessionId: 'pinned-session' });
  assert.deepEqual(exec.downgradedTools, ['export_shape']);
  const exportResult = preflight({
    ...route, currentInvokedTool: 'export_shape', currentOperation: 'export'
  });
  assert.deepEqual(exportResult.selectors.execute_code, { sessionId: 'pinned-session' });
  assert.deepEqual(exportResult.downgradedTools, ['export_shape']);
  assert.throws(() => preflight({
    ...route, confirmedOneConnectedTab: false, currentInvokedTool: 'export_shape', currentOperation: 'export'
  }), /does not expose session routing/);
  assert.throws(() => preflight({
    ...route, inventoryKnown: true, reported: ['other-session'],
    currentInvokedTool: 'export_shape', currentOperation: 'export'
  }), /unavailable/);
});

const restoreBlock = doc.split('### Restore the task pin after a plugin reload')[1]
  ?.match(new RegExp(String.fromCharCode(96).repeat(3) + 'javascript\\n([\\s\\S]*?)\\n' + String.fromCharCode(96).repeat(3)))?.[1];
assert.ok(restoreBlock, 'reload recovery must have executable guarded storage restoration');
function recoverTask(original, sessionId, { file = 'file-a', page = 'page-a', ids = ['target-a'], state = {} } = {}) {
  const script = restoreBlock
    .replace(/const originalTask = \{[\s\S]*?\n\};/,
      'const originalTask = ' + JSON.stringify(original) + ';')
    .replace("const confirmedSessionId = 'REPLACE_CONFIRMED_SESSION_ID';",
      'const confirmedSessionId = ' + JSON.stringify(sessionId) + ';');
  const penpot = { currentFile: { id: file }, currentPage: { id: page, root: {} }, selection: [{ id: 'unrelated-selection' }] };
  const penpotUtils = { findShape: predicate => ids.map(id => ({ id })).find(predicate) };
  const result = new Function('penpot', 'penpotUtils', 'storage', script)(penpot, penpotUtils, state);
  return { result, state };
}

test('reload restores the full original file/page/target pin, not a fresh selection', () => {
  const original = { fileId: 'file-a', pageId: 'page-a', targetIds: ['target-a'] };
  const { result, state } = recoverTask(original, 'new-session');
  assert.equal(result.restored, true);
  assert.deepEqual(state.penpotTask, {
    fileId: 'file-a', pageId: 'page-a', targetIds: ['target-a'], sessionId: 'new-session'
  });
  assert.equal(state.penpotTaskSelection, undefined);
});

test('reload recovery refuses changed file/page, missing targets, missing saved IDs and existing tasks', () => {
  const original = { fileId: 'file-a', pageId: 'page-a', targetIds: ['target-a'] };
  const state = {};
  assert.throws(() => recoverTask(original, 'new-session', { file: 'other-file', state }), /does not match/);
  assert.throws(() => recoverTask(original, 'new-session', { page: 'other-page', state }), /does not match/);
  assert.throws(() => recoverTask(original, 'new-session', { ids: ['other-target'], state }), /missing/);
  assert.throws(() => recoverTask(undefined, 'new-session', { state }), /existing task/);
  assert.throws(() => recoverTask(original, undefined, { state }), /confirmed Penpot route/);
  assert.deepEqual(state, {});
  const existing = { penpotTask: { fileId: 'other-file' } };
  assert.throws(() => recoverTask(original, 'new-session', { state: existing }), /already pinned/);
  assert.deepEqual(existing.penpotTask, { fileId: 'other-file' });
});
