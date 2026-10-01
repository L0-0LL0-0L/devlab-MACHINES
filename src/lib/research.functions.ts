import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DOMAINS, RESEARCH_ROLES, roleName, type Paper } from "./research";
import { LIMITS, PROMPT_VERSION, CLAUDE_MODEL, JEV_MODEL, createRunSchema, extractJson, roleOutputSchema, annotateCitations } from "./research-core";

const uuid = z.object({ id: z.string().uuid() });

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Public, bounded paper discovery across Crossref, Europe PMC and arXiv. */
export const searchPapers = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(3).max(200), provider: z.enum(["all", "crossref", "europepmc", "arxiv"]) }).parse(d))
  .handler(async ({ data }) => {
    const p = await import("./papers.server");
    const jobs: [string, Promise<Paper[]>][] = [];
    if (data.provider === "all" || data.provider === "europepmc") jobs.push(["europepmc", p.searchEuropePmc(data.q, 6)]);
    if (data.provider === "all" || data.provider === "crossref") jobs.push(["crossref", p.searchCrossref(data.q, 6)]);
    if (data.provider === "all" || data.provider === "arxiv") jobs.push(["arxiv", p.searchArxiv(data.q, 6)]);
    const settled = await Promise.allSettled(jobs.map((j) => j[1]));
    const errors: string[] = [];
    const papers: Paper[] = [];
    settled.forEach((s, i) => (s.status === "fulfilled" ? papers.push(...s.value) : errors.push(`${jobs[i][0]} unavailable`)));
    return { papers, errors };
  });

export const createRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createRunSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.upload_path && !data.upload_path.startsWith(`${userId}/`)) throw new Error("Upload does not belong to you");
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabase.from("research_runs").select("id", { count: "exact", head: true }).gte("created_at", since);
    if ((count ?? 0) >= LIMITS.runsPerDay) throw new Error(`Daily limit reached (${LIMITS.runsPerDay} runs per 24h).`);
    const { count: active } = await supabase.from("research_runs").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]);
    if ((active ?? 0) >= LIMITS.activeRuns) throw new Error("You already have an active run. Finish or cancel it first.");
    if (!data.source_text && !data.papers.length && !data.upload_path) throw new Error("Add pasted text, a PDF or at least one paper.");

    // Order roles canonically, synthesis editor last.
    const roles = RESEARCH_ROLES.map((r) => r.id).filter((id) => data.roles.includes(id));
    const { data: run, error } = await supabase.from("research_runs").insert({
      owner_id: userId, question: data.question, source_text: data.source_text ?? null, roles,
      depth: data.depth, stance: data.stance, upload_path: data.upload_path ?? null, status: "queued",
    }).select("id").single();
    if (error) throw new Error(error.message);

    const db = await admin();
    const sources = [
      ...(data.source_text ? [{ ref: "U1", provider: "user", external_id: null, title: "Pasted text", authors: null, year: null, url: null, text_kind: "user_text", body: data.source_text }] : []),
      ...(data.upload_path ? [{ ref: "PDF1", provider: "upload", external_id: data.upload_path.split("/").pop()!, title: "Uploaded PDF", authors: null, year: null, url: null, text_kind: "full_text_pdf", body: null }] : []),
      ...data.papers.map((p, i) => ({ ref: `S${i + 1}`, provider: p.provider, external_id: p.external_id, title: p.title, authors: p.authors, year: p.year, url: p.url, text_kind: p.abstract ? "abstract" : "metadata_only", body: p.abstract })),
    ].map((s) => ({ ...s, run_id: run.id, owner_id: userId }));
    const { error: se } = await db.from("research_sources").insert(sources);
    if (se) throw new Error(se.message);
    return { id: run.id };
  });

