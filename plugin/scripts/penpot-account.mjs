import { access, lstat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { connectionURL } from '../server/connection.mjs';

const folder = join(homedir(), '.penpot-for-chatgpt');
const file = join(folder, 'connection.json');
const command = process.argv[2] ?? 'connect';

function remoteSteps() {
  console.log('Remote MCP authentication/tool discovery: NOT CHECKED (desktop host required).');
  console.log('Active Penpot design file/tab: NOT CHECKED (read-only execute_code required).');
  console.log('IDs returned: the tab is connected; compare them with the pinned task IDs before any write/export.');
  console.log('`No Penpot instance connected`: first reconnect the intended file via File > MCP Server > Connect and rerun the probe read-only.');
  console.log('If it persists after reconnecting the intended tab, the saved key may be stale (regenerating the MCP key revokes the old one): update the saved credential via the existing secure setup, then reconnect.');
  console.log('Reload the desktop MCP connection; connect the intended Penpot file via File > MCP Server > Connect.');
  console.log('Inspect the file/page read-only before any write/export. Local VALID covers URL structure only, not authentication.');
  console.log('Before running the example: discover the connected official Penpot MCP tools and inspect their live schemas.');
  console.log('Establish the intended session first. If execute_code supports sessionId, pass the established ID unchanged.');
  console.log('Without sessionId, confirm exactly one intended tab is connected; stop on ambiguity or interrupted routing.');
  console.log('Read high_level_overview once per session, then penpot_api_info for currentFile and currentPage before execute_code.');
  console.log('Documentation retrieval alone does not verify access to a design file.');
  console.log('Run this read-only execute_code probe with the verified official tool:');
  console.log('```javascript');
  console.log('const file = penpot.currentFile;');
  console.log('const page = penpot.currentPage;');
  console.log('if (!file || !page) throw new Error("Open the intended Penpot file and connect MCP.");');
  console.log('return { file: { id: file.id, name: file.name }, page: { id: page.id, name: page.name } };');
  console.log('```');
}

function connect() {
  console.log('Connect Penpot using the official MCP URL; this is not an OAuth sign-in.');
  console.log('Open https://design.penpot.app/ > Your account > Integrations > MCP Server.');
  console.log('Copy the URL privately; never pass it as a command-line argument or paste it into chat.');
  if (process.platform === 'win32') {
    console.log('In the installed plugin directory run: powershell.exe -NoProfile -File ./scripts/penpot-setup.ps1');
    console.log('The existing setup uses hidden input and Windows DPAPI.');
  } else {
    console.log('In the installed plugin directory use a hidden Bash prompt:');
    console.log("read -r -s -p 'MCP URL: ' PENPOT_MCP_URL; printf '\\n'");
    console.log('printf %s "$PENPOT_MCP_URL" | node scripts/penpot-setup.mjs; unset PENPOT_MCP_URL');
    console.log('The existing setup stores a 0600 user-only file (not a keychain).');
  }
  console.log('In the installed plugin directory run: node scripts/penpot-account.mjs status to check local setup.');
  remoteSteps();
}

async function status() {
  const runtime = Number(process.versions.node.split('.')[0]) >= 22;
  let bundled = false;
  try { await access(new URL('../server/bridge.mjs', import.meta.url)); bundled = true; } catch {}
  console.log('Node.js 22+: ' + (runtime ? 'READY' : 'MISSING'));
  console.log('Local bridge bundle: ' + (bundled ? 'READY' : 'MISSING'));
  try {
    await connectionURL(); // The existing shared validator; never print the URL.
    const fromEnv = process.env.PENPOT_MCP_URL !== undefined;
    console.log('Local credential: VALID (' + (fromEnv ? 'environment override' : 'private user file') + ').');
  } catch (error) {
    // Existing resolver returns fixed, sanitized diagnostics.
    console.log('Local credential: NOT READY. ' + error.message);
    process.exitCode = 1;
  }
  if (!runtime || !bundled) process.exitCode = 1;
  remoteSteps();
}

function validate(info, isFile) {
  if (info.isSymbolicLink() || (isFile ? !info.isFile() : !info.isDirectory())) {
    throw new Error('Unsafe connection path');
  }
  if (process.platform !== 'win32' &&
      ((info.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && info.uid !== process.getuid()))) {
    throw new Error('Unsafe local permissions');
  }
}
async function checked(path, isFile) {
  const info = await lstat(path);
  validate(info, isFile);
  return info;
}
function identical(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size &&
    a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

async function disconnect() {
  let directory, target;
  try {
    directory = await checked(folder, false);
    target = await checked(file, true);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log('No saved local connection to remove. The remote Penpot token was not revoked.');
    return;
  }
  console.log('Only the saved credential file for this OS user will be deleted.');
  console.log('This does NOT revoke remote tokens, unset PENPOT_MCP_URL or stop the running MCP bridge.');
  console.log('Do not run setup or rotate credentials concurrently: the final check and deletion are not atomic.');
  console.log('Type DISCONNECT to confirm. Anything else preserves the file.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let confirmation;
  try { confirmation = await rl.question('Confirm: '); } finally { rl.close(); }
  if (confirmation !== 'DISCONNECT') {
    console.log('Cancelled. Existing credential preserved.');
    return;
  }
  // shortcut: recheck and unlink are not atomic; use OS-specific deletion if concurrent rotation must be supported.
  if (!identical(directory, await checked(folder, false)) ||
      !identical(target, await checked(file, true))) {
    throw new Error('Local connection path changed');
  }
  await unlink(file);
  console.log('Saved local credential removed. Restart the desktop MCP bridge.');
  if (process.env.PENPOT_MCP_URL !== undefined) {
    console.log('Environment override still exists: unset PENPOT_MCP_URL separately.');
  }
  console.log('Revoke the remote token separately from official Penpot account settings.');
}

if (!['connect', 'status', 'disconnect'].includes(command) || process.argv.length > 3) {
  console.error('Usage (installed plugin directory): node scripts/penpot-account.mjs [connect|status|disconnect]');
  process.exitCode = 1;
} else {
  try {
    if (command === 'connect') connect();
    else if (command === 'status') await status();
    else await disconnect();
  } catch {
    // No file paths, tokens or OS exception details in diagnostics.
    console.error('Connection operation stopped. Check the local private-file permissions and retry.');
    process.exitCode = 1;
  }
}
