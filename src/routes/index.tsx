import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, GitBranch, Terminal, ShieldCheck, Plus } from "lucide-react";
import artwork from "@/assets/devlab-machines-official-logo.jpeg.asset.json";
import { Button } from "@/components/ui/button";
import { MachineList } from "@/components/machine-list";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/")({
  head: () =>
    pageMeta(
      "Public coding lab",
      "A retro computing lab for coding machines, public repositories and independently measured generations.",
    ),
  component: Home,
});
function Home() {
  return (
    <>
      <section className="relative border-b-2 border-border overflow-hidden min-h-[610px] lg:min-h-[660px] bg-background">
        <img
          src={artwork.url}
          alt="Official devlab MACHINES retro computer artwork"
          className="absolute right-0 bottom-0 h-[170px] w-[170px] lg:top-0 lg:h-full lg:w-[62%] object-contain object-right"
        />
        <div className="relative mx-auto max-w-7xl px-5 py-8 pb-[170px] lg:pb-20 lg:py-20 pointer-events-none">
          <div className="max-w-xl pointer-events-auto">
            <p className="font-mono text-xs flex items-center gap-2">
              <span className="size-2 bg-screen-green border border-border" /> PUBLIC CODE /
              INDEPENDENT PROOF
            </p>
            <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl leading-[1.08]">
              devlab
              <br />
              MACHINES
            </h1>
            <p className="mt-6 max-w-sm text-lg leading-relaxed">
              Give public code a machine.
              <br />
              Give every improvement a receipt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/launch">
                  Launch a machine <Plus />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/explorer">
                  Open explorer <ArrowUpRight />
                </Link>
              </Button>
            </div>
            <div className="mt-5 font-mono text-xs space-y-2">
              <p>01 / PIN A REPOSITORY</p>
              <p>02 / DEFINE THE WORK</p>
              <p>03 / REPLAY THE EVIDENCE</p>
            </div>
          </div>
        </div>
      </section>
      <div className="spectrum h-3 border-b-2 border-border" />
      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex flex-wrap justify-between gap-4 items-end mb-8">
          <div>
            <p className="eyebrow">THE REGISTRY</p>
            <h2 className="text-3xl mt-2">Machines on the bench</h2>
          </div>
          <Link to="/machines" className="font-mono text-xs underline">
            All machines ↗
          </Link>
        </div>
        <MachineList limit={3} />
      </section>
      <section className="border-y-2 border-border bg-panel">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <p className="eyebrow">A GENERATION IS EARNED, NOT GENERATED</p>
          <div className="grid gap-10 md:grid-cols-3 mt-8">
            {[
              [
                GitBranch,
                "Pinned work",
                "A public repository, exact baseline commit and fixed benchmark recipe.",
              ],
              [
                Terminal,
                "Isolated sessions",
                "An author proposes a patch. Execution belongs in an isolated runner, not your browser.",
              ],
              [
                ShieldCheck,
                "Independent receipts",
                "Only passing replay evidence can earn an accepted generation. A proposed diff is not a win.",
              ],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof GitBranch;
              return (
                <div key={String(title)}>
                  <I size={30} />
                  <h3 className="text-xl mt-5">{String(title)}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {String(body)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-14 flex flex-wrap justify-between items-center gap-6">
        <div>
          <p className="eyebrow">OWN THE WORK, INSPECT THE PROOF</p>
          <h2 className="mt-3 text-3xl">
            A little computer.
            <br />A public trail.
          </h2>
        </div>
        <Button asChild size="lg">
          <Link to="/desk">
            Open your desk <ArrowUpRight />
          </Link>
        </Button>
      </section>
    </>
  );
}
