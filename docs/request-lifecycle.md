# Request lifecycle

The bridge keeps each host request ID pending until its matching remote JSON-RPC response arrives. A normal JSON response and a valid POST SSE response retire the ID once and are forwarded once; a send rejection or a non-resumable SSE EOF/error retires it with one sanitized `-32000` error that says the remote outcome is unknown. The bridge never replays the request.

When the host sends `notifications/cancelled`, the bridge retires only `params.requestId` before forwarding the cancellation notification upstream. A late or duplicate response for that ID is discarded, while unrelated pending requests continue normally. Bridge shutdown clears all pending IDs before closing the transports; closing the remote transport aborts its network signal and late failures produce no synthetic replies.

`test/request-lifecycle.test.mjs` exercises the checked-in bundled bridge with a synthetic fetch for normal JSON, send rejection, EOF/error, cancellation with late duplicate replies, concurrent healthy work, and shutdown abort. `test/sse-eof.test.mjs` retains the non-resumable and resumable SSE parser regressions.
