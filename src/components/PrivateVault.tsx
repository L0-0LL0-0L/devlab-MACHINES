import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCluster, shortAddr } from "@/lib/cluster";
import { submitSignedTransaction } from "@/lib/dbc.functions";
import { buildFundingTransaction, getPrivateSupport, recordPrivateSupport, setPrivateSupportAddress } from "@/lib/privacy.functions";
import type { PrivateSession } from "@/lib/privacy";

/* ---------- in-memory session store (never persisted) ---------- */
let current: PrivateSession | null = null;
const listeners = new Set<() => void>();
function setSession(s: PrivateSession | null) {
  const prev = current;
  current = s;
  if (prev && prev !== s) void import("@/lib/privacy").then((m) => m.closePrivateSession(prev));
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export function usePrivateSession() {
  const { cluster, wallet } = useCluster();
  const s = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    if (current && (current.wallet !== wallet || current.cluster !== cluster)) setSession(null);
  }, [wallet, cluster]);
  const valid = s && s.wallet === wallet && s.cluster === cluster ? s : null;
  async function unlock() {
    if (!wallet) throw new Error("Connect your wallet first.");
    const m = await import("@/lib/privacy");
    const next = await m.openPrivateSession(cluster, wallet);
    setSession(next);
    return next;
  }
  return { session: valid, unlock, lock: () => setSession(null) };
}

export async function errText(e: unknown) {
  const { signingError } = await import("@/lib/solana-client");
  const m = signingError(e);
  return m.length > 220 ? `${m.slice(0, 220)}…` : m;
}

function useBalances(s: PrivateSession | null) {
  return useQuery({
    queryKey: ["private-balance", "cluster", s?.cluster, s?.feeAddress],
    enabled: !!s,
    queryFn: async () => {
      const m = await import("@/lib/privacy");
      const b = await m.readBalances(s!);
      return { privateSol: m.fromLamports(b.privateLamports), privateLamports: b.privateLamports.toString(), feeSol: m.fromLamports(b.feeLamports), feeLamports: b.feeLamports.toString() };
    },
    refetchInterval: 30_000,
  });
}

/** Moves public SOL from the connected wallet into the private balance: one wallet-signed top-up, then a locally signed deposit. */
function useDeposit() {
  const { cluster, wallet } = useCluster();
  const fund = useServerFn(buildFundingTransaction);
  const submit = useServerFn(submitSignedTransaction);
  return async (s: PrivateSession, lamports: bigint, setPhase: (p: string) => void) => {
    const m = await import("@/lib/privacy");
    const feeNow = (await m.readBalances(s)).feeLamports;
    const need = lamports + m.FEE_RESERVE_LAMPORTS - feeNow;
    if (need > 0n) {
      setPhase("Approve the top-up in your wallet…");
      const prep = await fund({ data: { cluster, from: wallet!, to: s.feeAddress, lamports: Number(need) } });
      const { signWithWallet } = await import("@/lib/solana-client");
      const signed = await signWithWallet(prep.transactionBase64);
      setPhase("Confirming top-up…");
      const r = await submit({ data: { cluster, transactionBase64: signed, blockhash: prep.blockhash, lastValidBlockHeight: prep.lastValidBlockHeight } });
      if (!r.ok) throw new Error(r.message);
    }
    setPhase("Encrypting into your private balance…");
    return m.depositFromFeeAddress(s, lamports);
  };
}

function Unlock({ what }: { what: string }) {
  const { wallet, connectWallet } = useCluster();
  const { unlock } = usePrivateSession();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Sign a free message to open your private balance and {what}. Nothing is stored: the same wallet re-opens the same balance on any device.
      </p>
      <Button className="w-full" disabled={busy} onClick={async () => {
        setBusy(true);
        try { if (!wallet) { const c = await connectWallet(); if (!c.ok) throw new Error(c.message); } else await unlock(); }
        catch (e) { toast.error(await errText(e)); }
        setBusy(false);
      }}>
        <Lock /> {busy ? "Waiting for wallet…" : wallet ? "Open private balance" : "Connect wallet"}
      </Button>
    </div>
  );
}

