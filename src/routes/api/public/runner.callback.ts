import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/runner/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { runnerRequest } = await import("@/lib/runner.server");
          return await runnerRequest(request, "callback");
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 400 });
        }
      },
    },
  },
});
