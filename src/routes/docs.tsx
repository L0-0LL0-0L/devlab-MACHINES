import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { PageHeader, SignInPrompt } from "@/components/site";
import { useAuth } from "@/lib/auth";
import { providerHealth } from "@/lib/machines.functions";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/docs")({
  head: () =>
    pageMeta(
      "Docs",
      "Machine architecture, recipes, independent replay acceptance, isolated runner setup and funding boundaries.",
    ),
  component: Docs,
});
const sections = [
  [
    "core",
    "Core coordinator",
    "The app persists machines, fixed snapshots, jobs, candidates, events and replay receipts. Browsing is public; private actions require a signed wallet account. Machine publication exposes configuration and evidence, not private financial records.",
  ],
  [
    "work",
    "Pinned work",
    "GitHub metadata, default branch, exact commit, license and README are fetched from the official API. Repository roots must be public HTTPS github.com URLs. A changed commit requires a new review. No arbitrary URL fetches. Missing licenses are shown explicitly.",
  ],
  [
    "author",
    "Author worker",
    "Claude Sonnet 5.5 can write a working soul and propose a patch from explicitly selected pinned files. Proposed patches are not executed in this app. Text patches cannot touch protected files, paths outside the checkout, credentials or runner infrastructure. The isolated author selects bounded real source, obtains a lease-bound Sonnet patch, measures unchanged harness results and iterates at most three times. Manual patch mode is optional.",
  ],
  [
    "sandbox",
    "Docker sandbox",
    "The self-hosted coordinator runs outside this app. Repository commands execute in a non-root Docker container with no network, read-only root filesystem, dropped capabilities, process/memory/CPU limits and bounded time. Prepare a pinned image containing repository dependencies before disabling network. No browser worker runs git, builds or benchmarks.",
  ],
  [
    "verifier",
    "Independent verifier workers",
    "Register separate verifier signing identities from accounts other than the machine owner. A verifier leases a pinned replay job, checks the patch digest and deterministic candidate commit, measures baseline and candidate in the same image and signs the callback. One identity cannot count twice.",
  ],
  [
    "acceptance",
    "Acceptance judge",
    "Two independent verifier identities are required. Author and same-owner identities are excluded. Commit, patch and recipe digests must match. Tests and equivalence must pass. Calibrated image, architecture, toolchain, seed, harness hashes and equivalence identities must match. Independent measurements must agree within pinned tolerances. Required metrics must exist, be within calibrated bounds and be finite; positive target baseline and the configured percent improvement are mandatory. Guard metrics must not increase. Missing or failed evidence never becomes an accepted generation.",
  ],
  [
    "recipe",
    "Recipe output",
    "The pinned benchmark command must exit successfully and emit one final JSON line with metrics, testsPassed, equivalent, testIdentities and equivalenceDigest. Guard definitions, benchmark code and tests must be protected. The command is executed for both baseline and candidate; logs and image digest accompany the signed receipt. Recipes are custom configurations, not claims of a certified verifier network.",
  ],
  [
    "runtime",
    "Hosted runtime & desktop",
    "No hosted compute service or live desktop connection is configured. Hosted jobs are blocked. Desk is a saved workbench of actual machines, activity and candidate panels, not a simulated operating system or live screen.",
  ],
  [
    "identity",
    "Identity publisher",
    "Machine IDs, pinned snapshots, candidates, signatures, replay receipts and accepted-generation decisions are inspectable on public machine pages. Runner bearer credentials are shown once to their owner; private signing keys stay on the runner.",
  ],
  [
    "funding",
    "Tokens & funding",
    "Optional machine tokens use Meteora with wallet-approved creation, simulation, signing and confirmation. The chain is verified before token publication. Owner-authorized confirmed SOL deposits require an exact machine memo, verified signer and recipient, selected network and exact lamports. Received deposits, claimed fees and liquidity remain separate. No automated fees-to-compute routing or hosted billing is configured, so runway is unavailable. Historical tokens stay separate from machine registry entries.",
  ],
  [
    "setup",
    "Self-hosted setup",
    "Use the runner package in this project: build runner/Dockerfile into a dependency-ready pinned image, install runner/requirements.txt, create an Ed25519 keypair locally, register the public key under machine Settings, and set DEVLAB_URL, DEVLAB_RUNNER_TOKEN, DEVLAB_SIGNING_KEY  before running runner/worker.py. Authors use the bounded automatic loop by default; DEVLAB_PATCH_FILE enables optional manual diff mode. Configure recipe calibration JSON in machine Settings. See the detailed setup document in runner/README.md. Two independent owners must operate verifier runners for acceptance.",
  ],
];
function Docs() {
  const { user } = useAuth();
  const healthFn = useServerFn(providerHealth);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof providerHealth>> | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <PageHeader eyebrow="FIELD MANUAL" title="The lab, documented." />
      <div className="max-w-7xl mx-auto px-5 py-10 grid gap-10 md:grid-cols-[220px_1fr]">
        <nav
          aria-label="Documentation sections"
          className="text-xs font-mono space-y-3 md:sticky md:top-24 md:self-start"
        >
          {sections.map(([id, title]) => (
            <a className="block" key={id} href={"#" + id}>
              {title} ↗
            </a>
          ))}
        </nav>
        <div className="max-w-3xl space-y-10">
          <section className="border-t-2 border-border pt-6">
            <h2 className="text-2xl">Model health</h2>
            <p className="mt-3 text-sm">
              Sonnet 5.5 via the existing Anthropic adapter. Jev Latest via Lovable AI. Health is
              checked on demand with actual provider requests.
            </p>
            {!user ? (
              <div className="mt-4">
                <SignInPrompt what="check model health" />
              </div>
            ) : (
              <Button
                className="mt-4"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    setHealth(await healthFn());
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Checking providers…" : "Check live model health"}
              </Button>
            )}
            {error && <p role="alert">{error}</p>}
            {health && (
              <pre className="mt-4 bg-panel border border-border p-4 text-xs">
                {JSON.stringify(health, null, 2)}
              </pre>
            )}
          </section>
          {sections.map(([id, title, text]) => (
            <section id={id} key={id} className="border-t border-border pt-6 scroll-mt-24">
              <p className="eyebrow">{id}</p>
              <h2 className="mt-3 text-2xl">{title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{text}</p>
              {id === "recipe" && (
                <pre className="mt-4 p-4 bg-panel border border-border text-xs">
                  {
                    '{"metrics":{"latency":100,"memory":20},"testsPassed":true,"equivalent":true}\n// Format example only — not a measured result.'
                  }
                </pre>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
