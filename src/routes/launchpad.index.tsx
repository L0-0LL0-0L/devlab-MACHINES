import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SignInPrompt, StatusPill } from "@/components/site";
import { useAuth } from "@/lib/auth";
import { useCluster, isBase58Address } from "@/lib/cluster";
import { CATEGORIES } from "@/lib/research";

export const Route = createFileRoute("/launchpad/")({
  head: () => ({
    meta: [
      { title: "Launchpad — biocode" },
      { name: "description", content: "Prepare a decentralized-science project launch: thesis, evidence, treasury and token settings, with review." },
      { property: "og:title", content: "Launchpad — biocode" },
      { property: "og:description", content: "Draft and review DeSci project launches on Solana." },
    ],
  }),
  component: LaunchPage,
});

const evidenceItem = z.object({ label: z.string().trim().min(2, "Evidence label required"), url: z.string().trim().url("Evidence link must be a valid URL") });
const stepSchemas = [
  z.object({
    title: z.string().trim().min(3, "Title: at least 3 characters").max(120),
    symbol: z.string().regex(/^[A-Z0-9]{2,10}$/, "Symbol: 2–10 uppercase letters or digits"),
    category: z.enum(CATEGORIES, { message: "Choose a category" }),
  }),
  z.object({
    thesis: z.string().trim().min(40, "Thesis: at least 40 characters").max(5000),
    evidence: z.array(evidenceItem).min(1, "Add at least one evidence link"),
  }),
  z.object({
    treasury_address: z.string().refine(isBase58Address, "Treasury must be a valid Solana address"),
    token_supply: z.number().int().min(1000, "Supply must be at least 1,000").max(1e12, "Supply too large"),
    token_decimals: z.number().int().min(0).max(9, "Decimals must be 0–9"),
  }),
];
const STEP_NAMES = ["Basics", "Thesis & evidence", "Treasury & token", "Review"];

type Form = {
  title: string; symbol: string; category: string; thesis: string;
  evidence: { label: string; url: string }[];
  treasury_address: string; token_supply: number; token_decimals: number;
};
const EMPTY: Form = { title: "", symbol: "", category: "", thesis: "", evidence: [{ label: "", url: "" }], treasury_address: "", token_supply: 1_000_000_000, token_decimals: 6 };

