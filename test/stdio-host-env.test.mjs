import assert from 'node:assert/strict';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import test from 'node:test';

const secret = 'synthetic-only-do-not-use';
const probe = "process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:1,result:{customEnvironmentPresent:!!process.env.PENPOT_MCP_URL}})+'\\n')";
async function sdkChild(overrides) {
  const transport = new StdioClientTransport({
    command: process.execPath, args: ['-e', probe], stderr: 'pipe',
    ...(overrides ? { env: overrides } : {})
  });
  const results = [];
  transport.onmessage = message => results.push(message);
  const closed = new Promise(resolve => { transport.onclose = resolve; });
  try {
    await transport.start();
    await Promise.race([closed, new Promise((_, reject) =>
      setTimeout(() => reject(new Error('stdio child did not exit')), 12000).unref()
    )]);
  } finally { await transport.close(); }
  return results;
}

test('SDK default host filters PENPOT_MCP_URL in the spawned stdio server', {
  timeout: 15000
}, async () => {
  const previous = process.env.PENPOT_MCP_URL;
  process.env.PENPOT_MCP_URL = secret;
  try {
    assert.equal(Object.hasOwn(getDefaultEnvironment(), 'PENPOT_MCP_URL'), false);
    const result = await sdkChild();
    assert.equal(result.length, 1);
    assert.equal(result[0].result.customEnvironmentPresent, false);
  } finally {
    if (previous === undefined) delete process.env.PENPOT_MCP_URL;
    else process.env.PENPOT_MCP_URL = previous;
  }
});

test('SDK host explicit env passes the custom connection setting', {
  timeout: 15000
}, async () => {
  const result = await sdkChild({ PENPOT_MCP_URL: secret });
  assert.equal(result.length, 1);
  assert.equal(result[0].result.customEnvironmentPresent, true);
});
