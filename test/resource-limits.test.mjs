import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';

// Incremental synthetic bodies exercise the real bundle without an OOM test.
const mock = `
const mode = process.env.PENPOT_TEST_RESOURCE;
globalThis.fetch = async (_, init) => {
  if (mode !== 'legitimate' && mode !== 'slow-error-output') {
    init.signal.addEventListener('abort', () => process.stderr.write('synthetic-request-aborted\\n'), { once: true });
  }
  if (init.method === 'GET' && mode !== 'get-sse') return new Response(null, { status: 405 });
  const request = init.method === 'GET' ? {} : JSON.parse(init.body);
  if (request.method === 'notifications/initialized') return new Response(null, { status: 202 });
  let index = 0;
  const encoder = new TextEncoder();
  const image = mode === 'legitimate' || mode === 'slow-output' ? 'a'.repeat(12 * 1024 * 1024) : '';
  // Stalled output must be tested with distinct, legitimate messages. Duplicate
  // JSON-RPC responses for the same id are now intentionally suppressed by the bridge.
  const payload = JSON.stringify(mode === 'slow-output'
    ? { jsonrpc: '2.0', method: 'notifications/message',
        params: { level: 'info', data: { content: [{ type: 'image', data: image, mimeType: 'image/png' }] } } }
    : { jsonrpc: '2.0', id: request.id ?? 1,
        result: { content: [{ type: 'image', data: image, mimeType: 'image/png' }], label: '한글' } });
  const body = new ReadableStream({
    pull(controller) {
      if (mode === 'slow-error-output') {
        if (index++ < 2000) controller.enqueue(encoder.encode('data: !\\n\\n'.repeat(4096)));
        else controller.close();
      } else if (mode === 'slow-output') {
        if (index++ < 8) controller.enqueue(encoder.encode('data: ' + payload + '\\n\\n'));
        else controller.close();
      } else if (mode === 'legitimate') {
        // Total exceeds 64 MiB; each event is small. CRLF is split across chunks.
        if (index < 3150) {
          const part = index++ % 3;
          controller.enqueue(encoder.encode(part === 0 ? ':' + 'x'.repeat(65500) + '\\r' : part === 1 ? '\\n\\r' : '\\n'));
        } else if (index++ === 3150) controller.enqueue(encoder.encode('data: ' + payload + '\\n\\n'));
        else controller.close();
      } else {
        if (mode === 'sse-chunk' && index++ === 0) controller.enqueue(new Uint8Array(64 * 1024 * 1024 + 1));
        else if (mode !== 'sse-chunk' && index++ < 1050) controller.enqueue(encoder.encode(
          mode === 'sse-crlf' ? ':x\\r\\n'.repeat(16384) :
          mode.endsWith('multiline') ? 'data: ' + 'x'.repeat(65536) + '\\r\\n' :
          'x'.repeat(65536) + (mode === 'error-sse' || mode === 'json' ? '\\n\\n' : '')));
        else controller.close();
      }
    },
    cancel() { if (mode !== 'slow-error-output') process.stderr.write('synthetic-body-cancelled\\n'); }
  });
  const sse = mode.includes('sse') || mode === 'legitimate' || mode.startsWith('slow-');
  return new Response(body, { status: mode.startsWith('error') ? 500 : 200,
    headers: { 'content-type': sse || mode === 'error-sse' ? 'Text/Event-Stream; charset=utf-8' :
      'application/json; note="text/event-stream"' } });
};`;

function launch(t, mode) {
  const child = spawn(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(mock)}`,
    process.env.PENPOT_TEST_BRIDGE || 'plugin/server/bridge.mjs'
  ], { env: { ...process.env, PENPOT_MCP_URL: 'https://design.penpot.app/mcp/stream?userToken=synthetic',
    PENPOT_TEST_RESOURCE: mode }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  t.after(() => child.kill());
  let stderr = '';
  if (mode !== 'slow-error-output') child.stderr.on('data', data => { stderr += data; });
  const closed = once(child, 'close');
  child.stdin.write(JSON.stringify(mode === 'get-sse' ?
    { jsonrpc: '2.0', method: 'notifications/initialized' } :
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: {} }) + '\n');
  return { child, closed, stderr: () => stderr };
}

test('resource limits close JSON, HTTP errors, partial/multiline SSE and stalled output', { timeout: 60000 }, async t => {
  for (const mode of ['json', 'error', 'error-sse', 'sse-line', 'sse-multiline', 'sse-crlf', 'sse-chunk', 'get-sse', 'slow-output', 'slow-error-output']) {
    await t.test(mode, { timeout: 30000 }, async t => {
      const runtime = launch(t, mode);
      if (mode !== 'slow-output') runtime.child.stdout.resume();
      const [code, signal] = await runtime.closed;
      assert.ok(code === 1 || signal === 'SIGKILL', 'must terminate unsuccessfully');
      if (mode !== 'slow-error-output') assert.match(runtime.stderr(), /Penpot bridge resource limit exceeded/);
      assert.ok(!runtime.stderr().includes('userToken'));
      if (mode !== 'slow-error-output') assert.match(runtime.stderr(), /synthetic-request-aborted/);
    });
  }
});

test('long SSE with split CRLF and a large image remains intact', { timeout: 15000 }, async t => {
  const runtime = launch(t, 'legitimate');
  const chunks = [];
  runtime.child.stdout.on('data', chunk => {
    chunks.push(chunk);
    if (chunk.includes(10)) runtime.child.stdin.end();
  });
  assert.equal((await runtime.closed)[0], 0);
  const message = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(message.id, 1);
  assert.equal(message.result.label, '한글');
  assert.equal(message.result.content[0].data.length, 12 * 1024 * 1024);
  assert.equal(runtime.stderr(), '');
});
