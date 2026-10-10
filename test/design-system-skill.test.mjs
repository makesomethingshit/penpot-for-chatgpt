import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const text = await readFile(new URL('../plugin/skills/penpot-design-system/references/build-from-code.md', import.meta.url), 'utf8');
const examples = [...text.matchAll(/```javascript\n([\s\S]*?)\n```/g)].map(match => match[1]);
const inventory = new Function('penpot', 'storage', examples[0]);
const detail = new Function('penpot', 'storage', examples[1]);
const create = new Function('penpot', 'storage', examples[2]);
const sets = Array.from({ length: 100 }, (_, i) => {
  const set = { id: 'set-' + i, name: 'Tokens ' + i, active: true,
    tokens: Array.from({ length: 100 }, (_, j) => ({
      id: `token-${i}-${j}`, name: `token.${i}.${j}`, type: 'spacing',
      value: `${j}px`, resolvedValueString: `${j}px`
    })) };
  set.addToken = input => {
    const token = { ...input, id: 'created-' + set.tokens.length };
    set.tokens.push(token);
    return token;
  };
  return set;
});
const library = { id: 'lib', tokens: { sets, getSetById: id => sets.find(s => s.id === id) ?? null },
  components: Array.from({ length: 500 }, (_, i) => ({ id: 'component-' + i, name: 'Component ' + i, path: '/' })) };
const penpot = { currentFile: { id: 'file' }, currentPage: { id: 'page' }, library: { local: library } };
const storage = () => ({ penpotTask: { fileId: 'file', pageId: 'page', targetIds: [] } });

test('initial catalog inspection is bounded even with many tokens and components', () => {
  const before = sets[0].tokens.length;
  const s = storage();
  const response = inventory(penpot, s);
  assert.equal(response.sets.length, 20);
  assert.equal(response.setTotal, 100);
  assert.equal(response.nextSetOffset, 20);
  assert.equal(response.components.length, 50);
  assert.equal(response.componentTotal, 500);
  assert.equal(response.nextComponentOffset, 50);
  assert.ok(response.sets.every(x => !Object.hasOwn(x, 'tokens') && x.tokenCount === 100));
  assert.ok(Buffer.byteLength(JSON.stringify(response)) < 12000);
  assert.equal(sets[0].tokens.length, before);
});

test('catalog inventory and targeted read fail closed after file/page switch', () => {
  for (const context of [
    { ...penpot, currentFile: { id: 'other' } },
    { ...penpot, currentPage: { id: 'other' } }
  ]) {
    assert.throws(() => inventory(context, storage()), /context changed/);
    assert.throws(() => detail(context, storage()), /context changed/);
  }
  assert.throws(() => inventory(penpot, {}), /context changed/);
});

test('targeted set reads are bounded and preserve raw and resolved token values', () => {
  const selected = new Function('penpot', 'storage',
    examples[1].replace('REPLACE_WITH_EXISTING_SET_ID', 'set-4'));
  const response = selected(penpot, storage());
  assert.equal(response.setId, 'set-4');
  assert.equal(response.tokens.length, 50);
  assert.equal(response.total, 100);
  assert.equal(response.nextOffset, 50);
  assert.equal(response.tokens[0].value, '0px');
  assert.equal(response.tokens[0].resolved, '0px');
});

test('token plan is task-local, idempotent for retry and unavailable in later task', () => {
  const s = storage();
  s.penpotTask.tokenPlan = { setId: 'set-99', tokens: [
    { name: 'new.task.token', type: 'spacing', value: '12px' }
  ] };
  const before = sets[99].tokens.length;
  const first = create(penpot, s);
  const second = create(penpot, s);
  assert.equal(first.tokens[0].id, second.tokens[0].id);
  assert.equal(sets[99].tokens.length, before + 1);
  delete s.penpotTask;
  s.penpotTask = { fileId: 'file', pageId: 'page', targetIds: [] };
  assert.throws(() => create(penpot, s), /Resolve the destination set/);
  s.penpotTokenPlan = { setId: 'set-99', tokens: [{ name: 'legacy', type: 'spacing', value: '4px' }] };
  assert.throws(() => create(penpot, s), /Resolve the destination set/);
  assert.equal(sets[99].tokens.some(t => t.name === 'legacy'), false);
});
