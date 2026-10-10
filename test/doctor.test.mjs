import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const secret = 'synthetic-doctor-token';
test('doctor validates existing configuration without network, mutation or secret output', async () => {
  const output = await promisify(execFile)(process.execPath, [
    '--import', 'data:text/javascript,globalThis.fetch=()=>{throw new Error("network forbidden")}',
    'plugin/scripts/penpot-doctor.mjs'
  ], { env: { ...process.env, PENPOT_MCP_URL: `https://design.penpot.app/mcp/stream?userToken=${secret}` }, windowsHide: true });
  assert.match(output.stdout, /No credentials were changed; no network request was made/);
  assert.match(output.stdout, /read-only execute_code/);
  assert.equal(output.stderr, '');
  assert.ok(!output.stdout.includes(secret));
});
test('doctor reports invalid configuration without leaking secrets', async () => {
  await assert.rejects(promisify(execFile)(process.execPath, ['plugin/scripts/penpot-doctor.mjs'], {
    env: { ...process.env, PENPOT_MCP_URL: `https://untrusted.example/?secret=${secret}` }, windowsHide: true
  }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Invalid Penpot MCP URL/);
    assert.ok(!error.stdout.includes(secret));
    assert.ok(!error.stderr.includes(secret));
    return true;
  });
});
