import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import test from 'node:test';

const bridgePath = fileURLToPath(new URL('../plugin/server/bridge.mjs', import.meta.url));
const syntheticURL = 'https://design.penpot.app/mcp/stream?userToken=synthetic-host-bridge';
const imageBytes = 11 * 1024 * 1024;
const inboundLimit = 64 * 1024 * 1024;

const mockFetch = `
let resolveLargeStarted;
const largeStarted = new Promise(resolve => { resolveLargeStarted = resolve; });
globalThis.fetch = async (input, init) => {
  if (String(input) !== process.env.PENPOT_MCP_URL) throw new Error('Unexpected synthetic endpoint');
  if (init.method === 'GET') return new Response(null, { status: 405 });
  const message = JSON.parse(init.body);
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (message.method === 'initialize') return new Response(JSON.stringify({
    jsonrpc: '2.0', id: message.id,
    result: { protocolVersion: '2025-03-26', capabilities: { tools: {} },
      serverInfo: { name: 'synthetic-host-bridge', version: '1' } }
  }), { headers: { 'content-type': 'application/json' } });
  if (message.method !== 'tools/call') throw new Error('Unexpected synthetic method');
  const kind = message.params.arguments.kind;
  if (kind === 'large') {
    resolveLargeStarted();
    await new Promise(resolve => setTimeout(resolve, 50));
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {
      content: [{ type: 'image', mimeType: 'image/png', data: 'a'.repeat(${imageBytes}) }]
    } }), { headers: { 'content-type': 'application/json' } });
  }
  if (kind === 'normal') {
    await largeStarted;
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {
      content: [{ type: 'text', text: 'normal response' }],
      structuredContent: { observedConcurrentLargeResponse: true }
    } }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('Unexpected synthetic tool');
};`;

function clientRuntime(t, maxBufferSize) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', `data:text/javascript,${encodeURIComponent(mockFetch)}`, bridgePath],
    env: { PENPOT_MCP_URL: syntheticURL },
    stderr: 'pipe',
    ...(maxBufferSize === undefined ? {} : { maxBufferSize })
  });
  const client = new Client({ name: 'stdio-host-bridge-test', version: '1' });
  const errors = [];
  let stderr = '';
  transport.onerror = error => errors.push(error.message);
  transport.stderr.on('data', data => { stderr += data.toString(); });
  t.after(() => client.close());
  return { client, transport, errors, stderr: () => stderr };
}

async function concurrentToolCalls(runtime) {
  await runtime.client.connect(runtime.transport);
  const large = runtime.client.callTool({ name: 'synthetic-image', arguments: { kind: 'large' } });
  const normal = runtime.client.callTool({ name: 'synthetic-normal', arguments: { kind: 'normal' } });
  return Promise.allSettled([large, normal]);
}

test('bundled bridge preserves a concurrent normal result and 11 MiB image with a 16 MiB host limit', { timeout: 30000 }, async t => {
  const runtime = clientRuntime(t, 16 * 1024 * 1024);
  const [large, normal] = await concurrentToolCalls(runtime);
  assert.equal(large.status, 'fulfilled');
  assert.equal(large.value.content[0].type, 'image');
  assert.equal(large.value.content[0].data.length, imageBytes);
  assert.equal(normal.status, 'fulfilled');
  assert.equal(normal.value.content[0].text, 'normal response');
  assert.equal(normal.value.structuredContent.observedConcurrentLargeResponse, true);
  assert.deepEqual(runtime.errors, []);
  assert.equal(runtime.stderr(), '');
});

test('bundled bridge keeps the normal result but the default 10 MiB host rejects the 11 MiB image', { timeout: 30000 }, async t => {
  const runtime = clientRuntime(t);
  const [large, normal] = await concurrentToolCalls(runtime);
  assert.equal(normal.status, 'fulfilled');
  assert.equal(normal.value.content[0].text, 'normal response');
  assert.equal(large.status, 'rejected');
  assert.match(String(large.reason), /Connection closed/);
  assert.ok(runtime.errors.some(message => /exceeded maximum size of 10485760 bytes/.test(message)));
  assert.equal(runtime.stderr(), '');
});

test('bundled bridge rejects an inbound frame over 64 MiB with a nonzero exit', { timeout: 30000 }, async t => {
  const child = spawn(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(`
globalThis.fetch = async (_, init) => init.method === 'GET'
  ? new Response(null, { status: 405 })
  : new Response(null, { status: 202 });`)}`,
    bridgePath
  ], {
    env: { PENPOT_MCP_URL: syntheticURL },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  t.after(() => child.kill());
  let stderr = '';
  child.stderr.on('data', data => { stderr += data.toString(); });
  const frame = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'synthetic', arguments: { padding: 'x'.repeat(inboundLimit + 1) } } }) + '\n';
  child.stdin.end(frame);
  const [code, signal] = await once(child, 'close');
  assert.equal(signal, null);
  assert.equal(code, 1);
  assert.match(stderr, /Invalid local MCP message or frame exceeds 64 MiB/);
  assert.ok(!stderr.includes('synthetic-host-bridge'));
});
