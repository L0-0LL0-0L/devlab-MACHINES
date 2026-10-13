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
    "Claude Sonnet 5.5 writes the working soul in this app. Patches are proposed only inside a leased author session: press Run on the machine, and your key-proven author runner requests patches through the signed propose endpoint. Proposed patches are not executed in this app. Text patches cannot touch protected files, paths outside the checkout, credentials or runner infrastructure. The isolated author selects bounded real source, obtains a lease-bound Sonnet patch, measures unchanged harness results and iterates at most three times. Manual patch mode is optional.",
  ],
  [
    "sandbox",
    "Docker sandbox",
    "The self-hosted coordinator runs outside this app. Repository commands execute in a non-root Docker container with no network, read-only root filesystem, dropped capabilities, process/memory/CPU limits and bounded time. Prepare a pinned image containing repository dependencies before disabling network. No browser worker runs git, builds or benchmarks.",
  ],
  [
    "verifier",
    "Independent verifier workers",
    "Enroll verifier runners from accounts other than the machine owner, each proving control of its own globally unique Ed25519 key. A verifier leases a pinned replay job, checks the patch digest and deterministic candidate commit, measures baseline and candidate in the same image and signs the callback. The author's key, any key already used on the candidate and same-owner runners are excluded at lease, callback and judge. Account separation plus key proof is not Sybil resistance and does not prove separate physical hosts.",
  ],
  [
    "acceptance",
    "Acceptance judge",
    "Two independent verifier identities are required. Author and same-owner identities are excluded. Commit, patch and recipe digests must match. Tests and equivalence must pass. Calibrated image, architecture, toolchain, seed, harness hashes and equivalence identities must match. Independent measurements must agree within pinned tolerances. Required metrics must exist, be within calibrated bounds and be finite; positive target baseline and the configured percent improvement are mandatory. Guard metrics must not increase. Missing or failed evidence never becomes an accepted generation.",
  ],
  [
    "recipe",
    "Recipe output",
    "Recipe v2 pins a goal, command, target metric/direction/percent, guard metrics, protected files and a calibration block. Execution stays blocked until calibration names an immutable image ID, architecture, toolchain, holdout seed, SHA-256 of every harness file, ordered test identities, expected equivalence digest, exact metric bounds and agreement tolerances. The unchanged command must exit 0 and print one final JSON line from real tests. The examples below are illustrative shapes only, with placeholder values; they are not runnable and are not measured results.",
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
    "Download the runner package. You need your own author runner plus two verifier runners enrolled from two separate other accounts, each on a dedicated Linux host with Docker and an actually calibrated, dependency-ready image whose immutable ID is pinned in the recipe. Keys are generated and kept on the host; only the public key and a challenge signature are pasted into the app. Authors use the bounded automatic loop by default; DEVLAB_PATCH_FILE enables optional manual diff mode.",
  ],
];
const RUNNER_ZIP = "devlab-runner-v2.1.0.zip";
const ENROLL_STEPS = `# On each dedicated runner host
unzip devlab-runner-v2.1.0.zip && cd devlab-runner-v2.1.0
sudo useradd --system devlab-runner && sudo usermod -aG docker devlab-runner
sudo install -d -o devlab-runner /opt/devlab /var/lib/devlab
sudo install -d -m 0700 -o devlab-runner /etc/devlab
sudo cp -r . /opt/devlab/runner
sudo -u devlab-runner python3 -m venv /opt/devlab/venv
sudo -u devlab-runner /opt/devlab/venv/bin/pip install -r requirements.txt

# 1. Generate the signing key locally (prints the PUBLIC key only)
sudo -u devlab-runner /opt/devlab/venv/bin/python devlab_enroll.py keygen --out /etc/devlab/signing.key

# 2. In the app: machine > Settings > Enroll isolated runner > Request enrollment challenge
#    Save the challenge text exactly as challenge.txt, then sign it here:
sudo -u devlab-runner /opt/devlab/venv/bin/python devlab_enroll.py sign --key /etc/devlab/signing.key --challenge challenge.txt

# 3. Paste the signature > Prove key and enroll. Copy the one-time credential into:
sudo install -m 0600 -o devlab-runner runner.env.example /etc/devlab/runner.env
sudoedit /etc/devlab/runner.env   # DEVLAB_URL, DEVLAB_RUNNER_TOKEN

# 4. Start the service
sudo cp devlab-runner.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now devlab-runner`;
const EXAMPLE_CALIBRATION = {
  image: "sha256:<64-hex image ID of YOUR calibrated image>",
  architecture: "x86_64",
  toolchain: "<exact toolchain identity, e.g. node 22.x + pnpm 9.x>",
  holdoutSeed: "<pinned seed>",
  harness: { "bench/run.mjs": "<sha256 of file>", "bench/fixtures/input.json": "<sha256>" },
  tests: ["<ordered test identity>", "<ordered test identity>"],
  equivalenceDigest: "<digest produced by your trusted holdout checks>",
  metrics: { "<target metric>": { min: 0, max: "<finite bound>" }, "<guard metric>": { min: 0, max: "<finite bound>" } },
  relativeTolerance: "<0 to 0.05>",
  absoluteTolerance: "<0 to 0.001>",
};
const EXAMPLE_OUTPUT = {
  metrics: { "<target metric>": "<measured number>", "<guard metric>": "<measured number>" },
  testsPassed: "<boolean from real tests>",
  equivalent: "<boolean from real holdout checks>",
  testIdentities: ["<ordered test identity>"],
  equivalenceDigest: "<digest>",
  architecture: "x86_64",
  toolchain: "<toolchain>",
  holdoutSeed: "<seed>",
};
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
                <>
                  <p className="mt-4 font-mono text-xs">
                    ILLUSTRATIVE CALIBRATION — PLACEHOLDERS, NOT RUNNABLE
                  </p>
                  <pre className="mt-2 p-4 bg-panel border border-border text-xs overflow-auto">
                    {JSON.stringify(EXAMPLE_CALIBRATION, null, 2)}
                  </pre>
                  <p className="mt-4 font-mono text-xs">
                    ILLUSTRATIVE FINAL OUTPUT LINE SHAPE — NOT A MEASURED RESULT
                  </p>
                  <pre className="mt-2 p-4 bg-panel border border-border text-xs overflow-auto">
                    {JSON.stringify(EXAMPLE_OUTPUT, null, 2)}
                  </pre>
                </>
              )}
              {id === "setup" && (
                <div id="runner" className="mt-4 space-y-3 text-sm scroll-mt-24">
                  <a
                    className="inline-block border-2 border-border px-4 py-2 font-mono text-xs underline"
                    href={`/downloads/${RUNNER_ZIP}`}
                    download={RUNNER_ZIP}
                  >
                    Download {RUNNER_ZIP}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Contains worker.py, devlab_enroll.py, requirements.txt, Dockerfile, systemd
                    service, README and a blank env template. No credentials. SHA-256 at{" "}
                    <a className="underline" href={`/downloads/${RUNNER_ZIP}.sha256`}>
                      {RUNNER_ZIP}.sha256
                    </a>
                    .
                  </p>
                  <pre className="p-4 bg-panel border border-border text-xs overflow-auto whitespace-pre">
                    {ENROLL_STEPS}
                  </pre>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
