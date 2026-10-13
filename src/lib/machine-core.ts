import { z } from "zod";
export const calibrationSchema = z.object({
  image: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  architecture: z.enum(["x86_64", "aarch64"]),
  toolchain: z.string().min(1).max(200),
  holdoutSeed: z.string().min(1).max(100),
  harness: z.record(z.string().regex(/^[a-f0-9]{64}$/)),
  tests: z.array(z.string().min(1)).min(1).max(40),
  metrics: z.record(
    z.object({ min: z.number().nonnegative(), max: z.number().finite().nonnegative() }),
  ),
  relativeTolerance: z.number().min(0).max(0.05),
  absoluteTolerance: z.number().min(0).max(0.001),
  equivalenceDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const recipeSchema = z.object({
  goal: z.string().min(8).max(2000),
  command: z.string().min(1).max(500),
  metric: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  direction: z.enum(["lower", "higher"]),
  improvement: z.number().positive().max(100),
  guards: z.array(z.string()).max(20),
  protectedFiles: z.array(z.string()).max(30),
  calibration: calibrationSchema.optional(),
});
export type Recipe = z.infer<typeof recipeSchema>;
export function parseRepository(input: string) {
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "github.com" ||
    u.username ||
    u.password ||
    u.port ||
    u.search ||
    u.hash
  )
    throw new Error("Use a public https://github.com/owner/repository URL.");
  const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (
    parts.length !== 2 ||
    parts.some((p) => !/^[A-Za-z0-9_.-]+$/.test(p) || p === "." || p === "..")
  )
    throw new Error("Use the repository root, not a file or branch URL.");
  const owner = parts[0],
    name = parts[1];
  if (!owner || !name) throw new Error("Repository owner and name required");
  const repo = name.replace(/\.git$/, "");
  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}
export function patchPaths(patch: string) {
  if (/^diff --git .*"|^(?:old mode|new mode|deleted file mode)/m.test(patch))
    throw new Error("Quoted paths and file mode changes are not allowed");
  const headers = [...patch.matchAll(/^diff --git a\/([^\n]+) b\/([^\n]+)$/gm)].flatMap((m) => [
    m[1] ?? "",
    m[2] ?? "",
  ]);
  const paths = [
    ...headers,
    ...[...patch.matchAll(/^(?:\+\+\+|---) (?:[ab]\/)?([^\t\n]+)(?:\t.*)?$/gm)]
      .map((m) => m[1] ?? "")
      .filter((p) => p !== "" && p !== "/dev/null"),
  ];
  if (
    !paths.length ||
    !patch.startsWith("diff --git ") ||
    /^(?:GIT binary patch|Binary files|rename from|rename to|new mode 120000|new file mode 120000)/m.test(
      patch,
    )
  )
    throw new Error("Only textual unified git patches are allowed.");
  return [...new Set(paths)];
}
export function safeSourcePath(p: string, protectedFiles: string[] = []) {
  return (
    /^[A-Za-z0-9_./-]+$/.test(p) &&
    !p.split("/").some((x) => x === ".." || x === ".git" || x === "") &&
    !/(?:^|\/)(?:\.[^/]+|tests?|benchmarks?|harness|fixtures|runner|node_modules|vendor)(?:\/|$)|(?:lock|config|secret|credential|Dockerfile|Makefile|package\.json|requirements|\.pem$|\.key$|\.(?:test|spec)\.)/i.test(
      p,
    ) &&
    !protectedFiles.some((f) => p === f || p.startsWith(f + "/"))
  );
}
export function guardPatch(patch: string, protectedFiles: string[]) {
  if (patch.length > 200000) throw new Error("Patch exceeds 200 KB.");
  const paths = patchPaths(patch);
  for (const p of paths)
    if (
      !safeSourcePath(p, protectedFiles) ||
      p.startsWith("/") ||
      p.includes("\\") ||
      p.split("/").some((s) => s === ".." || s === ".git") ||
      /^(?:\.github\/|\.env|Dockerfile|runner\/|tests?\/|benchmarks?\/)|(?:^|\/)[^/]*\.(?:test|spec)\./.test(
        p,
      ) ||
      protectedFiles.some((f) => p === f || p.startsWith(f + "/"))
    )
      throw new Error(`Protected or unsafe patch path: ${p}`);
  return paths;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export type ReplayEvidence = {
  testsPassed: boolean;
  equivalent: boolean;
  baseline: Record<string, number>;
  candidate: Record<string, number>;
  logs: string;
  environment: string;
  architecture?: string;
  toolchain?: string;
  holdoutSeed?: string;
  harnessDigest?: string;
  testIdentities?: string[];
  baselineEquivalenceDigest?: string;
  candidateEquivalenceDigest?: string;
};
export type JudgeReplay = {
  runnerId: string;
  runnerOwner: string;
  signatureValid: boolean;
  baselineCommit: string;
  candidateCommit: string;
  patchDigest: string;
  recipeDigest: string;
  evidence: ReplayEvidence;
};
export function judge(input: {
  authorId: string;
  ownerId: string;
  baselineCommit: string;
  candidateCommit: string;
  patchDigest: string;
  recipeDigest: string;
  recipe: Recipe;
  replays: JudgeReplay[];
}) {
  const reasons: string[] = [];
  const calibration = input.recipe.calibration;
  if (!calibration) reasons.push("Recipe calibration required");
  const measured: ReplayEvidence[] = [];
  const valid = new Set<string>();
  const owners = new Set<string>();
  if (
    !/^[a-f0-9]{40}$/.test(input.baselineCommit) ||
    !/^[a-f0-9]{40}$/.test(input.candidateCommit) ||
    input.baselineCommit === input.candidateCommit
  )
    reasons.push("Pinned distinct commit hashes required");
  for (const r of input.replays) {
    if (r.runnerId === input.authorId || r.runnerOwner === input.ownerId) {
      reasons.push("Author or same-owner verifier excluded");
      continue;
    }
    if (
      !r.signatureValid ||
      r.baselineCommit !== input.baselineCommit ||
      r.candidateCommit !== input.candidateCommit ||
      r.patchDigest !== input.patchDigest ||
      r.recipeDigest !== input.recipeDigest
    ) {
      reasons.push("Replay signature or snapshot mismatch");
      continue;
    }
    if (!r.evidence.testsPassed || !r.evidence.equivalent || !r.evidence.environment) {
      reasons.push("Tests, equivalence or environment missing");
      continue;
    }
    if (calibration) {
      const e = r.evidence;
      if (
        e.environment !== calibration.image ||
        e.architecture !== calibration.architecture ||
        e.toolchain !== calibration.toolchain ||
        e.holdoutSeed !== calibration.holdoutSeed ||
        e.harnessDigest !== canonical(calibration.harness) ||
        canonical(e.testIdentities) !== canonical(calibration.tests) ||
        e.baselineEquivalenceDigest !== calibration.equivalenceDigest ||
        e.candidateEquivalenceDigest !== calibration.equivalenceDigest
      ) {
        reasons.push("Pinned harness, image, toolchain or equivalence mismatch");
        continue;
      }
    }
    const { baseline: b, candidate: c } = r.evidence;
    if (
      calibration &&
      [b, c].some(
        (m) =>
          canonical(Object.keys(m).sort()) !== canonical(Object.keys(calibration.metrics).sort()) ||
          Object.entries(m).some(
            ([k, v]) =>
              !Number.isFinite(v) ||
              v < (calibration.metrics[k]?.min ?? 0) ||
              v > (calibration.metrics[k]?.max ?? -1),
          ),
      )
    ) {
      reasons.push("Unrecognized or impossible metrics");
      continue;
    }
    const keys = [input.recipe.metric, ...input.recipe.guards];
    if (
      keys.some(
        (k) =>
          typeof b[k] !== "number" ||
          typeof c[k] !== "number" ||
          !Number.isFinite(b[k]) ||
          !Number.isFinite(c[k]),
      )
    ) {
      reasons.push("Missing, unknown or non-finite metric");
      continue;
    }
    const base = b[input.recipe.metric],
      cand = c[input.recipe.metric];
    if (typeof base !== "number" || typeof cand !== "number" || base <= 0) {
      reasons.push("Positive baseline required");
      continue;
    }
    const gain = ((input.recipe.direction === "lower" ? base - cand : cand - base) / base) * 100;
    if (gain < input.recipe.improvement) {
      reasons.push("Target improvement not reached");
      continue;
    }
    if (input.recipe.guards.some((k) => (c[k] ?? Infinity) > (b[k] ?? -Infinity))) {
      reasons.push("Metric guard regressed");
      continue;
    }
    if (owners.has(r.runnerOwner)) {
      reasons.push("Verifier owners must be distinct");
      continue;
    }
    owners.add(r.runnerOwner);
    valid.add(r.runnerId);
    measured.push(r.evidence);
  }
  if (calibration && measured.length >= 2) {
    const first = measured[0];
    if (first)
      for (const e of measured.slice(1))
        for (const phase of ["baseline", "candidate"] as const)
          for (const k of Object.keys(calibration.metrics)) {
            const a = first[phase][k] ?? NaN,
              b = e[phase][k] ?? NaN;
            if (
              Math.abs(a - b) >
              calibration.absoluteTolerance +
                calibration.relativeTolerance * Math.max(Math.abs(a), Math.abs(b))
            )
              reasons.push("Independent replay measurements disagree");
          }
  }
  if (valid.size < 2) reasons.push("Two independent verifier identities required");
  return { accepted: reasons.length === 0, reasons, verifiers: [...valid] };
}