async function loadOwnedRun(supabase: Parameters<Parameters<ReturnType<typeof createServerFn>["handler"]>[0]>[0] extends never ? never : any, id: string) {
  const { data, error } = await supabase.from("research_runs").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Run not found");
  return data as { id: string; owner_id: string; question: string; roles: string[]; depth: "quick" | "standard" | "deep"; stance: string; status: string; stage: string; cancel_requested: boolean; upload_path: string | null; usage: Record<string, number> };
}

export const cancelRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uuid.parse(d))
  .handler(async ({ data, context }) => {
    const run = await loadOwnedRun(context.supabase, data.id);
    if (!["queued", "running", "failed"].includes(run.status)) return { status: run.status };
    const db = await admin();
    await db.from("research_runs").update({ status: "cancelled", cancel_requested: true, updated_at: new Date().toISOString() }).eq("id", run.id);
    await db.from("research_steps").update({ status: "skipped" }).eq("run_id", run.id).in("status", ["pending", "running"]);
    return { status: "cancelled" };
  });

export const retryRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uuid.parse(d))
  .handler(async ({ data, context }) => {
    const run = await loadOwnedRun(context.supabase, data.id);
    if (run.status !== "failed") throw new Error("Only failed runs can be retried");
    const db = await admin();
    await db.from("research_steps").update({ status: "pending", error: null }).eq("run_id", run.id).eq("status", "failed");
    await db.from("research_runs").update({ status: "running", error: null, updated_at: new Date().toISOString() }).eq("id", run.id);
    return { status: "running" };
  });

