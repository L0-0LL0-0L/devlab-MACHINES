import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/site";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — biocode" },
      { name: "description", content: "The biocode community of researchers, funders and builders in decentralized science." },
      { property: "og:title", content: "Community — biocode" },
      { property: "og:description", content: "Join researchers and builders in decentralized science." },
    ],
  }),
  component: Community,
});

const PRINCIPLES = [
  ["Open by default", "Theses, evidence and results are published, not gated."],
  ["Evidence over hype", "No fabricated metrics, testimonials or price claims."],
  ["Owner-controlled", "Your drafts and runs are private until you publish them."],
];

function Community() {
  return (
    <>
      <PageHeader eyebrow="community" title="Community">A place for researchers, funders and builders. We're just getting started.</PageHeader>
      <div className="mx-auto max-w-7xl space-y-12 px-5 py-14">
        <ul className="grid gap-px bg-border md:grid-cols-3">
          {PRINCIPLES.map(([t, d]) => (
            <li key={t} className="bg-panel p-6"><h2 className="text-xl">{t}</h2><p className="mt-2 text-sm text-muted-foreground">{d}</p></li>
          ))}
        </ul>
        <EmptyState title="No discussions yet" action={<Button asChild size="sm" variant="outline"><Link to="/research">Start with a research question</Link></Button>}>
          Project discussions will open alongside the first public launches. Official channels will be listed here once they exist.
        </EmptyState>
      </div>
    </>
  );
}
