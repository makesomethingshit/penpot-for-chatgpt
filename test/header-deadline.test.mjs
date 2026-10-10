import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWithHeaderDeadline } from '../plugin/server/header-deadline.mjs';

test('never-resolving POST fetch times out with unknown outcome and signals abort', { timeout: 5000 }, async () => {
  let signal;
  await assert.rejects(fetchWithHeaderDeadline((_, init) => {
    signal = init.signal;
    return new Promise(() => {});
  }, 'https://example.invalid', { method: 'POST' }, 25),
  error => error.name === 'TimeoutError' && /Remote outcome unknown/.test(error.message));
  assert.equal(signal.aborted, true);
});

test('response headers arrive: preserve body and clear timeout', { timeout: 5000 }, async () => {
  const response = await fetchWithHeaderDeadline(async () =>
    new Response('data: hello\n\n', { headers: { 'content-type': 'text/event-stream' } }),
    'https://example.invalid', { method: 'POST' }, 1000);
  assert.equal(await response.text(), 'data: hello\n\n');
});

test('host abort propagates to the outstanding request', { timeout: 5000 }, async () => {
  const host = new AbortController();
  let requestSignal;
  const pending = fetchWithHeaderDeadline((_, init) => {
    requestSignal = init.signal;
    return new Promise((_, reject) =>
      init.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  }, 'https://example.invalid', { method: 'POST', signal: host.signal }, 1000);
  host.abort();
  await assert.rejects(pending, /cancelled/);
  assert.equal(requestSignal.aborted, true);
});
