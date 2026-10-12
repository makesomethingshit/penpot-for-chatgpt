import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import test from 'node:test';

const secret = 'synthetic-only-do-not-use';
const bridgePath = resolve('plugin/server/bridge.mjs');
const probe = "process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:1,result:{customEnvironmentPresent:!!process.env.PENPOT_MCP_URL}})+'\\n')";
async function sdkChild(overrides) {
  const transport = new StdioClientTransport({
    command: process.execPath, args: ['-e', probe], stderr: 'pipe',
    ...(overrides ? { env: overrides } : {})
  });
  const results = [];
  transport.onmessage = message => results.push(message);
  const closed = new Promise(resolve => { transport.onclose = resolve; });
  try {
    await transport.start();
    await Promise.race([closed, new Promise((_, reject) =>
      setTimeout(() => reject(new Error('stdio child did not exit')), 12000).unref()
    )]);
  } finally { await transport.close(); }
  return results;
}

function mockFetchSource(url) {
  return `
const expected = ${JSON.stringify(url)};
let getCount = 0;
let resolveReconnect;
const reconnected = new Promise(resolve => { resolveReconnect = resolve; });
globalThis.fetch = async (input, init = {}) => {
  if (String(input) !== expected) throw new Error('Unexpected endpoint');
  if (init.redirect !== 'error') throw new Error('Redirects are not blocked');
  if (init.method === 'GET') {
    if (++getCount === 1) return new Response('id: reconnect-me\\n\\n', {
      headers: { 'content-type': 'text/event-stream' }
    });
    resolveReconnect();
    return new Response(null, { status: 405 });
  }
  const message = JSON.parse(init.body);
  const headers = { 'content-type': 'application/json', 'mcp-session-id': 'synthetic-session' };
  if (message.method === 'initialize') return new Response(JSON.stringify({
    jsonrpc: '2.0', id: message.id, result: {
      protocolVersion: '2025-03-26', capabilities: { tools: {} },
      serverInfo: { name: 'mock-penpot', version: '1.0.0' }
    }
  }), { headers });
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (message.method === 'tools/list') {
    await reconnected;
    return new Response(JSON.stringify({
      jsonrpc: '2.0', id: message.id, result: {
        tools: [{ name: 'export_shape', inputSchema: { type: 'object', properties: {} } }],
        reconnected: getCount >= 2
      }
    }), { headers });
  }
  throw new Error('Unexpected MCP method');
};`;
}

async function bundledBridge(t, { home, url }) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', `data:text/javascript,${encodeURIComponent(mockFetchSource(url))}`, bridgePath],
    env: { HOME: home },
    stderr: 'pipe'
  });
  const messages = [];
  const errors = [];
  const pending = new Map();
  let id = 0;
  let stderr = '';
  transport.stderr.on('data', chunk => { stderr += chunk.toString(); });
  transport.onmessage = message => {
    messages.push(message);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      waiter.resolve(message);
    }
  };
  transport.onerror = error => {
    errors.push(error);
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };
  let close;
  const closed = new Promise(resolve => { close = resolve; });
  transport.onclose = () => {
    close();
    for (const waiter of pending.values()) waiter.reject(new Error('bundled bridge closed'));
    pending.clear();
  };
  await transport.start();
  t.after(() => transport.close());
  return {
    transport,
    messages,
    errors,
    stderr: () => stderr,
    closed,
    request(method, params = {}) {
      const requestId = ++id;
      const response = new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
      return transport.send({ jsonrpc: '2.0', id: requestId, method, params }).then(() => response);
    }
  };
}

function assertNoSecretOutput(runtime) {
  assert.ok(!runtime.stderr().includes(secret));
  assert.ok(!JSON.stringify(runtime.messages).includes(secret));
}

