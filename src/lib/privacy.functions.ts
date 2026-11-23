import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addr = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const sig = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/);
const cluster = z.enum(["devnet", "mainnet-beta"]);
/** base58 of a serialized ShieldedAddress (signing key + nullifier key + viewing key). */
const shielded = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{60,200}$/, "Not a private receiving address");
const PRIVACY_PROGRAM = "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW";

/** Unsigned legacy SOL transfer from the user's wallet to their private-balance key. The wallet signs it. */
export const buildFundingTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster, from: addr, to: addr, lamports: z.number().int().positive().max(1_000 * 1e9) }).parse(d))
  .handler(async ({ data }) => {
    const [{ getConnection }, { PublicKey, SystemProgram, Transaction }] = await Promise.all([import("./dbc.server"), import("@solana/web3.js")]);
    const conn = getConnection(data.cluster);
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: new PublicKey(data.from), blockhash, lastValidBlockHeight })
      .add(SystemProgram.transfer({ fromPubkey: new PublicKey(data.from), toPubkey: new PublicKey(data.to), lamports: data.lamports }));
    return { transactionBase64: tx.serialize({ requireAllSignatures: false }).toString("base64"), blockhash, lastValidBlockHeight };
  });

/** Public: a live project's published private receiving address and its count of recorded private contributions. */
export const getPrivateSupport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("projects").select("status,hidden,private_support_address").eq("id", data.projectId).maybeSingle();
    if (!p || !["live", "migrated"].includes(p.status)) return { address: null, count: 0 };
    const { count } = await supabaseAdmin.from("private_support_receipts").select("id", { count: "exact", head: true }).eq("project_id", data.projectId);
    return { address: p.private_support_address, count: count ?? 0 };
  });

/** Owner-only: publish (or clear) the project's private receiving address. */
export const setPrivateSupportAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), address: shielded.nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("projects").select("id,owner_id,status").eq("id", data.projectId).maybeSingle();
    if (!p || p.owner_id !== context.userId) throw new Error("Only the project owner can change this.");
    if (!["live", "migrated"].includes(p.status)) throw new Error("Launch the token before enabling private support.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").update({ private_support_address: data.address }).eq("id", data.projectId);
    if (error) throw new Error("Could not save the private receiving address.");
    return { ok: true };
  });

/**
 * Public: record that a confirmed, successful Privacy Rings transaction was sent as support.
 * The amount and recipient are encrypted, so the server can only verify that the transaction is a real,
 * recent, successful privacy-program transaction; it is counted once per signature.
 */
export const recordPrivateSupport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), cluster, signature: sig }).parse(d))
  .handler(async ({ data }) => {
    const [{ rpcUrl }, { supabaseAdmin }] = await Promise.all([import("./dbc.server"), import("@/integrations/supabase/client.server")]);
    const { data: p } = await supabaseAdmin.from("projects").select("cluster,status,private_support_address").eq("id", data.projectId).maybeSingle();
    if (!p || p.cluster !== data.cluster || !p.private_support_address) return { ok: false as const, message: "This project doesn't accept private support." };
    const res = await fetch(rpcUrl(data.cluster), {
      method: "POST", headers: { "content-type": "application/json" }, redirect: "manual", signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [data.signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 1 }] }),
    }).catch(() => null);
    if (!res || !res.ok) return { ok: false as const, message: "Couldn't read the transaction from the network. Try again shortly." };
    const body = (await res.json().catch(() => null)) as { result?: { meta?: { err: unknown }; blockTime?: number | null; transaction?: { message?: { accountKeys?: string[] } } } | null } | null;
    const tx = body?.result;
    if (!tx) return { ok: false as const, message: "Transaction not found yet. Try again in a few seconds." };
    if (tx.meta?.err) return { ok: false as const, message: "That transaction failed on-chain." };
    if (!tx.blockTime || Date.now() / 1000 - tx.blockTime > 86_400) return { ok: false as const, message: "Only transactions from the last 24 hours can be recorded." };
    if (!JSON.stringify(tx.transaction ?? {}).includes(PRIVACY_PROGRAM)) return { ok: false as const, message: "Not a Helius Privacy Rings transaction." };
    const { error } = await supabaseAdmin.from("private_support_receipts").insert({ project_id: data.projectId, cluster: data.cluster, signature: data.signature });
    if (error && !/duplicate/i.test(error.message)) return { ok: false as const, message: "Could not record the contribution." };
    return { ok: true as const };
  });
