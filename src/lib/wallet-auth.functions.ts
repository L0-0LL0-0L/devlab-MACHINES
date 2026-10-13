import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const walletSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address");
const TTL_MS = 5 * 60 * 1000;

function walletEmail(wallet: string) {
  return `${wallet.toLowerCase()}@wallet.biocode.cfd`;
}

/** Step 1: issue a one-use, short-lived sign-in message bound to this domain and wallet. */
export const getWalletChallenge = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ wallet: walletSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const host = (getRequestHeader("host") ?? "devlab MACHINES").slice(0, 200);
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("wallet_auth_challenges")
      .select("id", { count: "exact", head: true })
      .eq("wallet", data.wallet)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Too many sign-in attempts. Wait a minute and try again.");
    const nonce = crypto.randomUUID();
    const expires = new Date(Date.now() + TTL_MS);
    const message = [
      `${host} wants you to sign in to devlab MACHINES with your Solana account:`,
      data.wallet,
      "",
      "Signing proves you own this wallet. It costs nothing and sends no transaction.",
      "",
      `Domain: ${host}`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date().toISOString()}`,
      `Expiration Time: ${expires.toISOString()}`,
    ].join("\n");
    const { error } = await supabaseAdmin
      .from("wallet_auth_challenges")
      .insert({ wallet: data.wallet, nonce, message, expires_at: expires.toISOString() });
    if (error) throw new Error("Could not start wallet sign-in.");
    return { nonce, message };
  });

/** Step 2: verify the ed25519 signature, consume the nonce, and return a one-time login token. */
export const verifyWalletSignature = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ wallet: walletSchema, nonce: z.string().uuid(), signature: z.string().min(40).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const [{ supabaseAdmin }, nacl, bs58] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("tweetnacl").then((m) => m.default ?? m),
      import("bs58").then((m) => m.default ?? m),
    ]);
    const { data: ch } = await supabaseAdmin
      .from("wallet_auth_challenges")
      .select("*")
      .eq("nonce", data.nonce)
      .eq("wallet", data.wallet)
      .maybeSingle();
    if (!ch || ch.used_at) throw new Error("Sign-in request not found or already used. Try again.");
    if (new Date(ch.expires_at).getTime() < Date.now()) throw new Error("Sign-in request expired. Try again.");

    // Consume first (one-use), atomically guarded on used_at being null.
    const { data: consumed } = await supabaseAdmin
      .from("wallet_auth_challenges")
      .update({ used_at: new Date().toISOString() })
      .eq("id", ch.id)
      .is("used_at", null)
      .select("id");
    if (!consumed?.length) throw new Error("Sign-in request already used. Try again.");

    let ok = false;
    try {
      ok = nacl.sign.detached.verify(
        new TextEncoder().encode(ch.message),
        bs58.decode(data.signature),
        bs58.decode(data.wallet),
      );
    } catch {
      ok = false;
    }
    if (!ok) throw new Error("Signature did not match this wallet.");

    const email = walletEmail(data.wallet);
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("wallet_address", data.wallet).maybeSingle();
    if (!prof) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: `${data.wallet.slice(0, 4)}…${data.wallet.slice(-4)}`, wallet: data.wallet },
      });
      if (error && !/already/i.test(error.message)) throw new Error("Could not create account.");
      if (created?.user) {
        await supabaseAdmin.from("profiles").upsert({ id: created.user.id, wallet_address: data.wallet });
      }
    }
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkErr || !link.properties?.hashed_token) throw new Error("Could not complete sign-in.");
    return { tokenHash: link.properties.hashed_token };
  });
