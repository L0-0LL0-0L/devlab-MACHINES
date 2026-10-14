# Recipe output

Recipe v2 pins a goal, command, target metric/direction/percent, guard metrics, protected files, and a calibration block. Execution stays blocked until calibration names an immutable image ID, architecture, toolchain, holdout seed, SHA-256 of every harness file, ordered test identities, expected equivalence digest, exact metric bounds, and agreement tolerances.

The unchanged command must exit 0 and print one final JSON line from real tests.

## Illustrative calibration

> **Placeholders only — not runnable, not a measured result.**

```json
{
  "image": "sha256:<64-hex image ID of YOUR calibrated image>",
  "architecture": "x86_64",
  "toolchain": "<exact toolchain identity, e.g. node 22.x + pnpm 9.x>",
  "holdoutSeed": "<pinned seed>",
  "harness": {
    "bench/run.mjs": "<sha256 of file>",
    "bench/fixtures/input.json": "<sha256>"
  },
  "tests": ["<ordered test identity>", "<ordered test identity>"],
  "equivalenceDigest": "<digest produced by your trusted holdout checks>",
  "metrics": {
    "<target metric>": { "min": 0, "max": "<finite bound>" },
    "<guard metric>": { "min": 0, "max": "<finite bound>" }
  },
  "relativeTolerance": "<0 to 0.05>",
  "absoluteTolerance": "<0 to 0.001>"
}
```

## Illustrative final output line shape

> **Not a measured result.**

```json
{
  "metrics": {
    "<target metric>": "<measured number>",
    "<guard metric>": "<measured number>"
  },
  "testsPassed": "<boolean from real tests>",
  "equivalent": "<boolean from real holdout checks>",
  "testIdentities": ["<ordered test identity>"],
  "equivalenceDigest": "<digest>",
  "architecture": "x86_64",
  "toolchain": "<toolchain>",
  "holdoutSeed": "<seed>"
}
```
