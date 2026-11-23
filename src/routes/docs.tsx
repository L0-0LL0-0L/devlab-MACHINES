import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — biocraft" },
      { name: "description", content: "What biocraft does today, what is coming next, and how accounts, clusters and data work." },
      { property: "og:title", content: "Docs — biocraft" },
      { property: "og:description", content: "Current state and roadmap of the biocraft DeSci platform." },
    ],
  }),
  component: Docs,
});

const SECTIONS = [
  { id: "status", t: "Current state (v0.1)", b: [
    "Live: wallet sign-in (sign a free message with a Solana wallet), research workspace, real paper search via OpenAlex, launch draft builder with validation, watchlist, wallet connect (Phantom-compatible) and cluster switching.",
    "Not live yet: AI analysis of research runs, token creation, pools and trading. Runs are saved with status \"queued\"; drafts are saved with status \"draft\".",
  ]},
  { id: "accounts", t: "Accounts & privacy", b: [
    "Anyone can browse. Saving research runs, launch drafts and watchlist entries requires an account.",
    "Every saved record is owner-only: access rules on the database ensure only you can read, change or delete your rows.",
  ]},
  { id: "clusters", t: "Clusters", b: [
    "biocraft defaults to Solana minnet. Switching networks disconnects your wallet and clears all cluster-dependent data in the app, then reloads drafts and watchlist for the new cluster. Use devnet for risk-free testing.",
  ]},
  { id: "research", t: "Research", b: [
    "A run combines a question, papers found live in Europe PMC, Crossref and arXiv, pasted text or a private PDF, a depth and stance, and up to 12 specialist roles: Literature mapper, Hypothesis builder, Methods critic, Statistics reviewer, Reproducibility reviewer, Data interpreter, Novelty scout, Translational researcher, Ethics reviewer, Funding planner, Peer-review challenger and Synthesis editor.",
    "Jev Latest makes the typed decisions: it classifies the domain, scores how relevant each source is (low-relevance sources are left out), rates how well each role fits, and estimates whether each cited excerpt supports its claim. Claude Sonnet 5.5 writes each role's findings, hypotheses, dissent and limitations, and must cite sources by quoting them word for word.",
    "A citation is marked verified only when its quoted excerpt is found word for word in the stored source text. Sources are labeled abstract only, metadata only, pasted text or full-text PDF. Verified does not mean the claim is true.",
    "Each run moves step by step while you have it open, and you can cancel it or retry a failed step. Download a Markdown or JSON reproducibility pack with sources, the claim ledger, the checklist, and the model and prompt version for each step.",
    "Current status: paper search, Jev and Claude Sonnet 5.5 (through Anthropic directly, since Lovable AI does not offer that model) all answered live test requests.",
  ]},
  { id: "launch", t: "Launchpad", b: [
    "Four validated steps: basics (title, symbol, category), thesis and evidence links, treasury address and token settings, then review.",
    "Next: launching will create the token and a Meteora pool on the selected cluster.",
  ]},
  { id: "private", t: "Private balances (Helius)", b: [
    "biocraft uses Helius Privacy Rings to keep amounts private. You sign one free message with your wallet. That opens a private balance which only your wallet can re-open, and nothing is stored by biocraft.",
    "Creators can move claimed fees into their private balance, withdraw them later, and turn on private support for a launched token. Supporters can then send SOL to that creator with the amount encrypted on-chain.",
    "What stays public: claiming creator fees, moving SOL in or out of a private balance, and which addresses take part in a private transfer. What is hidden: the amount and token of private transfers and balances.",
    "Each token page shows how many private contributions were recorded. Each one is checked to be a real, successful privacy transaction, but because the recipient and amount are encrypted, the count can't prove who received what.",
    "This uses Helius's early-access (alpha) toolkit. Zero-knowledge proofs are made in Helius's verified secure enclave and Helius never holds funds. A small public fee reserve (0.01 SOL) pays network fees and can be returned to your wallet at any time.",
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
