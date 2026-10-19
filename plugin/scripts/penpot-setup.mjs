import { chmod, lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { validateConnectionURL } from '../server/connection.mjs';

// Supply the URL on stdin from a hidden shell prompt; never as an argument.
let temporary;
try {
  if (process.platform === 'win32') throw new Error('Use the DPAPI setup script on Windows.');
  if (process.env.PENPOT_MCP_URL !== undefined) {
    console.warn('Warning: PENPOT_MCP_URL is set and takes precedence over the file saved here. Unset it and restart the host to use the new credential.');
  }
  const parts = [];
  let bytes = 0;
  for await (const part of process.stdin) {
    bytes += part.length;
    if (bytes > 8192) throw new Error('Input too long');
    parts.push(part);
  }
  const url = validateConnectionURL(Buffer.concat(parts).toString('utf8').trim());
  const directory = join(homedir(), '.penpot-for-chatgpt');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
    throw new Error('Unsafe directory');
  }
  await chmod(directory, 0o700);
  temporary = join(directory, '.connection-' + randomUUID() + '.tmp');
  await writeFile(temporary, JSON.stringify({ url: url.href }), { flag: 'wx', mode: 0o600 });
  await rename(temporary, join(directory, 'connection.json'));
  temporary = undefined;
  console.log('Saved local Penpot connection in a private user-only file. No network request was made.');
} catch {
  console.error('Could not save the Penpot connection. Check URL, Node.js, and home directory permissions.');
  process.exitCode = 1;
} finally {
  if (temporary) await rm(temporary, { force: true });
}
