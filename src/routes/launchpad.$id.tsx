import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SignInPrompt, StatusPill } from "@/components/site";
import { useAuth } from "@/lib/auth";
import { useCluster, shortAddr } from "@/lib/cluster";
import {
  buildClaimFeesTransaction, buildLaunchTransaction, buildMigrationTransaction, buildSwapTransaction,
  getPoolState, getSwapQuote, previewCurve, recordChainTransaction, recordLaunch, submitSignedTransaction, syncMigrationStatus,
} from "@/lib/dbc.functions";

export const Route = createFileRoute("/launchpad/$id")({
  head: () => ({
    meta: [
      { title: "Project token — devlab MACHINES" },
      { name: "description", content: "Optional machine token on a Meteora bonding curve: live price, buy, sell, creator fees and migration." },
      { property: "og:title", content: "Project token — devlab MACHINES" },
      { property: "og:description", content: "Live Meteora bonding-curve market for a devlab MACHINES token." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TokenPage,
});

type Prep = { transactionBase64: string; blockhash: string; lastValidBlockHeight: number; simulation: { ok: boolean; error: string | null; logs: string[] } };

function useSignAndSend() {
  const { cluster } = useCluster();
  const submit = useServerFn(submitSignedTransaction);
  return async (prep: Prep, localSigners: import("@solana/web3.js").Keypair[] = []) => {
    if (!prep.simulation.ok) throw new Error(`Simulation failed: ${prep.simulation.error ?? "unknown"}. ${prep.simulation.logs.slice(-2).join(" ")}`);
    const { signWithWallet } = await import("@/lib/solana-client");
    const signed = await signWithWallet(prep.transactionBase64, localSigners);
    const r = await submit({ data: { cluster, transactionBase64: signed, blockhash: prep.blockhash, lastValidBlockHeight: prep.lastValidBlockHeight } });
    if (!r.ok) throw new Error(r.message);
    return r.signature;
  };
}

function TokenPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { cluster } = useCluster();
  const project = useQuery({
    queryKey: ["project", "cluster", cluster, id, user?.id ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const p = project.data;
  if (project.isLoading) return <PageHeader eyebrow="launchpad" title="Loading…" />;
  if (!p) return (
    <><PageHeader eyebrow="launchpad" title="Project not found" />
      <div className="mx-auto max-w-3xl px-5 py-14"><EmptyState title="This project is private or doesn't exist" action={<Link to="/launchpad"><Button variant="outline">Back to launchpad</Button></Link>}>Drafts are only visible to their owner. {!user && "Sign in if this is your draft."}</EmptyState></div></>
  );
  const isOwner = user?.id === p.owner_id;
  const wrongCluster = p.cluster !== cluster;
  return (
    <>
      <TokenScreen p={p} wrongCluster={wrongCluster} isOwner={isOwner} />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {p.image_url && <img src={p.image_url} alt={`${p.title} project mark`} className="aspect-square w-full max-w-sm border border-border object-cover" />}
          {wrongCluster && <p role="alert" className="panel p-4 text-sm">This project lives on <b>{p.cluster}</b>. Switch the network in the header to interact.</p>}
          {p.mint_address && !wrongCluster && <PoolPanel mint={p.mint_address} isCreatorWallet={p.creator_wallet} dbStatus={p.status} migrationSig={p.migration_signature} migratedAt={p.migrated_at} />}
          <section className="panel p-6">
            <h2 className="eyebrow">Token description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.thesis}</p>
            <h2 className="eyebrow mt-6">Evidence</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(p.evidence as { label: string; url: string }[]).map((e, k) => (
                <li key={k}><a className="underline" href={e.url} target="_blank" rel="noreferrer noopener">{e.label}</a></li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">Curve liquidity is not spendable compute budget. Fees claimed by the creator and curve reserves are shown separately.</p>
            {(p.website_url || p.x_url) && <div className="mt-6 flex gap-4 text-sm">{p.website_url && <a className="underline" href={p.website_url} target="_blank" rel="noreferrer noopener">Website</a>}{p.x_url && <a className="underline" href={p.x_url} target="_blank" rel="noreferrer noopener">X</a>}</div>}
          </section>
        </div>
        <aside className="space-y-6">
          {p.status === "draft" && (isOwner ? (wrongCluster ? null : <DeployPanel project={p} onDone={() => project.refetch()} />) : <SignInPrompt what="deploy this draft" />)}
          {p.mint_address && !wrongCluster && p.status !== "migrated" && <TradePanel mint={p.mint_address} symbol={p.symbol} />}
          {p.status === "migrated" && <section className="panel p-5 text-sm">Bonding-curve trading closed after migration. <a className="underline" target="_blank" rel="noreferrer" href={`https://www.meteora.ag/pools?search=${p.mint_address}`}>Trade on Meteora</a></section>}
          {p.mint_address && (
            <dl className="panel space-y-2 p-5 text-xs">
              {([["Mint", p.mint_address], ["Pool", p.pool_address], ["Config", p.config_address], ["Creator", p.creator_wallet]] as const).map(([k, v]) => v && (
                <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono"><ExplorerLink a={v} cluster={p.cluster} /></dd></div>
              ))}
            </dl>
          )}
        </aside>
      </div>
    </>
  );
}

function ExplorerLink({ a, cluster }: { a: string; cluster: string }) {
  return <a className="underline" target="_blank" rel="noreferrer" href={`https://explorer.solana.com/address/${a}${cluster === "devnet" ? "?cluster=devnet" : ""}`}>{shortAddr(a)}</a>;
}

function DeployPanel({ project, onDone }: { project: { id: string; token_supply: number | null; cluster: string }; onDone: () => void }) {
  const { cluster, wallet, connectWallet } = useCluster();
  const preview = useServerFn(previewCurve);
  const build = useServerFn(buildLaunchTransaction);
  const record = useServerFn(recordLaunch);
  const send = useSignAndSend();
  const [initial, setInitial] = useState("30");
  const [grad, setGrad] = useState("85");
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [confirmMainnet, setConfirmMainnet] = useState(false);
  const supply = Number(project.token_supply ?? 1_000_000_000);

  async function doPreview() {
    const r = await preview({ data: { initialMarketCapSol: Number(initial), migrationMarketCapSol: Number(grad), totalSupply: supply } });
    if (!r.ok) { toast.error(r.message); return; }
    setSummary(r);
  }

  async function deploy() {
    try {
      if (!wallet) { const c = await connectWallet(); if (!c.ok) throw new Error(c.message); }
      if (cluster === "mainnet-beta" && !confirmMainnet) throw new Error("Confirm you understand this uses real SOL on mainnet.");
      const { Keypair } = await import("@/lib/solana-client");
      const mint = Keypair.generate();
      const config = Keypair.generate();
      setBusy("Building and simulating…");
      const r = await build({ data: { cluster, projectId: project.id, baseMint: mint.publicKey.toBase58(), configAddress: config.publicKey.toBase58(), initialMarketCapSol: Number(initial), migrationMarketCapSol: Number(grad), origin: window.location.origin } });
      if (!r.ok) throw new Error(r.message);
      setBusy("Approve in your wallet…");
      const sig = await send(r, [mint, config]);
      setBusy("Verifying on-chain…");
      const v = await record({ data: { cluster, projectId: project.id, signature: sig } });
      if (!v.ok) throw new Error(`Confirmed (${sig.slice(0, 8)}…) but verification failed: ${v.message}. Reload to retry verification.`);
      toast.success("Token launched and verified on-chain");
      onDone();
    } catch (e) {
      const { signingError } = await import("@/lib/solana-client");
      toast.error(signingError(e));
    } finally { setBusy(null); }
  }

  return (
    <section className="panel space-y-4 p-5">
      <h2 className="text-xl">Deploy token</h2>
      <p className="text-xs text-muted-foreground">Creates a Meteora bonding-curve config and pool in one transaction, signed by your wallet. SOL-quoted, 6-decimal immutable token, flat 1% fee — all fees claimable by you, no app fee. At graduation, 100% of LP is permanently locked to you on DAMM v2.</p>
      <label className="block text-sm">Starting market cap (SOL)<input className="field mt-1" inputMode="decimal" value={initial} onChange={(e) => setInitial(e.target.value)} /></label>
      <label className="block text-sm">Graduation market cap (SOL)<input className="field mt-1" inputMode="decimal" value={grad} onChange={(e) => setGrad(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">Supply {supply.toLocaleString()} · network {cluster}</p>
      <Button variant="outline" className="w-full" onClick={doPreview}>Preview curve (SDK)</Button>
      {summary && (
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between"><dt>SOL needed to graduate</dt><dd className="font-mono">{String(summary["migrationQuoteThresholdSol"])}</dd></div>
          <div className="flex justify-between"><dt>Trading fee</dt><dd>1% (100 bps)</dd></div>
          <div className="flex justify-between"><dt>Your fee share</dt><dd>100% after protocol cut</dd></div>
          <div className="flex justify-between"><dt>Locked LP to creator</dt><dd>{String(summary["creatorLockedLpPercentage"])}%</dd></div>
          <div className="flex justify-between"><dt>Migration</dt><dd>DAMM v2</dd></div>
        </dl>
      )}
      {cluster === "mainnet-beta" && <label className="flex gap-2 text-xs"><input type="checkbox" checked={confirmMainnet} onChange={(e) => setConfirmMainnet(e.target.checked)} />I understand this spends real SOL and is irreversible.</label>}
      <Button className="w-full" disabled={!!busy || !summary} onClick={deploy}>{busy ?? (summary ? "Sign & deploy" : "Preview first")}</Button>
    </section>
  );
}

function PoolPanel({ mint, isCreatorWallet, dbStatus, migrationSig, migratedAt }: { mint: string; isCreatorWallet: string | null; dbStatus: string; migrationSig: string | null; migratedAt: string | null }) {
  const { cluster, wallet, connectWallet } = useCluster();
  const qc = useQueryClient();
  const state = useServerFn(getPoolState);
  const claim = useServerFn(buildClaimFeesTransaction);
  const migrate = useServerFn(buildMigrationTransaction);
  const recordTx = useServerFn(recordChainTransaction);
  const sync = useServerFn(syncMigrationStatus);
  const send = useSignAndSend();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["pool", "cluster", cluster, mint], queryFn: () => state({ data: { cluster, mint } }), refetchInterval: 15000 });
  const d = q.data;
  const chainMigrated = !!(d && d.ok && d.migrated);
  useEffect(() => {
    if (chainMigrated && dbStatus === "live") {
      sync({ data: { cluster, mint } }).then(() => qc.invalidateQueries({ queryKey: ["project"] }));
    }
  }, [chainMigrated, dbStatus, cluster, mint]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <section className="panel p-6 text-sm text-muted-foreground">Reading pool from chain…</section>;
  if (!d.ok) return <section className="panel p-6 text-sm">Pool unavailable: {d.message}</section>;

  async function run(kind: "claim" | "migrate") {
    try {
      if (!wallet) { const c = await connectWallet(); if (!c.ok) throw new Error(c.message); toast("Wallet connected — press again."); return; }
      const owner = wallet;
      setBusy("Building…");
      const r = kind === "claim" ? await claim({ data: { cluster, mint, owner } }) : await migrate({ data: { cluster, mint, payer: owner } });
      if (!r.ok) throw new Error(r.message);
      setBusy("Approve in wallet…");
      const sig = await send(r);
      await recordTx({ data: { cluster, mint, signature: sig, kind } });
      toast.success(kind === "claim" ? "Fees claimed" : "Migrated to DAMM v2");
      q.refetch();
    } catch (e) {
      const { signingError } = await import("@/lib/solana-client");
      toast.error(signingError(e));
    } finally { setBusy(null); }
  }

  const isCreator = wallet && wallet === d.creator;
  const unclaimed = Number(d.creatorFeeSol) + Number(d.partnerFeeSol);
  return (
    <section className="panel p-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <Stat k="Price (SOL / token)" v={Number(d.priceSolPerToken).toPrecision(6)} />
        <Stat k="Curve reserve (SOL)" v={d.quoteReserveSol} />
        <Stat k="Graduates at (SOL)" v={d.migrationThresholdSol} />
      </div>
      <div className="mt-6">
        <div className="flex justify-between text-xs"><span>Curve progress</span><span className="font-mono">{(d.progressBps / 100).toFixed(2)}%</span></div>
        <div className="mt-2 h-1 bg-border"><div className="h-1 bg-foreground" style={{ width: `${d.progressBps / 100}%` }} /></div>
      </div>
      <div className="mt-6 border-t border-border pt-4" aria-live="polite">
        <h3 className="eyebrow">Migration status (read from chain)</h3>
        <ol className="mt-3 grid grid-cols-3 gap-1 text-[11px]">
          {[
            { label: "Bonding curve", on: true },
            { label: "Threshold reached", on: d.curveComplete || d.migrated },
            { label: "Migrated to DAMM v2", on: d.migrated },
          ].map((s, i) => (
            <li key={s.label} className={`border-t-2 pt-1 ${s.on ? "border-foreground" : "border-border text-muted-foreground"}`}>{i + 1}. {s.label}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          {d.migrated
            ? "Liquidity moved to a permanent Meteora DAMM v2 pool. Bonding-curve trading is closed; trade on Meteora."
            : d.curveComplete
              ? "The curve hit its threshold. Migration is a separate on-chain transaction anyone can send (Meteora's cranker may also send it). Until it confirms, the token is not migrated."
              : `${d.quoteReserveSol} of ${d.migrationThresholdSol} SOL raised. Reaching the threshold alone does not migrate.`}
        </p>
        {migrationSig && <p className="mt-1 text-xs">Migration tx: <a className="font-mono underline" target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${migrationSig}${cluster === "devnet" ? "?cluster=devnet" : ""}`}>{shortAddr(migrationSig)}</a>{migratedAt && ` · ${new Date(migratedAt).toLocaleString()}`}</p>}
        {d.curveComplete && !d.migrated && <Button className="mt-3" variant="outline" disabled={!!busy} onClick={() => run("migrate")}>{busy ?? (wallet ? "Send migration transaction" : "Connect wallet to migrate")}</Button>}
        {d.curveComplete && !d.migrated && <p className="mt-2 text-xs text-muted-foreground">You pay the network fee. Your share of the new pool's liquidity stays permanently locked to the creator.</p>}
        {d.migrated && <a className="mt-3 inline-block text-sm underline" target="_blank" rel="noreferrer" href={`https://www.meteora.ag/pools?search=${mint}`}>Trade on Meteora</a>}
      </div>
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="eyebrow">Creator fees (unclaimed, on-chain)</h3>
        <p className="mt-2 font-mono text-lg">{unclaimed.toFixed(9).replace(/0+$/, "").replace(/\.$/, "")} SOL</p>
        {isCreator ? (
          <Button className="mt-3" disabled={!!busy || unclaimed <= 0} onClick={() => run("claim")}>{busy ?? "Claim creator fees"}</Button>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{isCreatorWallet ? `Only the creator wallet ${shortAddr(isCreatorWallet)} can claim.` : ""} {!wallet && "Connect the creator wallet to claim."}</p>
        )}
      </div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div><p className="eyebrow">{k}</p><p className="mt-1 font-mono text-lg">{v}</p></div>;
}

function TradePanel({ mint, symbol }: { mint: string; symbol: string }) {
  const { cluster, wallet, connectWallet } = useCluster();
  const qc = useQueryClient();
  const quoteFn = useServerFn(getSwapQuote);
  const buildFn = useServerFn(buildSwapTransaction);
  const recordTx = useServerFn(recordChainTransaction);
  const submit = useServerFn(submitSignedTransaction);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slip, setSlip] = useState("1");
  const [quote, setQuote] = useState<{ amountOut: string; minimumAmountOut: string; tradingFeeSol: string; expiresAt: number } | null>(null);
  type Phase =
    | { k: "idle" }
    | { k: "simulating" }
    | { k: "review"; prep: Prep & { ok: true } }
    | { k: "signing" }
    | { k: "confirming"; sig?: string }
    | { k: "done"; sig: string; url: string }
    | { k: "error"; message: string };
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [quoting, setQuoting] = useState(false);
  const slippageBps = Math.round(Number(slip) * 100);
  const reset = () => { setQuote(null); setPhase({ k: "idle" }); };

  async function getQuote() {
    reset(); setQuoting(true);
    try {
      const r = await quoteFn({ data: { cluster, mint, side, amount, slippageBps } });
      if (!r.ok) { toast.error(r.message); return; }
      setQuote(r);
    } finally { setQuoting(false); }
  }

  async function simulate() {
    try {
      if (!wallet) { const c = await connectWallet(); if (!c.ok) throw new Error(c.message); return; }
      setPhase({ k: "simulating" });
      const r = await buildFn({ data: { cluster, mint, side, amount, slippageBps, owner: wallet } });
      if (!r.ok) throw new Error(r.message);
      setPhase({ k: "review", prep: r as Prep & { ok: true } });
    } catch (e) {
      const { signingError } = await import("@/lib/solana-client");
      setPhase({ k: "error", message: signingError(e) });
    }
  }

  async function signAndSend(prep: Prep) {
    try {
      setPhase({ k: "signing" });
      const { signWithWallet, explorerTx } = await import("@/lib/solana-client");
      const signed = await signWithWallet(prep.transactionBase64, []);
      setPhase({ k: "confirming" });
      const r = await submit({ data: { cluster, transactionBase64: signed, blockhash: prep.blockhash, lastValidBlockHeight: prep.lastValidBlockHeight } });
      if (!r.ok) throw new Error(r.message);
      setPhase({ k: "confirming", sig: r.signature });
      await recordTx({ data: { cluster, mint, signature: r.signature, kind: side } });
      setPhase({ k: "done", sig: r.signature, url: explorerTx(r.signature, cluster) });
      toast.success(`${side === "buy" ? "Buy" : "Sell"} confirmed on-chain`);
      setQuote(null); setAmount("");
      qc.invalidateQueries({ queryKey: ["pool"] });
    } catch (e) {
      const { signingError } = await import("@/lib/solana-client");
      setPhase({ k: "error", message: signingError(e) });
    }
  }

  const expired = quote && Date.now() > quote.expiresAt;
  const busy = phase.k === "simulating" || phase.k === "signing" || phase.k === "confirming";
  const steps = ["Quote", "Simulate", "Sign", "Confirm"];
  const at = phase.k === "simulating" ? 1 : phase.k === "review" || phase.k === "signing" ? 2 : phase.k === "confirming" ? 3 : phase.k === "done" ? 4 : quote ? 1 : 0;
  return (
    <section className="panel space-y-4 p-5" aria-live="polite">
      <div className="grid grid-cols-2 gap-px bg-border">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} disabled={busy} onClick={() => { setSide(s); reset(); }} className={`py-2 text-sm ${side === s ? "bg-foreground text-background" : "bg-panel"}`}>{s}</button>
        ))}
      </div>
      <ol className="grid grid-cols-4 gap-1 text-[11px]">
        {steps.map((s, i) => (
          <li key={s} className={`border-t-2 pt-1 ${i < at ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>{i + 1}. {s}</li>
        ))}
      </ol>
      <label className="block text-sm">{side === "buy" ? "Pay (SOL)" : `Sell (${symbol})`}<input className="field mt-1 font-mono" inputMode="decimal" disabled={busy} value={amount} onChange={(e) => { setAmount(e.target.value.trim()); reset(); }} placeholder="0.0" /></label>
      <label className="block text-sm">Slippage (%)<input className="field mt-1" inputMode="decimal" disabled={busy} value={slip} onChange={(e) => { setSlip(e.target.value); reset(); }} /></label>
      <Button variant="outline" className="w-full" disabled={!/^\d+(\.\d+)?$/.test(amount) || busy || quoting} onClick={getQuote}>{quoting ? "Quoting…" : quote ? "Refresh quote" : "Get quote"}</Button>
      {quote && (
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between"><dt>Expected</dt><dd className="font-mono">{quote.amountOut} {side === "buy" ? symbol : "SOL"}</dd></div>
          <div className="flex justify-between"><dt>Minimum received</dt><dd className="font-mono">{quote.minimumAmountOut}</dd></div>
          <div className="flex justify-between"><dt>Trading fee</dt><dd className="font-mono">{quote.tradingFeeSol} SOL</dd></div>
          {expired && <p className="text-destructive">Quote expired — refresh it.</p>}
        </dl>
      )}

      {phase.k === "review" && (
        <div className="space-y-2 border border-border p-3 text-xs">
          <p className="font-medium">Simulation passed</p>
          <p className="text-muted-foreground">The server re-quoted the live curve and simulated this exact transaction. Your minimum output is enforced on-chain; the transaction fails rather than fill worse.</p>
          <details><summary className="cursor-pointer">Simulation logs</summary><pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px]">{phase.prep.simulation.logs.slice(-8).join("\n")}</pre></details>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => signAndSend(phase.prep)}>Sign {side} in wallet</Button>
            <Button variant="outline" onClick={() => setPhase({ k: "idle" })}>Cancel</Button>
          </div>
        </div>
      )}
      {phase.k === "signing" && <p className="text-xs">Approve the transaction in your wallet…</p>}
      {phase.k === "confirming" && <p className="text-xs">Waiting for on-chain confirmation{phase.sig ? ` (${shortAddr(phase.sig)})` : ""}…</p>}
      {phase.k === "done" && <p className="text-xs">Confirmed. <a className="underline" href={phase.url} target="_blank" rel="noreferrer">View transaction</a></p>}
      {phase.k === "error" && <p role="alert" className="text-xs text-destructive">{phase.message}</p>}

      {phase.k !== "review" && (
        <Button className="w-full" disabled={!quote || !!expired || busy} onClick={simulate}>
          {phase.k === "simulating" ? "Re-quoting & simulating…" : wallet ? `Review ${side}` : "Connect wallet"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">You sign every transaction. Nothing is sent until you approve it in your wallet.</p>
    </section>
  );
}
