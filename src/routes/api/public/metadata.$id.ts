import { createFileRoute } from "@tanstack/react-router";

/** Public token metadata JSON (Metaplex URI). Reads only title/symbol/thesis of the project. */
export const Route = createFileRoute("/api/public/metadata/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("projects").select("title,symbol,thesis,category,image_url,website_url").eq("id", params.id).maybeSingle();
        if (!data) return new Response("Not found", { status: 404 });
        const origin = new URL(request.url).origin;
        const body = {
          name: data.title.slice(0, 32),
          symbol: data.symbol,
          description: data.thesis.slice(0, 1000),
          image: data.image_url ? new URL(data.image_url, origin).toString() : `${origin}/favicon.png`,
          external_url: data.website_url || `${origin}/launchpad/${params.id}`,
          attributes: [{ trait_type: "category", value: data.category }],
        };
        return Response.json(body, { headers: { "cache-control": "public, max-age=300" } });
      },
    },
  },
});
