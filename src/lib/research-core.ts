// Pure, client-safe research logic (schemas, limits, citation checks, exports). Unit-tested.
import { z } from "zod";
import { ROLE_IDS } from "./research";

export const PROMPT_VERSION = "biocode-research-v1";
export const CLAUDE_MODEL = "claude-sonnet-5-5";
export const JEV_MODEL = "typesafe/jev-latest";

export const LIMITS = {
  questionMax: 2000,
  sourceTextMax: 50000,
  papersMax: 12,
  pdfBytesMax: 10 * 1024 * 1024,
  runsPerDay: 10,
  activeRuns: 1,
  sourceCharsPerRole: { quick: 1500, standard: 3000, deep: 6000 } as const,
  maxTokens: { quick: 2000, standard: 4000, deep: 8000 } as const,
};

export const createRunSchema = z.object({
  question: z.string().trim().min(5).max(LIMITS.questionMax),
  source_text: z.string().max(LIMITS.sourceTextMax).optional(),
  roles: z.array(z.enum(ROLE_IDS as [string, ...string[]])).min(1).max(12),
  depth: z.enum(["quick", "standard", "deep"]),
  stance: z.enum(["conservative", "exploratory"]),
  upload_path: z.string().max(300).regex(/^[0-9a-f-]{36}\/[\w.-]+\.pdf$/i).optional(),
  papers: z.array(z.object({
    provider: z.enum(["crossref", "europepmc", "arxiv"]),
    external_id: z.string().max(300),
    title: z.string().min(1).max(1000),
    authors: z.string().max(1000),
    year: z.number().int().nullable(),
    venue: z.string().max(500).nullable(),
    url: z.string().url().max(1000),
    abstract: z.string().max(20000).nullable(),
  })).max(LIMITS.papersMax),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

// Output contract every generative role must satisfy.
export const roleOutputSchema = z.object({
  summary: z.string().min(1).max(4000),
  items: z.array(z.object({
    kind: z.enum(["finding", "hypothesis", "dissent", "limitation"]),
    statement: z.string().min(1).max(1500),
    citations: z.array(z.object({
      source: z.string().max(20),
      excerpt: z.string().max(600),
    })).max(6),
  })).max(12),
  checklist: z.array(z.object({
    item: z.string().max(300),
    status: z.enum(["met", "not_met", "unclear"]),
    note: z.string().max(500).optional(),
  })).max(15).optional(),
});
export type RoleOutput = z.infer<typeof roleOutputSchema>;

/** Extract the first JSON object from model text (handles ```json fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text) ?? "";
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

/** A citation is verified only if its excerpt literally occurs in the cited source text. */
export function verifyCitation(excerpt: string, sourceText: string | null | undefined): boolean {
  if (!sourceText || excerpt.trim().length < 12) return false;
  return norm(sourceText).includes(norm(excerpt.replace(/^\.\.\.|\.\.\.$/g, "")));
}

export type SourceLite = { ref: string; title: string; body: string | null; text_kind: string };

export function annotateCitations(out: RoleOutput, sources: SourceLite[]) {
  const byRef = new Map(sources.map((s) => [s.ref, s]));
  return out.items.map((it) => ({
    ...it,
    citations: it.citations.map((c) => {
      const src = byRef.get(c.source);
      return { ...c, known_source: !!src, verified: !!src && verifyCitation(c.excerpt, src.body) };
    }),
  }));
}

/** Escape characters that would create markdown structure/links from untrusted text. */
export function escapeMd(s: string): string {
  return s.replace(/([\\`*_{}\[\]()#+\-!|>~<])/g, "\\$1").replace(/\r?\n/g, " ");
}

export type ExportBundle = {
  run: { id: string; question: string; depth: string; stance: string; status: string; created_at: string; prompt_version: string | null; domain: unknown; usage: unknown; checklist: unknown; roles: string[] };
  sources: { ref: string; provider: string; external_id: string | null; title: string; url: string | null; year: number | null; text_kind: string; relevance: number | null; included: boolean }[];
  steps: { seq: number; kind: string; role: string | null; status: string; provider: string | null; model: string | null; prompt_version: string | null; usage: unknown; error: string | null; started_at: string | null; finished_at: string | null; summary: string | null }[];
  findings: { role: string; kind: string; statement: string; citations: unknown; support_prob: number | null; support_confidence: number | null }[];
};

export function buildMarkdown(b: ExportBundle, roleName: (id: string) => string): string {
  const L: string[] = [];
  L.push(`# biocode reproducibility pack`, ``, `Run: \`${b.run.id}\``, `Question: ${escapeMd(b.run.question)}`);
  L.push(`Depth: ${b.run.depth} · Stance: ${b.run.stance} · Status: ${b.run.status} · Prompt version: ${b.run.prompt_version ?? "n/a"}`, `Created: ${b.run.created_at}`, ``);
  L.push(`> AI-generated analysis. Verify every claim against the cited sources. "verified" means the excerpt text was found verbatim in the stored source text; it does not mean the claim is true.`, ``);
  L.push(`## Sources`, ``);
  for (const s of b.sources) L.push(`- **${s.ref}** ${escapeMd(s.title)} (${s.year ?? "n.d."}) · ${s.provider}${s.external_id ? ` ${escapeMd(s.external_id)}` : ""} · ${s.text_kind}${s.included ? "" : " · excluded"}${s.relevance != null ? ` · relevance ${Number(s.relevance).toFixed(2)}` : ""}${s.url ? ` · <${s.url.replace(/[<>\s]/g, "")}>` : ""}`);
  for (const kind of ["finding", "hypothesis", "dissent", "limitation"]) {
    const items = b.findings.filter((f) => f.kind === kind);
    if (!items.length) continue;
    L.push(``, `## ${kind[0]!.toUpperCase() + kind.slice(1)}s`, ``);
    for (const f of items) {
      const cites = (f.citations as { source: string; excerpt: string; verified?: boolean }[]) ?? [];
      L.push(`- ${escapeMd(f.statement)} — _${roleName(f.role)}_${f.support_prob != null ? ` · support p=${Number(f.support_prob).toFixed(2)}` : ""}`);
      for (const c of cites) L.push(`  - ${escapeMd(c.source)} ${c.verified ? "(verified excerpt)" : "(unverified excerpt)"}: "${escapeMd(c.excerpt)}"`);
    }
  }
  const cl = (b.run.checklist as { item: string; status: string; note?: string }[] | null) ?? [];
  if (cl.length) {
    L.push(``, `## Reproducibility checklist`, ``);
    for (const c of cl) L.push(`- [${c.status === "met" ? "x" : " "}] ${escapeMd(c.item)} — ${c.status}${c.note ? `: ${escapeMd(c.note)}` : ""}`);
  }
  L.push(``, `## Trace`, ``, `| # | step | role | status | provider/model | finished |`, `|---|---|---|---|---|---|`);
  for (const s of b.steps) L.push(`| ${s.seq} | ${s.kind} | ${s.role ? roleName(s.role) : "-"} | ${s.status} | ${s.provider ?? "-"}/${s.model ?? "-"} | ${s.finished_at ?? "-"} |`);
  return L.join("\n") + "\n";
}
