import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCluster } from "@/lib/cluster";
import { syncExternalBiocodeLaunch } from "@/lib/dbc.functions";

/** Tokens with a verified Meteora pool, shown as launchpad launches. */
export function LaunchedTokens() {
  const { cluster } = useCluster();
  const qc = useQueryClient();
  const sync = useServerFn(syncExternalBiocodeLaunch);
  const key = ["explorer-tokens", "cluster", cluster];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,symbol,status,mint_address,image_url,website_url,x_url")
        .eq("cluster", cluster)
        .in("status", ["live", "migrated"])
        .order("launched_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (cluster !== "mainnet-beta") return;
    void sync().then((r) => {
      if (r.ok && "projectId" in r) void qc.invalidateQueries({ queryKey: key });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster]);
  if (!q.data?.length) return null;
  return (
    <section className="mb-12">
      <p className="eyebrow">LAUNCHED ON METEORA</p>
      <h2 className="text-2xl mt-2 mb-6">Tokens</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {q.data.map((p) => (
          <article key={p.id} className="hardware p-5">
            <div className="flex items-center gap-4">
              {p.image_url && <img src={p.image_url} alt="" className="size-14 border-2 border-border object-cover" />}
              <div className="min-w-0">
                <Link to="/launchpad/$id" params={{ id: p.id }} className="font-display text-xl font-bold">
                  {p.title} <ArrowUpRight className="inline" size={18} />
                </Link>
                <p className="font-mono text-xs">${p.symbol} · {p.status}</p>
              </div>
            </div>
            <p className="mt-4 font-mono text-[11px] break-all">{p.mint_address}</p>
            <div className="mt-4 pt-3 border-t border-border flex gap-4 font-mono text-xs">
              {p.website_url && <a href={p.website_url} target="_blank" rel="noreferrer" className="underline">website</a>}
              {p.x_url && <a href={p.x_url} target="_blank" rel="noreferrer" className="underline">x</a>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
