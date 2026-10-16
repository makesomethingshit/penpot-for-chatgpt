import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

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
  assert.ok(!x.stdout.includes(secret));
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
  const refused = await invoke(home, 'disconnect', 'CANCEL\n');
  assert.equal(refused.code, 0);
  assert.match(refused.stdout, /Cancelled/);
  assert.equal(await readFile(file, 'utf8'), original);
  const removed = await invoke(home, 'disconnect', 'DISCONNECT\n');
  assert.equal(removed.code, 0);
  await assert.rejects(readFile(file, 'utf8'), { code: 'ENOENT' });
  assert.match(removed.stdout, /remote token separately/);
  assert.ok(!removed.stdout.includes(secret));
  const nofile = await invoke(home, 'disconnect', 'DISCONNECT\n');
  assert.equal(nofile.code, 0);
  assert.match(nofile.stdout, /No saved local connection/);
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
