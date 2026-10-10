import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';

const token = 'synthetic-test-token';
const officialURL = `https://design.penpot.app/mcp/stream?userToken=${token}`;
const mockFetch = `
let resolveGet;
const getChecked = new Promise(resolve => { resolveGet = resolve; });
globalThis.fetch = async (input, init) => {
  if (String(input) !== process.env.PENPOT_MCP_URL) throw new Error('Unexpected endpoint');
  if (init.method === 'GET') resolveGet(init.redirect);
  if (init.redirect !== 'error') throw new Error('Redirects are not blocked');
  if (init.method === 'GET') return new Response(null, { status: 405 });
  const message = JSON.parse(init.body);
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (process.env.PENPOT_TEST_FAILURE) return new Response(String(input), { status: 401 });
  let result;
  if (message.method === 'initialize') result = {
    protocolVersion: '2025-03-26', capabilities: { tools: {} },
    serverInfo: { name: 'mock-penpot', version: '1.0.0' }
  };
  if (message.method === 'tools/list') {
    if (await getChecked !== 'error') throw new Error('GET redirects are not blocked');
    if (init.headers.get('mcp-protocol-version') !== '2025-03-26') throw new Error('Protocol not negotiated');
    if (init.headers.get('mcp-session-id') !== 'test-session') throw new Error('Session not forwarded');
    result = { tools: [{ name: 'export_shape', inputSchema: { type: 'object', properties: {} } }], nextCursor: 'page-2' };
    if (process.env.PENPOT_TEST_EXTRA_PROTOCOL) result.protocolVersion = '2099-not-negotiated';
  }
  if (message.method === 'tools/call') {
    if (init.headers.get('mcp-protocol-version') !== '2025-03-26')
      throw new Error('Negotiated protocol header was overwritten by an unrelated tool result');
    result = {
    content: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }],
    structuredContent: { shapeId: message.params.arguments.shapeId }
    };
  }
  const payload = { jsonrpc: '2.0', id: message.id, result };
  const headers = { 'content-type': 'application/json', 'mcp-session-id': 'test-session' };
  if (message.method === 'tools/call') return new Response(
    'event: message\\ndata: ' + JSON.stringify(payload) + '\\n\\n',
    { headers: { ...headers, 'content-type': 'text/event-stream' } }
  );
  return new Response(JSON.stringify(payload), { headers });
};`;

function bridge(t, url = officialURL, failure = false, extraProtocol = false) {
  const child = spawn(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(mockFetch)}`,
    process.env.PENPOT_TEST_BRIDGE || 'plugin/server/bridge.mjs'
  ], {
    env: { ...process.env, PENPOT_MCP_URL: url, PENPOT_TEST_FAILURE: failure ? '1' : '', PENPOT_TEST_EXTRA_PROTOCOL: extraProtocol ? '1' : '' },
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
  });
  t.after(() => child.kill());
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  const lines = createInterface({ input: child.stdout });
  const responses = lines[Symbol.asyncIterator]();
  let id = 0;
  return {
    child, stderr: () => stderr,
    async request(method, params) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) + '\n');
      const next = await responses.next();
      assert.equal(next.done, false, stderr);
      const response = JSON.parse(next.value);
      assert.equal(response.id, id);
      return response;
    }
  };
}

test('bundled bridge preserves initialization, schemas, pagination, SSE images and shutdown', { timeout: 10000 }, async t => {
  const runtime = bridge(t);
  const initialized = await runtime.request('initialize', {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' }
  });
  assert.equal(initialized.result.serverInfo.name, 'mock-penpot');
  runtime.child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  const list = await runtime.request('tools/list', {});
  assert.equal(list.result.tools[0].name, 'export_shape');
  assert.deepEqual(list.result.tools[0].inputSchema, { type: 'object', properties: {} });
  assert.equal(list.result.nextCursor, 'page-2');
  const call = await runtime.request('tools/call', { name: 'export_shape', arguments: { shapeId: 'test-shape' } });
  assert.deepEqual(call.result, {
    content: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }],
    structuredContent: { shapeId: 'test-shape' }
  });
  const closed = once(runtime.child, 'exit');
  runtime.child.stdin.end();
  assert.equal((await closed)[0], 0);
  assert.equal(runtime.stderr(), '');
});

test('HTTP failures return a matching error without leaking credentials', { timeout: 10000 }, async t => {
  const runtime = bridge(t, officialURL, true);
  const response = await runtime.request('tools/list', {});
  assert.equal(response.error.code, -32000);
  assert.ok(!JSON.stringify(response).includes(token));
  assert.ok(!runtime.stderr().includes(token));
  const closed = once(runtime.child, 'exit');
  runtime.child.stdin.end();
  await closed;
});

test('reject untrusted endpoints before sending a request', { timeout: 15000 }, async t => {
  for (const url of [
    'invalid-' + token, `http://design.penpot.app/mcp/stream?userToken=${token}`,
    `https://example.com/mcp/stream?userToken=${token}`, officialURL + '#fragment',
    `https://user:pass@design.penpot.app/mcp/stream?userToken=${token}`,
    `https://design.penpot.app:8443/mcp/stream?userToken=${token}`,
    `https://design.penpot.app/wrong?userToken=${token}`,
    'https://design.penpot.app/mcp/stream?userToken=',
    'https://design.penpot.app/mcp/stream?userToken=&userToken=' + token,
    'https://design.penpot.app/mcp/stream?userToken=' + token + '&userToken=',
    'https://design.penpot.app/mcp/stream?userToken=%20'
  ]) {
    const runtime = bridge(t, url);
    let stdout = '';
    runtime.child.stdout.on('data', data => { stdout += data; });
    assert.equal((await once(runtime.child, 'exit'))[0], 1);
    assert.equal(stdout, '');
    assert.match(runtime.stderr(), /Invalid Penpot MCP URL/);
    assert.ok(!runtime.stderr().includes(token));
  }
});

test('unrelated tool output cannot change the negotiated MCP protocol header', { timeout: 10000 }, async t => {
  const runtime = bridge(t, officialURL, false, true);
  const initialized = await runtime.request('initialize', {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' }
  });
  assert.equal(initialized.result.protocolVersion, '2025-03-26');
  runtime.child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\\n');
  const list = await runtime.request('tools/list', {});
  assert.equal(list.result.protocolVersion, '2099-not-negotiated');
  const call = await runtime.request('tools/call', {
    name: 'export_shape', arguments: { shapeId: 'shape-safe' }
  });
  assert.equal(call.result.structuredContent.shapeId, 'shape-safe');
  const closed = once(runtime.child, 'exit');
  runtime.child.stdin.end();
  assert.equal((await closed)[0], 0);
  assert.equal(runtime.stderr(), '');
});
