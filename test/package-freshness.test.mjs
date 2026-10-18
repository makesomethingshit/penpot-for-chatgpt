import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('package entrypoint rebuilds a stale bridge before archiving', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'penpot-package-'));
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: fixture, encoding: 'utf8', windowsHide: true, timeout: 120_000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  try {
    for (const path of ['scripts', 'plugin', 'package.json', 'package-lock.json', 'LICENSE', '.agents']) {
      await cp(resolve(path), join(fixture, path), { recursive: true });
    }
    await symlink(resolve('node_modules'), join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const bridge = join(fixture, 'plugin/server/bridge.mjs');
    run(process.execPath, ['scripts/build.mjs']);
    const expected = await readFile(bridge);
    const stale = Buffer.concat([expected, Buffer.from('\n// stale package regression fixture\n')]);
    await writeFile(bridge, stale);
    // Call package directly: a preceding build would hide the original regression.
    run(process.execPath, ['scripts/package.mjs']);
    assert.deepEqual(await readFile(bridge), expected, 'package did not restore the fresh generated bridge');
    const { name, version } = JSON.parse(await readFile(join(fixture, 'plugin/plugin.json'), 'utf8'));
    run('tar', ['-xzf', `dist/${name}-${version}.tar.gz`, '-C', 'dist']);
    assert.deepEqual(await readFile(join(fixture, 'dist', name, 'server/bridge.mjs')), expected,
      'archive contains stale bridge bytes');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

