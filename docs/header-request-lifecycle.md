# HTTP request lifecycle

The bridge gives each POST request with a JSON-RPC ID a local `AbortController`.
Its signal is combined with the transport shutdown signal before the request is
sent. A `notifications/cancelled` message aborts only the matching POST and
removes its owner so a terminal response that arrives after cancellation is
discarded.

The 180-second deadline applies only while waiting for POST response headers.
When it expires, the bridge aborts that request and returns one JSON-RPC error
stating that the remote outcome is unknown. It never resends the mutation.
Once headers arrive, the deadline is cleared and the response body keeps its
existing lifetime, including a long-lived SSE body. Other pending requests use
their own signals and continue independently.

Host shutdown aborts every owned request before closing the MCP transport. The
focused bridge tests shorten the production timer in a preload by translating
only the literal 180-second timer to 30 or 80 milliseconds; production
configuration is unchanged.

## Integration with #26

This branch reconciles #26 non-resumable POST-SSE handling with header deadlines in one source and one request-owner map. Both regression suites run against its regenerated bundle. Apply #26 before #31 when merging; #31 contains their reconciled overlapping bridge implementation and must not replace it with an older generated artifact. This is source reconciliation, not a merge of either PR into main. GET-SSE retry exhaustion (#17) remains separate.