function LaunchPage() {
  const { user } = useAuth();
  const { cluster, wallet } = useCluster();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const drafts = useQuery({
    queryKey: ["projects", "cluster", cluster, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("cluster", cluster).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      for (const s of stepSchemas) s.parse(f);
      const { error } = await supabase.from("projects").insert({ ...f, owner_id: user!.id, cluster, status: "draft" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Launch draft saved");
      setF(EMPTY); setStep(0);
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e) => toast.error(e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  function next() {
    const r = stepSchemas[step]!.safeParse(f);
    if (!r.success) return setErr(r.error.issues[0]?.message ?? "Invalid input");
    setErr(null);
    setStep(step + 1);
  }

  return (
    <>
      <PageHeader eyebrow={`launchpad · ${cluster}`} title="Prepare a launch">
        Build a validated launch package. Drafts are private and scoped to the selected cluster. <StatusPill>on-chain pool creation awaits Meteora SDK integration</StatusPill>
      </PageHeader>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_340px]">
        <div>
          <ol className="mb-8 grid grid-cols-4 gap-px bg-border" aria-label="Steps">
            {STEP_NAMES.map((n, k) => (
              <li key={n} aria-current={k === step ? "step" : undefined} className={`px-3 py-3 text-xs ${k === step ? "bg-foreground text-background" : k < step ? "bg-panel-2" : "bg-panel text-muted-foreground"}`}>
                <span className="font-mono">0{k + 1}</span> <span className="hidden sm:inline">{n}</span>
              </li>
            ))}
          </ol>

          <div className="panel space-y-5 p-6">
            {step === 0 && (
              <>
                <label className="block text-sm">Project title<input className="field mt-1" maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
                <label className="block text-sm">Token symbol<input className="field mt-1 font-mono uppercase" maxLength={10} value={f.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label>
                <label className="block text-sm">Category
                  <select className="field mt-1" value={f.category} onChange={(e) => set("category", e.target.value)}>
                    <option value="">Select…</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </>
            )}
            {step === 1 && (
              <>
                <label className="block text-sm">Thesis<textarea className="field mt-1 min-h-40" maxLength={5000} value={f.thesis} onChange={(e) => set("thesis", e.target.value)} placeholder="What will this project test, and why does it matter?" /></label>
                <fieldset>
                  <legend className="text-sm">Evidence</legend>
                  <div className="mt-2 space-y-2">
                    {f.evidence.map((ev, k) => (
                      <div key={k} className="flex gap-2">
                        <input aria-label={`Evidence ${k + 1} label`} className="field" placeholder="Label" value={ev.label} onChange={(e) => set("evidence", f.evidence.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} />
                        <input aria-label={`Evidence ${k + 1} link`} className="field" placeholder="https://…" value={ev.url} onChange={(e) => set("evidence", f.evidence.map((x, j) => (j === k ? { ...x, url: e.target.value } : x)))} />
                        <Button variant="ghost" size="icon" aria-label="Remove evidence" onClick={() => set("evidence", f.evidence.filter((_, j) => j !== k))}><Trash2 /></Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => set("evidence", [...f.evidence, { label: "", url: "" }])}><Plus /> Add evidence</Button>
                </fieldset>
              </>
            )}
            {step === 2 && (
              <>
                <label className="block text-sm">Treasury address (Solana)
                  <div className="mt-1 flex gap-2">
                    <input className="field font-mono text-xs" value={f.treasury_address} onChange={(e) => set("treasury_address", e.target.value.trim())} />
                    {wallet && <Button variant="outline" size="sm" onClick={() => set("treasury_address", wallet)}>Use wallet</Button>}
                  </div>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm">Total supply<input type="number" className="field mt-1" value={f.token_supply} onChange={(e) => set("token_supply", Number(e.target.value))} /></label>
                  <label className="block text-sm">Decimals<input type="number" min={0} max={9} className="field mt-1" value={f.token_decimals} onChange={(e) => set("token_decimals", Number(e.target.value))} /></label>
                </div>
                <p className="text-xs text-muted-foreground">Cluster: <span className="font-mono">{cluster}</span></p>
              </>
            )}
            {step === 3 && (
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {([["Title", f.title], ["Symbol", f.symbol], ["Category", f.category], ["Cluster", cluster], ["Treasury", f.treasury_address], ["Supply", f.token_supply.toLocaleString()], ["Decimals", String(f.token_decimals)], ["Evidence", `${f.evidence.length} link(s)`]] as const).map(([k, v]) => (
                  <div key={k}><dt className="eyebrow">{k}</dt><dd className="mt-1 break-all">{v}</dd></div>
                ))}
                <div className="sm:col-span-2"><dt className="eyebrow">Thesis</dt><dd className="mt-1 whitespace-pre-wrap text-muted-foreground">{f.thesis}</dd></div>
              </dl>
            )}
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <div className="flex justify-between pt-2">
              <Button variant="ghost" disabled={step === 0} onClick={() => { setErr(null); setStep(step - 1); }}>Back</Button>
              {step < 3 ? <Button onClick={next}>Continue</Button> : user ? (
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save launch draft"}</Button>
              ) : null}
            </div>
          </div>
          {step === 3 && !user && <div className="mt-6"><SignInPrompt what="save this launch draft" /></div>}
        </div>

        <aside>
          <h2 className="text-2xl">Your drafts <span className="font-mono text-sm text-muted-foreground">{cluster}</span></h2>
          <div className="mt-4 space-y-3">
            {!user && <p className="text-sm text-muted-foreground">Sign in to see your private drafts.</p>}
            {user && drafts.data?.length === 0 && <EmptyState title="No drafts on this cluster" />}
            {drafts.data?.map((d) => (
              <article key={d.id} className="panel p-4">
                <div className="flex items-center justify-between"><span className="font-mono text-xs">${d.symbol}</span>
                  <button aria-label="Delete draft" onClick={() => remove.mutate(d.id)} className="text-muted-foreground hover:text-foreground"><Trash2 size={14} /></button></div>
                <p className="mt-2">{d.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{d.category} · {d.status}</p>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
