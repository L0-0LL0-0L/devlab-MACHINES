import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifySolDeposit } from "./funding-core";
const cluster = z.enum(["devnet", "mainnet-beta"]);
export const configureMachineFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        cluster,
        recipient: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase
      .from("machines")
      .select("id,runtime")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();
    if (!m || m.runtime !== "self-hosted")
      throw new Error("Only owner-managed self-hosted funding is configured");
    const { PublicKey } = await import("@solana/web3.js");
    new PublicKey(data.recipient);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db
      .from("machines")
      .update({
        funding_config: {
          recipient: data.recipient,
          cluster: data.cluster,
          purpose: "self-hosted",
        },
      })
      .eq("id", m.id);
    if (error) throw error;
    return { ok: true };
  });
export const reconcileMachineFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        cluster,
        signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: m } = await context.supabase
      .from("machines")
      .select("id,funding_config")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .single();
    const config = m?.funding_config as { recipient?: string; cluster?: string } | null;
    if (!m || !config?.recipient || config.cluster !== data.cluster)
      throw new Error("Configure a machine recipient on this network first");
    const url =
      data.cluster === "devnet"
        ? "https://api.devnet.solana.com"
        : "https://api.mainnet-beta.solana.com";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          data.signature,
          { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("Solana receipt lookup unavailable");
    const text = await res.text();
    if (text.length > 500000) throw new Error("Transaction too large");
    const response = JSON.parse(text);
    if (!response.result) throw new Error("No confirmed transaction on selected network");
    const receipt = verifySolDeposit(response.result, m.id, config.recipient);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: record, error } = await db.rpc("record_machine_funding", {
      p_machine: m.id,
      p_owner: context.userId,
      p_cluster: data.cluster,
      p_signature: data.signature,
      p_amount: receipt.amountLamports,
      p_sender: receipt.sender,
      p_recipient: receipt.recipient,
      p_slot: receipt.slot,
      p_provenance: {
        memo: receipt.memo,
        commitment: "confirmed",
        verifiedAt: new Date().toISOString(),
        purpose: "self-hosted deposit, not hosted credits or liquidity",
      },
    });
    if (error) throw error;
    return record;
  });
