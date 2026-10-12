import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const SKILLS = [
  'penpot-use', 'penpot-generate-design', 'penpot-design-system',
  'penpot-audit', 'penpot-design-to-code'
];

const isNonEmptyText = value => typeof value === 'string' && value.trim().length > 0;
const isFullCommitSha = value => typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);

export function validateEvidence(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['Evidence must be a JSON object.'];
  if (!isNonEmptyText(record.host)) errors.push('Host must be nonempty text.');
  if (!isFullCommitSha(record.commit)) errors.push('Commit must be a full 40-character SHA.');
  if (!isNonEmptyText(record.environment)) errors.push('Environment must be nonempty text.');
  for (const name of SKILLS) {
    const item = record.workflows?.[name];
    if (!item || typeof item !== 'object' || Array.isArray(item) || !['pass', 'fail', 'unverified'].includes(item.status)) {
      errors.push(name + ': status must be pass/fail/unverified');
      continue;
    }
    if (item.status === 'unverified') continue;
    if (!isNonEmptyText(item.scope) || !isNonEmptyText(item.steps) || !isNonEmptyText(item.notes)) {
      errors.push(name + ': scope, steps and notes must be nonempty text');
    }
    if (item.status === 'fail') continue;
    if (!isNonEmptyText(item.readBack) || !isNonEmptyText(item.visualEvidence)) {
      errors.push(name + ': pass needs nonempty read-back and visual evidence');
    }
    if (item.unrelatedPreserved !== true) errors.push(name + ': pass needs unrelatedPreserved=true');
    if ((name === 'penpot-audit' || name === 'penpot-design-to-code') && item.readOnlyUnchanged !== true) {
      errors.push(name + ': pass needs readOnlyUnchanged=true');
    }
    if (name === 'penpot-generate-design' && item.retryNoDuplicate !== true) {
      errors.push(name + ': pass needs retryNoDuplicate=true');
    }
    if (name === 'penpot-design-system' && item.bindingPreserved !== true) {
      errors.push(name + ': pass needs bindingPreserved=true');
    }
    if (name === 'penpot-design-to-code' && item.buildChecked !== true) {
      errors.push(name + ': pass needs buildChecked=true');
    }
  }
  return errors;
}

const normalizedRealPath = path => {
  const realPath = realpathSync.native(path);
  return process.platform === 'win32' ? realPath.toLowerCase() : realPath;
};

const isDirectExecution = () => {
  if (!process.argv[1]) return false;
  try {
    return normalizedRealPath(process.argv[1]) === normalizedRealPath(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isDirectExecution()) {
  try {
    const evidence = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const errors = validateEvidence(evidence);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('Evidence has the required fields. Claims must still be manually reviewed against the real design.');
  } catch { console.error('Provide a readable JSON evidence file.'); process.exitCode = 1; }
}
