import { AsyncLocalStorage } from 'node:async_hooks';
import { createParser } from 'eventsource-parser';
import { connectionURL } from './connection.mjs';
import { fetchWithHeaderDeadline } from './header-deadline.mjs';
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
let initializeRequestId;
const requestOwners = new Map();
// SDK stream readers and reconnect timers inherit the send context. Initial GETs
// stay transport-owned; only GET resumption belongs to the original POST.
const requestContext = new AsyncLocalStorage();
function failPendingRequest(id, message, owner) {
  if (requestOwners.get(id) !== owner) return;
  if (!requestOwners.delete(id) || stopping) return;
  if (initializeRequestId === id) initializeRequestId = undefined;
  writeOutput(output, serializeMessage({ jsonrpc: '2.0', id, error: { code: -32000, message } }));
}

function requestIdOfMessage(message) {
  return message && !Array.isArray(message) && typeof message.method === 'string' && Object.hasOwn(message, 'id') && message.id !== undefined
    ? message.id : undefined;
}

function requestIdOfBody(body) {
  if (typeof body !== 'string') return;
  try { return requestIdOfMessage(JSON.parse(body)); } catch { return; }
}

function combinedSignal(...signals) {
  const available = signals.filter(Boolean);
  return available.length > 1 ? AbortSignal.any(available) : available[0];
}

async function stop() {
  if (stopping) return;
  stopping = true;
  for (const owner of requestOwners.values()) owner.controller.abort();
  requestOwners.clear();
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
  const requestId = init.method === 'POST' ? requestIdOfBody(init.body) : undefined;
  const resuming = init.method === 'GET' && new Headers(init.headers).has('last-event-id');
  const owner = requestId === undefined ? (resuming ? requestContext.getStore() : undefined) : requestContext.getStore();
  // Complete this cancelled SDK resume locally, without opening a remote stream
  // or rejecting (which would cause another SDK retry). Other GETs stay intact.
  if (resuming && owner?.cancelled) return new Response(null, { status: 405 });
  const options = {
    ...init,
    signal: combinedSignal(init.signal, owner?.controller.signal),
    redirect: 'error'
  };
  if (requestId !== undefined && (!owner || owner.cancelled)) {
    throw new DOMException('Request was cancelled', 'AbortError');
  }
  const response = init.method === 'POST'
    ? await fetchWithHeaderDeadline(fetch, input, options)
    : await fetch(input, options);
  if (!response.body) return response;
  const sse = response.ok && mediaTypeEssence(response.headers.get('content-type')) === 'text/event-stream';
  let bytes = 0;
  let lineBytes = 0;
  let previousCR = false;
  let eventEnded = false;
  let resumableId = false;
  let postRequestIds = [];
  if (sse && init.method === 'POST' && typeof init.body === 'string') {
    try {
      const messages = JSON.parse(init.body);
      postRequestIds = (Array.isArray(messages) ? messages : [messages])
        .filter(message => message && typeof message.method === 'string' && Object.hasOwn(message, 'id'))
        .map(message => ({ id: message.id, owner }));
    } catch { /* Never log a sensitive request body. */ }
  }
  const decoder = postRequestIds.length ? new TextDecoder() : undefined;
  const parser = decoder && createParser({
    onEvent: event => { if (event.id) resumableId = true; }
  });
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
      if (parser) parser.feed(decoder.decode(chunk, { stream: true }));
      controller.enqueue(chunk);
    }
  }), { signal: options.signal });
  if (!postRequestIds.length) return new Response(body, response);
  // The SDK handles POST SSE asynchronously: send() may resolve before the stream
  // closes without a JSON-RPC result. Preserve backpressure and do not replay edits.
  const reader = body.getReader();
  const checkedBody = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          if (!resumableId) setImmediate(() => postRequestIds.forEach(({ id, owner }) =>
            failPendingRequest(id, 'Penpot response stream ended without a reply. Remote outcome unknown; inspect the intended file before retrying.', owner)
          ));
        } else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
        if (!resumableId) setImmediate(() => postRequestIds.forEach(({ id, owner }) =>
          failPendingRequest(id, 'Penpot response stream failed before a reply. Remote outcome unknown; inspect the intended file before retrying.', owner)
        ));
      }
    },
    cancel(reason) { return reader.cancel(reason); }
  });
  return new Response(checkedBody, response);
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
  local = new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: MAX_BYTES });
  // Windows stdio pipes block synchronously; POSIX already uses async pipe writes.
  output = process.platform === 'win32' ? createWriteStream(null, { fd: 1, autoClose: false }) : process.stdout;
  diagnostics = process.platform === 'win32' ? createWriteStream(null, { fd: 2, autoClose: false }) : process.stderr;
  output.once('error', () => { process.exitCode = 1; stop(); });
  diagnostics.once('error', () => { process.exitCode = 1; stop(); });
  remote.onmessage = message => {
    const terminal = Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error');
    if (Object.hasOwn(message, 'id') && terminal) {
      const owner = requestOwners.get(message.id);
      if (!owner || owner.cancelled) return;
      requestOwners.delete(message.id);
    }
    // Only the matching initialize response is allowed to negotiate HTTP protocol headers.
    if (initializeRequestId !== undefined && message.id === initializeRequestId) {
      initializeRequestId = undefined;
      if (typeof message.result?.protocolVersion === 'string') {
        remote.setProtocolVersion(message.result.protocolVersion);
      }
    }
    writeOutput(output, serializeMessage(message));
  };
  remote.onerror = () => {
    writeOutput(diagnostics, 'Penpot connection error. Check the local MCP URL, key validity, and active Penpot tab.\n');
  };
  local.onerror = () => {
    if (stopping) return;
    process.exitCode = 1;
    writeOutput(diagnostics, 'Invalid local MCP message or frame exceeds 64 MiB. Restart the host connection.\n');
    stop();
    process.stdin.destroy();
    // Close extra Windows pipe writers on a fatal parser error; flush the safe diagnostic first.
    if (process.platform === 'win32') {
      output.end();
      diagnostics.end();
    }
  };
  local.onmessage = message => {
    const requestId = requestIdOfMessage(message);
    const requestOwner = requestId === undefined ? undefined : { controller: new AbortController(), cancelled: false };
    if (requestOwner) requestOwners.set(requestId, requestOwner);
    if (message.method === 'notifications/cancelled') {
      const owner = requestOwners.get(message.params?.requestId);
      if (owner) {
        owner.cancelled = true;
        owner.controller.abort();
        requestOwners.delete(message.params.requestId);
      }
    }
    if (message.method === 'initialize' && Object.hasOwn(message, 'id')) {
      initializeRequestId = message.id;
    }
    requestContext.run(requestOwner, () => remote.send(message)).catch(error => {
      const currentOwner = requestId === undefined ? undefined : requestOwners.get(requestId);
      if (requestOwner && currentOwner === requestOwner && !requestOwner.cancelled) {
        requestOwners.delete(requestId);
      }
      if (typeof message.method === 'string' && Object.hasOwn(message, 'id')) {
        if (!requestOwner || currentOwner !== requestOwner || requestOwner.cancelled || stopping) return;
        writeOutput(output, serializeMessage({ jsonrpc: '2.0', id: message.id, error: {
          code: -32000, message: error?.name === 'TimeoutError'
            ? 'Penpot response headers timed out. Remote outcome unknown; inspect the intended file before retrying.'
            : 'Penpot connection failed. Remote outcome unknown; inspect the intended file before retrying.'
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
