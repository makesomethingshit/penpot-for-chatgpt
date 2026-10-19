import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const secret = 'synthetic-connection-onboarding-token';
const url = 'https://design.penpot.app/mcp/stream?userToken=' + secret;
const program = resolve('plugin/scripts/penpot-account.mjs');
async function sandbox(t) {
  const home = await mkdtemp(join(tmpdir(), 'account-workflow-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const folder = join(home, '.penpot-for-chatgpt');
  await mkdir(folder, { mode: 0o700 });
  if (process.platform !== 'win32') await chmod(folder, 0o700);
  return { home, folder, file: join(folder, 'connection.json') };
}
async function invoke(home, action, input = '', overrides = {}) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, ...overrides };
  if (overrides.PENPOT_MCP_URL === undefined) delete env.PENPOT_MCP_URL;
  const child = spawn(process.execPath, [program, action], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const done = new Promise((resolveResult, reject) => {
    child.once('error', reject);
    child.once('close', code => resolveResult({ code, stdout, stderr }));
  });
  child.stdin.end(input);
  return done;
}
test('connection guide uses existing secure setup, no secrets', async t => {
  const { home } = await sandbox(t);
  const x = await invoke(home, 'connect');
  assert.equal(x.code, 0);
  assert.match(x.stdout, /official MCP URL/);
  assert.match(x.stdout, /not an OAuth sign-in/);
  assert.match(x.stdout, /read-only execute_code/);
  assert.match(x.stdout, /In the installed plugin directory run: node scripts\/penpot-account\.mjs status/);
  assert.ok(!x.stdout.includes(secret));
});
test('connection guide treats no-instance error as ambiguous (tab or stale key)', async t => {
  const { home } = await sandbox(t);
  const x = await invoke(home, 'connect');
  assert.equal(x.code, 0);
  assert.match(x.stdout, /read-only execute_code probe/);
  assert.match(x.stdout, /No Penpot instance connected/);
  assert.match(x.stdout, /reconnect the intended file/);
  assert.match(x.stdout, /stale/);
  assert.ok(!x.stdout.includes(secret));
});
test('connection guide warns when an environment override takes precedence', async t => {
  const { home } = await sandbox(t);
  const x = await invoke(home, 'connect', '', { PENPOT_MCP_URL: url });
  assert.equal(x.code, 0);
  assert.match(x.stdout, /PENPOT_MCP_URL is set and will take precedence/);
  assert.ok(!x.stdout.includes(secret));
});
test('empty environment override remains higher priority than saved credentials', async t => {
  const { home } = await sandbox(t);
  const guide = await invoke(home, 'connect', '', { PENPOT_MCP_URL: '' });
  assert.equal(guide.code, 0);
  assert.match(guide.stdout, /PENPOT_MCP_URL is set and will take precedence/);
  const status = await invoke(home, 'status', '', { PENPOT_MCP_URL: '' });
  assert.equal(status.code, 1);
  assert.match(status.stdout, /Invalid Penpot MCP URL/);
  const removed = await invoke(home, 'disconnect', '', { PENPOT_MCP_URL: '' });
  assert.equal(removed.code, 0);
  assert.match(removed.stdout, /Environment override still exists/);
});
test('printed read-only example parses and runs after the routing and documentation prerequisites', async t => {
  const { home } = await sandbox(t);
  for (const action of ['connect', 'status']) {
    const result = await invoke(home, action, '', { PENPOT_MCP_URL: url });
    assert.equal(result.code, 0);
    const match = result.stdout.match(/```javascript\r?\n([\s\S]*?)\r?\n```/);
    assert.ok(match, 'CLI must print a JavaScript example');
    const prerequisites = result.stdout.slice(0, match.index);
    assert.match(prerequisites, /official Penpot MCP tools/);
    assert.match(prerequisites, /exactly one intended tab/);
    assert.match(prerequisites, /high_level_overview once per session/);
    assert.match(prerequisites, /penpot_api_info/);
    const run = new Function('penpot', match[1]);
    const penpot = Object.freeze({
      currentFile: Object.freeze({ id: 'file-1', name: 'Design' }),
      currentPage: Object.freeze({ id: 'page-1', name: 'Board' })
    });
    assert.deepEqual(run(penpot), { file: { id: 'file-1', name: 'Design' }, page: { id: 'page-1', name: 'Board' } });
    for (const missing of [{}, { currentFile: penpot.currentFile }, { currentPage: penpot.currentPage }]) {
      assert.throws(() => run(missing), /Open the intended Penpot file and connect MCP/);
    }
  }
});
test('status separates local credential from unverified remote and active tab', async t => {
  const { home, file } = await sandbox(t);
  if (process.platform !== 'win32') {
    await writeFile(file, JSON.stringify({ url }), { mode: 0o600 });
    const saved = await invoke(home, 'status');
    assert.equal(saved.code, 0);
    assert.match(saved.stdout, /Local credential: VALID \(private user file\)/);
  }
  const good = await invoke(home, 'status', '', { PENPOT_MCP_URL: url });
  assert.equal(good.code, 0);
  assert.match(good.stdout, /VALID \(environment override\)/);
  assert.match(good.stdout, /MCP authentication\/tool discovery: NOT CHECKED/);
  assert.match(good.stdout, /Active Penpot design file\/tab: NOT CHECKED/);
  assert.ok(!good.stdout.includes(secret));
  const bad = await invoke(home, 'status', '', { PENPOT_MCP_URL: 'https://invalid.example/?key=' + secret });
  assert.equal(bad.code, 1);
  assert.match(bad.stdout, /Invalid Penpot MCP URL/);
  assert.ok(!bad.stdout.includes(secret) && !bad.stderr.includes(secret));
});
test('disconnect requires exact confirmation, preserves refusal and removes only user local file', async t => {
  const { home, file } = await sandbox(t);
  const original = process.platform === 'win32' ? '{"dpapi":"synthetic"}' : JSON.stringify({ url });
  await writeFile(file, original, { mode: 0o600 });
  for (const input of ['CANCEL\n', ' DISCONNECT \n', '\n']) {
    const refused = await invoke(home, 'disconnect', input);
    assert.equal(refused.code, 0);
    assert.match(refused.stdout, /Cancelled/);
    assert.equal(await readFile(file, 'utf8'), original);
  }
  const removed = await invoke(home, 'disconnect', 'DISCONNECT\n');
  assert.equal(removed.code, 0);
  await assert.rejects(readFile(file, 'utf8'), { code: 'ENOENT' });
  assert.match(removed.stdout, /remote token separately/);
  assert.match(removed.stdout, /final check and deletion are not atomic/);
  assert.ok(!removed.stdout.includes(secret));
  const nofile = await invoke(home, 'disconnect', 'DISCONNECT\n');
  assert.equal(nofile.code, 0);
  assert.match(nofile.stdout, /No saved local connection/);
});
test('status reports missing and damaged credentials without changing or exposing them', async t => {
  const { home, file } = await sandbox(t);
  const missing = await invoke(home, 'status');
  assert.equal(missing.code, 1);
  assert.match(missing.stdout, /connection is missing/);
  const damaged = '{' + secret;
  await writeFile(file, damaged, { mode: 0o600 });
  const result = await invoke(home, 'status');
  assert.equal(result.code, 1);
  assert.match(result.stdout, /file is damaged/);
  assert.equal(await readFile(file, 'utf8'), damaged);
  assert.ok(!(result.stdout + result.stderr).includes(secret));
});

test('disconnect preserves the credential when confirmation input ends', { timeout: 10000 }, async t => {
  const { home, file } = await sandbox(t);
  await writeFile(file, secret, { mode: 0o600 });
  const result = await invoke(home, 'disconnect');
  assert.notEqual(result.code, 0);
  assert.equal(await readFile(file, 'utf8'), secret);
  assert.ok(!(result.stdout + result.stderr).includes(secret));
});

test('disconnect rejects symlink file and preserves its target', { skip: process.platform === 'win32' }, async t => {
  const { home, file } = await sandbox(t);
  const outside = join(home, 'outside.json');
  await writeFile(outside, JSON.stringify({ url }), { mode: 0o600 });
  await symlink(outside, file);
  const rejected = await invoke(home, 'disconnect', 'DISCONNECT\n');
  assert.equal(rejected.code, 1);
  assert.equal((await lstat(file)).isSymbolicLink(), true);
  assert.equal(await readFile(outside, 'utf8'), JSON.stringify({ url }));
  assert.ok(!rejected.stderr.includes(secret));
});
test('disconnect refuses group-readable files', { skip: process.platform === 'win32' }, async t => {
  const { home, file } = await sandbox(t);
  await writeFile(file, JSON.stringify({ url }), { mode: 0o644 });
  const rejected = await invoke(home, 'disconnect', 'DISCONNECT\n');
  assert.equal(rejected.code, 1);
  assert.equal(await readFile(file, 'utf8'), JSON.stringify({ url }));
});
test('explicit environment override remains after local removal and is not falsely revoked', async t => {
  const { home, file } = await sandbox(t);
  await writeFile(file, process.platform === 'win32' ? '{"dpapi":"test"}' : JSON.stringify({ url }), { mode: 0o600 });
  const x = await invoke(home, 'disconnect', 'DISCONNECT\n', { PENPOT_MCP_URL: url });
  assert.equal(x.code, 0);
  assert.match(x.stdout, /Environment override still exists/);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
  assert.ok(!x.stdout.includes(secret));
});
test('disconnect without a saved file still warns about an environment override', async t => {
  const { home } = await sandbox(t);
  const x = await invoke(home, 'disconnect', 'DISCONNECT\n', { PENPOT_MCP_URL: url });
  assert.equal(x.code, 0);
  assert.match(x.stdout, /No saved local connection/);
  assert.match(x.stdout, /Environment override still exists/);
  assert.ok(!x.stdout.includes(secret));
});


for (const change of ['replace', 'rewrite', 'directory']) {
  test('disconnect preserves credential after ' + change + ' while awaiting confirmation', { timeout: 10000 }, async t => {
    const { home, file } = await sandbox(t);
    const original = '{"dpapi":"original"}';
    const replacement = '{"dpapi":"replacement"}';
    await writeFile(file, original, { mode: 0o600 });
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    delete env.PENPOT_MCP_URL;
    const child = spawn(process.execPath, [program, 'disconnect'], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    t.after(() => child.kill());
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.on('data', data => { stderr += data; });
    const done = new Promise((resolveResult, reject) => {
      child.once('error', reject);
      child.once('close', code => resolveResult(code));
    });
    for await (const chunk of child.stdout) {
      stdout += chunk;
      if (!stdout.includes('Confirm: ')) continue;
      if (change === 'directory') {
        await rename(join(home, '.penpot-for-chatgpt'), join(home, 'original-directory'));
        await mkdir(join(home, '.penpot-for-chatgpt'), { mode: 0o700 });
      } else if (change === 'replace') {
        await rename(file, file + '.original');
      }
      await writeFile(file, replacement, { mode: 0o600 });
      child.stdin.end('DISCONNECT\n');
      break;
    }
    assert.equal(await done, 1);
    assert.match(stdout, /Confirm: /);
    assert.match(stderr, /Connection operation stopped/);
    assert.equal(await readFile(file, 'utf8'), replacement);
    if (change === 'replace') assert.equal(await readFile(file + '.original', 'utf8'), original);
    if (change === 'directory') {
      assert.equal(await readFile(join(home, 'original-directory', 'connection.json'), 'utf8'), original);
    }
  });
}

test('Windows account status reads real DPAPI credentials before local disconnect', {
  skip: process.platform !== 'win32', timeout: 30000
}, async t => {
  const { home, file } = await sandbox(t);
  const env = { ...process.env, USERPROFILE: home, PENPOT_TEST_URL: url,
    PENPOT_TEST_SETUP: resolve('plugin/scripts/penpot-setup.ps1') };
  delete env.PSModulePath;
  delete env.PENPOT_MCP_URL;
  const script = 'function Read-Host { param($Prompt, [switch]$AsSecureString) ConvertTo-SecureString $env:PENPOT_TEST_URL -AsPlainText -Force }; & $env:PENPOT_TEST_SETUP';
  await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env, windowsHide: true, timeout: 10000
  });
  assert.ok(!(await readFile(file, 'utf8')).includes(secret));
  const saved = await invoke(home, 'status');
  assert.equal(saved.code, 0);
  assert.match(saved.stdout, /VALID \(private user file\)/);
  assert.ok(!saved.stdout.includes(secret) && !saved.stderr.includes(secret));
  const removed = await invoke(home, 'disconnect', 'DISCONNECT\n');
  assert.equal(removed.code, 0);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
  const missing = await invoke(home, 'status');
  assert.equal(missing.code, 1);
  assert.match(missing.stdout, /connection is missing/);
});
