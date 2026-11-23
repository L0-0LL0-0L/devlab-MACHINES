import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRIVACY_PROGRAM = "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW";
const shielded = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{60,200}$/, "Not a private receiving address");
const sig = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/);

/** Creator-only: post a private bounty or a sealed review request on a live project. */
export const createBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    projectId: z.string().uuid(), kind: z.enum(["bounty", "review"]),
    title: z.string().trim().min(3).max(140), description: z.string().trim().min(10).max(4000),
    rewardSol: z.number().positive().max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("projects").select("owner_id,status").eq("id", data.projectId).maybeSingle();
    if (!p || p.owner_id !== context.userId) throw new Error("Only the project creator can post bounties.");
    if (!["live", "migrated"].includes(p.status)) throw new Error("Launch the token first.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("bounties").select("id", { count: "exact", head: true }).eq("project_id", data.projectId).eq("status", "open");
    if ((count ?? 0) >= 20) throw new Error("Close some open bounties first (limit 20).");
    const { error } = await supabaseAdmin.from("bounties").insert({ project_id: data.projectId, owner_id: context.userId, kind: data.kind, title: data.title, description: data.description, reward_sol: data.rewardSol });
    if (error) throw new Error("Could not save the bounty.");
    return { ok: true };
  });

export const closeBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bountyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase.from("bounties").select("owner_id").eq("id", data.bountyId).maybeSingle();
    if (!b || b.owner_id !== context.userId) throw new Error("Only the creator can close this.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bounties").update({ status: "closed" }).eq("id", data.bountyId);
    return { ok: true };
  });

/** Signed-in user submits work (bounty) or a sealed review, with a private receiving address for payment. */
export const submitToBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bountyId: z.string().uuid(), body: z.string().trim().min(20).max(8000), receiveAddress: shielded }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase.from("bounties").select("owner_id,status").eq("id", data.bountyId).maybeSingle();
    if (!b || b.status !== "open") throw new Error("This bounty isn't open.");
    if (b.owner_id === context.userId) throw new Error("You can't submit to your own bounty.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("bounty_submissions").insert({ bounty_id: data.bountyId, owner_id: context.userId, body: data.body, receive_address: data.receiveAddress });
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "You already submitted to this bounty." : "Could not save your submission.");
    return { ok: true };
  });

/**
 * Creator-only: read submissions. Submitter identity is never returned (sealed); only a per-bounty number,
 * the text, the private receiving address and the payment state.
 */
export const listSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bountyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase.from("bounties").select("owner_id").eq("id", data.bountyId).maybeSingle();
    if (!b || b.owner_id !== context.userId) throw new Error("Only the creator can view submissions.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("bounty_submissions").select("id,body,receive_address,status,paid_signature,created_at").eq("bounty_id", data.bountyId).order("created_at");
    return (rows ?? []).map((r, i) => ({ ...r, label: `Submission #${i + 1}` }));
  });

/** Creator-only: mark a submission paid after a confirmed, successful Privacy Rings transaction. */
export const markSubmissionPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ submissionId: z.string().uuid(), cluster: z.enum(["devnet", "mainnet-beta"]), signature: sig }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("bounty_submissions").select("id,bounty_id,status").eq("id", data.submissionId).maybeSingle();
    if (!s) throw new Error("Submission not found.");
    const { data: b } = await context.supabase.from("bounties").select("owner_id").eq("id", s.bounty_id).maybeSingle();
    if (!b || b.owner_id !== context.userId) throw new Error("Only the creator can pay this.");
    const { rpcUrl } = await import("./dbc.server");
    const res = await fetch(rpcUrl(data.cluster), {
      method: "POST", headers: { "content-type": "application/json" }, redirect: "manual", signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [data.signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 1 }] }),
    }).catch(() => null);
    const tx = res?.ok ? ((await res.json().catch(() => null)) as { result?: { meta?: { err: unknown }; transaction?: unknown } | null } | null)?.result : null;
    if (!tx) throw new Error("Payment transaction not found yet. Try again shortly.");
    if (tx.meta?.err) throw new Error("That payment failed on-chain.");
    if (!JSON.stringify(tx.transaction ?? {}).includes(PRIVACY_PROGRAM)) throw new Error("Not a Privacy Rings transaction.");
    const { error } = await supabaseAdmin.from("bounty_submissions").update({ status: "paid", paid_signature: data.signature }).eq("id", data.submissionId);
    if (error) throw new Error("Could not record the payment.");
    return { ok: true };
  });
