import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/site";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/analytics")({
  head: () =>
    pageMeta(
      "Analytics",
      "Real public registry counts, accepted generations and recorded replay evidence.",
    ),
  component: Analytics,
});
function Analytics() {
  const q = useQuery({
    queryKey: ["registry-analytics"],
    queryFn: async () => {
      const [m, g, r, e] = await Promise.all([
        supabase
          .from("machines")
          .select("id", { count: "exact", head: true })
          .eq("visibility", "public"),
        supabase.from("machine_generations").select("id", { count: "exact", head: true }),
        supabase.from("machine_replays").select("id", { count: "exact", head: true }),
        supabase.from("machine_events").select("id", { count: "exact", head: true }),
      ]);
      for (const x of [m, g, r, e]) if (x.error) throw x.error;
      return [m.count, g.count, r.count, e.count];
    },
  });
  return (
    <>
      <PageHeader eyebrow="MEASURED / NOT INVENTED" title="Analytics" />
      <div className="mx-auto max-w-7xl px-5 py-10">
        {q.error ? (
          <p role="alert">{q.error.message}</p>
        ) : (
          <dl className="grid grid-cols-2 lg:grid-cols-4 border-2 border-border">
            {["Public machines", "Accepted generations", "Recorded replays", "Public events"].map(
              (label, i) => (
                <div className="bg-panel p-6 border-r border-border" key={label}>
                  <dt className="eyebrow">{label}</dt>
                  <dd className="text-4xl font-display mt-6">{q.data ? q.data[i] : "—"}</dd>
                </div>
              ),
            )}
          </dl>
        )}
        <div className="mt-10 border-y border-border py-8">
          <h2 className="text-2xl">Compute & funding</h2>
          <p className="mt-3 text-muted-foreground">
            No price feed or hosted compute billing is configured. Funds and costs are not
            estimated; pool reserves are not compute budget.
          </p>
        </div>
      </div>
    </>
  );
}
