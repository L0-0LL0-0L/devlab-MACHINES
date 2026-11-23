import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/site";
import { useCluster, clusterLabel } from "@/lib/cluster";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — biocraft" },
      { name: "description", content: "Meteora markets for launched biocraft science projects on Solana." },
      { property: "og:title", content: "Markets — biocraft" },
      { property: "og:description", content: "DeSci project markets on Solana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Markets,
});

function Markets() {
  const { cluster } = useCluster();
  const q = useQuery({
    queryKey: ["cluster", cluster, "markets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,title,symbol,status,mint_address,launched_at").eq("cluster", cluster).eq("hidden", false).in("status", ["live", "migrated"]).order("launched_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  return (
    <>
      <PageHeader eyebrow={`markets · ${clusterLabel(cluster)}`} title="Markets">
        Live Meteora pools for launched projects.
      </PageHeader>
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Project markets</caption>
            <thead className="border-b border-border text-muted-foreground">
              <tr>{["Project", "Symbol", "Status", "Mint", ""].map((h, i) => <th key={i} scope="col" className="px-4 py-3 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No markets on {clusterLabel(cluster)} yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 font-mono">${r.symbol}</td>
                  <td className="px-4 py-3 text-primary">{r.status}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{r.mint_address ? `${r.mint_address.slice(0, 4)}…${r.mint_address.slice(-4)}` : "—"}</td>
                  <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="outline"><Link to="/launchpad/$id" params={{ id: r.id }}>Trade</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!q.isLoading && rows.length === 0 && (
          <div className="mt-8">
            <EmptyState title="Nothing is tradable yet" action={<Button asChild size="sm" variant="outline"><Link to="/launchpad">Prepare a launch</Link></Button>}>
              biocraft does not list or simulate prices. Markets appear only after a project creates a real pool.
            </EmptyState>
          </div>
        )}
      </div>
    </>
  );
}
