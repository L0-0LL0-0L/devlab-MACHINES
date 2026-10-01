import { describe, expect, it } from "vitest";
import { annotateCitations, buildMarkdown, createRunSchema, escapeMd, extractJson, roleOutputSchema, verifyCitation } from "./research-core";

describe("role output schema", () => {
  it("accepts valid output and rejects bad kinds", () => {
    const ok = { summary: "s", items: [{ kind: "finding", statement: "x", citations: [{ source: "S1", excerpt: "abc" }] }] };
    expect(roleOutputSchema.safeParse(ok).success).toBe(true);
    expect(roleOutputSchema.safeParse({ ...ok, items: [{ ...ok.items[0], kind: "opinion" }] }).success).toBe(false);
  });
  it("extracts fenced JSON", () => {
    expect(extractJson('here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("citations", () => {
  const src = [{ ref: "S1", title: "t", text_kind: "abstract", body: "Rapamycin extended median lifespan in genetically heterogeneous mice." }];
  it("verifies verbatim excerpts only", () => {
    expect(verifyCitation("extended median lifespan in genetically", src[0]!.body)).toBe(true);
    expect(verifyCitation("doubled lifespan in humans and dogs", src[0]!.body)).toBe(false);
    expect(verifyCitation("short", src[0]!.body)).toBe(false);
  });
  it("flags unknown sources", () => {
    const out = annotateCitations({ summary: "s", items: [{ kind: "finding", statement: "x", citations: [{ source: "S9", excerpt: "extended median lifespan in" }] }] }, src);
    expect(out[0]!.citations[0]).toMatchObject({ known_source: false, verified: false });
  });
});

describe("input limits and ownership shape", () => {
  const base = { question: "Does X do Y?", roles: ["methods_critic"], depth: "quick", stance: "conservative", papers: [] };
  it("rejects unknown roles and foreign upload paths", () => {
    expect(createRunSchema.safeParse(base).success).toBe(true);
    expect(createRunSchema.safeParse({ ...base, roles: ["wizard"] }).success).toBe(false);
    expect(createRunSchema.safeParse({ ...base, upload_path: "../etc/passwd" }).success).toBe(false);
    expect(createRunSchema.safeParse({ ...base, question: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("markdown export", () => {
  it("escapes untrusted text", () => {
    expect(escapeMd("[click](javascript:x)")).toBe("\\[click\\]\\(javascript:x\\)");
    const md = buildMarkdown({ run: { id: "r", question: "# hi", depth: "quick", stance: "conservative", status: "completed", created_at: "now", prompt_version: "v1", domain: null, usage: {}, checklist: null, roles: [] }, sources: [], steps: [], findings: [{ role: "methods_critic", kind: "finding", statement: "<b>x</b>", citations: [], support_prob: 0.8, support_confidence: 0.6 }] }, (x) => x);
    expect(md).toContain("\\# hi");
    expect(md).toContain("\\<b\\>x\\</b\\>");
  });
});
