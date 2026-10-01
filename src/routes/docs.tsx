import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — biocode" },
      { name: "description", content: "What biocode does today, what is coming next, and how accounts, clusters and data work." },
      { property: "og:title", content: "Docs — biocode" },
      { property: "og:description", content: "Current state and roadmap of the biocode DeSci platform." },
    ],
  }),
  component: Docs,
});

const SECTIONS = [
  { id: "status", t: "Current state (v0.1)", b: [
    "Live: accounts (email or Google), research workspace, real paper search via OpenAlex, launch draft builder with validation, watchlist, wallet connect (Phantom-compatible) and cluster switching.",
    "Not live yet: AI analysis of research runs, token creation, pools and trading. Runs are saved with status \"queued\"; drafts are saved with status \"draft\".",
  ]},
  { id: "accounts", t: "Accounts & privacy", b: [
    "Anyone can browse. Saving research runs, launch drafts and watchlist entries requires an account.",
    "Every saved record is owner-only: access rules on the database ensure only you can read, change or delete your rows.",
  ]},
  { id: "clusters", t: "Clusters", b: [
    "biocode defaults to Solana devnet. Switching to mainnet disconnects your wallet and clears all cluster-dependent data in the app, then reloads drafts and watchlist for the new cluster.",
  ]},
  { id: "research", t: "Research", b: [
    "A run combines a question, optional pasted source text, attached papers and one or more of 12 specialist roles.",
    "Next: runs will be executed by Claude, with structured scoring by Jev.",
  ]},
  { id: "launch", t: "Launchpad", b: [
    "Four validated steps: basics (title, symbol, category), thesis and evidence links, treasury address and token settings, then review.",
    "Next: launching will create the token and a Meteora pool on the selected cluster.",
  ]},
  { id: "markets", t: "Markets & portfolio", b: [
    "No prices or balances are simulated. Markets and holdings appear only from real on-chain data once the Meteora integration ships.",
  ]},
];

function Docs() {
  return (
    <>
      <PageHeader eyebrow="docs" title="Documentation">An honest account of what works today and what comes next.</PageHeader>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[200px_1fr]">
        <nav aria-label="Docs sections" className="md:sticky md:top-24 md:self-start">
          <ul className="space-y-2 text-sm">{SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">{s.t}</a></li>)}</ul>
        </nav>
        <div className="max-w-3xl space-y-12">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-t border-border pt-6">
              <h2 className="text-3xl">{s.t}</h2>
              {s.b.map((p, i) => <p key={i} className="mt-4 leading-relaxed text-muted-foreground">{p}</p>)}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
