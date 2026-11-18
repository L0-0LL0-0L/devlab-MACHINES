import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SignInPrompt } from "@/components/site";
import { useAuth } from "@/lib/auth";
import { useCluster, isBase58Address, shortAddr } from "@/lib/cluster";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — biocode" },
      { name: "description", content: "Your biocode wallet, watchlist, launch drafts and research activity." },
      { property: "og:title", content: "Portfolio — biocode" },
      { property: "og:description", content: "Track your DeSci activity on biocode." },
    ],
  }),
  component: Portfolio,
});

function Portfolio() {
  const { user } = useAuth();
  const { cluster, wallet } = useCluster();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");

  const watch = useQuery({
    queryKey: ["watchlist", "cluster", cluster, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("watchlist").select("*").eq("cluster", cluster).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const counts = useQuery({
    queryKey: ["counts", "cluster", cluster, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("cluster", cluster),
        supabase.from("research_runs").select("id", { count: "exact", head: true }),
      ]);
      return { projects: p.count ?? 0, runs: r.count ?? 0 };
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (label.trim().length < 2) throw new Error("Label must be at least 2 characters");
      if (!isBase58Address(address.trim())) throw new Error("Enter a valid Solana address");
      const { error } = await supabase.from("watchlist").insert({ owner_id: user!.id, cluster, label: label.trim(), address: address.trim() });
      if (error) throw new Error(error.code === "23505" ? "Already on your watchlist" : error.message);
    },
    onSuccess: () => { setLabel(""); setAddress(""); qc.invalidateQueries({ queryKey: ["watchlist"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("watchlist").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <>
      <PageHeader eyebrow={`portfolio · ${cluster}`} title="Portfolio">Your private workspace. Data shown is scoped to the selected cluster.</PageHeader>
      <div className="mx-auto max-w-7xl space-y-10 px-5 py-14">
        {!user ? <SignInPrompt what="view your portfolio" /> : (
          <>
            <dl className="grid gap-px bg-border md:grid-cols-4">
              {[["Account", user.email ?? "—"], ["Wallet", wallet ? shortAddr(wallet) : "not connected"], ["Launch drafts", String(counts.data?.projects ?? "…")], ["Research runs", String(counts.data?.runs ?? "…")]].map(([k, v]) => (
                <div key={k} className="bg-panel p-5"><dt className="eyebrow">{k}</dt><dd className="mt-2 truncate font-display text-xl font-light">{v}</dd></div>
              ))}
            </dl>
            <section>
              <h2 className="text-2xl">Holdings</h2>
              <div className="mt-4"><EmptyState title="No positions">On-chain balances will be read from your wallet once trading is integrated. No balances are estimated.</EmptyState></div>
            </section>
            <section>
              <h2 className="text-2xl">Watchlist</h2>
              <form className="mt-4 grid gap-2 sm:grid-cols-[200px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
                <input aria-label="Label" className="field" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
                <input aria-label="Solana address" className="field font-mono text-xs" placeholder="Token mint or wallet address" value={address} onChange={(e) => setAddress(e.target.value)} />
                <Button disabled={add.isPending}>Add</Button>
              </form>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {watch.data?.length === 0 && <li className="py-5 text-sm text-muted-foreground">Nothing watched on {cluster}.</li>}
                {watch.data?.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0"><p className="text-sm">{w.label}</p><p className="truncate font-mono text-xs text-muted-foreground">{w.address}</p></div>
                    <button aria-label={`Remove ${w.label}`} onClick={() => remove.mutate(w.id)} className="text-muted-foreground hover:text-foreground"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            </section>
            <div className="flex gap-3"><Button asChild variant="outline" size="sm"><Link to="/launchpad">Launch drafts</Link></Button><Button asChild variant="outline" size="sm"><Link to="/research">Research runs</Link></Button></div>
          </>
        )}
      </div>
    </>
  );
}
