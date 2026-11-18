import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SignInPrompt } from "@/components/site";
import { useAuth } from "@/lib/auth";
import { useCluster, shortAddr } from "@/lib/cluster";
import {
  buildClaimFeesTransaction, getPoolState, getWalletSolBalance, recordChainTransaction, submitSignedTransaction,
} from "@/lib/dbc.functions";

export const Route = createFileRoute("/creator")({
  head: () => ({
    meta: [
      { title: "Creator dashboard — biocode" },
      { name: "description", content: "Check unclaimed creator trading fees on your launched biocode tokens and claim them to your wallet." },
      { property: "og:title", content: "Creator dashboard — biocode" },
      { property: "og:description", content: "On-chain creator fees and claims for biocode research token launches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorDashboard,
});

const trim = (v: string) => (v.includes(".") ? v.replace(/0+$/, "").replace(/\.$/, "") : v) || "0";

function CreatorDashboard() {
  const { user } = useAuth();
  const { cluster, wallet, connectWallet } = useCluster();
  const balanceFn = useServerFn(getWalletSolBalance);

  const projects = useQuery({
    queryKey: ["creator-projects", "cluster", cluster, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("id,title,symbol,status,mint_address,creator_wallet,launched_at")
        .eq("owner_id", user!.id).eq("cluster", cluster).in("status", ["live", "migrated"])
        .order("launched_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const balance = useQuery({
    queryKey: ["sol-balance", "cluster", cluster, wallet],
    enabled: !!wallet,
    queryFn: () => balanceFn({ data: { cluster, wallet: wallet! } }),
    refetchInterval: 20000,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader eyebrow="creator" title="creator dashboard">{`Unclaimed trading fees read live from each Meteora pool on ${cluster}. Claims are signed by your wallet and sent straight to it.`}</PageHeader>
      {!user ? <SignInPrompt what="see your launched tokens and claim fees" /> : (
        <div className="space-y-6">
          <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="eyebrow">Connected wallet</p>
              <p className="mt-1 font-mono text-sm">{wallet ? shortAddr(wallet) : "Not connected"}</p>
            </div>
            <div className="text-right">
              <p className="eyebrow">SOL balance (on-chain, confirmed)</p>
              <p className="mt-1 font-mono text-lg">
                {!wallet ? "—" : balance.data?.ok ? `${trim(balance.data.sol)} SOL` : balance.data ? `Unavailable: ${balance.data.message}` : "Reading…"}
              </p>
              {balance.data?.ok && <p className="text-[11px] text-muted-foreground">slot {balance.data.slot}</p>}
            </div>
            {!wallet && <Button onClick={() => connectWallet()}>Connect wallet</Button>}
          </section>

          {projects.isLoading ? <p className="text-sm text-muted-foreground">Loading your launches…</p>
            : projects.error ? <p role="alert" className="text-sm text-destructive">{(projects.error as Error).message}</p>
            : !projects.data?.length ? (
              <EmptyState title={`No launched tokens on ${cluster}`} action={<Button asChild><Link to="/launchpad">Go to launchpad</Link></Button>}>Once you deploy a project's pool from its page, its creator fees appear here.</EmptyState>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {projects.data.map((p) => p.mint_address && (
                  <FeeCard key={p.id} id={p.id} title={p.title} symbol={p.symbol} mint={p.mint_address} creatorWallet={p.creator_wallet} onClaimed={() => balance.refetch()} />
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function FeeCard({ id, title, symbol, mint, creatorWallet, onClaimed }: { id: string; title: string; symbol: string; mint: string; creatorWallet: string | null; onClaimed: () => void }) {
  const { cluster, wallet, connectWallet } = useCluster();
  const qc = useQueryClient();
  const stateFn = useServerFn(getPoolState);
  const claimFn = useServerFn(buildClaimFeesTransaction);
  const submit = useServerFn(submitSignedTransaction);
  const recordTx = useServerFn(recordChainTransaction);
  const [phase, setPhase] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string } | null>(null);
  const q = useQuery({ queryKey: ["pool", "cluster", cluster, mint], queryFn: () => stateFn({ data: { cluster, mint } }), refetchInterval: 15000 });
  const d = q.data;

  async function claim() {
    setDone(null);
    try {
      if (!wallet) { const c = await connectWallet(); if (!c.ok) throw new Error(c.message); return; }
      setPhase("Building & simulating…");
      const r = await claimFn({ data: { cluster, mint, owner: wallet } });
      if (!r.ok) throw new Error(r.message);
      if (!r.simulation.ok) throw new Error(`Simulation failed: ${r.simulation.error ?? "unknown"}`);
      setPhase("Approve in wallet…");
      const { signWithWallet, explorerTx } = await import("@/lib/solana-client");
      const signed = await signWithWallet(r.transactionBase64, []);
      setPhase("Confirming on-chain…");
      const s = await submit({ data: { cluster, transactionBase64: signed, blockhash: r.blockhash, lastValidBlockHeight: r.lastValidBlockHeight } });
      if (!s.ok) throw new Error(s.message);
      await recordTx({ data: { cluster, mint, signature: s.signature, kind: "claim" } });
      setDone({ url: explorerTx(s.signature, cluster) });
      toast.success("Fees claimed to your wallet");
      await q.refetch(); onClaimed();
      qc.invalidateQueries({ queryKey: ["pool"] });
    } catch (e) {
      const { signingError } = await import("@/lib/solana-client");
      toast.error(signingError(e));
    } finally { setPhase(null); }
  }

  const unclaimed = d?.ok ? Number(d.creatorFeeSol) + (d.feeClaimer === d.creator ? Number(d.partnerFeeSol) : 0) : 0;
  const isCreator = d?.ok && wallet === d.creator;
  return (
    <section className="panel space-y-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link to="/launchpad/$id" params={{ id }} className="text-lg underline-offset-4 hover:underline">{title}</Link>
          <p className="font-mono text-xs text-muted-foreground">${symbol} · {shortAddr(mint)}</p>
        </div>
        {d?.ok && <span className="text-xs text-muted-foreground">{d.migrated ? "migrated" : `${(d.progressBps / 100).toFixed(1)}% to graduation`}</span>}
      </div>
      {!d ? <p className="text-sm text-muted-foreground">Reading pool from chain…</p>
        : !d.ok ? <p className="text-sm">Pool unavailable: {d.message}</p>
        : (
          <>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between"><dt>Creator fees (unclaimed)</dt><dd className="font-mono">{trim(d.creatorFeeSol)} SOL</dd></div>
              {d.feeClaimer === d.creator && <div className="flex justify-between"><dt>Fee-claimer share (unclaimed)</dt><dd className="font-mono">{trim(d.partnerFeeSol)} SOL</dd></div>}
              <div className="flex justify-between"><dt>Curve reserve (not spendable)</dt><dd className="font-mono">{trim(d.quoteReserveSol)} SOL</dd></div>
              <div className="flex justify-between"><dt>Fee wallet</dt><dd className="font-mono">{shortAddr(d.feeClaimer)}</dd></div>
            </dl>
            <Button className="w-full" disabled={!!phase || (!!wallet && (!isCreator || unclaimed <= 0))} onClick={claim}>
              {phase ?? (!wallet ? "Connect wallet" : !isCreator ? "Connect the creator wallet to claim" : unclaimed <= 0 ? "Nothing to claim" : `Claim ${trim(unclaimed.toFixed(9))} SOL`)}
            </Button>
            {wallet && !isCreator && <p className="text-xs text-muted-foreground">Only {shortAddr(creatorWallet ?? d.creator)} can claim these fees.</p>}
            {done && <p className="text-xs">Claimed. <a className="underline" href={done.url} target="_blank" rel="noreferrer">View transaction</a></p>}
          </>
        )}
    </section>
  );
}
