import { connectionURL } from './connection.mjs';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

let remote;
let local;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([remote?.close(), local?.close()]);
}

let url;
try { url = await connectionURL(); } catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
if (url) try {
  // Cover the SDK's GET/reconnect requests as well as POST requests.
  remote = new StreamableHTTPClientTransport(url, {
    fetch: (input, init) => fetch(input, { ...init, redirect: 'error' })
  });
  local = new StdioServerTransport();
  remote.onmessage = message => {
    if (message.result?.protocolVersion) remote.setProtocolVersion(message.result.protocolVersion);
    local.send(message).catch(() => stop());
  };
  remote.onerror = () => process.stderr.write('Penpot connection error. Check the local MCP URL, key validity, and active Penpot tab.\n');
  local.onerror = () => process.stderr.write('Invalid local MCP message.\n');
  local.onmessage = message => {
    remote.send(message).catch(() => {
      if (message.method && Object.hasOwn(message, 'id')) {
        local.send({ jsonrpc: '2.0', id: message.id, error: {
          code: -32000, message: 'Penpot connection failed. Check local configuration and the connected Penpot file.'
        } }).catch(() => stop());
      }
    });
  };
  local.onclose = () => stop();
  process.stdin.once('end', () => stop());
  process.once('SIGINT', () => stop());
  process.once('SIGTERM', () => stop());
  await remote.start();
  await local.start();
} catch {
  process.stderr.write('Penpot bridge startup failed. Check Node.js 22+ and restart the host MCP connection.\n');
  await stop();
  process.exitCode = 1;
}
