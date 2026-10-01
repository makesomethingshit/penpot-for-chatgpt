import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export function validateConnectionURL(value) {
  let url;
  try { url = new URL(value.trim()); } catch { /* Report only the safe message below. */ }
  const tokens = url?.searchParams.getAll('userToken') ?? [];
  if (!url || url.protocol !== 'https:' || url.hostname !== 'design.penpot.app' || url.port ||
      url.pathname !== '/mcp/stream' || url.username || url.password || url.hash ||
      tokens.length !== 1 || !tokens[0].trim()) {
    throw new Error('Invalid Penpot MCP URL. Copy the official server URL with exactly one non-empty userToken.');
  }
  return url;
}

export async function connectionURL(configurationPath = join(homedir(), '.penpot-for-chatgpt', 'connection.json')) {
  if (process.env.PENPOT_MCP_URL !== undefined) return validateConnectionURL(process.env.PENPOT_MCP_URL);
  let text;
  try { text = await readFile(configurationPath, 'utf8'); } catch (error) {
    throw new Error(error.code === 'ENOENT'
      ? 'Penpot connection is missing. Run penpot-setup.ps1 on Windows, or set PENPOT_MCP_URL in the host environment.'
      : 'Cannot read the Penpot connection file. Check its access permissions.');
  }
  let config;
  try { config = JSON.parse(text); } catch {
    throw new Error('Penpot connection file is damaged. Run penpot-setup.ps1 again.');
  }
  if (typeof config?.dpapi !== 'string' || !config.dpapi) {
    throw new Error('Penpot connection file is damaged. Run penpot-setup.ps1 again.');
  }
  if (process.platform !== 'win32') {
    throw new Error('Windows encrypted credentials cannot be used here. Set PENPOT_MCP_URL in the host environment.');
  }
  const script = '$ErrorActionPreference = "Stop"; $c = Get-Content -LiteralPath $env:PENPOT_CONNECTION_FILE -Raw | ConvertFrom-Json; $s = ConvertTo-SecureString $c.dpapi; [System.Net.NetworkCredential]::new("", $s).Password';
  let stdout;
  try {
    const env = { ...process.env, PENPOT_CONNECTION_FILE: configurationPath };
    // Windows PowerShell must resolve its own modules, not an inherited PowerShell 7 path.
    delete env.PSModulePath;
    ({ stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      env, windowsHide: true, timeout: 10000
    }));
  } catch {
    throw new Error('Cannot decrypt the Penpot connection. Run penpot-setup.ps1 as the current Windows user.');
  }
  return validateConnectionURL(stdout);
}
