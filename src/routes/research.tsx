import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileUp, RotateCcw, Search, Square, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SignInPrompt, StatusPill } from "@/components/site";
import { useAuth } from "@/lib/auth";
import { RESEARCH_ROLES, roleName, type Paper } from "@/lib/research";
import { LIMITS, buildMarkdown, type ExportBundle } from "@/lib/research-core";
import { advanceRun, aiHealth, cancelRun, createRun, retryRun, searchPapers } from "@/lib/research.functions";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research workspace — biocode" },
      { name: "description", content: "Multi-role AI research over real papers: findings, hypotheses, dissent, verified citations and reproducibility packs." },
      { property: "og:title", content: "Research workspace — biocode" },
      { property: "og:description", content: "Twelve specialist AI roles review real literature with citation checks and exportable traces." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResearchPage,
});

type Provider = "all" | "crossref" | "europepmc" | "arxiv";

function ResearchPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const runs = useQuery({
    queryKey: ["research_runs", user?.id],
    enabled: !!user,
    refetchInterval: (q) => ((q.state.data ?? []).some((r) => r.status === "running" || r.status === "queued") ? 4000 : false),
    queryFn: async () => {
      const { data, error } = await supabase.from("research_runs").select("id,question,status,roles,created_at,depth,stance").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("research_runs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => { if (selected === id) setSelected(null); qc.invalidateQueries({ queryKey: ["research_runs"] }); },
  });

  return (
    <>
      <PageHeader eyebrow="research" title="Research workspace">
        Twelve specialist roles review real papers you choose. Generation: Claude Sonnet 5.5. Typed decisions (domain, relevance, role fit, claim support): Jev Latest. Every output is AI-generated and must be checked against its sources.
      </PageHeader>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {selected ? <RunDetail id={selected} onClose={() => setSelected(null)} /> : <Composer onCreated={(id) => setSelected(id)} />}
        </div>
        <aside aria-labelledby="hist" className="space-y-6">
          {user && <HealthCheck />}
          <div>
            <h2 id="hist" className="text-2xl">Run history</h2>
            <div className="mt-4 space-y-3">
              {!user && <p className="text-sm text-muted-foreground">Sign in to see your private run history.</p>}
              {user && runs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {user && runs.data?.length === 0 && <EmptyState title="No runs yet">Runs you start appear here.</EmptyState>}
              {runs.data?.map((r) => (
                <article key={r.id} className={`panel p-4 ${selected === r.id ? "ring-1 ring-foreground" : ""}`}>
                  <div className="flex items-center justify-between">
                    <StatusPill>{r.status}</StatusPill>
                    <button aria-label="Delete run" onClick={() => remove.mutate(r.id)} className="text-muted-foreground hover:text-foreground"><Trash2 size={14} /></button>
                  </div>
                  <button className="mt-3 block text-left text-sm hover:underline" onClick={() => setSelected(r.id)}>{r.question}</button>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{r.roles.length} roles · {r.depth} · {r.stance} · {new Date(r.created_at).toLocaleString()}</p>
                </article>
              ))}
              {selected && <Button variant="outline" size="sm" onClick={() => setSelected(null)}>New run</Button>}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function HealthCheck() {
  const fn = useServerFn(aiHealth);
  const m = useMutation({ mutationFn: () => fn() });
  return (
    <div className="panel p-4 text-sm">
      <div className="flex items-center justify-between"><span className="font-medium">AI provider status</span>
        <Button size="sm" variant="ghost" onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Checking…" : "Check"}</Button></div>
      {m.data && (
        <ul className="mt-2 space-y-1 font-mono text-[11px]">
          <li>Jev: {m.data.jev?.ok ? `ok · ${m.data.jev.detail}` : `unavailable · ${m.data.jev?.detail}`}</li>
          <li>Claude ({m.data.claude_model}): {m.data.claude?.ok ? `ok · ${m.data.claude.detail}` : `unavailable · ${m.data.claude?.detail}`}</li>
        </ul>
      )}
      {m.error && <p className="mt-2 text-xs text-destructive">{(m.error as Error).message}</p>}
    </div>
  );
}

function Composer({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const create = useServerFn(createRun);
  const search = useServerFn(searchPapers);
  const [question, setQuestion] = useState("");
  const [source, setSource] = useState("");
  const [roles, setRoles] = useState<string[]>(["literature_mapper", "methods_critic", "peer_review_challenger", "synthesis_editor"]);
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard");
  const [stance, setStance] = useState<"conservative" | "exploratory">("conservative");
  const [paperQ, setPaperQ] = useState("");
  const [provider, setProvider] = useState<Provider>("all");
  const [results, setResults] = useState<{ papers: Paper[]; errors: string[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [attached, setAttached] = useState<Paper[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      if (question.trim().length < 5) throw new Error("Question must be at least 5 characters");
      if (!roles.length) throw new Error("Select at least one role");
      let upload_path: string | undefined;
      if (pdf) {
        if (pdf.type !== "application/pdf") throw new Error("Only PDF files are supported");
        if (pdf.size > LIMITS.pdfBytesMax) throw new Error("PDF must be 10 MB or smaller");
        upload_path = `${user!.id}/${crypto.randomUUID()}.pdf`;
        const { error } = await supabase.storage.from("research-uploads").upload(upload_path, pdf, { contentType: "application/pdf" });
        if (error) throw new Error(error.message);
      }
      return create({ data: { question: question.trim(), source_text: source || undefined, roles, depth, stance, upload_path, papers: attached } });
    },
    onSuccess: (r) => {
      toast.success("Run started");
      setQuestion(""); setSource(""); setAttached([]); setPdf(null);
      qc.invalidateQueries({ queryKey: ["research_runs"] });
      onCreated(r.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (paperQ.trim().length < 3) return;
    setSearching(true);
    try { setResults(await search({ data: { q: paperQ.trim(), provider } })); } catch { toast.error("Paper search is unavailable right now."); }
    setSearching(false);
  }
  const toggle = (id: string) => setRoles((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const key = (p: Paper) => `${p.provider}:${p.external_id}`;

  return (
    <div className="space-y-10">
      <section aria-labelledby="q">
        <h2 id="q" className="text-2xl">1. Question</h2>
        <label className="sr-only" htmlFor="question">Research question</label>
        <textarea id="question" className="field mt-4 min-h-24" maxLength={LIMITS.questionMax} placeholder="e.g. Does rapamycin extend healthspan in mammals beyond lifespan effects?" value={question} onChange={(e) => setQuestion(e.target.value)} />
      </section>

      <section aria-labelledby="papers">
        <h2 id="papers" className="text-2xl">2. Papers <span className="font-mono text-sm text-muted-foreground">{attached.length}/{LIMITS.papersMax}</span></h2>
        <p className="mt-1 text-sm text-muted-foreground">Live metadata and abstracts from Europe PMC, Crossref and arXiv. Abstract-only sources are labeled; metadata-only sources cannot support claims.</p>
        <form onSubmit={doSearch} className="mt-4 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="pq">Search papers</label>
          <input id="pq" className="field min-w-0 flex-1" placeholder="Search the literature" value={paperQ} onChange={(e) => setPaperQ(e.target.value)} />
          <label className="sr-only" htmlFor="prov">Index</label>
          <select id="prov" className="field w-auto" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            <option value="all">All indexes</option><option value="europepmc">Europe PMC</option><option value="crossref">Crossref</option><option value="arxiv">arXiv</option>
          </select>
          <Button variant="outline" disabled={searching}><Search /> {searching ? "…" : "Search"}</Button>
        </form>
        {attached.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {attached.map((p) => (
              <li key={key(p)} className="flex items-center gap-1 border border-border px-2 py-1 text-xs">
                <span className="max-w-64 truncate">{p.title}</span>
                <button aria-label={`Remove ${p.title}`} onClick={() => setAttached((a) => a.filter((x) => key(x) !== key(p)))}><X size={12} /></button>
              </li>
            ))}
          </ul>
        )}
        {results && (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {results.errors.map((e) => <li key={e} className="py-2 text-xs text-muted-foreground">{e}</li>)}
            {results.papers.length === 0 && <li className="py-4 text-sm text-muted-foreground">No papers matched.</li>}
            {results.papers.map((p) => {
              const on = attached.some((a) => key(a) === key(p));
              return (
                <li key={key(p)} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">{p.title}</a>
                    <p className="truncate text-xs text-muted-foreground">{p.authors || "—"} · {p.venue ?? "—"} · {p.year ?? "n.d."} · {p.provider} · {p.abstract ? "abstract" : "metadata only"}</p>
                  </div>
                  <Button size="sm" variant={on ? "secondary" : "ghost"} disabled={!on && attached.length >= LIMITS.papersMax}
                    onClick={() => setAttached((a) => (on ? a.filter((x) => key(x) !== key(p)) : [...a, p]))}>{on ? "Attached" : "Attach"}</Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="src">
        <h2 id="src" className="text-2xl">3. Your sources</h2>
        <label className="sr-only" htmlFor="source">Paste source text</label>
        <textarea id="source" className="field mt-4 min-h-32 font-mono text-xs" maxLength={LIMITS.sourceTextMax} placeholder="Paste an abstract, methods section or notes…" value={source} onChange={(e) => setSource(e.target.value)} />
        <p className="mt-1 text-right font-mono text-xs text-muted-foreground">{source.length.toLocaleString()} / 50,000</p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <FileUp size={16} /> {pdf ? `${pdf.name} (${(pdf.size / 1e6).toFixed(1)} MB)` : "Attach a private PDF (max 10 MB)"}
          <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
        </label>
        {pdf && <button className="mt-1 text-xs text-muted-foreground underline" onClick={() => setPdf(null)}>Remove PDF</button>}
      </section>

      <section aria-labelledby="roles">
        <h2 id="roles" className="text-2xl">4. Specialist roles <span className="font-mono text-sm text-muted-foreground">{roles.length}/12</span></h2>
        <div className="mt-4 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Research roles">
          {RESEARCH_ROLES.map((r) => {
            const on = roles.includes(r.id);
            return (
              <button key={r.id} type="button" aria-pressed={on} onClick={() => toggle(r.id)}
                className={`p-4 text-left transition-colors ${on ? "bg-foreground text-background" : "bg-panel hover:bg-panel-2"}`}>
                <span className="block text-sm font-medium">{r.name}</span>
                <span className={`mt-1 block text-xs ${on ? "opacity-70" : "text-muted-foreground"}`}>{r.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="settings" className="grid gap-6 sm:grid-cols-2">
        <h2 id="settings" className="sr-only">Settings</h2>
        <Seg label="Depth" value={depth} onChange={setDepth} options={[["quick", "Quick"], ["standard", "Standard"], ["deep", "Deep"]]} />
        <Seg label="Stance" value={stance} onChange={setStance} options={[["conservative", "Conservative"], ["exploratory", "Exploratory"]]} />
      </section>

      {user ? (
        <div className="space-y-2">
          <Button size="lg" onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? "Starting…" : "Start research run"}</Button>
          <p className="text-xs text-muted-foreground">Limits: {LIMITS.runsPerDay} runs per 24h, {LIMITS.activeRuns} active at a time.</p>
        </div>
      ) : <SignInPrompt what="run research" />}
    </div>
  );
}

function Seg<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 inline-flex border border-border" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`px-4 py-2 text-sm ${value === v ? "bg-foreground text-background" : "hover:bg-panel-2"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function useRunData(id: string) {
  return useQuery({
    queryKey: ["research_run", id],
    refetchInterval: (q) => (q.state.data && ["running", "queued"].includes(q.state.data.run.status) ? 3000 : false),
    queryFn: async () => {
      const [run, sources, steps, findings] = await Promise.all([
        supabase.from("research_runs").select("*").eq("id", id).single(),
        supabase.from("research_sources").select("ref,provider,external_id,title,url,year,text_kind,relevance,included,authors").eq("run_id", id).order("ref"),
        supabase.from("research_steps").select("seq,kind,role,status,provider,model,prompt_version,usage,error,started_at,finished_at,summary").eq("run_id", id).order("seq"),
        supabase.from("research_findings").select("role,kind,statement,citations,support_prob,support_confidence").eq("run_id", id).order("created_at"),
      ]);
      if (run.error) throw run.error;
      return { run: run.data, sources: sources.data ?? [], steps: steps.data ?? [], findings: findings.data ?? [] };
    },
  });
}

function RunDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useRunData(id);
  const advance = useServerFn(advanceRun);
  const cancel = useServerFn(cancelRun);
  const retry = useServerFn(retryRun);
  const driving = useRef(false);
  const [drive, setDrive] = useState(0);

  // Drive the run step by step while this view is open.
  useEffect(() => {
    const status = q.data?.run.status;
    if (!status || !["queued", "running"].includes(status) || driving.current) return;
    driving.current = true;
    let stop = false;
    (async () => {
      for (let i = 0; i < 20 && !stop; i++) {
        try {
          const r = await advance({ data: { id } });
          qc.invalidateQueries({ queryKey: ["research_run", id] });
          qc.invalidateQueries({ queryKey: ["research_runs"] });
          if (r.done) { if (r.status === "failed") toast.error("error" in r ? String(r.error) : "Run failed"); break; }
        } catch (e) { toast.error((e as Error).message); break; }
      }
      driving.current = false;
    })();
    return () => { stop = true; };
  }, [q.data?.run.status, id, drive, advance, qc]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading run…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">Could not load this run.</p>;
  const { run, sources, steps, findings } = q.data;
  const done = steps.filter((s) => s.status === "done").length;
  const bundle: ExportBundle = {
    run: { id: run.id, question: run.question, depth: run.depth, stance: run.stance, status: run.status, created_at: run.created_at, prompt_version: run.prompt_version, domain: run.domain, usage: run.usage, checklist: run.checklist, roles: run.roles },
    sources: sources.map((s) => ({ ...s, relevance: s.relevance == null ? null : Number(s.relevance) })),
    steps, findings: findings.map((f) => ({ ...f, support_prob: f.support_prob == null ? null : Number(f.support_prob), support_confidence: f.support_confidence == null ? null : Number(f.support_confidence) })),
  };
  const dl = (name: string, body: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); qc.invalidateQueries({ queryKey: ["research_run", id] }); qc.invalidateQueries({ queryKey: ["research_runs"] }); setDrive((d) => d + 1); }
    catch (e) { toast.error((e as Error).message); }
  };
  const domain = run.domain as { choice?: string; confidence?: number } | null;
  const checklist = (run.checklist as { item: string; status: string; note?: string }[] | null) ?? [];

  return (
    <div className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill>{run.status}</StatusPill>
          {domain?.choice && <span className="font-mono text-xs text-muted-foreground">domain: {domain.choice} ({((domain.confidence ?? 0) * 100).toFixed(0)}%)</span>}
          <button className="ml-auto text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>← New run</button>
        </div>
        <h2 className="mt-4 text-3xl">{run.question}</h2>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{run.depth} · {run.stance} · {run.prompt_version ?? "not started"} · step {done}/{steps.length || "…"}</p>
        {run.error && <p className="mt-4 border border-destructive/50 p-3 text-sm text-destructive" role="alert">{run.error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {["queued", "running"].includes(run.status) && <Button variant="outline" size="sm" onClick={() => act(() => cancel({ data: { id } }))}><Square /> Cancel</Button>}
          {run.status === "failed" && <Button variant="outline" size="sm" onClick={() => act(() => retry({ data: { id } }))}><RotateCcw /> Retry failed step</Button>}
          <Button variant="outline" size="sm" onClick={() => dl(`biocode-${run.id}.md`, buildMarkdown(bundle, roleName), "text/markdown")}><Download /> Markdown pack</Button>
          <Button variant="outline" size="sm" onClick={() => dl(`biocode-${run.id}.json`, JSON.stringify(bundle, null, 2), "application/json")}><Download /> JSON pack</Button>
        </div>
      </div>

      <section aria-labelledby="prog">
        <h3 id="prog" className="text-xl">Progress</h3>
        <ol className="mt-3 divide-y divide-border border-y border-border">
          {steps.length === 0 && <li className="py-3 text-sm text-muted-foreground">Preparing: classifying domain and scoring sources…</li>}
          {steps.map((s) => (
            <li key={s.seq} className="py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>{s.kind === "role" ? roleName(s.role!) : s.kind === "triage" ? "Triage (Jev)" : "Claim support (Jev)"}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{s.status}{s.model ? ` · ${s.model}` : ""}</span>
              </div>
              {s.summary && <p className="mt-1 text-muted-foreground">{s.summary}</p>}
              {s.error && <p className="mt-1 text-xs text-destructive">{s.error}</p>}
            </li>
          ))}
        </ol>
      </section>

      {(["finding", "hypothesis", "dissent", "limitation"] as const).map((k) => {
        const items = findings.filter((f) => f.kind === k);
        if (!items.length) return null;
        return (
          <section key={k}>
            <h3 className="text-xl capitalize">{k === "dissent" ? "Dissent" : `${k}s`}</h3>
            <ul className="mt-3 space-y-3">
              {items.map((f, i) => (
                <li key={i} className="panel p-4 text-sm">
                  <p>{f.statement}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{roleName(f.role)}{f.support_prob != null ? ` · evidence support p=${Number(f.support_prob).toFixed(2)}` : " · no support score"}</p>
                  <ul className="mt-2 space-y-1">
                    {(f.citations as { source: string; excerpt: string; verified?: boolean }[]).map((c, j) => (
                      <li key={j} className="text-xs text-muted-foreground">
                        <span className="font-mono">[{c.source}]</span> <span className={c.verified ? "text-foreground" : ""}>{c.verified ? "verified excerpt" : "unverified excerpt"}</span>: “{c.excerpt}”
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {checklist.length > 0 && (
        <section>
          <h3 className="text-xl">Reproducibility checklist</h3>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {checklist.map((c, i) => <li key={i} className="flex justify-between gap-4 py-2 text-sm"><span>{c.item}{c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}</span><span className="font-mono text-xs">{c.status}</span></li>)}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-xl">Evidence ledger</h3>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {sources.map((s) => (
            <li key={s.ref} className="py-2 text-sm">
              <span className="font-mono text-xs">[{s.ref}]</span> {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.title}</a> : s.title}
              <span className="block font-mono text-[11px] text-muted-foreground">{s.provider}{s.external_id ? ` · ${s.external_id}` : ""} · {s.text_kind.replace(/_/g, " ")}{s.relevance != null ? ` · relevance ${Number(s.relevance).toFixed(2)}` : ""}{s.included ? "" : " · excluded as low relevance"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
