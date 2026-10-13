import { describe, it, expect } from "vitest";
import {
  parseRepository,
  guardPatch,
  judge,
  canonical,
  type JudgeReplay,
  type Recipe,
} from "./machine-core";
const recipe: Recipe = {
  goal: "Improve runtime",
  command: "python benchmark.py",
  metric: "latency",
  direction: "lower",
  improvement: 5,
  guards: ["memory"],
  protectedFiles: ["benchmark.py", "tests"],
};
const baseline = "a".repeat(40),
  candidate = "b".repeat(40);
const replay = (id: string): JudgeReplay => ({
  runnerId: id,
  runnerOwner: "independent-" + id,
  signatureValid: true,
  baselineCommit: baseline,
  candidateCommit: candidate,
  patchDigest: "digest",
  recipeDigest: "recipe",
  evidence: {
    testsPassed: true,
    equivalent: true,
    baseline: { latency: 100, memory: 20 },
    candidate: { latency: 90, memory: 20 },
    logs: "real",
    environment: "image@sha256:abc",
  },
});
const input = (replays: JudgeReplay[]) => ({
  authorId: "author",
  ownerId: "owner",
  baselineCommit: baseline,
  candidateCommit: candidate,
  patchDigest: "digest",
  recipeDigest: "recipe",
  recipe,
  replays,
});
describe("Repository boundaries", () => {
  it("accepts only GitHub root HTTPS", () => {
    expect(parseRepository("https://github.com/units-agents/units-recipes").repo).toBe(
      "units-recipes",
    );
    for (const u of [
      "http://github.com/a/b",
      "https://evil.test/a/b",
      "https://github.com/a/b/tree/main",
      "https://x@github.com/a/b",
    ])
      expect(() => parseRepository(u)).toThrow();
  });
});
describe("Patch guards", () => {
  it("blocks protected benchmark", () =>
    expect(() =>
      guardPatch(
        "diff --git a/benchmark.py b/benchmark.py\n--- a/benchmark.py\n+++ b/benchmark.py\n@@ -1 +1 @@\n-a\n+b",
        recipe.protectedFiles,
      ),
    ).toThrow());
  it("blocks traversal", () =>
    expect(() => guardPatch("diff --git a/../x b/../x\n--- a/../x\n+++ b/../x", [])).toThrow());
});
describe("Acceptance judge", () => {
  it("requires two independently signed replays", () => {
    expect(judge(input([replay("v1"), replay("v2")])).accepted).toBe(true);
    expect(judge(input([replay("v1")])).accepted).toBe(false);
  });
  it("excludes author", () =>
    expect(judge(input([replay("author"), replay("v2")])).accepted).toBe(false));
  it("excludes same owner", () =>
    expect(judge(input([{ ...replay("v1"), runnerOwner: "owner" }, replay("v2")])).accepted).toBe(
      false,
    ));
  it("rejects missing metric", () => {
    const r = replay("v1");
    delete r.evidence.candidate["latency"];
    expect(judge(input([r, replay("v2")])).accepted).toBe(false);
  });
  it("rejects nonfinite metric", () => {
    const r = replay("v1");
    r.evidence.candidate["latency"] = NaN;
    expect(judge(input([r, replay("v2")])).accepted).toBe(false);
  });
  it("rejects failed tests", () => {
    const r = replay("v1");
    r.evidence.testsPassed = false;
    expect(judge(input([r, replay("v2")])).accepted).toBe(false);
  });
  it("rejects failed equivalence", () => {
    const r = replay("v1");
    r.evidence.equivalent = false;
    expect(judge(input([r, replay("v2")])).accepted).toBe(false);
  });
  it("rejects regressed guard", () => {
    const r = replay("v1");
    r.evidence.candidate["memory"] = 21;
    expect(judge(input([r, replay("v2")])).accepted).toBe(false);
  });
  it("rejects insufficient improvement", () => {
    const r = replay("v1");
    r.evidence.candidate["latency"] = 99;
    expect(judge(input([r, replay("v2")])).accepted).toBe(false);
  });
  it("rejects digest mismatch", () =>
    expect(judge(input([{ ...replay("v1"), patchDigest: "other" }, replay("v2")])).accepted).toBe(
      false,
    ));
  it("rejects signature failure", () =>
    expect(judge(input([{ ...replay("v1"), signatureValid: false }, replay("v2")])).accepted).toBe(
      false,
    ));
  it("rejects duplicate identities", () =>
    expect(judge(input([replay("v1"), replay("v1")])).accepted).toBe(false));
  it("canonicalizes signed snapshots", () =>
    expect(canonical({ b: 2, a: 1 })).toBe('{"a":1,"b":2}'));
});
describe("Verifier ownership separation", () => {
  it("rejects two identities owned by the same verifier owner", () => {
    const a = replay("v1"),
      b = replay("v2");
    b.runnerOwner = a.runnerOwner;
    expect(judge(input([a, b])).accepted).toBe(false);
  });
});
