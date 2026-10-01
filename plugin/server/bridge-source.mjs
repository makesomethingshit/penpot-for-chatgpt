import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const configurationPath = join(homedir(), '.penpot-for-chatgpt', 'connection.json');
async function connectionURL() {
  if (process.env.PENPOT_MCP_URL) return validate(process.env.PENPOT_MCP_URL);
  const config = JSON.parse(await readFile(configurationPath, 'utf8'));
  if (config.dpapi && process.platform === 'win32') {
    const script = '$c = Get-Content -LiteralPath $env:PENPOT_CONNECTION_FILE -Raw | ConvertFrom-Json; $s = ConvertTo-SecureString $c.dpapi; [System.Net.NetworkCredential]::new("", $s).Password';
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...process.env, PENPOT_CONNECTION_FILE: configurationPath }, windowsHide: true,
      timeout: 10000
    });
    return validate(stdout.trim());
  }
  throw new Error('Missing local connection');
}

function validate(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.hostname !== 'design.penpot.app' || url.port ||
      url.pathname !== '/mcp/stream' || url.username || url.password || url.hash ||
      !url.searchParams.get('userToken')) throw new Error('Invalid official connection');
  return url;
}

let remote;
let local;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([remote?.close(), local?.close()]);
}

try {
  const url = await connectionURL();
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
  process.stderr.write('Penpot is not configured. Run penpot-setup.ps1 on Windows, or set PENPOT_MCP_URL in the desktop application environment. Requires Node.js 22+.\n');
  await stop();
  process.exitCode = 1;
}
