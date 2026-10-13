import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const prepareMachineToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ id: z.string().uuid(), cluster: z.enum(["mainnet-beta", "devnet"]) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase
      .from("machines")
      .select("*")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();
    if (!m) throw new Error("Not your machine");
    if (m.token_project_id) return { id: m.token_project_id };
    if (!/^[A-Z0-9]{2,10}$/.test(m.symbol))
      throw new Error("Token symbol must be 2–10 uppercase characters");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", context.userId)
      .single();
    if (!profile?.wallet_address) throw new Error("Wallet identity required");
    const repo = m.repository as { url: string };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: token, error } = await db
      .from("projects")
      .insert({
        owner_id: context.userId,
        cluster: data.cluster,
        status: "draft",
        title: m.name,
        symbol: m.symbol,
        thesis: `Coding machine ${m.name} works on the public repository ${repo.url}. Proposed changes require independent deterministic replay evidence before acceptance.`,
        category: "other",
        evidence: [{ label: "Public source repository", url: repo.url }],
        treasury_address: profile.wallet_address,
        token_supply: 1000000000,
        token_decimals: 6,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e } = await db
      .from("machines")
      .update({ token_project_id: token.id })
      .eq("id", m.id);
    if (e) throw e;
    return token;
  });
