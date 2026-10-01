import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const { name, version } = JSON.parse(await readFile('plugin/plugin.json', 'utf8'));
await import('./check.mjs');
await mkdir('dist', { recursive: true });
const staging = await mkdtemp(resolve('dist/staging-'));
const files = ['.codex-plugin', '.mcp.json', 'mcp.json', 'plugin.json', 'README.md',
  'assets', 'skills', 'server', 'scripts/penpot-setup.ps1'];
try {
  for (const file of files) {
    const destination = join(staging, name, file);
    await mkdir(resolve(destination, '..'), { recursive: true });
    await cp(join('plugin', file), destination, { recursive: true });
  }
  const archive = resolve(`dist/${name}-${version}.tar.gz`);
  const result = spawnSync('tar', ['-czf', archive, '-C', staging, name], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Archive creation failed. Install tar or package this directory manually.');
  console.log(archive);
} finally { await rm(staging, { recursive: true, force: true }); }