test('SDK default host filters PENPOT_MCP_URL in the spawned stdio server', {
  timeout: 15000
}, async () => {
  const previous = process.env.PENPOT_MCP_URL;
  process.env.PENPOT_MCP_URL = secret;
  try {
    assert.equal(Object.hasOwn(getDefaultEnvironment(), 'PENPOT_MCP_URL'), false);
    const result = await sdkChild();
    assert.equal(result.length, 1);
    assert.equal(result[0].result.customEnvironmentPresent, false);
  } finally {
    if (previous === undefined) delete process.env.PENPOT_MCP_URL;
    else process.env.PENPOT_MCP_URL = previous;
  }
});

test('SDK host explicit env passes the custom connection setting', {
  timeout: 15000
}, async () => {
  const result = await sdkChild({ PENPOT_MCP_URL: secret });
  assert.equal(result.length, 1);
  assert.equal(result[0].result.customEnvironmentPresent, true);
});

test('POSIX filtered host starts the bundled bridge from a private file and reconnects', {
  skip: process.platform === 'win32', timeout: 20000
}, async t => {
  const url = 'https://design.penpot.app/mcp/stream?userToken=' + secret;
  const previous = process.env.PENPOT_MCP_URL;
  process.env.PENPOT_MCP_URL = url;
  t.after(() => {
    if (previous === undefined) delete process.env.PENPOT_MCP_URL;
    else process.env.PENPOT_MCP_URL = previous;
  });
  assert.equal(Object.hasOwn(getDefaultEnvironment(), 'PENPOT_MCP_URL'), false);

  const home = await mkdtemp(join(tmpdir(), 'penpot-host-env-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const directory = join(home, '.penpot-for-chatgpt');
  await mkdir(directory, { mode: 0o700 });
  await writeFile(join(directory, 'connection.json'), JSON.stringify({ url }), { mode: 0o600 });

  const runtime = await bundledBridge(t, { home, url });
  const initialized = await runtime.request('initialize', {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' }
  });
  assert.equal(initialized.result.serverInfo.name, 'mock-penpot');
  await runtime.transport.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const list = await runtime.request('tools/list');
  assert.equal(list.result.reconnected, true);
  assert.equal(list.result.tools[0].name, 'export_shape');
  await runtime.transport.close();
  assert.deepEqual(runtime.errors, []);
  assert.equal(runtime.stderr(), '');
  assertNoSecretOutput(runtime);
});

test('POSIX filtered host rejects missing, unsafe-mode and symlink credentials safely', {
  skip: process.platform === 'win32', timeout: 20000
}, async t => {
  const url = 'https://design.penpot.app/mcp/stream?userToken=' + secret;
  const previous = process.env.PENPOT_MCP_URL;
  process.env.PENPOT_MCP_URL = url;
  t.after(() => {
    if (previous === undefined) delete process.env.PENPOT_MCP_URL;
    else process.env.PENPOT_MCP_URL = previous;
  });
  assert.equal(Object.hasOwn(getDefaultEnvironment(), 'PENPOT_MCP_URL'), false);

  for (const [name, prepare, message] of [
    ['missing', async () => {}, /Penpot connection is missing/],
    ['unsafe mode', async path => {
      const directory = join(path, '.penpot-for-chatgpt');
      await mkdir(directory, { mode: 0o700 });
      const file = join(directory, 'connection.json');
      await writeFile(file, JSON.stringify({ url }), { mode: 0o644 });
      await chmod(file, 0o644);
    }, /permissions are unsafe/],
    ['symlink', async path => {
      const directory = join(path, '.penpot-for-chatgpt');
      await mkdir(directory, { mode: 0o700 });
      const target = join(directory, 'target.json');
      await writeFile(target, JSON.stringify({ url }), { mode: 0o600 });
      await symlink(target, join(directory, 'connection.json'));
    }, /permissions are unsafe/]
  ]) {
    await t.test(name, async t => {
      const home = await mkdtemp(join(tmpdir(), `penpot-host-env-${name.replace(' ', '-')}-`));
      t.after(() => rm(home, { recursive: true, force: true }));
      await prepare(home);
      const runtime = await bundledBridge(t, { home, url });
      await runtime.closed;
      assert.equal(runtime.messages.length, 0);
      assert.match(runtime.stderr(), message);
      assertNoSecretOutput(runtime);
    });
  }
});
