import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';

const mockFetch = `
globalThis.fetch = async (_, init) => {
  if (init.method === 'GET') return new Response(null, { status: 405 });
  const message = JSON.parse(init.body);
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: message.id,
    result: { receivedBytes: message.params?.arguments?.padding?.length ?? 0 } }),
    { headers: { 'content-type': 'application/json' } });
};`;

function start(t) {
  const child = spawn(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(mockFetch)}`,
    'plugin/server/bridge.mjs'
  ], { env: { ...process.env,
    PENPOT_MCP_URL: 'https://design.penpot.app/mcp/stream?userToken=synthetic-stdio'
  }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  t.after(() => child.kill());
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  return { child, lines: createInterface({ input: child.stdout }), stderr: () => stderr };
}

test('stdio bridge accepts a valid JSON-RPC frame larger than the SDK 10 MiB default', { timeout: 30000 }, async t => {
  const runtime = start(t);
  const responses = runtime.lines[Symbol.asyncIterator]();
  const bytes = 11 * 1024 * 1024;
  const request = JSON.stringify({ jsonrpc: '2.0', id: 41, method: 'tools/call',
    params: { name: 'synthetic', arguments: { padding: 'x'.repeat(bytes) } } }) + '\n';
  runtime.child.stdin.write(request);
  const next = await responses.next();
  assert.equal(next.done, false, runtime.stderr());
  const response = JSON.parse(next.value);
  assert.equal(response.id, 41);
  assert.equal(response.result.receivedBytes, bytes);
  const exited = once(runtime.child, 'exit');
  runtime.child.stdin.end();
  assert.equal((await exited)[0], 0, runtime.stderr());
});

test('malformed incoming stdio frame terminates unsuccessfully and safely', { timeout: 10000 }, async t => {
  const runtime = start(t);
  const exited = once(runtime.child, 'exit');
  runtime.child.stdin.write('malformed-json\n');
  assert.equal((await exited)[0], 1);
  assert.match(runtime.stderr(), /Invalid local MCP message/);
  assert.ok(!runtime.stderr().includes('userToken='));
});
