import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import test from 'node:test';

const token = 'synthetic-request-lifecycle-token';
const mockFetch = `
const encode = value => new TextEncoder().encode(value);
const response = (message, result) => new Response(JSON.stringify({
  jsonrpc: '2.0', id: message.id, result
}), { headers: { 'content-type': 'application/json' } });
const sse = (message, suffix = '') => new Response(
  'event: message\\ndata: ' + JSON.stringify({ jsonrpc: '2.0', id: message.id,
    result: { content: [{ type: 'text', text: 'late-' + message.id + suffix }] } }) + '\\n\\n',
  { headers: { 'content-type': 'text/event-stream' } });

globalThis.fetch = async (_, init) => {
  if (init.method === 'GET') return new Response(null, { status: 405 });
  const message = JSON.parse(init.body);
  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') {
    if (message.method === 'notifications/cancelled') {
      process.stderr.write('cancel-forwarded:' + message.params?.requestId + '\\n');
    }
    return new Response(null, { status: 202 });
  }
  if (message.method === 'initialize') return response(message, {
    protocolVersion: '2025-03-26', capabilities: { tools: {} },
    serverInfo: { name: 'lifecycle-mock', version: '1' }
  });

  const mode = message.params?.arguments?.mode;
  process.stderr.write('started:' + message.id + ':' + mode + '\\n');
  if (mode === 'json') return response(message, { value: 'normal-json' });
  if (mode === 'reject') throw new Error('synthetic secret fetch failure');
  if (mode === 'eof') return new Response('event: ping\\n\\n', {
    headers: { 'content-type': 'text/event-stream' }
  });
  if (mode === 'error') return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encode('event: ping\\n\\n'));
      queueMicrotask(() => controller.error(new Error('synthetic stream failure')));
    }
  }), { headers: { 'content-type': 'text/event-stream' } });
  if (mode === 'cancel') {
    let timer;
    return new Response(new ReadableStream({
    start(controller) {
      timer = setTimeout(() => {
        controller.enqueue(encode('event: message\\ndata: ' + JSON.stringify({
          jsonrpc: '2.0', id: message.id,
          result: { content: [{ type: 'text', text: 'late-' + message.id }] }
        }) + '\\n\\n'));
        controller.enqueue(encode('event: message\\ndata: ' + JSON.stringify({
          jsonrpc: '2.0', id: message.id,
          result: { content: [{ type: 'text', text: 'duplicate-' + message.id }] }
        }) + '\\n\\n'));
        controller.close();
      }, 80);
    },
    cancel() { clearTimeout(timer); }
  }), { headers: { 'content-type': 'text/event-stream' } });
  }
  if (mode === 'healthy') return new Promise(resolve => setTimeout(() =>
    resolve(response(message, { value: 'healthy' })), 100));
  if (mode === 'shutdown') return new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => {
      process.stderr.write('aborted:' + message.id + '\\n');
      reject(new Error('synthetic shutdown abort'));
    }, { once: true });
  });
  return sse(message);
};`;

