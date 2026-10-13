import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import bs58 from "bs58";
import { Wallet } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getProvider } from "@/lib/cluster";
import { getWalletChallenge, verifyWalletSignature } from "@/lib/wallet-auth.functions";
import { LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in with Solana — devlab MACHINES" },
      { name: "description", content: "Sign in to devlab MACHINES by signing a free message with your Solana wallet." },
      { property: "og:title", content: "Sign in with Solana — devlab MACHINES" },
      { property: "og:description", content: "Wallet-based sign-in for the devlab MACHINES coding machine workbench." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const challenge = useServerFn(getWalletChallenge);
  const verify = useServerFn(verifyWalletSignature);
  const [busy, setBusy] = useState(false);
  const [noWallet, setNoWallet] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/profile", replace: true });
  }, [user, navigate]);

  async function signIn() {
    const p = getProvider();
    if (!p?.signMessage) { setNoWallet(true); return; }
    setBusy(true);
    try {
      const { publicKey } = await p.connect();
      const wallet = publicKey.toString();
      const { nonce, message } = await challenge({ data: { wallet } });
      const res = await p.signMessage(new TextEncoder().encode(message), "utf8");
      const sig = res instanceof Uint8Array ? res : res.signature;
      const { tokenHash } = await verify({ data: { wallet, nonce, signature: bs58.encode(sig) } });
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) throw error;
      toast.success("Signed in with your wallet");
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(/reject|cancel|denied/i.test(msg) ? "Signature request was cancelled." : msg || "Wallet sign-in failed");
    }
    setBusy(false);
  }

  return (
    <div className="grid-bg flex min-h-[80vh] items-center justify-center px-5 py-16">
      <div className="panel w-full max-w-sm p-8">
        <LogoMark size={28} />
        <h1 className="mt-6 text-3xl">Sign in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Connect your Solana wallet and sign a short message. It's free and sends no transaction. New wallets get an account automatically.
        </p>
        <Button className="mt-6 w-full" onClick={signIn} disabled={busy}>
          <Wallet /> {busy ? "Waiting for wallet…" : "Sign in with Solana wallet"}
        </Button>
        {noWallet && (
          <p className="mt-4 text-sm text-muted-foreground">
            No Solana wallet with message signing found. Install{" "}
            <a className="underline" href="https://phantom.app" target="_blank" rel="noreferrer">Phantom</a> or a compatible wallet, then reload.
          </p>
        )}
      </div>
    </div>
  );
}
