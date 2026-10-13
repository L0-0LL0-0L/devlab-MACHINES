import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Sparkles, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SignInPrompt } from "@/components/site";
import { createMachine, validateRepository, generateSoul } from "@/lib/machines.functions";
import { useAuth } from "@/lib/auth";
import { recipeSchema, type Recipe } from "@/lib/machine-core";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/launch")({
  head: () =>
    pageMeta(
      "Launch",
      "Create a coding machine with a pinned public repository, working soul, benchmark recipe and runtime.",
    ),
  component: Launch,
});
const steps = ["Coin", "Work", "Agent", "Identity", "Funding", "Review"];
const initialRecipe: Recipe = {
  goal: "",
  command: "",
  metric: "latency",
  direction: "lower",
  improvement: 5,
  guards: ["memory"],
  protectedFiles: ["tests", "benchmarks", ".github"],
};
function Launch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const validate = useServerFn(validateRepository),
    soulFn = useServerFn(generateSoul),
    save = useServerFn(createMachine);
  const [step, setStep] = useState(0),
    [name, setName] = useState(""),
    [symbol, setSymbol] = useState(""),
    [url, setUrl] = useState(""),
    [repo, setRepo] = useState<Awaited<ReturnType<typeof validateRepository>> | null>(null),
    [recipe, setRecipe] = useState(initialRecipe),
    [soul, setSoul] = useState(""),
    [runtime, setRuntime] = useState<"self-hosted" | "hosted">("self-hosted"),
    [publish, setPublish] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function next() {
    setError("");
    try {
      if (step === 0 && name.trim().length < 2)
        throw new Error("Name needs at least two characters");
      if (step === 1) {
        if (!repo || repo.url !== url.replace(/\/$/, ""))
          throw new Error("Validate the public repository first");
        recipeSchema.parse(recipe);
      }
      if (step === 2 && soul.trim().length < 10)
        throw new Error("Add a working soul of at least 10 characters");
      setStep(Math.min(5, step + 1));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function finish() {
    if (!repo) return;
    setBusy(true);
    try {
      const m = await save({
        data: { name, symbol, url: repo.url, commit: repo.commit, soul, recipe, runtime, publish },
      });
      toast.success("Machine saved");
      navigate({ to: "/machines/$id", params: { id: m.id } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (label: string, value: string, fn: (s: string) => void, multi = false) => (
    <label className="block text-sm font-medium">
      {label}
      {multi ? (
        <textarea
          className="field mt-2 min-h-28"
          value={value}
          onChange={(e) => fn(e.target.value)}
        />
      ) : (
        <input className="field mt-2" value={value} onChange={(e) => fn(e.target.value)} />
      )}
    </label>
  );
  return (
    <>
      <PageHeader eyebrow="NEW MACHINE / 6 STEPS" title="Put a machine to work." />
      <div className="mx-auto max-w-7xl px-5 py-10 grid gap-8 lg:grid-cols-[220px_1fr_260px]">
        <ol className="flex lg:flex-col gap-2 overflow-x-auto">
          {steps.map((s, i) => (
            <li
              key={s}
              className={`font-mono text-xs border border-border px-4 py-3 shrink-0 ${i === step ? "bg-primary text-primary-foreground" : "bg-panel"}`}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="mr-3">{i < step ? "✓" : `0${i + 1}`}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="hardware p-6 space-y-6 min-w-0">
          <h2 className="text-2xl">{steps[step]}</h2>
          {step === 0 && (
            <>
              {field("Machine name", name, setName)}
              {field("Optional token symbol", symbol, (s) =>
                setSymbol(
                  s
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 10),
                ),
              )}
              <p className="text-sm text-muted-foreground">
                Token creation is optional and wallet-signed. Saving this machine does not deploy a
                token.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              {field("Public GitHub repository", url, (s) => {
                setUrl(s);
                setRepo(null);
              })}
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    setRepo(await validate({ data: { url } }));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Check /> {busy ? "Checking…" : "Validate repository"}
              </Button>
              {repo && (
                <div className="border-y border-border py-4 space-y-2 text-sm">
                  <a className="underline" href={repo.url} target="_blank" rel="noreferrer">
                    {repo.owner}/{repo.repo} <ExternalLink size={12} className="inline" />
                  </a>
                  <p>{repo.description}</p>
                  <p className="font-mono text-xs">
                    {repo.branch} · {repo.language} · {repo.license}
                  </p>
                  <p className="font-mono text-xs break-all">{repo.commit}</p>
                  <details>
                    <summary>README</summary>
                    <pre className="text-xs mt-3 max-h-64 overflow-auto">
                      {repo.readme || "No README at this commit"}
                    </pre>
                  </details>
                </div>
              )}
              {field("Goal", recipe.goal, (s) => setRecipe({ ...recipe, goal: s }), true)}
              {field("Pinned benchmark command", recipe.command, (s) =>
                setRecipe({ ...recipe, command: s }),
              )}
              <div className="grid grid-cols-2 gap-4">
                {field("Target metric", recipe.metric, (s) => setRecipe({ ...recipe, metric: s }))}
                <label className="text-sm">
                  Direction
                  <select
                    className="field mt-2"
                    value={recipe.direction}
                    onChange={(e) =>
                      setRecipe({ ...recipe, direction: e.target.value as Recipe["direction"] })
                    }
                  >
                    <option value="lower">Lower is better</option>
                    <option value="higher">Higher is better</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                Minimum improvement (%)
                <input
                  className="field mt-2"
                  type="number"
                  min="0.01"
                  max="100"
                  value={recipe.improvement}
                  onChange={(e) => setRecipe({ ...recipe, improvement: Number(e.target.value) })}
                />
              </label>
              {field(
                "Guard metrics (comma-separated, must not increase)",
                recipe.guards.join(", "),
                (s) =>
                  setRecipe({
                    ...recipe,
                    guards: s
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }),
              )}
              {field("Protected files/directories", recipe.protectedFiles.join(", "), (s) =>
                setRecipe({
                  ...recipe,
                  protectedFiles: s
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                }),
              )}
            </>
          )}
          {step === 2 && (
            <>
              <p className="font-mono text-xs">CLAUDE SONNET 5.5 / JEV LATEST</p>
              {field("Working soul", soul, setSoul, true)}
              <Button
                variant="outline"
                disabled={busy || !user || !repo}
                onClick={async () => {
                  if (!repo) return;
                  setBusy(true);
                  try {
                    const result = await soulFn({
                      data: { url: repo.url, goal: recipe.goal, style: soul },
                    });
                    setSoul(result.text);
                    toast.success(`Generated with ${result.model}`);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles />
                {busy ? "Writing…" : "Generate working soul"}
              </Button>
              {!user && <SignInPrompt what="generate a working soul" />}
            </>
          )}
          {step === 3 && (
            <>
              <p className="text-sm">
                Owner identity comes from your signed wallet account. Author and independent
                verifiers use separate registered signing keys.
              </p>
              <label className="block text-sm">
                Runtime
                <select
                  className="field mt-2"
                  value={runtime}
                  onChange={(e) => setRuntime(e.target.value as typeof runtime)}
                >
                  <option value="self-hosted">Self-hosted isolated runner</option>
                  <option value="hosted">Hosted — not configured</option>
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                {runtime === "hosted"
                  ? "Hosted jobs remain blocked until a real compute integration is configured."
                  : "Register your author runner from the machine page. Verifiers must have different owners."}
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <dl className="divide-y divide-border text-sm">
                {[
                  ["Received compute funding", "0 SOL — new machine"],
                  ["Token pool", "Not created"],
                  ["Compute price", "Not configured — no estimated price"],
                  ["Runway", "Unavailable until real costs and funds exist"],
                  ["Pool liquidity", "Never counted as compute budget"],
                ].map(([k, v]) => (
                  <div className="py-3" key={k}>
                    <dt className="font-mono text-xs">{k}</dt>
                    <dd className="mt-2">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm">
                Meteora token preparation is available after saving. You review actual transaction
                costs and approve each signature on the token page.
              </p>
            </>
          )}
          {step === 5 && (
            <>
              <dl className="space-y-4 text-sm">
                {[
                  ["Machine", name],
                  ["Repository", repo?.url ?? ""],
                  ["Baseline", repo?.commit ?? ""],
                  ["Goal", recipe.goal],
                  ["Command", recipe.command],
                  ["Target", `${recipe.metric} / ${recipe.direction} / ${recipe.improvement}%`],
                  ["Runtime", runtime],
                  ["Model", "claude-sonnet-5-5"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="eyebrow">{k}</dt>
                    <dd className="mt-1 break-all">{v}</dd>
                  </div>
                ))}
              </dl>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={publish}
                  onChange={(e) => setPublish(e.target.checked)}
                />{" "}
                Publish the machine configuration and public evidence. Jobs and private financial
                ledger stay owner-only.
              </label>
              {!user && <SignInPrompt what="save this machine" />}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive break-words">
              {error}
            </p>
          )}
          <div className="flex justify-between gap-3 border-t border-border pt-5">
            <Button
              variant="ghost"
              disabled={step === 0 || busy}
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              <ArrowLeft />
              Back
            </Button>
            {step < 5 ? (
              <Button onClick={next} disabled={busy}>
                Continue
                <ArrowRight />
              </Button>
            ) : (
              <Button disabled={!user || busy} onClick={finish}>
                {busy ? "Saving…" : "Save machine"}
              </Button>
            )}
          </div>
        </div>
        <aside className="text-sm">
          <p className="eyebrow">PINNED, NOT PROMISED</p>
          <p className="mt-3 leading-relaxed">
            A machine is a configuration. A patch is a proposal. A generation needs passing,
            independently signed replay measurements.
          </p>
          <div className="spectrum h-2 mt-6 border border-border" />
          <p className="mt-5 font-mono text-xs">No funds are spent by this wizard.</p>
        </aside>
      </div>
    </>
  );
}
