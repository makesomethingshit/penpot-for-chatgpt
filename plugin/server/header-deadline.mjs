// Bound the wait for POST response headers only, not long-lived SSE bodies.
// Timeout means the remote outcome is unknown; do not replay mutations.
export async function fetchWithHeaderDeadline(fetchImpl, input, init, timeoutMs = 180_000) {
  const controller = new AbortController();
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Penpot response headers timed out. Remote outcome unknown; inspect the intended file before retrying.');
      error.name = 'TimeoutError';
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetchImpl(input, { ...init, signal }), expired]);
  } finally {
    clearTimeout(timer);
  }
}
