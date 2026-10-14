import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import test from 'node:test';

// Execute synthetic fetch in the actual generated bridge process. No network or real token.
function syntheticRemote() {
  const encode = text => new TextEncoder().encode(text);
  let gets = 0;
  let resumeGets = 0;
  const json = msg => new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id,
    result: { content: [{ type: 'text', text: 'ok-' + msg.id }] }
  }), { headers: { 'content-type': 'application/json' } });
  const sse = msg => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encode('event: message\ndata: ' + JSON.stringify({
        jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'ok-' + msg.id }] }
      }) + '\n\n'));
      controller.close();
    }
  }), { headers: { 'content-type': 'text/event-stream' } });
  globalThis.fetch = async (_url, init) => {
    if (init.method === 'GET') {
      const lastEventId = new Headers(init.headers).get('last-event-id');
      if (lastEventId) {
        resumeGets++;
        process.stderr.write('resume-get:' + resumeGets + '\n');
        return new Response(null, { status: 503 });
      }
      gets++;
      process.stderr.write('get:' + gets + '\n');
      if (process.env.CASE === 'healthy') return new Response(null, { status: 405 });
      if (gets === 1) {
        const event = 'retry: 1\nid: response-channel\n'
          + 'data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"primed"}}\n\n';
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encode(event));
            if (process.env.CASE === 'owned') {
              setTimeout(() => controller.enqueue(encode('event: message\ndata: ' + JSON.stringify({
                jsonrpc: '2.0', id: 11, result: { content: [{ type: 'text', text: 'ok-11' }] }
              }) + '\n\n')), 3000);
            } else {
              setTimeout(() => controller.close(), 100);
            }
          }
        }), { headers: { 'content-type': 'text/event-stream' } });
      }
      return new Response(null, { status: 503 });
    }
    const msg = JSON.parse(init.body);
    if (msg.method === 'initialize') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id,
        result: { protocolVersion: '2025-03-26', capabilities: { tools: {} },
          serverInfo: { name: 'get-sse-regression', version: '1' } }
      }), { headers: { 'content-type': 'application/json' } });
    }
    if (msg.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (msg.method === 'tools/call') {
      const mode = msg.params?.arguments?.mode || 'accepted';
      process.stderr.write('posted:' + msg.id + ':' + mode + '\n');
      if (mode === 'accepted') return new Response(null, { status: 202 });
      if (mode === 'accepted-after') return new Response(new ReadableStream({
        cancel() { throw new Error('synthetic cancel failure'); }
      }), { status: 202 });
      if (mode === 'resumable') {
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encode('retry: 1\nid: post-response\ndata:\n\n'));
            controller.close();
          }
        }), { headers: { 'content-type': 'text/event-stream' } });
      }
      if (mode === 'json') {
        await new Promise(resolve => setTimeout(resolve, process.env.CASE === 'owned' ? 4000 : 200));
        return json(msg);
      }
      if (mode === 'sse') {
        await new Promise(resolve => setTimeout(resolve, 200));
        return sse(msg);
      }
      return process.env.CASE === 'healthy' ? json(msg) : new Response(null, { status: 202 });
    }
    return new Response(null, { status: 202 });
  };
}

function fixture(t, scenario) {
  const moduleText = '(' + syntheticRemote.toString() + ')()';
  const child = spawn(process.execPath, [
    '--import', 'data:text/javascript,' + encodeURIComponent(moduleText),
    process.env.PENPOT_TEST_BRIDGE || 'plugin/server/bridge.mjs'
  ], { env: { ...process.env,
      PENPOT_MCP_URL: 'https://design.penpot.app/mcp/stream?userToken=synthetic-get-sse',
      CASE: scenario
    }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  t.after(() => child.kill());
  const messages = [];
  let stderr = '';
  createInterface({ input: child.stdout }).on('line', line => messages.push(JSON.parse(line)));
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const wait = async predicate => {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('GET-SSE regression timed out: ' + stderr);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const send = (id, method, mode) => child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id, method, params: method === 'tools/call'
      ? { name: 'mutate', arguments: { mode } } : {}
  }) + '\n');
  return { messages, stderr: () => stderr, send, wait,
    async init() {
      send(1, 'initialize');
      await wait(() => messages.some(m => m.id === 1));
      child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    },
    async close() {
      const exit = once(child, 'exit');
      child.stdin.end();
      assert.equal((await exit)[0], 0);
    }
  };
}

