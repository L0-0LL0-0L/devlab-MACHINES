import { createFileRoute } from "@tanstack/react-router";
import { RegistryPage } from "@/components/registry-page";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/explorer")({
  head: () =>
    pageMeta("Explorer", "Public coding machine explorer and pinned repository evidence."),
  component: () => <RegistryPage kind="explorer" />,
});
