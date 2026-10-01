import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { connectionURL, validateConnectionURL } from '../plugin/server/connection.mjs';

const token = 'synthetic-connection-test';
const url = `https://design.penpot.app/mcp/stream?userToken=${token}`;
const invalid = [url + '&userToken=second',
  `https://design.penpot.app/mcp/stream?userToken=&userToken=${token}`,
  'https://design.penpot.app/mcp/stream?userToken=%20'];

test('shared URL validation and configuration errors are safe', async t => {
  const previous = process.env.PENPOT_MCP_URL;
  delete process.env.PENPOT_MCP_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.PENPOT_MCP_URL;
    else process.env.PENPOT_MCP_URL = previous;
  });
  const directory = await mkdtemp(join(tmpdir(), 'penpot-connection-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'connection.json');
  assert.equal(validateConnectionURL(` ${url} `).href, url);
  for (const value of invalid) assert.throws(() => validateConnectionURL(value), /exactly one non-empty/);
  await assert.rejects(connectionURL(path), /connection is missing/);
  for (const content of ['{' + token, JSON.stringify({ dpapi: null })]) {
    await writeFile(path, content);
    await assert.rejects(connectionURL(path), error => {
      assert.match(error.message, /file is damaged/);
      assert.ok(!error.message.includes(token));
      return true;
    });
  }
  await writeFile(path, JSON.stringify({ dpapi: token }));
  await assert.rejects(connectionURL(path), error => {
    assert.match(error.message, process.platform === 'win32' ? /Cannot decrypt/ : /Windows encrypted credentials/);
    assert.ok(!error.message.includes(token));
    return true;
  });
  process.env.PENPOT_MCP_URL = '';
  await assert.rejects(connectionURL(path), /Invalid Penpot MCP URL/);
  process.env.PENPOT_MCP_URL = url;
  assert.equal((await connectionURL(path)).href, url);
});

test('Windows setup uses the shared validator and round-trips DPAPI without overwriting on failure',
  { skip: process.platform !== 'win32', timeout: 30000 }, async t => {
    const directory = await mkdtemp(join(tmpdir(), 'penpot-setup-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const script = 'function Read-Host { param($Prompt, [switch]$AsSecureString) ConvertTo-SecureString $env:PENPOT_TEST_URL -AsPlainText -Force }; & $env:PENPOT_TEST_SETUP';
    const setup = value => promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, USERPROFILE: directory, PENPOT_TEST_URL: value,
        PENPOT_TEST_SETUP: resolve('plugin/scripts/penpot-setup.ps1') },
      windowsHide: true, timeout: 10000
    });
    const result = await setup(url);
    assert.ok(!result.stdout.includes(token));
    const path = join(directory, '.penpot-for-chatgpt', 'connection.json');
    const saved = await readFile(path, 'utf8');
    assert.ok(!saved.includes(token));
    for (const value of invalid) {
      await assert.rejects(setup(value), error => {
        assert.match(error.stderr, /exactly one non-empty/);
        assert.ok(!error.stderr.includes(token));
        return true;
      });
      assert.equal(await readFile(path, 'utf8'), saved);
    }
    const previous = process.env.PENPOT_MCP_URL;
    delete process.env.PENPOT_MCP_URL;
    try { assert.equal((await connectionURL(path)).href, url); }
    finally {
      if (previous === undefined) delete process.env.PENPOT_MCP_URL;
      else process.env.PENPOT_MCP_URL = previous;
    }
  });
