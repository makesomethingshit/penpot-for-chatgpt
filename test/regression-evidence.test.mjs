import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKILLS, validateEvidence } from '../scripts/regression-evidence.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/regression-evidence.mjs', import.meta.url));
const COMMIT = 'a'.repeat(40);

const fixture = () => ({
  host: 'ChatGPT desktop', commit: COMMIT, environment: 'disposable fixture',
  workflows: Object.fromEntries(SKILLS.map(name => [name, { status: 'unverified' }]))
});

test('draft evidence stays explicitly unverified without pretending all five skills passed', () => {
  const f = fixture();
  f.workflows['penpot-use'] = { status: 'unverified', scope: [], steps: true, notes: {} };
  assert.deepEqual(validateEvidence(f), []);
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

test('required metadata and claimed evidence reject non-text and whitespace values', () => {
  for (const field of ['host', 'environment']) {
    for (const value of [[], true, {}, ' \t']) {
      const f = fixture();
      f[field] = value;
      assert.ok(validateEvidence(f).some(error => error.toLowerCase().includes(field)), `${field}: ${String(value)}`);
    }
  }

  for (const value of [[], true, {}, 'synthetic-sha', ' '.repeat(40)]) {
    const f = fixture();
    f.commit = value;
    assert.ok(validateEvidence(f).some(error => error.includes('full 40-character SHA')), String(value));
  }

  const evidence = {
    status: 'pass', scope: 'board', steps: 'edited text', notes: 'synthetic',
    readBack: 'stable id verified', visualEvidence: 'export inspected', unrelatedPreserved: true
  };
  for (const field of ['scope', 'steps', 'notes', 'readBack', 'visualEvidence']) {
    for (const value of [[], true, {}, ' \t']) {
      const f = fixture();
      f.workflows['penpot-use'] = { ...evidence, [field]: value };
      assert.ok(validateEvidence(f).length, `${field}: ${String(value)}`);
    }
  }
});

test('CLI accepts a valid evidence file beside a script path containing spaces and #', () => {
  const directory = mkdtempSync(join(tmpdir(), 'regression evidence #'));
  try {
    const script = join(directory, 'regression-evidence.mjs');
    const evidencePath = join(directory, 'evidence record.json');
    copyFileSync(SCRIPT, script);
    writeFileSync(evidencePath, JSON.stringify(fixture()));
    const result = execFileSync(process.execPath, [script, evidencePath], { encoding: 'utf8' });
    assert.match(result, /Evidence has the required fields/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI exits nonzero for invalid evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'regression evidence #'));
  try {
    const evidencePath = join(directory, 'invalid evidence.json');
    writeFileSync(evidencePath, JSON.stringify({ ...fixture(), host: ' ' }));
    const result = spawnSync(process.execPath, [SCRIPT, evidencePath], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Host must be nonempty text/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI exits nonzero for invalid evidence through a real symlink', t => {
  const directory = mkdtempSync(join(tmpdir(), 'regression evidence #'));
  try {
    const link = join(directory, 'regression-evidence-link.mjs');
    const evidencePath = join(directory, 'invalid evidence.json');
    try {
      symlinkSync(SCRIPT, link, 'file');
    } catch (error) {
      if (process.platform === 'win32' && error?.code === 'EPERM') {
        t.skip('Windows symbolic links are not permitted in this environment');
        return;
      }
      throw error;
    }
    writeFileSync(evidencePath, JSON.stringify({ ...fixture(), host: ' ' }));
    const result = spawnSync(process.execPath, [link, evidencePath], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Host must be nonempty text/);

    writeFileSync(evidencePath, JSON.stringify(fixture()));
    const validResult = spawnSync(process.execPath, [link, evidencePath], { encoding: 'utf8' });
    assert.equal(validResult.status, 0);
    assert.match(validResult.stdout, /Evidence has the required fields/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
