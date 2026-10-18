import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
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
    ['package.json', value => { delete value.dependencies['eventsource-parser']; }],
    ['package-lock.json', value => { delete value.packages[''].dependencies['eventsource-parser']; }],
    ['package-lock.json', value => { value.packages[''].dependencies['eventsource-parser'] = '^3.1.1'; }],
    ['.agents/plugins/marketplace.json', value => { value.plugins[0].source.source = 'remote'; }],
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
  const releasePaths = ['package.json', 'package-lock.json', 'plugin/plugin.json', 'plugin/.codex-plugin/plugin.json'];
  const releaseBefore = await Promise.all(releasePaths.map(path => readFile(join(directory, path), 'utf8')));
  const releaseFields = [[0, 'version'], [1, 'version'], [1, 'packages', '', 'version'], [2, 'version'], [3, 'version']];
  async function releaseFixture(fields, version) {
    const values = releaseBefore.map(text => JSON.parse(text));
    for (const [index, ...keys] of fields) {
      const owner = keys.slice(0, -1).reduce((value, key) => value[key], values[index]);
      owner[keys.at(-1)] = version;
    }
    for (const [index, path] of releasePaths.entries()) {
      await writeFile(join(directory, path), JSON.stringify(values[index]));
    }
  }
  try {
    for (const version of ['1.2.3', '1.2.3-rc.2+build.01']) {
      await releaseFixture(releaseFields, version);
      await check();
    }
    // Synchronize every copy so invalid versions reach SemVer validation.
    for (const version of ['1.2.3-rc.01', '1.2.3+build..1', '1.2.3\n']) {
      await releaseFixture(releaseFields, version);
      await assert.rejects(check(), error => error.code === 1 && /must be valid SemVer/.test(error.stderr));
    }
    for (const field of releaseFields) {
      await releaseFixture([field], '9.9.9');
      await assert.rejects(check(), error => error.code === 1);
    }
  } finally {
    for (const [index, path] of releasePaths.entries()) {
      await writeFile(join(directory, path), releaseBefore[index]);
    }
  }
  const iconPath = join(directory, 'plugin/assets/icon.png');
  const iconBefore = await readFile(iconPath);
  const invalidIcon = Buffer.alloc(24);
  invalidIcon.write('PNG', 1);
  invalidIcon.writeUInt32BE(48, 16);
  invalidIcon.writeUInt32BE(48, 20);
  await writeFile(iconPath, invalidIcon);
  await assert.rejects(check(), error => error.code === 1);
  await writeFile(iconPath, iconBefore);
  for (const corrupt of [
    icon => { icon[0] = 0; },
    icon => { icon.writeUInt32BE(12, 8); },
    icon => { icon.write('BAD!', 12); },
    icon => { icon[icon.length - 1] = 0; }
  ]) {
    const icon = Buffer.from(iconBefore);
    corrupt(icon);
    await writeFile(iconPath, icon);
    await assert.rejects(check(), error => error.code === 1);
  }
  await writeFile(iconPath, iconBefore);

  // A junction also exercises real-path containment on Windows without symlink privileges.
  const skillsPath = join(directory, 'plugin/skills');
  const outsideSkills = join(directory, 'outside-skills');
  await rename(skillsPath, outsideSkills);
  await symlink(outsideSkills, skillsPath, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(check(), error => error.code === 1);
});
