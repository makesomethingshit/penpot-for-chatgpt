import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('package check rejects invalid external-schema and host metadata fixtures', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'penpot-manifest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp('plugin', join(directory, 'plugin'), { recursive: true });
  await mkdir(join(directory, '.agents/plugins'), { recursive: true });
  for (const path of ['package.json', 'package-lock.json', '.agents/plugins/marketplace.json']) {
    await cp(path, join(directory, path));
  }
  const check = () => promisify(execFile)(process.execPath, [resolve('scripts/check.mjs')], { cwd: directory, windowsHide: true });
  await check();
  const portablePath = join(directory, 'plugin/plugin.json');
  const overlayPath = join(directory, 'plugin/.codex-plugin/plugin.json');
  const portableBefore = await readFile(portablePath, 'utf8');
  const overlayBefore = await readFile(overlayPath, 'utf8');
  for (const path of [portablePath, overlayPath]) {
    const value = JSON.parse(await readFile(path, 'utf8'));
    delete (value.interface ?? value.extensions['com.openai'].interface).defaultPrompt;
    await writeFile(path, JSON.stringify(value));
  }
  await check(); // The upstream field is optional.
  await writeFile(portablePath, portableBefore);
  await writeFile(overlayPath, overlayBefore);
  for (const [path, mutate] of [
    ...['displayName', 'developerName', 'category'].map(field => ['plugin/plugin.json', value => { delete value.extensions['com.openai'].interface[field]; }]),
    ['plugin/plugin.json', value => { value.extensions['com.openai'].interface.brandColor = 'bad'; }],
    ['plugin/plugin.json', value => { value.extensions['com.openai'].interface.logo = 'assets/icon.png'; }],
    ['plugin/plugin.json', value => { value.extensions['com.openai'].interface.defaultPrompt = ['same', 'same']; }],
    ['plugin/plugin.json', value => { value.name = 'Bad Name'; }],
    ['plugin/plugin.json', value => { value.unsupported = true; }],
    ['plugin/mcp.json', value => { delete value.mcpServers.penpot.command; }],
    ['plugin/mcp.json', value => { value.mcpServers.penpot.cwd = '../outside'; }],
    ['plugin/.codex-plugin/plugin.json', value => { value.skills = '../outside'; }],
    ['plugin/plugin.json', value => { value.extensions['com.openai'].interface.defaultPrompt = ['x'.repeat(129)]; }],
    ['plugin/plugin.json', value => { value.extensions['com.openai'].interface.capabilities = [123]; }],
    ['plugin/plugin.json', value => { value.extensions['com.openai'].interface.logo = '../outside.png'; }]
  ]) {
    const fullPath = join(directory, path);
    const before = await readFile(fullPath, 'utf8');
    const fixture = JSON.parse(before);
    mutate(fixture);
    await writeFile(fullPath, JSON.stringify(fixture));
    // Keep overlays synchronized so presentation failures exercise their validation, not equality alone.
    const overlayPath = join(directory, 'plugin/.codex-plugin/plugin.json');
    const overlayBefore = await readFile(overlayPath, 'utf8');
    if (path === 'plugin/plugin.json' && fixture.extensions?.['com.openai']?.interface) {
      const overlay = JSON.parse(overlayBefore);
      overlay.interface = fixture.extensions['com.openai'].interface;
      await writeFile(overlayPath, JSON.stringify(overlay));
    }
    await assert.rejects(check(), error => error.code === 1);
    await writeFile(fullPath, before);
    if (path !== 'plugin/.codex-plugin/plugin.json') await writeFile(overlayPath, overlayBefore);
  }
});
