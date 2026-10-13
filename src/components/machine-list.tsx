import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cpu, GitBranch, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCluster } from "@/lib/cluster";
import { EmptyState, SignInPrompt } from "./site";
import { Button } from "./ui/button";
export function useMachines(own = false) {
  const { user } = useAuth();
  const { cluster } = useCluster();
  return useQuery({
    queryKey: ["machines", "cluster", cluster, own, user?.id],
    enabled: !own || !!user,
    queryFn: async () => {
      let q = supabase.from("machines").select("*").order("created_at", { ascending: false });
      if (own) {
        if (!user) return [];
        q = q.eq("owner_id", user.id);
      } else q = q.eq("visibility", "public");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
export function MachineList({ own = false, limit }: { own?: boolean; limit?: number }) {
  const { user } = useAuth();
  const q = useMachines(own);
  if (own && !user) return <SignInPrompt what="view your machines" />;
  if (q.isPending) return <p className="font-mono text-sm py-8">Reading registry…</p>;
  if (q.error)
    return (
      <p role="alert" className="text-destructive">
        {q.error.message}
      </p>
    );
  if (!q.data?.length)
    return (
      <EmptyState
        title={own ? "Your workbench is clear" : "No public machines yet"}
        action={
          <Button asChild variant="outline">
            <Link to="/launch">
              Launch a machine <ArrowUpRight />
            </Link>
          </Button>
        }
      />
    );
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {q.data.slice(0, limit).map((m) => {
        const r = m.repository as { owner: string; repo: string; branch: string };
        return (
          <article className="hardware p-5" key={m.id}>
            <div className="flex justify-between">
              <Cpu size={28} />
              <span className="font-mono text-xs">{m.status}</span>
            </div>
            <Link
              to="/machines/$id"
              params={{ id: m.id }}
              className="block mt-6 font-display text-xl font-bold"
            >
              {m.name} <ArrowUpRight className="inline" size={18} />
            </Link>
            <p className="mt-2 font-mono text-xs break-all">
              {r.owner}/{r.repo}
            </p>
            <div className="mt-5 pt-3 border-t border-border flex justify-between text-xs">
              <span>
                <GitBranch size={12} className="inline" /> {r.branch}
              </span>
              <span>{m.runtime}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
