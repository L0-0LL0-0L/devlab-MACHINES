import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import heroImg from "@/assets/hero-lattice.jpg";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusPill } from "@/components/site";
import { RESEARCH_ROLES } from "@/lib/research";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "biocode — research, launch and open results for DeSci" },
      { name: "description", content: "A monochrome decentralized-science platform: AI-assisted research, on-chain project launches on Solana, and open results." },
      { property: "og:title", content: "biocode — decentralized science platform" },
      { property: "og:description", content: "Research with specialist AI roles, launch science projects on Solana, publish open results." },
    ],
  }),
  component: Home,
});

const SLIDES = [
  { tag: "research", title: "Interrogate the evidence.", body: "Frame a question, paste sources, search the literature and assign up to 12 specialist research roles." },
  { tag: "launch", title: "Launch science on-chain.", body: "Turn a validated thesis into a project with a treasury and token settings on Solana — devnet first." },
  { tag: "open results", title: "Publish what you find.", body: "Every run and project keeps its history, so results stay inspectable and reproducible." },
];

const STATS = [
  { value: "0", label: "projects launched on-chain" },
  { value: "0", label: "live markets" },
  { value: String(RESEARCH_ROLES.length), label: "specialist research roles" },
  { value: "mainnet", label: "default cluster" },
];

const STEPS = [
  { n: "01", t: "Ask", d: "Write a research question and attach source text or papers." },
  { n: "02", t: "Analyze", d: "Select specialist roles to review evidence from different angles." },
  { n: "03", t: "Launch", d: "Package thesis, evidence, treasury and token settings for review." },
  { n: "04", t: "Publish", d: "Share open results and track the project from your portfolio." },
];

const UPDATES = [
  { date: "2026-10-01", t: "v0.1 foundation", d: "Accounts, research workspace, launch drafts, watchlist and cluster switching are live." },
  { date: "next", t: "Meteora pools", d: "Pool creation and trading through the Meteora SDK." },
  { date: "next", t: "Claude research runs", d: "Queued runs will be executed by Claude with the selected roles." },
];

function Home() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [paused]);
  const s = SLIDES[i]!;

  return (
    <>
      <section
        className="relative overflow-hidden border-b border-border"
        aria-roledescription="carousel"
        aria-label="biocode highlights"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <img src={heroImg} alt="" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-center px-5 py-20">
          <p className="eyebrow" aria-live="polite">{String(i + 1).padStart(2, "0")} / {s.tag}</p>
          <h1 key={i} className="mt-4 max-w-3xl animate-in fade-in slide-in-from-bottom-2 text-5xl leading-[1.05] duration-700 md:text-7xl">
            {s.title}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">{s.body}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link to="/research">Start research <ArrowRight /></Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/launchpad">Prepare a launch</Link></Button>
          </div>
          <div className="mt-14 flex items-center gap-3">
            <button aria-label="Previous slide" className="rounded-sm border border-border p-2 hover:bg-accent" onClick={() => setI((i + SLIDES.length - 1) % SLIDES.length)}><ChevronLeft size={16} /></button>
            <button aria-label="Next slide" className="rounded-sm border border-border p-2 hover:bg-accent" onClick={() => setI((i + 1) % SLIDES.length)}><ChevronRight size={16} /></button>
            <div className="ml-2 flex gap-2">
              {SLIDES.map((sl, k) => (
                <button key={sl.tag} aria-label={`Show ${sl.tag}`} aria-current={k === i} onClick={() => setI(k)}
                  className={`h-px w-10 transition-colors ${k === i ? "bg-foreground" : "bg-line"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
          {STATS.map((st) => (
            <div key={st.label} className="border-r border-border px-5 py-10 last:border-r-0">
              <dt className="eyebrow">{st.label}</dt>
              <dd className="mt-3 font-display text-4xl font-extralight">{st.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-2">
        <div>
          <p className="eyebrow">ai × desci</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Machine rigor, open science.</h2>
        </div>
        <div className="space-y-5 text-muted-foreground">
          <p>Research questions are reviewed by a panel of specialist roles — from statistician to ethics reviewer — so weaknesses surface before capital is committed.</p>
          <p>Funding happens on Solana with transparent treasuries. Results and run history stay attached to each project.</p>
          <StatusPill>AI execution connects in the next release · runs are queued today</StatusPill>
        </div>
      </section>

      <section className="border-y border-border bg-panel">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <p className="eyebrow">process</p>
          <h2 className="mt-3 text-4xl">Four steps from question to result.</h2>
          <ol className="mt-12 grid gap-px bg-border md:grid-cols-4">
            {STEPS.map((st) => (
              <li key={st.n} className="bg-panel p-6">
                <span className="font-mono text-xs text-muted-foreground">{st.n}</span>
                <h3 className="mt-6 text-2xl">{st.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{st.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">recent projects</p>
            <h2 className="mt-3 text-4xl">Launched projects</h2>
          </div>
          <Link to="/markets" className="text-sm text-muted-foreground hover:text-foreground">View markets →</Link>
        </div>
        <div className="mt-10">
          <EmptyState title="No projects have launched yet" action={<Button asChild size="sm" variant="outline"><Link to="/launchpad">Draft the first one</Link></Button>}>
            Projects appear here once they are launched on-chain. Drafts stay private to their owners.
          </EmptyState>
        </div>
      </section>

      <section className="border-y border-border grid-bg">
        <div className="mx-auto max-w-4xl px-5 py-24 text-center">
          <p className="eyebrow">mission</p>
          <p className="mt-6 font-display text-3xl font-extralight leading-snug md:text-4xl">
            Make it cheap to ask hard scientific questions, honest to fund the answers, and impossible to hide the results.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-3">
        <div>
          <p className="eyebrow">updates</p>
          <h2 className="mt-3 text-4xl">Changelog</h2>
        </div>
        <ul className="divide-y divide-border border-y border-border md:col-span-2">
          {UPDATES.map((u) => (
            <li key={u.t} className="grid gap-2 py-5 sm:grid-cols-[120px_1fr]">
              <span className="font-mono text-xs text-muted-foreground">{u.date}</span>
              <div><h3 className="text-lg">{u.t}</h3><p className="text-sm text-muted-foreground">{u.d}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-10 gap-y-4 px-5 py-10">
          <span className="eyebrow">built with</span>
          {["Solana", "Meteora", "Claude", "Jev"].map((b) => (
            <span key={b} className="font-display text-xl font-light text-muted-foreground">{b}</span>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-panel">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-20 md:flex-row md:items-center">
          <h2 className="text-4xl md:text-5xl">Have a thesis worth funding?</h2>
          <Button size="lg" asChild><Link to="/launchpad">Start a launch <ArrowRight /></Link></Button>
        </div>
      </section>
    </>
  );
}
