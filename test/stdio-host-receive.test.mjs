import assert from 'node:assert/strict';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { STDIO_DEFAULT_MAX_BUFFER_SIZE } from '@modelcontextprotocol/sdk/shared/stdio.js';
import test from 'node:test';

// Use the SDK *client* decoder, not raw stdout. No server credentials/network.
async function receiveImage(bytes, maxBufferSize) {
  const code = [
    "const data = 'a'.repeat(" + bytes + ");",
    "process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:1,result:{content:[{type:'image',mimeType:'image/png',data}]}}) + '\\n');"
  ].join('');
  const transport = new StdioClientTransport({
    command: process.execPath, args: ['-e', code], stderr: 'pipe',
    ...(maxBufferSize === undefined ? {} : { maxBufferSize })
  });
  const messages = [], errors = [];
  let end;
  const closed = new Promise(resolve => { end = resolve; });
  transport.onmessage = message => messages.push(message);
  transport.onerror = error => errors.push(error.message);
  transport.onclose = () => end();
  try {
    await transport.start();
    await Promise.race([
      closed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('SDK child did not exit')), 12000).unref())
    ]);
  } finally {
    await transport.close();
  }
  return { messages, errors };
}

test('default SDK host decoder accepts a 2 MiB image response', { timeout: 20000 }, async () => {
  const result = await receiveImage(2 * 1024 * 1024);
  assert.equal(result.errors.length, 0);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].result.content[0].data.length, 2 * 1024 * 1024);
});

test('default SDK host decoder rejects an 11 MiB response, unlike raw stdout', { timeout: 20000 }, async () => {
  assert.equal(STDIO_DEFAULT_MAX_BUFFER_SIZE, 10 * 1024 * 1024);
  const result = await receiveImage(11 * 1024 * 1024);
  assert.equal(result.messages.length, 0);
  assert.ok(result.errors.some(message => /exceeded maximum size/.test(message)));
});

test('SDK host explicitly configured for 16 MiB accepts the same 11 MiB response', { timeout: 20000 }, async () => {
  const result = await receiveImage(11 * 1024 * 1024, 16 * 1024 * 1024);
  assert.equal(result.errors.length, 0);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].result.content[0].data.length, 11 * 1024 * 1024);
});
