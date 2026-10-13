# devlab MACHINES isolated runner

This runnable self-hosted coordinator is separate from the web application. It does not depend on Units services. No upstream code is vendored.

## Prerequisites
Docker on a dedicated Linux host (not the web runtime); Python 3.11+; a dependency-ready image for the chosen repository. Use separate host/accounts/keys for author and independent verifiers. Never mount your Docker socket or private home directory into a sandbox.

1. Build the starter image: `docker build -t devlab-sandbox:local runner/`. Extend it with the pinned repository's dependencies. Use immutable image digests in `DEVLAB_IMAGE`. Dependency installation is an operator-controlled image-build step, not a network-enabled benchmark.
2. Install the coordinator dependency: `python3 -m pip install -r runner/requirements.txt`.
3. Generate a keypair locally. Keep the signing key private:
   ```python
   from nacl.signing import SigningKey
   import base64
   key = SigningKey.generate()
   print('Private signing key:', base64.b64encode(bytes(key)).decode())
   print('Public key:', base64.b64encode(bytes(key.verify_key)).decode())
   ```
4. Sign in to the app, open a machine → Settings, and register the **public** key and role. Copy the one-time runner credential privately.
5. Set `DEVLAB_URL` to the app origin, `DEVLAB_RUNNER_TOKEN` to that credential, `DEVLAB_SIGNING_KEY` to your private Base64 key, and `DEVLAB_IMAGE` to your pinned image. Do not commit these values. Author workers also require `DEVLAB_PATCH_FILE`, a local real unified diff exported from the candidate view or supplied by your author pipeline.
6. Start `python3 runner/worker.py`. Start two verifier workers registered by owners other than the machine owner.
7. Press Run on the machine page. A missing author or hosted integration is explicitly blocked. Retry after registration. Failures remain recorded; cancelled/expired/consumed leases cannot submit results.

## Recipe contract
A baseline-pinned benchmark command must emit a final JSON line:
```json
{"metrics":{"latency":100,"memory":20},"testsPassed":true,"equivalent":true}
```
Format example, not a result. The recipe must genuinely run tests/equivalence checks and produce measurements. Metrics must be finite. Protect the command file, all imported measurement/equivalence code, fixture files, tests and guards. An arbitrary command saying `true` is not independently meaningful evidence. Operator review of recipe and pinned image is essential.

## Lease/callback contract
`POST /api/public/runner/lease` with `Authorization: Bearer <runner credential>` returns `{job:null}` or a snapshot with a one-use `lease_token`, `lease_until`, role, baseline and recipe. Leases last 10 minutes; timed-out attempts can be leased up to three times. The same runner cannot provide both required replay identities. Owner cancellation invalidates leases.

`POST /api/public/runner/callback` takes `jobId`, `leaseToken`, `status`, optional `error`, author `patch` + `candidateCommit`, or verifier `evidence` + `candidateCommit`, and Base64 `signature`. Sign canonical JSON of all fields except signature (sorted object keys). Credential and Ed25519 signature are both required. Patch path guards run before author results are accepted. Commit/digest agreement and fixed numeric guards gate generations.

## Isolation and limitations
Benchmarks run non-root, network-disabled, capability-free, read-only root, no-new-privileges, with bounded CPU/memory/pids/time. Checkout is the only writable mount; /tmp is bounded. Do not use this as a hardened multitenant public execution service without a VM/microVM outer boundary, vetted recipes, dependency/image provenance and host-level isolation monitoring. Docker alone is not a complete security boundary against kernel exploits.

This package measures real supplied patches; it is not a full autonomous author planner. Hosted desktop/compute billing, automated treasury credits, external GitHub publication and independent verifier deployments are not configured. No claim of a fully operational verifier network is made.
