import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SignInPrompt, StatusPill } from "@/components/site";
import { useAuth } from "@/lib/auth";
import { RESEARCH_ROLES, searchPapers, type Paper } from "@/lib/research";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research workspace — biocode" },
      { name: "description", content: "Frame a research question, paste sources, search papers and pick from 12 specialist research roles." },
      { property: "og:title", content: "Research workspace — biocode" },
      { property: "og:description", content: "AI-assisted DeSci research with specialist roles and run history." },
    ],
  }),
  component: ResearchPage,
});

const runSchema = z.object({
  question: z.string().trim().min(5, "Question must be at least 5 characters").max(2000),
  source_text: z.string().max(50000).optional(),
  roles: z.array(z.string()).min(1, "Select at least one role"),
});

function ResearchPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [source, setSource] = useState("");
  const [roles, setRoles] = useState<string[]>(["literature", "methods", "statistics"]);
  const [paperQ, setPaperQ] = useState("");
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [attached, setAttached] = useState<Paper[]>([]);

  const runs = useQuery({
    queryKey: ["research_runs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("research_runs").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const p = runSchema.parse({ question, source_text: source || undefined, roles });
      const refs = attached.map((a) => `- ${a.title} (${a.year ?? "n.d."}) ${a.url}`).join("\n");
      const { error } = await supabase.from("research_runs").insert({
        owner_id: user!.id,
        question: p.question,
        source_text: [p.source_text, refs && `Attached papers:\n${refs}`].filter(Boolean).join("\n\n") || null,
        paper_query: paperQ || null,
        roles: p.roles,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Run saved and queued. AI execution connects in the next release.");
      setQuestion(""); setSource(""); setAttached([]);
      qc.invalidateQueries({ queryKey: ["research_runs"] });
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0].message : (e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("research_runs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["research_runs"] }),
  });

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (paperQ.trim().length < 3) return;
    setSearching(true);
    try { setPapers(await searchPapers(paperQ.trim())); } catch { toast.error("Paper search is unavailable right now."); }
    setSearching(false);
  }

  const toggle = (id: string) => setRoles((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  return (
    <>
      <PageHeader eyebrow="research" title="Research workspace">
        Compose a run from a question, source text, papers and specialist roles. <StatusPill>AI analysis not yet connected · runs are saved as queued</StatusPill>
      </PageHeader>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <section aria-labelledby="q">
            <h2 id="q" className="text-2xl">1. Question</h2>
            <label className="sr-only" htmlFor="question">Research question</label>
            <textarea id="question" className="field mt-4 min-h-24" maxLength={2000} placeholder="e.g. Does rapamycin extend healthspan in mammals beyond lifespan effects?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </section>

          <section aria-labelledby="src">
            <h2 id="src" className="text-2xl">2. Source text</h2>
            <label className="sr-only" htmlFor="source">Paste source text</label>
            <textarea id="source" className="field mt-4 min-h-32 font-mono text-xs" maxLength={50000} placeholder="Paste an abstract, methods section or notes…" value={source} onChange={(e) => setSource(e.target.value)} />
            <p className="mt-1 text-right font-mono text-xs text-muted-foreground">{source.length.toLocaleString()} / 50,000</p>
          </section>

          <section aria-labelledby="papers">
            <h2 id="papers" className="text-2xl">3. Paper search</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live results from OpenAlex, an open scholarly index.</p>
            <form onSubmit={doSearch} className="mt-4 flex gap-2">
              <label className="sr-only" htmlFor="pq">Search papers</label>
              <input id="pq" className="field" placeholder="Search titles and abstracts" value={paperQ} onChange={(e) => setPaperQ(e.target.value)} />
              <Button variant="outline" disabled={searching}><Search /> {searching ? "…" : "Search"}</Button>
            </form>
            {papers && (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {papers.length === 0 && <li className="py-4 text-sm text-muted-foreground">No papers matched.</li>}
                {papers.map((p) => {
                  const on = attached.some((a) => a.id === p.id);
                  return (
                    <li key={p.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">{p.title}</a>
                        <p className="truncate text-xs text-muted-foreground">{p.authors} · {p.venue ?? "—"} · {p.year ?? "n.d."}</p>
                      </div>
                      <Button size="sm" variant={on ? "secondary" : "ghost"} onClick={() => setAttached((a) => (on ? a.filter((x) => x.id !== p.id) : [...a, p]))}>
                        {on ? "Attached" : "Attach"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
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

          {user ? (
            <Button size="lg" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Queue research run"}
            </Button>
          ) : (
            <SignInPrompt what="save research runs" />
          )}
        </div>

        <aside aria-labelledby="hist">
          <h2 id="hist" className="text-2xl">Run history</h2>
          <div className="mt-4 space-y-3">
            {!user && <p className="text-sm text-muted-foreground">Sign in to see your private run history.</p>}
            {user && runs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {user && runs.data?.length === 0 && <EmptyState title="No runs yet">Queued runs will appear here.</EmptyState>}
            {runs.data?.map((r) => (
              <article key={r.id} className="panel p-4">
                <div className="flex items-center justify-between">
                  <StatusPill>{r.status}</StatusPill>
                  <button aria-label="Delete run" onClick={() => remove.mutate(r.id)} className="text-muted-foreground hover:text-foreground"><Trash2 size={14} /></button>
                </div>
                <p className="mt-3 text-sm">{r.question}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">{r.roles.length} roles · {new Date(r.created_at).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
