import { readFileSync } from 'node:fs';
import { validateConnectionURL } from '../server/connection.mjs';

try { validateConnectionURL(readFileSync(0, 'utf8')); }
catch { process.exitCode = 1; }
