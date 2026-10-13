import { createFileRoute } from "@tanstack/react-router";
import { MachineDetail } from "@/components/machine-detail";
import { pageMeta } from "@/lib/page-meta";
export const Route = createFileRoute("/machines/$id")({
  head: ({ params }) =>
    pageMeta(
      "Machine " + params.id,
      "Pinned source, patch candidates, replay evidence and machine activity.",
    ),
  component: Detail,
});
function Detail() {
  const { id } = Route.useParams();
  return (
    <div className="max-w-7xl mx-auto px-5 py-10">
      <MachineDetail id={id} />
    </div>
  );
}
