import { createFileRoute } from "@tanstack/react-router";
import { RegistryPage } from "@/components/registry-page";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/repositories")({
  head: () =>
    pageMeta("Repositories", "Public coding machine repositories and pinned repository evidence."),
  component: () => <RegistryPage kind="repositories" />,
});
