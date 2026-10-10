import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const doc = await readFile(new URL('../plugin/skills/penpot-use/SKILL.md', import.meta.url), 'utf8');
const block = doc.split('### Session-routing decision preflight')[1]?.match(/```javascript\n([\s\S]*?)\n```/)?.[1];
assert.ok(block, 'host-side preflight must remain executable');
function preflight(executeCodeSupports, exportShapeSupports, reported, chosen, confirmedOneConnectedTab = false) {
  const script = block
    .replace('const executeCodeSupportsSessionId = false;', 'const executeCodeSupportsSessionId = ' + JSON.stringify(executeCodeSupports) + ';')
    .replace('const exportShapeSupportsSessionId = false;', 'const exportShapeSupportsSessionId = ' + JSON.stringify(exportShapeSupports) + ';')
    .replace('const reportedIds = [];', 'const reportedIds = ' + JSON.stringify(reported) + ';')
    .replace('const chosenId = undefined;', 'const chosenId = ' + JSON.stringify(chosen) + ';')
    .replace('const confirmedOneConnectedTab = false;', 'const confirmedOneConnectedTab = ' + JSON.stringify(confirmedOneConnectedTab) + ';');
  return new Function(script)();
}

test('single tab stays automatic when both scoped tools support route selection', () => {
  assert.equal(preflight(true, true, ['session-a'], undefined).sessionId, 'session-a');
});

test('multiple sessions fail closed without a routing selector or explicit choice', () => {
  assert.throws(() => preflight(false, false, ['session-a', 'session-b'], undefined), /no route selector/);
  assert.throws(() => preflight(true, true, ['session-a', 'session-b'], undefined), /Choose the intended/);
});

test('complete routing requires selector support in both scoped tools', () => {
  assert.throws(() => preflight(true, false, ['session-a', 'session-b'], undefined), /no route selector/);
  assert.throws(() => preflight(false, true, ['session-a', 'session-b'], undefined), /no route selector/);
});

test('a pinned session is retained; missing session never silently falls back to another', () => {
  assert.equal(preflight(true, true, ['session-a', 'session-b'], 'session-b').sessionId, 'session-b');
  assert.throws(() => preflight(true, true, ['session-a'], 'session-b'), /unavailable/);
  assert.throws(() => preflight(false, false, ['session-a'], 'session-a'), /unavailable/);
});

test('unknown supported inventory fails closed before choosing a route', () => {
  assert.throws(() => preflight(true, true, [], undefined), /No Penpot sessions are reported/);
});

test('a pinned supported route fails closed when disconnect leaves zero reported sessions', () => {
  assert.throws(() => preflight(true, true, [], 'session-a'), /No Penpot sessions are reported/);
});

test('legacy unknown inventory requires explicit one-connected-tab confirmation', () => {
  assert.throws(() => preflight(false, false, [], undefined), /explicitly confirm exactly one connected tab/);
  assert.equal(preflight(false, false, [], undefined, true).sessionId, undefined);
});
