import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/site";
import { useCluster } from "@/lib/cluster";
import { supabase } from "@/integrations/supabase/client";
import { getPoolState, syncExternalBiocodeLaunch } from "@/lib/dbc.functions";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — biocode" },
      { name: "description", content: "Meteora markets for launched biocode science projects on Solana." },
      { property: "og:title", content: "Markets — biocode" },
      { property: "og:description", content: "DeSci project markets on Solana." },
    ],
  }),
  component: Markets,
});

function Markets() {
  const { cluster } = useCluster();
  const queryClient = useQueryClient();
  const syncExternal = useServerFn(syncExternalBiocodeLaunch);
  const poolState = useServerFn(getPoolState);
  const markets = useQuery({
    queryKey: ["markets", "cluster", cluster],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,title,symbol,status,mint_address,image_url").eq("cluster", cluster).in("status", ["live", "migrated"]).order("launched_at", { ascending: false }).limit(50);
      if (error) throw error;
      return Promise.all(data.map(async (project) => ({ project, chain: project.mint_address ? await poolState({ data: { cluster, mint: project.mint_address } }) : null })));
    },
    refetchInterval: 20_000,
  });
  useEffect(() => {
    if (cluster !== "mainnet-beta") return;
    let active = true;
    const sync = async () => {
      const result = await syncExternal();
      if (active && result.ok && "projectId" in result) await queryClient.invalidateQueries({ queryKey: ["markets", "cluster", cluster] });
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [cluster, queryClient, syncExternal]);
  const rows = markets.data ?? [];
  return (
    <>
      <PageHeader eyebrow={`markets · ${cluster}`} title="Markets">
        Live Meteora pools for launched projects appear here.
      </PageHeader>
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Project markets</caption>
            <thead className="border-b border-border text-muted-foreground">
              <tr>{["Project", "Symbol", "Price", "Liquidity", "24h volume"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No verified markets on {cluster} yet.</td></tr>}
              {rows.map(({ project, chain }) => (
                <tr key={project.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-4"><Link to="/launchpad/$id" params={{ id: project.id }} className="flex items-center gap-3 hover:underline">{project.image_url && <img src={project.image_url} alt="" className="size-9 border border-border object-cover" />}<span>{project.title}</span></Link></td>
                  <td className="px-4 py-4 font-mono">${project.symbol}</td>
                  <td className="px-4 py-4 font-mono">{chain?.ok ? `${chain.priceSolPerToken} SOL` : "Unavailable"}</td>
                  <td className="px-4 py-4 font-mono">{chain?.ok ? `${chain.quoteReserveSol} SOL` : "Unavailable"}</td>
                  <td className="px-4 py-4 text-muted-foreground">Not available</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div className="mt-8">
          <EmptyState title="Nothing is tradable yet" action={<Button asChild size="sm" variant="outline"><Link to="/launchpad">Prepare a launch</Link></Button>}>
            biocode does not list or simulate prices. Markets appear only after a project creates a real pool.
          </EmptyState>
        </div>}
      </div>
    </>
  );
}
