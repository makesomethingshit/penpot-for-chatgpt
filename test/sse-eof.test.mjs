import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';

const token = 'synthetic-sse-eof-token';
const mock = `
globalThis.fetch = async (_, init) => {
  if (init.method === 'GET') return new Response(null, { status: 405 });
  const message = JSON.parse(init.body);
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (message.method === 'initialize') return new Response(JSON.stringify({
    jsonrpc: '2.0', id: message.id, result: {
      protocolVersion: '2025-03-26', capabilities: { tools: {} },
      serverInfo: { name: 'synthetic', version: '1' }
    }
  }), { headers: { 'content-type': 'application/json' } });
  const mode = message.params?.arguments?.mode || 'empty';
  const payload = JSON.stringify({ jsonrpc: '2.0', id: message.id,
    result: { content: [{ type: 'text', text: 'ok' }] } });
  let stream;
  if (mode === 'valid') {
    stream = 'event: message\\ndata: ' + payload + '\\n\\n';
  } else if (mode === 'duplicate') {
    stream = ('event: message\\ndata: ' + payload + '\\n\\n').repeat(2);
  } else if (mode === 'resumable') {
    stream = 'id: evt-1\\n\\n';
  } else if (mode === 'error') {
    stream = new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('event: ping\\n\\n'));
      queueMicrotask(() => controller.error(new Error('synthetic network disconnect')));
    }});
  } else {
    stream = 'event: ping\\n\\n';
  }
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
};`;

function fixture(t) {
  const child = spawn(process.execPath, [
    '--import', 'data:text/javascript,' + encodeURIComponent(mock),
    'plugin/server/bridge.mjs'
  ], {
    env: { ...process.env, PENPOT_MCP_URL: 'https://design.penpot.app/mcp/stream?userToken=' + token },
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
  });
  t.after(() => child.kill());
  const responses = [];
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => responses.push(JSON.parse(line)));
  let diagnostics = '';
  child.stderr.on('data', chunk => { diagnostics += chunk; });
  return {
    child, lines, responses, diagnostics: () => diagnostics,
    async call(mode, id = 5) {
      const reply = once(lines, 'line');
      child.stdin.write(JSON.stringify({
        jsonrpc: '2.0', id, method: 'tools/call',
        params: { name: 'synthetic', arguments: { mode } }
      }) + '\n');
      return JSON.parse((await reply)[0]);
    },
    async finish() {
      const exited = once(child, 'exit');
      child.stdin.end();
      assert.equal((await exited)[0], 0, diagnostics);
    }
  };
}

for (const mode of ['empty', 'error']) {
  test('non-resumable POST SSE ' + mode + ' returns one sanitized unknown-outcome failure', { timeout: 15000 }, async t => {
    const f = fixture(t);
    const response = await f.call(mode);
    assert.equal(response.id, 5);
    assert.equal(response.error.code, -32000);
    assert.match(response.error.message, /Remote outcome unknown/);
    assert.match(response.error.message, /inspect the intended file before retrying/);
    assert.ok(!JSON.stringify(response).includes(token));
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(f.responses.length, 1);
    await f.finish();
    assert.ok(!f.diagnostics().includes(token));
  });
}

for (const mode of ['valid', 'duplicate']) {
  test('valid POST SSE ' + mode + ' forwards exactly one reply', { timeout: 15000 }, async t => {
    const f = fixture(t);
    const response = await f.call(mode);
    assert.deepEqual(response.result, { content: [{ type: 'text', text: 'ok' }] });
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(f.responses.length, 1);
    await f.finish();
  });
}

test('SSE stream with resumption id does not generate an early synthetic error', { timeout: 15000 }, async t => {
  const f = fixture(t);
  f.child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id: 6, method: 'tools/call',
    params: { name: 'synthetic', arguments: { mode: 'resumable' } }
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(f.responses.length, 0);
  await f.finish();
});
