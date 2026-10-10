import { access } from 'node:fs/promises';
import { connectionURL } from '../server/connection.mjs';

// This check intentionally makes no network request and never prints credential contents.
try {
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error('Node.js 22+ is required. Make the supported runtime available on the desktop host PATH.');
  }
  await access(new URL('../server/bridge.mjs', import.meta.url));
  console.log('Runtime and bundled bridge: available.');
} catch {
  console.error('Runtime/bridge unavailable. Check Node.js 22+ on the host PATH and restore the plugin package.');
  process.exitCode = 1;
}
if (!process.exitCode) {
  try {
    await connectionURL();
    console.log('Local connection configuration/URL: valid. Authentication is not checked. No credentials were changed; no network request was made.');
    console.log('Next: reload the host MCP connection. Documentation/tool discovery proves transport only.');
    console.log('Then run a read-only execute_code against the intended connected Penpot file to confirm live design access.');
  } catch (error) {
    // connectionURL exposes only fixed, sanitized configuration diagnostics.
    console.error(error.message);
    process.exitCode = 1;
  }
}
