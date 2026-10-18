import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const { name, version } = JSON.parse(await readFile('plugin/plugin.json', 'utf8'));
const filename = `${name}-${version ?? 'preview'}.tar.gz`;
// Rebuild before validating or archiving so local packaging cannot ship a stale bridge.
await import('./build.mjs');
await import('./check.mjs');
await mkdir('dist', { recursive: true });
const staging = await mkdtemp(resolve('dist/staging-'));
const files = ['.codex-plugin/plugin.json', '.mcp.json', 'mcp.json', 'plugin.json', 'README.md', 'LICENSE',
  'assets/icon.png', 'assets/icon-dark.png', 'server/bridge-source.mjs', 'server/header-deadline.mjs', 'server/bridge.mjs',
  'server/build-info.json', 'server/THIRD_PARTY_NOTICES.txt', 'server/connection.mjs',
  'scripts/penpot-setup.ps1', 'scripts/penpot-setup.mjs', 'scripts/validate-connection.mjs', 'scripts/penpot-doctor.mjs', 'scripts/penpot-account.mjs',
  ...(await readdir('plugin/skills')).map(skill => `skills/${skill}/SKILL.md`),
  'skills/penpot-design-system/references/build-from-code.md'];
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
  const guide = spawnSync(process.execPath, ['scripts/penpot-account.mjs', 'connect'], {
    cwd: join(readback, name), encoding: 'utf8', windowsHide: true
  });
  assert.ifError(guide.error);
  assert.equal(guide.status, 0, guide.stderr);
  assert.match(guide.stdout, /Remote MCP authentication\/tool discovery: NOT CHECKED/);
  assert.match(guide.stdout, /Active Penpot design file\/tab: NOT CHECKED/);
  const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile('dist/SHA256SUMS', `${digest}  ${filename}\n`);
  console.log(archive);
  console.log(`Verified ${files.length} packaged files; SHA-256: ${digest}`);
} finally { await rm(staging, { recursive: true, force: true }); }
