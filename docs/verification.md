# devlab MACHINES pipeline verification — 2026-10-13

## Completed source and workflows
- Brand, official artwork and registry retained. No publishing, on-chain signing/spending, historical data deletion or BIO mint changes.
- Autonomous worker author loop: bounded safe source selection, real signed lease-bound Sonnet proposal endpoint, hard attempt/input/output/time limits, conservative persisted token reservations, owner concurrency/daily quotas and immutable attempt caching. Optional manual diff mode remains. Candidate measurements must pass calibrated thresholds before submission.
- Callback transaction: PostgreSQL row-lock RPC commits result receipt, consumed lease, candidate and two replay jobs OR replay evidence, event and machine state together. Same signed bytes return the same receipt; conflicting/cancelled/expired callbacks fail. Replays are judged separately with safely retryable atomic generation publication.
- Generation progression: snapshots contain original commit and immutable accepted patch ancestry; worker checks parent, patch digest, exact recipe bytes/digest and deterministic reconstructed candidate hashes. Atomic accepted head update. No GitHub Verified label or upstream pushes/PRs.
- Calibration: immutable image ID, architecture, toolchain, seed, full harness/dependency hash map, test identities, expected equivalence digest, exact required metric set/ranges and bounded agreement tolerance. Missing calibration blocks execution. Negative/impossible/unrecognized/unknown/missing metrics, disagreement and environment mismatches reject acceptance. Harness read-only mounts; protected tests/CI/config/locks/modes/binaries/symlinks.
- Signatures v2: exact UTF-8 serialized payload bytes signed and stored; parse only after signature verification. Every replay evidence field and candidate/job/lease/snapshot/digest is checked against those same bytes. Old canonical-signing workers must upgrade.
- Reliability: signed cancellation/heartbeat renewal, hard database deadline (20 min), downward-configurable worker deadline (max 1000 sec), command/checkout/output/disk bounds. Repository commands remain restricted Docker-only. Runnable systemd service and host setup in runner/README.md.
- Funding: owner configures self-hosted recipient; confirmed machine-specific direct SOL deposits reconcile with exact memo, signing sender/recipient, cluster and safe integer base units. Immutable receipt, atomic network+signature deduplication. No automatic debits, invented prices, hosting collection, pool liquidity conversion or fee-origin attribution without separate proof. Linked Meteora fee/trade pages retained.

## Actually exercised in this turn
### Live app and providers
- Fresh generated local test wallet authenticated via actual signed challenge; no transaction signature. Desktop 1280×1800 and mobile 390×844 checked; screenshots reviewed, no page/phone overflow errors.
- Real public GitHub repository validation initially returned main/997d1b0e86293f6897090f20159bc858e8550e3b/Apache-2.0/README. Repeated fresh lookup subsequently hit GitHub unauthenticated rate limit (403), correctly shown as an error. Full repeated fresh launch was therefore blocked; remaining flow used a clearly private verification machine based on the earlier snapshot, not fake GitHub metadata. Optional operator GITHUB_TOKEN lookup support added.
- Actual signed author proposal returned **claude-sonnet-5-5** and a real valid unified patch (controlled, labeled verification source snippet, not scientific/benchmark evidence). Identical attempt cached, no second provider call; malformed signed request 400.
- Provider health rechecked: Claude READY, model claude-sonnet-5-5, 21 input/4 output tokens, 1112 ms; Jev typesafe/jev-1.13-20260917, 276 input/20 output, 329 ms. Keys never logged or sent to sandbox.
- Register runner → queue → lease → heartbeat 200. Invalid signature 403. Concurrent identical signed failure callbacks returned [200,200], conflicting body 409. Cancellation heartbeat/callback both 409. Expired heartbeat/callback rejected through service client.
- Settings persisted; follows persisted; public test machine readable anonymously then made private and denied anonymous access. Direct client state forgery denied. Token draft preparation/link opens real retained token page, no transaction executed. Desk loads saved machine.
- Funding configuration saved through authenticated owner function, receipt controls visible desktop/mobile. No real SOL deposit was sent or reconciled: generated test wallet unfunded. Receipt parser and DB network/idempotency exercised with rollback-only fixtures.
- Main browser smoke ended with zero page errors. All Explorer/Machines/Repositories/Generations/Analytics/Launch/Desk/Docs/Profile routes loaded and legacy redirects worked. Official artwork unchanged.

### Tests and compilation
- `bunx vitest run src/lib/pipeline.integration.test.ts src/lib/machine-core.test.ts src/lib/runner-signing.test.ts src/lib/funding-core.test.ts src/lib/research-core.test.ts`: **40 passed**, five files.
- Real database tests: failure injected after candidate/replay-queue writes rolls back candidate, queues, event and receipt and retains leased status; identical replay produces one candidate/two jobs/one event; receipt conflict rejected. All fixtures rolled back, none persist.
- Real database head/receipt test: atomic head + idempotent generation; ancestry mutation rejected; receipt idempotency, same-signature cross-network separation and conflicting amount rejected. All fixtures rolled back.
- Python producer → JS consumer and JS producer → Python consumer tests cover tiny exponent/large exponent, negative zero, Unicode and reordered nested objects. Reserialization invalidates signatures, as intended.
- `python3 -m unittest discover -s runner -p 'test_*.py'`: **3 passed**. Pure protected-source and strict chain/digest/candidate checks. These mock Git application; no claim of physical commit reconstruction verification.
- Harness automatic build/typecheck latest observed: **build OK** 2026-10-13 20:30:13 UTC. No manual build/typecheck was run (platform runs them automatically).
- Local real Git fixture commit test could not execute because sandbox disallows stateful Git commands; test rewritten as pure chain checks. Docker binary unavailable, so actual isolated author/verifier execution remains untested here.