/* ---------- Creator page: private balance ---------- */
export function PrivateBalancePanel() {
  const { cluster, wallet } = useCluster();
  const { session, lock } = usePrivateSession();
  const bal = useBalances(session);
  const deposit = useDeposit();
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  async function run(kind: "deposit" | "withdraw" | "sweep") {
    if (!session || !wallet) return;
    setLast(null);
    try {
      const m = await import("@/lib/privacy");
      let sig: string;
      if (kind === "sweep") {
        const fee = BigInt(bal.data?.feeLamports ?? "0") - 5000n;
        if (fee <= 0n) throw new Error("Nothing to return.");
        setPhase("Returning leftover SOL…");
        sig = await m.sweepFeeAddress(session, wallet, fee);
      } else {
        const l = m.toLamports(amount);
        if (kind === "deposit") sig = await deposit(session, l, setPhase);
        else {
          if (l > BigInt(bal.data?.privateLamports ?? "0")) throw new Error("That's more than your private balance.");
          setPhase("Generating proof and withdrawing…");
          sig = await m.withdrawTo(session, wallet, l);
        }
      }
      const { explorerTx } = await import("@/lib/solana-client");
      setLast(explorerTx(sig, cluster));
      toast.success(kind === "deposit" ? "Moved into your private balance" : kind === "withdraw" ? "Withdrawn to your wallet" : "Returned to your wallet");
      setAmount("");
      await bal.refetch();
    } catch (e) { toast.error(await errText(e)); }
    setPhase(null);
  }

  return (
    <section className="panel space-y-4 p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> private balance · Helius Privacy Rings</p>
          <p className="mt-1 text-sm text-muted-foreground">Move claimed fees or support into an encrypted balance. Amounts are hidden on-chain; you can withdraw any time.</p>
        </div>
        {session && <Button size="sm" variant="ghost" onClick={lock}>Lock</Button>}
      </div>
      {!session ? <Unlock what="manage private funds" /> : (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="panel p-3"><dt className="eyebrow">Private SOL (only you can see)</dt><dd className="mt-1 font-mono text-lg">{bal.data ? `${bal.data.privateSol} SOL` : bal.error ? "Unavailable" : "Decrypting…"}</dd></div>
            <div className="panel p-3"><dt className="eyebrow">Fee reserve (public)</dt><dd className="mt-1 font-mono text-lg">{bal.data ? `${bal.data.feeSol} SOL` : "—"}
              <p className="mt-1 text-[11px] text-muted-foreground">Pays network fees from {shortAddr(session.feeAddress)}</p></dd></div>
          </dl>
          {bal.error && <p role="alert" className="text-xs text-destructive">{(bal.error as Error).message}</p>}
          <div className="flex flex-wrap gap-2">
            <Input aria-label="Amount in SOL" inputMode="decimal" placeholder="Amount in SOL" value={amount} onChange={(e) => setAmount(e.target.value)} className="max-w-40 font-mono" />
            <Button disabled={!!phase || !amount} onClick={() => run("deposit")}>Move in</Button>
            <Button variant="outline" disabled={!!phase || !amount} onClick={() => run("withdraw")}>Withdraw to wallet</Button>
            <Button variant="ghost" disabled={!!phase || !bal.data || BigInt(bal.data.feeLamports) <= 5000n} onClick={() => run("sweep")}>Return fee reserve</Button>
          </div>
          {phase && <p className="font-mono text-xs">{phase}</p>}
          {last && <p className="text-xs">Done. <a className="underline" href={last} target="_blank" rel="noreferrer">View transaction</a> — the explorer shows it happened, not the amount.</p>}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">What's private and what isn't</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Hidden: the amount and token of private transfers and of your balance.</li>
              <li>Public: moving SOL in or out (the wallet, amount and fee-reserve address show on-chain), and which addresses take part in a private transfer.</li>
              <li>Claiming creator fees is always public; only what happens after you move them in is private.</li>
              <li>Uses Helius's early (alpha) privacy toolkit. Proofs are made in Helius's verified secure enclave; Helius never holds your funds.</li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

/* ---------- Creator page: publish private receiving address per token ---------- */
export function PrivateSupportToggle({ projectId }: { projectId: string }) {
  const { session } = usePrivateSession();
  const qc = useQueryClient();
  const info = useServerFn(getPrivateSupport);
  const save = useServerFn(setPrivateSupportAddress);
  const q = useQuery({ queryKey: ["private-support", projectId], queryFn: () => info({ data: { projectId } }) });
  const [busy, setBusy] = useState(false);
  const published = q.data?.address;
  const mine = session && published === session.shieldedAddress;
  async function set(address: string | null) {
    setBusy(true);
    try { await save({ data: { projectId, address } }); await qc.invalidateQueries({ queryKey: ["private-support", projectId] }); toast.success(address ? "Private support is on" : "Private support is off"); }
    catch (e) { toast.error(await errText(e)); }
    setBusy(false);
  }
  return (
    <div className="space-y-2 border-t border-border pt-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">Private support</span>
        <span className="font-mono">{q.data ? (published ? `on · ${q.data.count} recorded` : "off") : "…"}</span>
      </div>
      {!session ? <p className="text-muted-foreground">Open your private balance above to turn on private support for this token.</p>
        : published && !mine ? <p className="text-muted-foreground">Published address belongs to a different wallet. <button className="underline" disabled={busy} onClick={() => set(session.shieldedAddress)}>Replace with this wallet's</button></p>
        : <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => set(mine ? null : session.shieldedAddress)}>{mine ? "Turn off private support" : "Accept private support"}</Button>}
    </div>
  );
}

/* ---------- Token page: support the creator privately ---------- */
export function SupportPrivatelyPanel({ projectId, symbol }: { projectId: string; symbol: string }) {
  const { cluster } = useCluster();
  const { session } = usePrivateSession();
  const info = useServerFn(getPrivateSupport);
  const record = useServerFn(recordPrivateSupport);
  const q = useQuery({ queryKey: ["private-support", projectId], queryFn: () => info({ data: { projectId } }) });
  const bal = useBalances(session);
  const deposit = useDeposit();
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!q.data?.address) return null;
  const target = q.data.address;

  async function send() {
    if (!session) return;
    setDone(null);
    try {
      const m = await import("@/lib/privacy");
      if (session.shieldedAddress === target) throw new Error("This is your own project.");
      const l = m.toLamports(amount);
      if (l <= 0n) throw new Error("Enter an amount above zero.");
      const have = BigInt(bal.data?.privateLamports ?? "0");
      if (have < l) await deposit(session, l - have, setPhase);
      setPhase("Generating proof and sending privately…");
      const sig = await m.sendPrivately(session, target, l);
      setPhase("Recording…");
      await record({ data: { projectId, cluster, signature: sig } }).catch(() => null);
      const { explorerTx } = await import("@/lib/solana-client");
      setDone(explorerTx(sig, cluster));
      toast.success("Sent privately");
      setAmount("");
      await Promise.all([q.refetch(), bal.refetch()]);
    } catch (e) { toast.error(await errText(e)); }
    setPhase(null);
  }

  return (
    <section className="panel space-y-3 p-5" aria-live="polite">
      <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> support privately</p>
      <p className="text-sm text-muted-foreground">Send SOL to the ${symbol} creator with the amount encrypted on-chain, using Helius Privacy Rings.</p>
      <p className="font-mono text-xs">{q.data.count} private contribution{q.data.count === 1 ? "" : "s"} recorded · amounts hidden</p>
      {!session ? <Unlock what="send private support" /> : (
        <>
          <p className="text-xs text-muted-foreground">Your private balance: <span className="font-mono">{bal.data ? `${bal.data.privateSol} SOL` : "decrypting…"}</span>. Any shortfall is topped up from your wallet first (that top-up is public).</p>
          <div className="flex gap-2">
            <Input aria-label="Amount in SOL" inputMode="decimal" placeholder="SOL" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
            <Button disabled={!!phase || !amount} onClick={send}>Send</Button>
          </div>
          {phase && <p className="font-mono text-xs">{phase}</p>}
          {done && <p className="text-xs">Sent. <a className="underline" href={done} target="_blank" rel="noreferrer">View transaction</a> (amount not visible).</p>}
        </>
      )}
      <p className="text-[11px] text-muted-foreground">The count is supporter-reported and each entry is checked to be a real, successful privacy transaction, but because amounts and recipients are encrypted, it can't prove who received what.</p>
    </section>
  );
}
