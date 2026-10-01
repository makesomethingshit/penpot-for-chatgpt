import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const { name, version } = JSON.parse(await readFile('plugin/plugin.json', 'utf8'));
const filename = `${name}-${version ?? 'preview'}.tar.gz`;
await import('./check.mjs');
await mkdir('dist', { recursive: true });
const staging = await mkdtemp(resolve('dist/staging-'));
const files = ['.codex-plugin/plugin.json', '.mcp.json', 'mcp.json', 'plugin.json', 'README.md',
  'assets/icon.png', 'assets/icon-dark.png', 'server/bridge-source.mjs', 'server/bridge.mjs',
  'server/build-info.json', 'server/THIRD_PARTY_NOTICES.txt', 'server/connection.mjs',
  'scripts/penpot-setup.ps1', 'scripts/validate-connection.mjs',
  ...(await readdir('plugin/skills')).map(skill => `skills/${skill}/SKILL.md`)];
function tar(args) {
  const result = spawnSync('tar', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Archive operation failed: ${result.stderr}`);
  return result.stdout;
}
try {
  for (const file of files) {
    assert.ok((await lstat(join('plugin', file))).isFile(), `Package entry must be a regular file: ${file}`);
    const destination = join(staging, name, file);
    await mkdir(resolve(destination, '..'), { recursive: true });
    await cp(join('plugin', file), destination, { recursive: true });
  }
  const archive = resolve('dist', filename);
  tar(['-czf', archive, '-C', staging, name]);
  const listed = tar(['-tzf', archive]).trim().split(/\r?\n/).filter(path => !path.endsWith('/'));
  assert.deepEqual(listed.sort(), files.map(file => `${name}/${file}`).sort());
  const readback = join(staging, 'readback');
  await mkdir(readback);
  tar(['-xzf', archive, '-C', readback]);
  for (const file of files) {
    assert.deepEqual(await readFile(join(readback, name, file)), await readFile(join('plugin', file)),
      `Packaged content changed: ${file}`);
  }
  const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile('dist/SHA256SUMS', `${digest}  ${filename}\n`);
  console.log(archive);
  console.log(`Verified ${files.length} packaged files; SHA-256: ${digest}`);
} finally { await rm(staging, { recursive: true, force: true }); }
