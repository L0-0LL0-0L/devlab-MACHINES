# devlab MACHINES isolated runner v2

No repository scripts run in the web application or on the coordinator host. No Units services or vendored code are used. Autonomous authoring is implemented; actual execution requires Docker hosts and calibrated repository recipes.

## Host setup
Use dedicated Linux VMs for author and two distinct verifier owners, Python 3.11+, Docker Engine. A Docker-group coordinator effectively controls its dedicated host: never share it with production workloads. Put the repository checkout on a filesystem quota capped at 256 MB; the worker also monitors the checkout size and terminates at this limit. Disable Docker container logging or cap daemon log sizes. Keep host credentials outside the checkout and do not mount the home directory or Docker socket into containers.

1. Build `runner/Dockerfile` as a starter, extend it to install the repository dependencies and a trusted calibrated benchmark/equivalence harness. Pin the resulting Docker **image ID** `sha256:<64 hex>` in machine calibration. Mutable tags cannot execute.
2. Install `python3 -m venv /opt/devlab/venv`, then `/opt/devlab/venv/bin/pip install -r runner/requirements.txt`. Place worker.py in /opt/devlab/runner.
3. Generate Ed25519 keys on the coordinator. Register ONLY the Base64 public key under machine Settings. Put the signing seed and one-time runner credential into `/etc/devlab/runner.env` (permissions 0600; never commit or log it): `DEVLAB_URL`, `DEVLAB_RUNNER_TOKEN`, `DEVLAB_SIGNING_KEY`. No Anthropic key goes on the runner or in its sandbox.
4. Optional `DEVLAB_PATCH_FILE` selects manual mode. Default author mode asks the authenticated app for a real patch from at most six safe source files (8 KB aggregate; server caps the entire serialized prompt to 11 KB). Three provider attempts maximum (DEVLAB_MAX_ATTEMPTS may lower this); each reserves 14,000 tokens conservatively, maximum 84,000 reserved per owner/day and one pending request per owner. Pending unknown requests are not reissued under new IDs to evade quotas. Provider timeout 110s; output capped at 3,000 tokens.
5. Install `devlab-runner.service`, create a devlab-runner system user on this dedicated host, grant Docker access, then enable the service. Use an operator-managed service or job to poll the runner. No new paid service is required by the source package.
6. Register two verifier workers under different accounts from one another and the author owner. Same owner/author exclusions are enforced at lease, callback and judge.

## Calibration
Draft creation remains usable. Execution is blocked until Settings → Recipe calibration JSON contains:
- `image`: immutable Docker image ID; `architecture`: x86_64 or aarch64; `toolchain`: exact toolchain identity; `holdoutSeed`: pinned seed.
- `harness`: map of ALL measurement/equivalence scripts and imported dependencies/fixtures to SHA-256 hashes. Use canonical ASCII repository paths. These files are read-only bind mounts; verify their hashes before every execution.
- `tests`: fixed ordered test identity list; `equivalenceDigest`: expected digest from the real trusted holdout checks.
- `metrics`: EXACT metric set, each with nonnegative min and finite max bounds. Include target and every guard.
- `relativeTolerance` (0–0.05) and `absoluteTolerance` (0–0.001) for agreement across every baseline/candidate metric.

The unchanged trusted command must exit 0 and emit a final JSON record: `metrics`, `testsPassed`, `equivalent`, `testIdentities`, `equivalenceDigest`, `architecture`, `toolchain`, `holdoutSeed`. These must come from actual tests/holdout outcomes, not copied success booleans. Operator calibration/harness review is necessary; arbitrary self-reporting commands are not certified benchmarks. The signed runner is a trusted operator attestation, not hardware remote attestation.

## Bounds and isolation
Jobs have a database hard deadline of 20 minutes from creation; worker runs at most 1,000 seconds (DEVLAB_JOB_SECONDS may lower this) and checks cancellation with a signed heartbeat every 20 seconds. Renewal lasts up to three minutes but never extends the hard deadline. Commands max 180s, measurements 150s, clone 90s, output 1 MB, recipe logs 35 KB each. Filesystem monitoring plus required host quota bounds disk usage. Docker is non-root, network disabled, read-only root, caps dropped, CPU/memory/pids limited, tmpfs bounded; .git hidden, harness/dependencies read-only. Missing image/Docker/configuration records failure, never a sample result.

Author measures the original baseline, obtains a real proposal, applies only safe text files and deterministic commits, executes the unchanged harness and checks tests/equivalence/metric/guard thresholds. Failed candidates feed bounded error feedback into the next attempt. Three failures terminate the job. Verifiers independently reconstruct the accepted chain and proposed candidate; exact commits/patch/recipe/evidence digests must match.

## Generation continuation
Snapshots include original pinned GitHub commit plus immutable accepted patch chain. Worker checks every parent, patch digest and deterministic commit before starting at accepted head. Accepted head and ancestry update in one locked database operation. Candidate commits are local unsigned reconstruction identities, **not GitHub Verified**. No upstream pushes/PRs and no signing identity is claimed. Optional operator-fork publication is not enabled; local chain continuation needs no GitHub write credentials.

## Protocol v2 (breaking change for old runners)
All signed endpoints use `{payload: '<exact JSON string>', signature: '<Base64 Ed25519>'}` plus bearer runner credential. Sign exact UTF-8 payload bytes; never parse/reserialize before verifying. Python serialize uses allow_nan=False. Tiny/exponent/negative-zero/Unicode formatting is preserved as signed bytes, so no cross-language canonical number conversion is necessary.

- `POST /api/public/runner/lease` unsigned bearer request returns current immutable job snapshot.
- `heartbeat`: signed jobId + leaseToken. Cancels/expiry → 409.
- `propose`: signed jobId, leaseToken, attemptId, bounded files and failure feedback. Active owner author lease required. Same attempt+bytes cached; changed bytes rejected. Pending → 202, terminal result cached; quotas → 429.
- `callback`: signed jobId, leaseToken, completed/failed status and actual evidence/patch/candidateCommit. One transactional receipt commits lease consumption, candidate+two replay jobs OR replay evidence, and event. Identical receipts → same 200; different/expired/cancelled → 409.
- `judge`: candidateId; only author owner or actual replay participant. Revalidates exact stored signature bytes, parsed evidence fields and leased snapshot. Retry after interruption; no second generation or conflicting head.

## Funding
Owner can configure a self-hosted recipient and reconcile a confirmed direct SOL transfer with exact `devlab:<machine UUID>` memo. Receipt verifies network, signing sender, recipient and integer lamports. Network+signature prevents double counting. Deposits are owner-controlled receipts, NOT managed hosted credits; token fee claims and pool reserves stay separate. No automatic wallet debits or invented provider prices. Confirmed fee transfers deposited this way remain received deposits; no fee origin claim without a separate verified fee receipt.

## Verification
`python3 -m unittest discover -s runner -p 'test_*.py'` exercises pure chain rules without executing Git commands. The sandbox environment forbids stateful Git commands, so real commit reconstruction and Docker runs need the dedicated host. See docs/verification.md for real provider/lease/callback/rollback checks and remaining external setup.
