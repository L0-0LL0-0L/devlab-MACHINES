import { MachineFunding } from "./machine-funding";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  GitBranch,
  Terminal,
  Wallet,
  FileDiff,
  Save,
  Star,
  Shield,
  Copy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { EmptyState } from "./site";
import { useAuth } from "@/lib/auth";
import { useCluster } from "@/lib/cluster";
import {
  machineAction,
  saveSettings,
  createRunnerChallenge,
  completeRunnerEnrollment,
  listMyRunners,
} from "@/lib/machines.functions";
import { prepareMachineToken } from "@/lib/token-machine.functions";
import { recipeSchema, type Recipe } from "@/lib/machine-core";
export function MachineDetail({
  id,
  compact = false,
  initialTab = "activity",
  onTabChange,
}: {
  id: string;
  compact?: boolean;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
}) {
  const { user } = useAuth();
  const { cluster } = useCluster();
  const qc = useQueryClient();
  const action = useServerFn(machineAction),
    settingsFn = useServerFn(saveSettings),
    challengeFn = useServerFn(createRunnerChallenge),
    enrollFn = useServerFn(completeRunnerEnrollment),
    runnersFn = useServerFn(listMyRunners),
    tokenFn = useServerFn(prepareMachineToken);
  const [tab, setTab] = useState(initialTab),
    [busy, setBusy] = useState(false),
    [soul, setSoul] = useState<string | null>(null),
    [recipe, setRecipe] = useState<Recipe | null>(null),
    [calibrationText, setCalibrationText] = useState<string | null>(null),
    [challenge, setChallenge] = useState<{ challengeId: string; message: string } | null>(null),
    [enrollSignature, setEnrollSignature] = useState(""),
    [replaceRunnerId, setReplaceRunnerId] = useState<string | null>(null),
    [runnerLabel, setRunnerLabel] = useState(""),
    [publicKey, setPublicKey] = useState(""),
    [runnerRole, setRunnerRole] = useState<"author" | "verifier">("author"),
    [credential, setCredential] = useState("");
  const q = useQuery({
    queryKey: ["machine", "cluster", cluster, id, user?.id],
    queryFn: async () => {
      const { data: m, error } = await supabase.from("machines").select("*").eq("id", id).single();
      if (error) throw error;
      const [events, candidates, generations, replays, jobs, ledger, follow] = await Promise.all([
        supabase
          .from("machine_events")
          .select("*")
          .eq("machine_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("machine_candidates")
          .select("*")
          .eq("machine_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("machine_generations").select("*").eq("machine_id", id),
        supabase.from("machine_replays").select("*").eq("machine_id", id),
        user?.id === m.owner_id
          ? supabase
              .from("machine_jobs")
              .select("*")
              .eq("machine_id", id)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        user?.id === m.owner_id
          ? supabase.from("machine_ledger").select("*").eq("machine_id", id)
          : Promise.resolve({ data: [], error: null }),
        user
          ? supabase
              .from("machine_follows")
              .select("machine_id")
              .eq("machine_id", id)
              .eq("owner_id", user.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [events, candidates, generations, replays, jobs, ledger, follow])
        if (r.error) throw r.error;
      return {
        m,
        events: events.data ?? [],
        candidates: candidates.data ?? [],
        generations: generations.data ?? [],
        replays: replays.data ?? [],
        jobs: jobs.data ?? [],
        ledger: ledger.data ?? [],
        following: !!follow.data?.length,
      };
    },
    refetchInterval: 15000,
  });
  const runners = useQuery({
    queryKey: ["machine", "runners", user?.id],
    queryFn: () => runnersFn(),
    enabled: !!user && q.data?.m.owner_id === user.id,
  });
  async function perform(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["machine"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (q.isPending) return <p className="font-mono text-sm">Reading machine…</p>;
  if (q.error || !q.data)
    return (
      <p role="alert" className="text-destructive">
        {q.error?.message ?? "Machine unavailable"}
      </p>
    );
  const { m, events, candidates, generations, replays, jobs, ledger, following } = q.data,
    own = user?.id === m.owner_id;
  const repo = m.repository as {
    url: string;
    commit: string;
    branch: string;
    readme: string;
    license: string;
  };
  const currentRecipe = recipe ?? recipeSchema.parse(m.recipe);
  const balance = ledger.reduce(
    (s, l) => s + (l.kind === "compute_debit" ? -1 : 1) * Number(l.amount_sol),
    0,
  );
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap justify-between items-start gap-5">
        <div>
          <p className="eyebrow">
            {m.visibility} / {m.status}
          </p>
          <h1 className={`${compact ? "text-3xl" : "text-4xl"} mt-3`}>{m.name}</h1>
          <p className="font-mono text-xs mt-3 break-all">{m.id}</p>
          <a
            href={repo.url}
            className="inline-block font-mono text-xs mt-3 underline"
            target="_blank"
            rel="noreferrer"
          >
            <GitBranch className="inline mr-2" size={14} />
            {repo.url.replace("https://github.com/", "")}
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          {user && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                perform(async () => {
                  const result = following
                    ? await supabase
                        .from("machine_follows")
                        .delete()
                        .eq("machine_id", id)
                        .eq("owner_id", user.id)
                    : await supabase
                        .from("machine_follows")
                        .insert({ owner_id: user.id, machine_id: id });
                  if (result.error) throw result.error;
                })
              }
            >
              <Star size={14} />
              {following ? "Following" : "Follow"}
            </Button>
          )}
          {own && (
            <>
              {(
                [
                  ["run", Play],
                  ["pause", Pause],
                  ["cancel", Square],
                  ["retry", RotateCcw],
                ] as const
              ).map(([a, I]) => (
                <Button
                  key={a}
                  size="icon"
                  variant={a === "run" ? "default" : "outline"}
                  aria-label={a}
                  title={a}
                  disabled={busy}
                  onClick={() => perform(() => action({ data: { id, action: a } }))}
                >
                  <I size={16} />
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  perform(() =>
                    action({
                      data: { id, action: m.visibility === "public" ? "private" : "publish" },
                    }),
                  )
                }
              >
                {m.visibility === "public" ? "Make private" : "Publish"}
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex border-b-2 border-border gap-1 overflow-x-auto">
        {[
          ["activity", Terminal],
          ["source", GitBranch],
          ["candidates", FileDiff],
          ["replays", Shield],
          ["funding", Wallet],
          ...(own ? [["settings", Settings]] : []),
        ].map(([t, Icon]) => {
          const I = Icon as typeof Terminal;
          return (
            <Button
              key={String(t)}
              variant={tab === t ? "default" : "ghost"}
              className="shrink-0 rounded-b-none capitalize"
              size="sm"
              onClick={() => {
                setTab(String(t));
                onTabChange?.(String(t));
              }}
            >
              <I size={14} />
              {String(t)}
            </Button>
          );
        })}
      </div>
      {tab === "activity" && (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <section>
            <h2 className="text-xl mb-5">Session activity</h2>
            {!events.length ? (
              <EmptyState title="No sessions yet" />
            ) : (
              <ol className="divide-y divide-border">
                {events.map((e) => (
                  <li className="py-4" key={e.id}>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()} / {e.kind}
                    </p>
                    <p className="text-sm mt-2">{e.message}</p>
                    {e.job_id && (
                      <p className="font-mono text-xs mt-2 break-all">session {e.job_id}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {jobs.map((j) => (
              <div key={j.id} className="border-t border-border py-4">
                <p className="font-mono text-xs break-all">
                  {j.kind} / {j.status} / {j.id}
                </p>
                {j.error && <p className="text-sm mt-2 text-destructive">{j.error}</p>}
                <p className="font-mono text-xs mt-2">
                  attempts {j.attempts} · lease {j.lease_until ?? "none"}
                </p>
                <details className="text-xs mt-2">
                  <summary>Pinned session snapshot</summary>
                  <pre className="mt-3">{JSON.stringify(j.snapshot, null, 2)}</pre>
                </details>
              </div>
            ))}
          </section>
          <aside className="border-l border-border pl-5">
            <p className="eyebrow">MACHINE CONFIG</p>
            <dl className="text-sm mt-5 space-y-4">
              {[
                ["Runtime", m.runtime],
                ["Model", m.model],
                ["Goal", currentRecipe.goal],
                ["Recipe", currentRecipe.command],
                [
                  "Target",
                  `${currentRecipe.improvement}% ${currentRecipe.direction} ${currentRecipe.metric}`,
                ],
                ["Accepted generations", String(generations.length)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
                  <dd className="mt-1 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
      {tab === "source" && (
        <section className="space-y-5">
          <p className="font-mono text-xs break-all">BASELINE / {repo.commit}</p>
          <p className="text-sm">License: {repo.license}</p>
          <h2 className="text-xl">README at pinned commit</h2>
          <pre className="bg-panel p-5 border border-border text-xs max-h-[600px] overflow-auto">
            {repo.readme || "No README"}
          </pre>
        </section>
      )}
      {tab === "candidates" && (
        <section className="space-y-6">
          {own && <AuthorSessionStatus jobs={jobs} recipe={currentRecipe} />}
          {!candidates.length ? (
            <EmptyState title="No patch candidates" />
          ) : (
            candidates.map((c) => (
              <article key={c.id} className="border-y border-border py-5">
                <div className="flex justify-between gap-4">
                  <p className="font-mono text-xs break-all">
                    {c.id} / {c.status}
                  </p>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Copy patch"
                    onClick={() => navigator.clipboard.writeText(c.patch)}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
                <p className="font-mono text-xs mt-3 break-all">SHA256 {c.patch_digest}</p>
                <pre className="mt-4 bg-panel border border-border p-4 text-xs max-h-96 overflow-auto">
                  {c.patch}
                </pre>
                <details className="mt-3 text-xs">
                  <summary>Provenance</summary>
                  <pre>{JSON.stringify(c.provenance, null, 2)}</pre>
                </details>
              </article>
            ))
          )}
        </section>
      )}
      {tab === "replays" && (
        <section>
          {!replays.length ? (
            <EmptyState title="No independent replays">
              An author result is not an independent measurement. Two separately owned verifier
              identities must replay the same pinned candidate.
            </EmptyState>
          ) : (
            replays.map((r) => (
              <article key={r.id} className="border-y border-border py-5">
                <p className="font-mono text-xs break-all">
                  Replay {r.id} / {r.status}
                </p>
                <p className="font-mono text-xs mt-3 break-all">
                  runner {r.runner_id} · digest {r.evidence_digest}
                </p>
                <pre className="mt-4 text-xs">{JSON.stringify(r.evidence, null, 2)}</pre>
                <details className="text-xs mt-3">
                  <summary>Signature</summary>
                  <p className="break-all">{r.signature}</p>
                </details>
              </article>
            ))
          )}
        </section>
      )}
      {tab === "funding" && (
        <section className="space-y-6">
          <h2 className="text-2xl">Treasury & runway</h2>
          {own ? (
            <>
              <dl className="grid sm:grid-cols-3 border-y border-border">
                {[
                  ["Recorded funding", `${balance} SOL`],
                  ["Compute costs", "No configured billing"],
                  ["Runway", "Unavailable"],
                ].map(([k, v]) => (
                  <div key={k} className="py-5">
                    <dt className="eyebrow">{k}</dt>
                    <dd className="text-lg mt-3">{v}</dd>
                  </div>
                ))}
              </dl>
              {ledger.length ? (
                ledger.map((l) => (
                  <p className="text-sm" key={l.id}>
                    {l.kind} / {l.amount_sol} SOL / {l.signature}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No verified receipts or compute debits. Unclaimed fees and pool liquidity do not
                  count as spendable budget.
                </p>
              )}
              {m.token_project_id ? (
                <Button asChild variant="outline">
                  <Link to="/launchpad/$id" params={{ id: m.token_project_id }}>
                    Open token & creator fees
                  </Link>
                </Button>
              ) : (
                <Button
                  disabled={busy || !m.symbol}
                  onClick={() =>
                    perform(async () => {
                      const token = await tokenFn({ data: { id, cluster } });
                      window.location.assign("/launchpad/" + token.id);
                    })
                  }
                >
                  <Wallet />
                  Prepare optional Meteora token
                </Button>
              )}
              <p className="text-xs">
                Pool creation, trades, claims and migration require your wallet approval. No
                automatic fees-to-compute routing is configured.
              </p>
              <MachineFunding id={id} cluster={cluster} />
            </>
          ) : (
            <p className="text-sm">Private financial records are visible only to the owner.</p>
          )}
        </section>
      )}
      {tab === "settings" && own && (
        <section className="space-y-7">
          <label className="block text-sm">
            Working soul
            <textarea
              className="field mt-2 min-h-48"
              value={soul ?? m.soul}
              onChange={(e) => setSoul(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Goal
            <textarea
              className="field mt-2"
              value={currentRecipe.goal}
              onChange={(e) => setRecipe({ ...currentRecipe, goal: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Recipe calibration JSON
            <textarea
              className="field mt-2 min-h-48 font-mono text-xs"
              value={calibrationText ?? JSON.stringify(currentRecipe.calibration ?? {}, null, 2)}
              onChange={(e) => setCalibrationText(e.target.value)}
            />
          </label>
          <Button
            disabled={busy}
            onClick={() =>
              perform(() =>
                settingsFn({
                  data: {
                    id,
                    soul: soul ?? m.soul,
                    recipe: recipeSchema.parse({
                      ...currentRecipe,
                      calibration:
                        calibrationText === null
                          ? currentRecipe.calibration
                          : JSON.parse(calibrationText),
                    }),
                  },
                }),
              )
            }
          >
            <Save />
            Save settings
          </Button>
          <div className="border-t border-border pt-6 space-y-4">
            <h2 className="text-xl">Enroll isolated runner</h2>
            <p className="text-sm text-muted-foreground">
              Generate the signing key on the runner host with the downloadable CLI. Paste only its
              public key here, sign the challenge on the host, then paste the signature. The private
              key never leaves the host.
            </p>
            <input
              aria-label="Runner label"
              className="field"
              placeholder="Runner label"
              value={runnerLabel}
              onChange={(e) => setRunnerLabel(e.target.value)}
            />
            <input
              aria-label="Runner public signing key"
              className="field font-mono text-xs"
              placeholder="Base64 Ed25519 public key (44 characters)"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value.trim())}
            />
            <select
              aria-label="Runner role"
              className="field"
              value={runnerRole}
              onChange={(e) => setRunnerRole(e.target.value as typeof runnerRole)}
            >
              <option value="author">Author — own jobs</option>
              <option value="verifier">Verifier — other owners only</option>
            </select>
            {replaceRunnerId && (
              <p className="text-xs font-mono">
                Re-enrolling replaces runner {replaceRunnerId.slice(0, 8)} once proven.{" "}
                <button className="underline" onClick={() => setReplaceRunnerId(null)}>
                  Cancel
                </button>
              </p>
            )}
            <Button
              disabled={busy || !runnerLabel.trim() || !publicKey}
              variant="outline"
              onClick={() =>
                perform(async () => {
                  setCredential("");
                  setEnrollSignature("");
                  setChallenge(
                    await challengeFn({
                      data: { label: runnerLabel, publicKey, role: runnerRole, replaceRunnerId },
                    }),
                  );
                })
              }
            >
              1. Request enrollment challenge
            </Button>
            {challenge && (
              <div className="border border-border p-4 space-y-3">
                <p className="text-sm">
                  Save this exact text as <code>challenge.txt</code> on the host and run{" "}
                  <code>python3 devlab_enroll.py sign --key /etc/devlab/signing.key --challenge challenge.txt</code>
                  . Expires in 5 minutes; single use.
                </p>
                <textarea
                  aria-label="Enrollment challenge"
                  readOnly
                  className="field font-mono text-xs min-h-40"
                  value={challenge.message}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(challenge.message)}
                >
                  <Copy />
                  Copy challenge
                </Button>
                <input
                  aria-label="Challenge signature"
                  className="field font-mono text-xs"
                  placeholder="Base64 signature printed by the CLI"
                  value={enrollSignature}
                  onChange={(e) => setEnrollSignature(e.target.value.trim())}
                />
                <Button
                  disabled={busy || !enrollSignature}
                  onClick={() =>
                    perform(async () => {
                      const r = await enrollFn({
                        data: { challengeId: challenge.challengeId, signature: enrollSignature },
                      });
                      setCredential(r.token);
                      setChallenge(null);
                      setReplaceRunnerId(null);
                    })
                  }
                >
                  2. Prove key and enroll
                </Button>
              </div>
            )}
            {credential && (
              <div className="border border-border p-4">
                <p className="text-sm">Runner credential — shown once. Keep private.</p>
                <input
                  aria-label="Runner credential"
                  type="password"
                  readOnly
                  value={credential}
                  className="field mt-2"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => navigator.clipboard.writeText(credential)}
                >
                  <Copy />
                  Copy credential
                </Button>
              </div>
            )}
            <RunnerList
              runners={runners.data ?? []}
              onReenroll={(r) => {
                setReplaceRunnerId(r.id);
                setRunnerLabel(r.label);
                setRunnerRole(r.role as "author" | "verifier");
              }}
            />
            <Link to="/docs" hash="runner" className="block underline text-sm">
              Runner download and setup documentation ↗
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

type RunnerRow = {
  id: string;
  label: string;
  role: string;
  active: boolean;
  proven: boolean;
  fingerprint: string | null;
  replaced: boolean;
};
function RunnerList({
  runners,
  onReenroll,
}: {
  runners: RunnerRow[];
  onReenroll: (r: RunnerRow) => void;
}) {
  if (!runners.length) return <p className="text-sm text-muted-foreground">No runners enrolled.</p>;
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-xs">YOUR RUNNERS (ALL MACHINES)</h3>
      {runners.map((r) => (
        <div key={r.id} className="border border-border p-3 flex flex-wrap gap-3 items-center justify-between text-sm">
          <span>
            {r.label} · {r.role} ·{" "}
            <span className="font-mono text-xs">
              {r.proven ? `key ${r.fingerprint}… proven` : "key NOT proven"}
              {r.active ? "" : r.replaced ? " · replaced" : " · inactive"}
            </span>
          </span>
          {r.active && !r.proven && (
            <Button size="sm" variant="outline" onClick={() => onReenroll(r)}>
              Re-enroll with proof
            </Button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Unproven runners cannot lease jobs or count as verifiers. Proof shows control of a signing key
        under a separate account; it is not Sybil resistance or proof of separate physical hosts.
      </p>
    </div>
  );
}
function AuthorSessionStatus({
  jobs,
  recipe,
}: {
  jobs: { id: string; kind: string; status: string; attempts: number; created_at: string }[];
  recipe: Recipe;
}) {
  const latest = jobs.find((j) => j.kind === "author");
  const calibrated = !!recipe.calibration && Object.keys(recipe.calibration.harness ?? {}).length > 0;
  return (
    <div className="border-b border-border pb-6 space-y-2">
      <h2 className="text-xl">Author session</h2>
      <p className="font-mono text-xs">
        CALIBRATION / {calibrated ? "configured" : "missing — execution blocked"}
      </p>
      <p className="font-mono text-xs">
        LATEST AUTHOR JOB /{" "}
        {latest ? `${latest.status} · attempt ${latest.attempts} of 3 · ${new Date(latest.created_at).toLocaleString()}` : "none yet"}
      </p>
      <p className="text-sm text-muted-foreground">
        Press Run to queue an author session. Your enrolled, key-proven author runner leases it,
        asks Claude for patches from bounded source, measures them in Docker against the pinned
        recipe, and only submits a candidate that passes. Candidates appear below; two independently
        owned verifier runners then replay them before any generation is accepted.
      </p>
    </div>
  );
}
