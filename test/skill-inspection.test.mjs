import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const text = await readFile(new URL('../plugin/skills/penpot-use/SKILL.md', import.meta.url), 'utf8');
const examples = [...text.replaceAll('\r\n', '\n').matchAll(/```javascript\n([\s\S]*?)\n```/g)].map(match => match[1]);
const inspect = new Function('penpot', 'penpotUtils', 'storage', examples[0]);
const guard = new Function('penpot', 'penpotUtils', 'storage', examples[1]);
const boards = Array.from({ length: 100 }, (_, i) => ({ id: `board-${i}`, name: `Board ${i}`, type: 'board',
  children: Array.from({ length: 20 }, (_, j) => ({ id: `text-${i}-${j}`, name: `Text ${j}`, type: 'text' })) }));
const root = { id: 'root', name: 'root', type: 'board', children: boards };
const penpot = { currentFile: { id: 'file', name: 'Fixture' }, currentPage: { id: 'page', name: 'Page', root }, selection: [boards[3]] };
// Fixture implementation of the documented API, not a production traversal helper.
const utils = {
  findShape(predicate, shape) { return [shape, ...(shape.children ?? [])].find(predicate) ?? null; },
  shapeStructure(shape, depth) {
    return { id: shape.id, name: shape.name, type: shape.type,
      ...(depth && shape.children ? { children: shape.children.map(child => utils.shapeStructure(child, depth - 1)) } : {}) };
  }
};

test('initial selection inspection excludes unrelated board descendants and reduces payload', () => {
  const storage = {};
  const result = inspect(penpot, utils, storage);
  assert.deepEqual(storage.penpotTask.targetIds, ['board-3']);
  assert.equal(result.structure.length, 1);
  assert.equal(result.structure[0].id, 'board-3');
  assert.equal(JSON.stringify(result).includes('text-4-'), false);
  const previous = { file: result.file, page: result.page, selection: result.selection,
    structure: utils.shapeStructure(root, 2) };
  const before = Buffer.byteLength(JSON.stringify(previous));
  const after = Buffer.byteLength(JSON.stringify(result));
  assert.ok(after < before / 10);
  console.log(`100 sibling boards x 20 texts: initial JSON ${before} -> ${after} bytes`);
  assert.throws(() => inspect({ ...penpot, selection: [boards[4]] }, utils, storage), /already pinned/);
  assert.deepEqual(storage.penpotTask.targetIds, ['board-3']);
  assert.deepEqual(guard(penpot, utils, storage), undefined);
  assert.throws(() => guard({ ...penpot, currentPage: { id: 'other', root } }, utils, storage), /context changed/);
  assert.throws(() => guard(penpot, { ...utils, findShape: () => null }, storage), /target is missing/);
});

test('explicit IDs override selection; unresolved targets fail before pinning', () => {
  const explicit = new Function('penpot', 'penpotUtils', 'storage', examples[0].replace('const requestedIds = [];', 'const requestedIds = ["board-8"];'));
  const storage = {};
  assert.equal(explicit(penpot, utils, storage).structure[0].id, 'board-8');
  assert.deepEqual(storage.penpotTask.targetIds, ['board-8']);
  const missingStorage = {};
  assert.throws(() => explicit(penpot, { ...utils, findShape: () => null }, missingStorage), /requested target is missing/);
  assert.equal(missingStorage.penpotTask, undefined);
});

test('no selection returns shallow paged inventory without recursive inspection or mutation targets', () => {
  const before = JSON.stringify(root);
  const storage = {};
  const result = inspect({ ...penpot, selection: [] }, { ...utils, shapeStructure: () => { throw new Error('unexpected traversal'); } }, storage);
  assert.deepEqual(result.structure, []);
  assert.equal(result.inventory.items.length, 50);
  assert.equal(result.inventory.total, 100);
  assert.equal(result.inventory.nextOffset, 50);
  assert.ok(result.inventory.items.every(item => !Object.hasOwn(item, 'children')));
  assert.deepEqual(storage.penpotTask.targetIds, []);
  assert.throws(() => guard(penpot, utils, storage), /No mutation targets/);
  assert.equal(JSON.stringify(root), before);
});
