import { connectionURL } from './connection.mjs';
import { createWriteStream } from 'node:fs';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mediaTypeEssence } from '@modelcontextprotocol/sdk/shared/mediaType.js';
import { serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';

const MAX_BYTES = 64 * 1024 * 1024;
let remote;
let local;
let output;
let diagnostics;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([remote?.close(), local?.close()]);
}

function resourceLimit() {
  if (!stopping) {
    process.exitCode = 1;
    stop();
    process.stdin.destroy();
    output?.destroy();
    const message = 'Penpot bridge resource limit exceeded (64 MiB). Reduce the export or restart the host connection.\n';
    if (diagnostics.writableLength + Buffer.byteLength(message) <= MAX_BYTES) diagnostics.end(message);
    else diagnostics.destroy();
    // A blocked native pipe write can survive destroy(); do not wait for its reader.
    setTimeout(() => process.kill(process.pid, 'SIGKILL'), 100).unref();
  }
  return new Error('Penpot bridge resource limit exceeded');
}

async function boundedFetch(input, init) {
  const response = await fetch(input, { ...init, redirect: 'error' });
  if (!response.body) return response;
  const sse = response.ok && mediaTypeEssence(response.headers.get('content-type')) === 'text/event-stream';
  let bytes = 0;
  let lineBytes = 0;
  let previousCR = false;
  let eventEnded = false;
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      if (chunk.byteLength > MAX_BYTES) throw resourceLimit();
      if (!sse) {
        bytes += chunk.byteLength;
        if (bytes > MAX_BYTES) throw resourceLimit();
      } else {
        // Bound unfinished events, not the lifetime of a persistent SSE connection.
        for (const byte of chunk) {
          if (previousCR) {
            previousCR = false;
            if (byte === 10) {
              if (++bytes > MAX_BYTES) throw resourceLimit();
              if (eventEnded) bytes = 0;
              eventEnded = false;
              continue;
            }
            if (eventEnded) bytes = 0;
            eventEnded = false;
          }
          if (++bytes > MAX_BYTES) throw resourceLimit();
          if (byte === 10 || byte === 13) {
            if (lineBytes === 0) {
              if (byte === 13) eventEnded = true;
              else bytes = 0;
            }
            lineBytes = 0;
          } else lineBytes++;
          previousCR = byte === 13;
        }
      }
      controller.enqueue(chunk);
    }
  }), { signal: init.signal });
  return new Response(body, response);
}

function writeOutput(stream, text) {
  if (stopping) return;
  if (stream.writableLength + Buffer.byteLength(text) > MAX_BYTES) {
    resourceLimit();
    return;
  }
  // Node queues writes in order; cap that queue instead of accumulating drain promises.
  stream.write(text);
}

let url;
try { url = await connectionURL(); } catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
if (url) try {
  // Cover the SDK's GET/reconnect requests as well as POST requests.
  remote = new StreamableHTTPClientTransport(url, {
    fetch: boundedFetch
  });
  local = new StdioServerTransport();
  // File-descriptor streams use asynchronous writes on Windows as well as Linux.
  output = createWriteStream(null, { fd: 1, autoClose: false });
  diagnostics = createWriteStream(null, { fd: 2, autoClose: false });
  output.once('error', () => stop());
  diagnostics.once('error', () => stop());
  remote.onmessage = message => {
    if (message.result?.protocolVersion) remote.setProtocolVersion(message.result.protocolVersion);
    writeOutput(output, serializeMessage(message));
  };
  remote.onerror = () => {
    writeOutput(diagnostics, 'Penpot connection error. Check the local MCP URL, key validity, and active Penpot tab.\n');
  };
  local.onerror = () => writeOutput(diagnostics, 'Invalid local MCP message.\n');
  local.onmessage = message => {
    remote.send(message).catch(() => {
      if (message.method && Object.hasOwn(message, 'id')) {
        writeOutput(output, serializeMessage({ jsonrpc: '2.0', id: message.id, error: {
          code: -32000, message: 'Penpot connection failed. Check local configuration and the connected Penpot file.'
        } }));
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
