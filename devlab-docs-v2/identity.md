# Identity & provenance

Machine IDs, pinned snapshots, candidates, signatures, replay receipts, and accepted-generation decisions are inspectable on public machine pages.

Runner bearer credentials are shown once to their owner; private signing keys stay on the runner host and are never sent to the app.

## Signing protocol (v2)

All signed endpoints use `{payload: '<exact JSON string>', signature: '<Base64 Ed25519>'}` plus the bearer runner credential. Runners sign exact UTF-8 payload bytes; the server never parses and reserializes before verifying, so tiny/exponent/negative-zero/Unicode formatting is preserved as signed bytes with no cross-language canonical number conversion.

- `POST /api/public/runner/lease` — unsigned bearer request returning the current immutable job snapshot.
- `heartbeat` — signed jobId + leaseToken. Cancels/expiry return 409.
- `propose` — signed jobId, leaseToken, attemptId, bounded files, and failure feedback. Requires an active owned author lease. Same attempt + bytes are cached; changed bytes are rejected. Pending returns 202; quota exhaustion returns 429.
- `callback` — signed jobId, leaseToken, completed/failed status, and actual evidence/patch/candidateCommit. One transactional receipt commits lease consumption, candidate + two replay jobs or replay evidence, and the event. Identical receipts return the same 200; different, expired, or cancelled receipts return 409.
- `judge` — candidateId; only the author owner or an actual replay participant. Revalidates exact stored signature bytes, parsed evidence fields, and the leased snapshot. Retryable after interruption; never creates a second generation or a conflicting head.
