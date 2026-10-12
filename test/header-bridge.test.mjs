import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';

const token = 'synthetic-header-test-token';
const officialURL = `https://design.penpot.app/mcp/stream?userToken=${token}`;
const mockFetch = `
const calls = new Map();
const encoder = new TextEncoder();
function responseFor(message, result, init, delay = 0) {
  const payload = { jsonrpc: '2.0', id: message.id, result };
  return new Response(new ReadableStream({
    start(controller) {
      const timer = setTimeout(() => {
        if (init.signal.aborted) {
          controller.error(new Error('synthetic request aborted'));
          return;
        }
        controller.enqueue(encoder.encode('event: message\\ndata: ' + JSON.stringify(payload) + '\\n\\n'));
        controller.close();
      }, delay);
      init.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.error(new Error('synthetic request aborted'));
      }, { once: true });
    }
  }), { headers: { 'content-type': 'text/event-stream' } });
}
globalThis.fetch = async (input, init) => {
  if (String(input) !== process.env.PENPOT_MCP_URL) throw new Error('Unexpected endpoint');
  if (init.redirect !== 'error') throw new Error('Redirects are not blocked');
  if (init.method === 'GET') return new Response(null, { status: 405 });
  const message = JSON.parse(init.body);
  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') {
    return new Response(null, { status: 202 });
  }
  if (message.method === 'initialize') {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: {
      protocolVersion: '2025-03-26', capabilities: { tools: {} },
      serverInfo: { name: 'synthetic-header-test', version: '1.0.0' }
    } }), { headers: { 'content-type': 'application/json', 'mcp-session-id': 'synthetic-session' } });
  }
  const shapeId = message.params?.arguments?.shapeId;
  calls.set(shapeId, (calls.get(shapeId) ?? 0) + 1);
  if (shapeId === 'never' || shapeId === 'shutdown') {
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => {
      process.stderr.write('aborted:' + shapeId + '\\n');
      reject(new DOMException('synthetic abort', 'AbortError'));
    }, { once: true }));
  }
  if (shapeId === 'cancel' || shapeId === 'cancel-late') {
    if (shapeId === 'cancel-late') process.stderr.write('started:cancel-late\\n');
    init.signal.addEventListener('abort', () => process.stderr.write('aborted:' + shapeId + '\\n'), { once: true });
    await new Promise(resolve => setTimeout(resolve, 50));
    const payload = { jsonrpc: '2.0', id: message.id, result: {
      content: [], structuredContent: { shapeId, calls: calls.get(shapeId) }
    } };
    return shapeId === 'cancel-late' ? {
      ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: null,
      json: async () => payload
    } : new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } });
  }
  const result = {
    content: [],
    structuredContent: {
      shapeId,
      signalAborted: init.signal.aborted,
      calls: Object.fromEntries(calls)
    }
  };
  return responseFor(message, result, init, process.env.PENPOT_TEST_CASE === 'delayed-body' ? 120 : 60);
};`;

function preload(headerDelay) {
  return `
const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, delay, ...args) =>
  nativeSetTimeout(callback, delay === 180000 ? ${headerDelay} : delay, ...args);
${mockFetch}`;
}

