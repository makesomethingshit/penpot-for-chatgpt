import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILLS, validateEvidence } from '../scripts/regression-evidence.mjs';

const fixture = () => ({
  host: 'ChatGPT desktop', commit: 'synthetic-sha', environment: 'disposable fixture',
  workflows: Object.fromEntries(SKILLS.map(name => [name, { status: 'unverified' }]))
});

test('draft evidence stays explicitly unverified without pretending all five skills passed', () => {
  assert.deepEqual(validateEvidence(fixture()), []);
});

test('a pass needs read-back, visual evidence and preservation, not just a checkbox', () => {
  const f = fixture();
  f.workflows['penpot-use'] = { status: 'pass', scope: 'board', steps: 'edited text', notes: 'synthetic' };
  assert.ok(validateEvidence(f).some(e => e.includes('read-back')));
  f.workflows['penpot-use'] = {
    ...f.workflows['penpot-use'], readBack: 'stable id verified', visualEvidence: 'export inspected',
    unrelatedPreserved: true
  };
  assert.deepEqual(validateEvidence(f), []);
});

test('read-only, component/token, retry and build claims require specific evidence', () => {
  for (const name of SKILLS.filter(n => n !== 'penpot-use')) {
    const f = fixture();
    f.workflows[name] = {
      status: 'pass', scope: 'synthetic', steps: 'synthetic', notes: 'synthetic',
      readBack: 'test', visualEvidence: 'test', unrelatedPreserved: true
    };
    assert.ok(validateEvidence(f).length, name);
  }
});

test('failed case must include steps and notes; missing skills cannot be declared complete', () => {
  const f = fixture();
  delete f.workflows['penpot-audit'];
  f.workflows['penpot-use'] = { status: 'fail' };
  assert.ok(validateEvidence(f).length >= 2);
});
