import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusPill } from "@/components/site";
import { useCluster } from "@/lib/cluster";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — biocode" },
      { name: "description", content: "Markets for launched biocode science projects on Solana. Trading arrives with Meteora integration." },
      { property: "og:title", content: "Markets — biocode" },
      { property: "og:description", content: "DeSci project markets on Solana." },
    ],
  }),
  component: Markets,
});

function Markets() {
  const { cluster } = useCluster();
  return (
    <>
      <PageHeader eyebrow={`markets · ${cluster}`} title="Markets">
        Pools for launched projects will be listed here. <StatusPill>trading awaits Meteora SDK integration</StatusPill>
      </PageHeader>
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Project markets</caption>
            <thead className="border-b border-border text-muted-foreground">
              <tr>{["Project", "Symbol", "Price", "Liquidity", "24h volume"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-normal">{h}</th>)}</tr>
            </thead>
            <tbody><tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No markets on {cluster} yet.</td></tr></tbody>
          </table>
        </div>
        <div className="mt-8">
          <EmptyState title="Nothing is tradable yet" action={<Button asChild size="sm" variant="outline"><Link to="/launchpad">Prepare a launch</Link></Button>}>
            biocode does not list or simulate prices. Markets appear only after a project creates a real pool.
          </EmptyState>
        </div>
      </div>
    </>
  );
}