function bridge(t, testCase, headerDelay) {
  const child = spawn(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(preload(headerDelay))}`,
    'plugin/server/bridge.mjs'
  ], {
    cwd: process.cwd(),
    env: { ...process.env, PENPOT_MCP_URL: officialURL, PENPOT_TEST_CASE: testCase },
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const messages = [];
  const waiters = [];
  let stderr = '';
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    const message = JSON.parse(line);
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      if (waiters[index].predicate(message)) {
        const waiter = waiters.splice(index, 1)[0];
        waiter.resolve(message);
      }
    }
  });
  child.stderr.on('data', data => { stderr += data; });
  const waitFor = (predicate, timeout = 2000) => {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve: value => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index !== -1) waiters.splice(index, 1);
        reject(new Error(`Timed out waiting for bridge response; stderr: ${stderr}`));
      }, timeout);
      waiters.push(waiter);
    });
  };
  const waitForStderr = (text, timeout = 2000) => {
    if (stderr.includes(text)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearInterval(check);
        reject(new Error(`Timed out waiting for stderr ${text}; got ${stderr}`));
      }, timeout);
      const check = setInterval(() => {
        if (stderr.includes(text)) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 5);
    });
  };
  let id = 0;
  return {
    child,
    messages,
    stderr: () => stderr,
    async request(method, params) {
      const requestId = ++id;
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
      return waitFor(message => message.id === requestId);
    },
    send(method, params) {
      const requestId = ++id;
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
      return requestId;
    },
    notify(method, params) {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    },
    waitFor,
    waitForStderr,
    async close() {
      if (child.exitCode !== null) return;
      child.stdin.end();
      await once(child, 'exit');
    }
  };
}

async function initialize(runtime) {
  const response = await runtime.request('initialize', {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' }
  });
  assert.equal(response.result.serverInfo.name, 'synthetic-header-test');
  runtime.notify('notifications/initialized');
}

test('bundled bridge reports one unknown outcome, preserves a concurrent request, and does not replay', { timeout: 5000 }, async t => {
  const runtime = bridge(t, 'timeout', 30);
  await initialize(runtime);
  const timedOut = runtime.request('tools/call', { name: 'export_shape', arguments: { shapeId: 'never' } });
  const normal = runtime.request('tools/call', { name: 'export_shape', arguments: { shapeId: 'normal' } });
  const timeoutResponse = await timedOut;
  assert.equal(timeoutResponse.error.code, -32000);
  assert.match(timeoutResponse.error.message, /Remote outcome unknown/);
  const normalResponse = await normal;
  assert.deepEqual(normalResponse.result.structuredContent, {
    shapeId: 'normal', signalAborted: false, calls: { never: 1, normal: 1 }
  });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(runtime.messages.filter(message => message.id === timeoutResponse.id).length, 1);
  await runtime.waitForStderr('aborted:never');
  await runtime.close();
});

test('bundled bridge cancels one POST, suppresses its late response, and keeps another request alive', { timeout: 5000 }, async t => {
  const runtime = bridge(t, 'cancel', 80);
  await initialize(runtime);
  const cancelledId = runtime.send('tools/call', { name: 'export_shape', arguments: { shapeId: 'cancel' } });
  runtime.notify('notifications/cancelled', { requestId: cancelledId });
  const normal = runtime.request('tools/call', { name: 'export_shape', arguments: { shapeId: 'normal' } });
  const normalResponse = await normal;
  assert.deepEqual(normalResponse.result.structuredContent, {
    shapeId: 'normal', signalAborted: false, calls: { normal: 1 }
  });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(runtime.stderr().includes('started:cancel-late'), false);
  const lateId = runtime.send('tools/call', { name: 'export_shape', arguments: { shapeId: 'cancel-late' } });
  await runtime.waitForStderr('started:cancel-late');
  runtime.notify('notifications/cancelled', { requestId: lateId });
  await runtime.waitForStderr('aborted:cancel-late');
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(runtime.messages.some(message => message.id === cancelledId || message.id === lateId), false);
  await runtime.close();
});

test('bundled bridge aborts pending POST on host shutdown', { timeout: 5000 }, async t => {
  const runtime = bridge(t, 'shutdown', 80);
  await initialize(runtime);
  runtime.send('tools/call', { name: 'export_shape', arguments: { shapeId: 'shutdown' } });
  runtime.child.stdin.end();
  await runtime.waitForStderr('aborted:shutdown');
  await once(runtime.child, 'exit');
  assert.equal(runtime.messages.length, 1);
});

test('bundled bridge keeps an SSE body alive after the shortened header deadline', { timeout: 5000 }, async t => {
  const runtime = bridge(t, 'delayed-body', 80);
  await initialize(runtime);
  const response = await runtime.request('tools/call', { name: 'export_shape', arguments: { shapeId: 'slow' } });
  assert.deepEqual(response.result.structuredContent, {
    shapeId: 'slow', signalAborted: false, calls: { slow: 1 }
  });
  await runtime.close();
});