function runtime(t) {
  const child = spawn(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(mockFetch)}`,
    'plugin/server/bridge.mjs'
  ], {
    env: { ...process.env, PENPOT_MCP_URL: 'https://design.penpot.app/mcp/stream?userToken=' + token },
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
  });
  t.after(() => child.kill());
  const messages = [];
  const waiters = [];
  const textWaiters = [];
  const lines = createInterface({ input: child.stdout });
  let diagnostics = '';
  child.stderr.on('data', chunk => {
    diagnostics += chunk;
    for (let index = textWaiters.length - 1; index >= 0; index--) {
      if (!diagnostics.includes(textWaiters[index].needle)) continue;
      const waiter = textWaiters.splice(index, 1)[0];
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
  });
  lines.on('line', line => {
    const message = JSON.parse(line);
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index--) {
      if (!waiters[index].predicate(message)) continue;
      const waiter = waiters.splice(index, 1)[0];
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    }
  });
  function waitFor(predicate, timeout = 3000) {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = waiters.findIndex(waiter => waiter.resolve === resolve);
        if (index !== -1) waiters.splice(index, 1);
        reject(new Error('Timed out waiting for bridge response. Diagnostics: ' + diagnostics));
      }, timeout);
      waiters.push({ predicate, resolve, timer });
    });
  }
  function waitForText(needle, timeout = 3000) {
    if (diagnostics.includes(needle)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = textWaiters.findIndex(waiter => waiter.resolve === resolve);
        if (index !== -1) textWaiters.splice(index, 1);
        reject(new Error('Timed out waiting for bridge diagnostic. Diagnostics: ' + diagnostics));
      }, timeout);
      textWaiters.push({ needle, resolve, timer });
    });
  }
  return {
    child,
    messages,
    diagnostics: () => diagnostics,
    send(message) { child.stdin.write(JSON.stringify(message) + '\n'); },
    waitFor,
    waitForText,
    async ready() {
      this.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' }
      } });
      const initialized = await waitFor(message => message.id === 1);
      assert.equal(initialized.result.serverInfo.name, 'lifecycle-mock');
      this.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    },
    async close() {
      const exited = once(child, 'exit');
      child.stdin.end();
      return (await exited)[0];
    }
  };
}

function request(id, mode) {
  return { jsonrpc: '2.0', id, method: 'tools/call',
    params: { name: 'synthetic', arguments: { mode } } };
}

test('bundled bridge forwards a normal JSON response once', { timeout: 10000 }, async t => {
  const f = runtime(t);
  await f.ready();
  f.send(request(2, 'json'));
  const response = await f.waitFor(message => message.id === 2);
  assert.deepEqual(response.result, { value: 'normal-json' });
  assert.equal(f.messages.filter(message => message.id === 2).length, 1);
  assert.ok(!f.diagnostics().includes(token));
  assert.equal(await f.close(), 0);
});

test('bundled bridge turns send rejection into one sanitized connection error', { timeout: 10000 }, async t => {
  const f = runtime(t);
  await f.ready();
  f.send(request(3, 'reject'));
  const response = await f.waitFor(message => message.id === 3);
  assert.deepEqual(response.error, {
    code: -32000,
    message: 'Penpot connection failed. Remote outcome unknown; inspect the intended file before retrying.'
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(f.messages.filter(message => message.id === 3).length, 1);
  assert.ok(!JSON.stringify(response).includes(token));
  assert.ok(!f.diagnostics().includes(token));
  assert.ok(!f.diagnostics().includes('synthetic secret'));
  assert.equal(await f.close(), 0);
});

for (const mode of ['eof', 'error']) {
  test('bundled bridge reports one sanitized unknown outcome for ' + mode, { timeout: 10000 }, async t => {
    const f = runtime(t);
    await f.ready();
    f.send(request(4, mode));
    const response = await f.waitFor(message => message.id === 4);
    assert.equal(response.error.code, -32000);
    assert.match(response.error.message, /Remote outcome unknown/);
    assert.match(response.error.message, /inspect the intended file before retrying/);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(f.messages.filter(message => message.id === 4).length, 1);
    assert.ok(!JSON.stringify(response).includes(token));
    assert.ok(!f.diagnostics().includes(token));
    assert.equal(await f.close(), 0);
  });
}

test('cancellation retires only its target, forwards the notification and drops late duplicates', { timeout: 10000 }, async t => {
  const f = runtime(t);
  await f.ready();
  f.send(request(10, 'cancel'));
  f.send(request(11, 'healthy'));
  await f.waitForText('started:10:cancel');
  await f.waitForText('started:11:healthy');
  f.send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: {
    requestId: 10, reason: 'user requested'
  } });
  await f.waitForText('cancel-forwarded:10');
  const healthy = await f.waitFor(message => message.id === 11);
  assert.deepEqual(healthy.result, { value: 'healthy' });
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(f.messages.filter(message => message.id === 10).length, 0);
  assert.equal(f.messages.filter(message => message.id === 11).length, 1);
  assert.equal((f.diagnostics().match(/started:10:cancel/g) ?? []).length, 1);
  assert.ok(!f.diagnostics().includes(token));
  assert.equal(await f.close(), 0);
});

test('bridge shutdown clears pending and aborts an in-flight fetch', { timeout: 10000 }, async t => {
  const f = runtime(t);
  await f.ready();
  f.send(request(20, 'shutdown'));
  await f.waitForText('started:20:shutdown');
  assert.equal(await f.close(), 0);
  await f.waitForText('aborted:20');
  assert.equal(f.messages.filter(message => message.id === 20).length, 0);
  assert.ok(!f.diagnostics().includes(token));
});