/** Executes exactly one bounded unit of work for the run and returns. The client loops. */
export const advanceRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uuid.parse(d))
  .handler(async ({ data, context }) => {
    const run = await loadOwnedRun(context.supabase, data.id);
    if (["completed", "cancelled", "failed"].includes(run.status)) return { status: run.status, done: true };
    const db = await admin();
    const now = () => new Date().toISOString();
    const { data: sources } = await db.from("research_sources").select("*").eq("run_id", run.id).order("ref");
    const srcs = sources ?? [];

    try {
      if (run.stage === "prepare") {
        await db.from("research_runs").update({ status: "running", prompt_version: PROMPT_VERSION, updated_at: now() }).eq("id", run.id);
        const qs: Record<string, any> = {
          domain: { type: "choice", instructions: "Which scientific domain does this research question belong to?", criteria: DOMAINS },
          answerable: { type: "noul", instructions: "Is this a scientific research question that can be examined with published evidence?" },
        };
        const tri = await jev(`Research question: ${run.question}`, qs);
        const rel: Record<string, number> = {};
        const relQs = Object.fromEntries(srcs.filter((s) => s.body).map((s) => [s.ref, { type: "noul", instructions: `Is the source titled "${s.title}" relevant to answering the research question?` }]));
        let relUsage = { input_tokens: 0, output_tokens: 0 };
        if (Object.keys(relQs).length) {
          const r = await jev({ question: run.question, sources: Object.fromEntries(srcs.filter((s) => s.body).map((s) => [s.ref, `${s.title}\n${(s.body ?? "").slice(0, 1500)}`])) }, relQs);
          for (const [k, a] of Object.entries(r.answers)) if (a.type === "noul") rel[k] = a.noul;
          relUsage = r.usage ?? relUsage;
        }
        for (const s of srcs) if (rel[s.ref] != null) await db.from("research_sources").update({ relevance: rel[s.ref], included: rel[s.ref] >= 0.25 || s.provider === "user" }).eq("id", s.id);
        const roleQs = Object.fromEntries(RESEARCH_ROLES.map((r) => [r.id, { type: "noul", instructions: `Would a "${r.name}" (${r.desc}) add substantial value for this question?` }]));
        const rr = await jev(`Research question: ${run.question}`, roleQs);
        const roleFit = Object.fromEntries(Object.entries(rr.answers).map(([k, a]) => [k, a.type === "noul" ? a.noul : null]));
        const steps = [
          { seq: 0, kind: "triage", role: null, status: "done", provider: "lovable-gateway", model: tri.model, prompt_version: PROMPT_VERSION, summary: "Domain classification, source relevance and role fit (typed decisions).", output: { domain: tri.answers.domain, answerable: tri.answers.answerable, relevance: rel, role_fit: roleFit }, usage: { triage: tri.usage, relevance: relUsage, roles: rr.usage }, started_at: now(), finished_at: now() },
          ...run.roles.map((role, i) => ({ seq: i + 1, kind: "role", role, status: "pending" })),
          { seq: run.roles.length + 1, kind: "support", role: null, status: "pending" },
        ].map((s) => ({ ...s, run_id: run.id, owner_id: run.owner_id }));
        await db.from("research_steps").insert(steps);
        await db.from("research_runs").update({ stage: "steps", domain: { ...(tri.answers.domain as object), answerable: (tri.answers.answerable as any)?.noul }, updated_at: now() }).eq("id", run.id);
        return { status: "running", done: false };
      }

      const { data: step } = await db.from("research_steps").select("*").eq("run_id", run.id).in("status", ["pending", "running"]).order("seq").limit(1).maybeSingle();
      if (!step) {
        await db.from("research_runs").update({ status: "completed", stage: "done", updated_at: now() }).eq("id", run.id);
        return { status: "completed", done: true };
      }
      await db.from("research_steps").update({ status: "running", started_at: now() }).eq("id", step.id);

      if (step.kind === "role") {
        const role = RESEARCH_ROLES.find((r) => r.id === step.role)!;
        const included = srcs.filter((s) => s.included);
        const cap = LIMITS.sourceCharsPerRole[run.depth];
        const corpus = included.filter((s) => s.body).map((s) => `[${s.ref}] ${s.title}${s.year ? ` (${s.year})` : ""} — ${s.text_kind}\n${(s.body ?? "").slice(0, cap)}`).join("\n\n");
        const meta = included.filter((s) => !s.body && s.provider !== "upload").map((s) => `[${s.ref}] ${s.title} — metadata only, no text available`).join("\n");
        let prior = "";
        if (role.id === "synthesis_editor") {
          const { data: done } = await db.from("research_steps").select("role,summary").eq("run_id", run.id).eq("kind", "role").eq("status", "done");
          prior = (done ?? []).map((d) => `${roleName(d.role!)}: ${d.summary}`).join("\n\n");
        }
        const content: any[] = [];
        if (run.upload_path && included.some((s) => s.ref === "PDF1")) {
          const { data: blob, error } = await db.storage.from("research-uploads").download(run.upload_path);
          if (error || !blob) throw new AiError("Could not read uploaded PDF", "upstream");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (bytes.byteLength > LIMITS.pdfBytesMax) throw new AiError("PDF exceeds 10 MB", "bad_output");
          content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") } });
        }
        content.push({ type: "text", text: `Research question: ${run.question}\n\nSOURCES (cite by ref; [PDF1] is the attached document if present):\n${corpus || "(no source text)"}${meta ? `\n\n${meta}` : ""}${prior ? `\n\nPRIOR ROLE SUMMARIES:\n${prior}` : ""}` });
        const system = `You are the "${role.name}" in a multi-role scientific review (prompt ${PROMPT_VERSION}). ${role.focus}
Stance: ${run.stance === "conservative" ? "conservative — only claims directly supported by the sources; flag speculation" : "exploratory — you may propose bolder hypotheses, but label them as hypotheses"}.
Rules: Use ONLY the supplied sources. Never invent papers, numbers, or citations. Each citation must quote a short verbatim excerpt (12-300 chars) copied exactly from the cited source. Abstract-only sources cannot support claims about methods details not in the abstract. Do not reveal private reasoning; give conclusions with brief justification.
Return ONLY a JSON object: {"summary": string, "items": [{"kind": "finding"|"hypothesis"|"dissent"|"limitation", "statement": string, "citations": [{"source": "S1", "excerpt": "verbatim text"}]}]${role.id === "reproducibility_reviewer" ? `, "checklist": [{"item": string, "status": "met"|"not_met"|"unclear", "note": string}]` : ""}}. Max 8 items.`;
        const r = await claude({ system, content, maxTokens: LIMITS.maxTokens[run.depth] });
        const parsed = roleOutputSchema.safeParse(extractJson(r.text));
        if (!parsed.success) throw new AiError(`Model output failed schema validation: ${parsed.error.issues[0]?.message}`, "bad_output");
        const items = annotateCitations(parsed.data, srcs);
        if (items.length) await db.from("research_findings").insert(items.map((it) => ({ run_id: run.id, owner_id: run.owner_id, step_id: step.id, role: role.id, kind: it.kind, statement: it.statement, citations: it.citations })));
        if (parsed.data.checklist) await db.from("research_runs").update({ checklist: parsed.data.checklist }).eq("id", run.id);
        await db.from("research_steps").update({ status: "done", provider: "anthropic", model: r.model, prompt_version: PROMPT_VERSION, summary: parsed.data.summary, output: { items_count: items.length, stop_reason: r.stop }, usage: r.usage, finished_at: now() }).eq("id", step.id);
      } else if (step.kind === "support") {
        const { data: fs } = await db.from("research_findings").select("id,statement,citations").eq("run_id", run.id);
        const byRef = new Map(srcs.map((s) => [s.ref, s]));
        const cited = (fs ?? []).filter((f) => (f.citations as any[]).length).slice(0, 40);
        let usage = null, model = JEV_MODEL;
        if (cited.length) {
          const state = Object.fromEntries(cited.map((f, i) => [`c${i}`, { claim: f.statement, evidence: (f.citations as any[]).map((c) => `[${c.source}] ${c.excerpt}${byRef.get(c.source) ? "" : " (unknown source)"}`).join("\n") }]));
          const qs = Object.fromEntries(cited.map((_, i) => [`c${i}`, { type: "noul", instructions: `Does the evidence under key c${i} directly support its claim?` }]));
          const r = await jev(state, qs);
          usage = r.usage; model = r.model;
          for (const [i, f] of cited.entries()) {
            const a = r.answers[`c${i}`];
            if (a?.type === "noul") await db.from("research_findings").update({ support_prob: a.noul, support_confidence: Math.abs(a.noul - 0.5) * 2 }).eq("id", f.id);
          }
        }
        await db.from("research_steps").update({ status: "done", provider: "lovable-gateway", model, prompt_version: PROMPT_VERSION, summary: `Claim-support probabilities for ${cited.length} cited claims.`, usage, finished_at: now() }).eq("id", step.id);
      }
      return { status: "running", done: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("research_steps").update({ status: "failed", error: msg.slice(0, 1000), finished_at: now() }).eq("run_id", run.id).eq("status", "running");
      await db.from("research_runs").update({ status: "failed", error: msg.slice(0, 1000), updated_at: now() }).eq("id", run.id);
      return { status: "failed", done: true, error: msg, code: e instanceof AiError ? e.code : "upstream" };
    }
  });

import { AiError, claude, jev } from "./ai.server";

/** Live non-financial provider health checks. */
export const aiHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const out: Record<string, { ok: boolean; detail: string }> = {};
    try { const r = await jev("Health check: is water wet?", { ok: { type: "noul", instructions: "Is this a yes/no question?" } }); out.jev = { ok: true, detail: r.model }; }
    catch (e) { out.jev = { ok: false, detail: (e as Error).message }; }
    try { const r = await claude({ system: "Reply with the word ok.", content: [{ type: "text", text: "ping" }], maxTokens: 16 }); out.claude = { ok: true, detail: r.model }; }
    catch (e) { out.claude = { ok: false, detail: (e as Error).message }; }
    return { ...out, claude_model: CLAUDE_MODEL };
  });
