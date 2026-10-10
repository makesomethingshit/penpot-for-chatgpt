import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const doc = await readFile(new URL('../plugin/skills/penpot-use/SKILL.md', import.meta.url), 'utf8');
const block = doc.split('### Session-routing decision preflight')[1]?.match(/```javascript\n([\s\S]*?)\n```/)?.[1];
assert.ok(block, 'host-side preflight must remain executable');
function preflight(supports, reported, chosen) {
  const script = block
    .replace('const supportsSessionId = false;', 'const supportsSessionId = ' + JSON.stringify(supports) + ';')
    .replace('const reportedIds = [];', 'const reportedIds = ' + JSON.stringify(reported) + ';')
    .replace('const chosenId = undefined;', 'const chosenId = ' + JSON.stringify(chosen) + ';');
  return new Function(script)();
}

test('single tab stays automatic when route selection is supported', () => {
  assert.equal(preflight(true, ['session-a'], undefined).sessionId, 'session-a');
  assert.equal(preflight(false, [], undefined).sessionId, undefined);
});

test('multiple sessions fail closed without a routing selector or explicit choice', () => {
  assert.throws(() => preflight(false, ['session-a', 'session-b'], undefined), /no route selector/);
  assert.throws(() => preflight(true, ['session-a', 'session-b'], undefined), /Choose the intended/);
});

test('a pinned session is retained; missing session never silently falls back to another', () => {
  assert.equal(preflight(true, ['session-a', 'session-b'], 'session-b').sessionId, 'session-b');
  assert.throws(() => preflight(true, ['session-a'], 'session-b'), /unavailable/);
  assert.throws(() => preflight(false, ['session-a'], 'session-a'), /unavailable/);
});