## Exact remaining setup/external dependencies
1. Dedicated Docker hosts, pinned dependency-ready images and genuinely calibrated trusted harness for target repositories; author + two distinct verifier operators. Until real independent Docker replays succeed, **not a fully operational standalone verifier network**. Physical candidate measurement and deterministic Git reconstruction need that environment.
2. Hosted desktop/compute/billing and automatic fee-to-compute program remain unconfigured external integrations. Self-hosted receipt reconciliation works independently; never equated with managed credits/runway.
3. Real funded-wallet end-to-end token creation, trades, claims, migration and deposit verification not executed. No wallet funds requested/spent.
4. GitHub anonymous lookup quota may block new validation; retry after reset or configure server-only operator GITHUB_TOKEN. No GitHub write/signing identity configured; optional fork publication deliberately not enabled, local patch-chain continuation requires none.
5. Runner identity is an operator attestation, not proof against a malicious operator or hardware remote attestation. Calibration must protect all harness imports/dependencies; opaque arbitrary commands are not certified benchmarks. Dedicated host filesystem quotas are required for hard disk isolation.
6. If a paid provider request finishes but its result cannot be saved after infrastructure failure, the pending reservation stays charged/blocked rather than silently reissuing. Operator reconciliation may be needed. This is conservative at-most-once charging behavior, not guaranteed provider exactly-once delivery.

## Changed files
src/lib/machine-core.ts/.test.ts, runner.server.ts, runner-signing.ts/.test.ts, machines.functions.ts, github.server.ts, funding-core.ts/.test.ts, funding.functions.ts, pipeline.integration.test.ts; src/routes/api/public/runner.{propose,heartbeat,judge}.ts; src/components/machine-detail.tsx, machine-funding.tsx; src/routes/docs.tsx; runner/worker.py, test_worker.py, devlab-runner.service, README.md; additive migrations 0008–0013; AGENTS.md; roadmap.md.

## Runner key proof, package and guard fixes (2026-10-13)
Completed code
- Enrollment: strict canonical Base64 → exactly 32-byte Ed25519 key, normalized hex globally unique (DB index); 5-minute single-use challenge bound to owner, label, role, key, nonce and optional replaced runner; Ed25519 proof of possession verified before an atomic consume+register function returns the one-time credential.
- Runners without proof cannot authenticate to signed endpoints (403) or lease jobs. Owners see "key NOT proven" and a "Re-enroll with proof" path that deactivates the old row once the new key is proven.
- Key separation enforced at lease (SQL), callback (server + database trigger on replay insert) and judge: replay key must differ from the proven author key and every key already used on the candidate, on top of owner/runner exclusions. Wording in UI/docs: key proof plus account separation is not Sybil resistance or proof of separate physical hosts.
- Removed the always-failing "Propose patch with Claude" control; Candidates now shows calibration and latest author-session status and explains where candidates appear. Docs show recipe v2 with labelled, placeholder-only illustrative calibration/output.
- Patch guards (JS and Python) reject `index … 120000/160000/100755`, copies/renames; worker checks Git tree modes, resolves every path under the checkout root and rejects symlinked ancestors for patches, source selection, harness reads and chain reconstruction.
- Downloadable `public/downloads/devlab-runner-v2.1.0.zip` (+ .sha256), built reproducibly by `scripts/build-runner-zip.py` from an allowlist: worker.py, devlab_enroll.py, requirements.txt, Dockerfile, systemd service, README, blank runner.env.example. Docs list copy/paste enrollment steps.

Actually exercised
- `bunx vitest run`: 7 files, 68 tests passed (new: key parsing/canonical/length, stolen key, modified challenge, reused/expired/wrong-owner challenge, key separation, index-mode guards, archive contents/reproducibility, DB enrollment fixture covering reuse/expiry/wrong owner/key mismatch/duplicate key/unproven replacement/author-key replay rejection, all rolled back).
- Python: 7 unittest tests passed (mode guards, symlink/escape containment, tree modes, CLI keygen 0600/no overwrite/sign/refuse foreign key).
- Typecheck clean; latest build OK.
- Browser (signed-in test wallet, private machine): malformed key rejected; forged signature rejected; CLI-signed challenge enrolled; proven credential leased (200, no job); same key rejected on second enrollment; ZIP download byte-identical to the built file; Docs mobile no overflow; no page errors. The test runner was then deactivated; no machine made public, no transactions signed.
- Concurrent duplicate-key enrollment is covered by the unique index + row-locked challenge (sequential DB fixture), not a parallel load test.

External dependencies only
- Dedicated Docker hosts with genuinely calibrated, dependency-ready pinned images; one author plus two verifier operators on separate accounts. No real independent replay has run.
- Hosted billing / fee-to-compute; funded-wallet chain tests; optional GitHub token for rate limits.
