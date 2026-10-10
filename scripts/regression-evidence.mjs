import { readFile } from 'node:fs/promises';

export const SKILLS = [
  'penpot-use', 'penpot-generate-design', 'penpot-design-system',
  'penpot-audit', 'penpot-design-to-code'
];

export function validateEvidence(record) {
  const errors = [];
  if (!record || typeof record !== 'object') return ['Evidence must be a JSON object.'];
  if (!record.host || !record.commit || !record.environment) errors.push('Host, commit and environment are required.');
  for (const name of SKILLS) {
    const item = record.workflows?.[name];
    if (!item || !['pass', 'fail', 'unverified'].includes(item.status)) {
      errors.push(name + ': status must be pass/fail/unverified');
      continue;
    }
    if (item.status === 'unverified') continue;
    if (!item.scope || !item.steps || !item.notes) errors.push(name + ': scope, steps and notes required');
    if (item.status === 'fail') continue;
    if (!item.readBack || !item.visualEvidence) errors.push(name + ': pass needs read-back and visual evidence');
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

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1].replaceAll('\\', '/')).href) {
  try {
    const evidence = JSON.parse(await readFile(process.argv[2], 'utf8'));
    const errors = validateEvidence(evidence);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('Evidence has the required fields. Claims must still be manually reviewed against the real design.');
  } catch { console.error('Provide a readable JSON evidence file.'); process.exitCode = 1; }
}
