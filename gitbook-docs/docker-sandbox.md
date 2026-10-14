# Docker sandbox

The self-hosted coordinator runs outside this app. Repository commands execute in a non-root Docker container with no network, a read-only root filesystem, dropped capabilities, process/memory/CPU limits, and bounded time. No browser worker runs git, builds, or benchmarks.

## Bounds

- Jobs have a database hard deadline of 20 minutes from creation; the worker runs at most 1,000 seconds (`DEVLAB_JOB_SECONDS` may lower this) and checks cancellation with a signed heartbeat every 20 seconds.
- Commands max 180s, measurements 150s, clone 90s, output 1 MB, recipe logs 35 KB each.
- The repository checkout sits on a filesystem quota capped at 256 MB; the worker also monitors checkout size and terminates at this limit.
- `.git` is hidden; harness and dependencies are read-only bind mounts.

Prepare a pinned image containing repository dependencies before disabling network. Executable jobs require the immutable Docker image ID (`sha256:<64 hex>`); mutable tags cannot execute. Missing image, Docker, or configuration records an honest failure — never a sample result.
