import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import test from 'node:test';

// Execute synthetic fetch in the actual generated bridge process. No network or real token.
function syntheticRemote() {
  const encode = text => new TextEncoder().encode(text);
  let gets = 0;
  globalThis.fetch = async (_url, init) => {
    if (init.method === 'GET') {
      gets++;
      process.stderr.write('get:' + gets + '\n');
      if (process.env.CASE === 'healthy') return new Response(null, { status: 405 });
      if (gets === 1) {
        const event = 'retry: 1\nid: response-channel\n'
          + 'data: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info","data":"primed"}}\n\n';
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encode(event));
            setTimeout(() => controller.close(), 100);
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
      process.stderr.write('posted:' + msg.id + '\n');
      if (process.env.CASE === 'healthy') {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: msg.id,
          result: { content: [{ type: 'text', text: 'ok' }] }
        }), { headers: { 'content-type': 'application/json' } });
      }
      // Mutation accepted, but reply is delivered only through the separate GET.
      return new Response(null, { status: 202 });
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
  const send = (id, method) => child.stdin.write(JSON.stringify({
    jsonrpc: '2.0', id, method, params: method === 'tools/call'
      ? { name: 'mutate', arguments: {} } : {}
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

test('exhausted GET-SSE fails pending once and refuses later POST without replay', { timeout: 16000 }, async t => {
  const r = fixture(t, 'exhaust');
  await r.init();
  await r.wait(() => r.stderr().includes('get:1'));
  r.send(2, 'tools/call');
  await r.wait(() => r.stderr().includes('posted:2'));
  await r.wait(() => r.messages.some(m => m.id === 2));
  assert.equal(r.messages.filter(m => m.id === 2).length, 1);
  assert.equal(r.messages.find(m => m.id === 2).error?.code, -32000);
  assert.match(r.messages.find(m => m.id === 2).error.message, /Remote outcome unknown/);
  assert.match(r.stderr(), /SSE response channel exhausted reconnection attempts/);
  r.send(3, 'tools/call');
  await r.wait(() => r.messages.some(m => m.id === 3));
  assert.equal(r.messages.find(m => m.id === 3).error?.code, -32000);
  assert.equal(r.stderr().includes('posted:3'), false, 'bridge must not transmit new mutations');
  assert.equal((r.stderr().match(/posted:2/g) || []).length, 1, 'no replay of accepted work');
  await r.close();
});

test('a fresh host connection with GET=405 still forwards POST results', { timeout: 16000 }, async t => {
  const r = fixture(t, 'healthy');
  await r.init();
  await r.wait(() => r.stderr().includes('get:1'));
  r.send(4, 'tools/call');
  await r.wait(() => r.messages.some(m => m.id === 4));
  assert.equal(r.messages.find(m => m.id === 4).result.content[0].text, 'ok');
  assert.equal((r.stderr().match(/posted:4/g) || []).length, 1);
  await r.close();
});