test('GET-SSE exhaustion is scoped to accepted requests and preserves direct POST paths', { timeout: 16000 }, async t => {
  const r = fixture(t, 'exhaust');
  await r.init();
  await r.wait(() => r.stderr().includes('get:1'));
  r.send(2, 'tools/call', 'json');
  r.send(3, 'tools/call', 'sse');
  r.send(4, 'tools/call', 'accepted');
  await r.wait(() => r.stderr().includes('posted:2:json') && r.stderr().includes('posted:3:sse') && r.stderr().includes('posted:4:accepted'));
  await r.wait(() => r.stderr().includes('SSE response channel exhausted reconnection attempts'));
  assert.match(r.stderr(), /SSE response channel exhausted reconnection attempts/);
  r.send(5, 'tools/call', 'json');
  r.send(6, 'tools/call', 'sse');
  r.send(7, 'tools/call', 'accepted-after');
  await r.wait(() => [2, 3, 4, 5, 6, 7].every(id => r.messages.some(m => m.id === id)));
  for (const id of [2, 3, 5, 6]) assert.equal(r.messages.find(m => m.id === id).result.content[0].text, 'ok-' + id);
  for (const id of [4, 7]) {
    assert.equal(r.messages.find(m => m.id === id).error?.code, -32000);
    assert.match(r.messages.find(m => m.id === id).error.message, /Remote outcome unknown/);
  }
  for (const id of [2, 3, 4, 5, 6, 7]) assert.equal(r.messages.filter(m => m.id === id).length, 1);
  assert.equal((r.stderr().match(/posted:4:accepted/g) || []).length, 1, 'accepted work must not replay');
  await r.close();
});

test('request-owned POST-SSE exhaustion does not fail an independent POST', { timeout: 16000 }, async t => {
  const r = fixture(t, 'owned');
  await r.init();
  await r.wait(() => r.stderr().includes('get:1'));
  r.send(8, 'tools/call', 'resumable');
  r.send(9, 'tools/call', 'json');
  r.send(11, 'tools/call', 'accepted');
  await r.wait(() => r.stderr().includes('posted:8:resumable') && r.stderr().includes('posted:9:json'));
  await r.wait(() => r.messages.some(m => m.id === 8) && r.messages.some(m => m.id === 9) && r.messages.some(m => m.id === 11));
  assert.equal(r.messages.find(m => m.id === 8).error?.code, -32000);
  assert.match(r.messages.find(m => m.id === 8).error.message, /Remote outcome unknown/);
  assert.match(r.stderr(), /resume-get:2/);
  assert.match(r.stderr(), /SSE response channel exhausted reconnection attempts/);
  assert.equal(r.messages.find(m => m.id === 9).result.content[0].text, 'ok-9');
  assert.equal(r.messages.find(m => m.id === 11).result.content[0].text, 'ok-11');
  assert.equal(r.messages.filter(m => m.id === 8).length, 1);
  assert.equal(r.messages.filter(m => m.id === 9).length, 1);
  assert.equal(r.messages.filter(m => m.id === 11).length, 1);
  r.send(10, 'tools/call', 'json');
  await r.wait(() => r.messages.some(m => m.id === 10));
  assert.equal(r.messages.find(m => m.id === 10).result.content[0].text, 'ok-10');
  await r.close();
});

test('a fresh host connection with GET=405 still forwards POST results', { timeout: 16000 }, async t => {
  const r = fixture(t, 'healthy');
  await r.init();
  await r.wait(() => r.stderr().includes('get:1'));
  r.send(4, 'tools/call', 'json');
  await r.wait(() => r.messages.some(m => m.id === 4));
  assert.equal(r.messages.find(m => m.id === 4).result.content[0].text, 'ok-4');
  assert.equal((r.stderr().match(/posted:4/g) || []).length, 1);
  await r.close();
});
