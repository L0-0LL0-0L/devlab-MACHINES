import { PageHeader } from "./site";
import { MachineList, useMachines } from "./machine-list";
import { GitBranch, ArrowUpRight } from "lucide-react";
import { LaunchedTokens } from "./launched-tokens";
export function RegistryPage({ kind }: { kind: "explorer" | "machines" | "repositories" }) {
  const q = useMachines();
  const names = {
    explorer: ["PUBLIC REGISTRY", "Explorer"] as const,
    machines: ["CODING MACHINES", "Machines"] as const,
    repositories: ["PINNED SOURCE", "Repositories"] as const,
  };
  return (
    <>
      <PageHeader eyebrow={names[kind][0]} title={names[kind][1]} />
      <div className="max-w-7xl mx-auto px-5 py-10">
        {kind === "explorer" && <LaunchedTokens />}
        {kind === "repositories" && q.data?.length ? (
          <div className="divide-y divide-border border-y border-border">
            {[
              ...new Map(
                q.data.map((m) => {
                  const r = m.repository as {
                    url: string;
                    owner: string;
                    repo: string;
                    commit: string;
                    license: string;
                  };
                  return [r.url, r];
                }),
              ).values(),
            ].map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-4 py-5"
              >
                <div className="min-w-0">
                  <p className="font-display font-bold">
                    <GitBranch className="inline mr-2" size={18} />
                    {r.owner}/{r.repo}
                  </p>
                  <p className="font-mono text-xs mt-2 break-all">
                    {r.commit} · {r.license}
                  </p>
                </div>
                <ArrowUpRight />
              </a>
            ))}
          </div>
        ) : (
          <MachineList />
        )}
      </div>
    </>
  );
}
