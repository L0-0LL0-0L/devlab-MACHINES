/**
 * Browser-only Helius Privacy Rings client. Import dynamically (never during SSR).
 *
 * Model: the user's normal wallet signs one fixed message; its SHA-256 becomes the seed of a separate
 * "private balance" key held only in memory. That key owns the encrypted balance and signs the
 * privacy transactions locally (they use Solana's new v1 transaction format that browser wallets
 * cannot sign yet). The same wallet always re-opens the same private balance; nothing is stored.
 */
import {
  createSprClient, ShieldedKeypair, SigningKey, LocalKeys, Wallet, ShieldedAddress, SOL_MINT,
  syncWallet, getPrivateTokenBalances, buildDepositTransaction, buildTransferTransaction, buildWithdrawalTransaction,
} from "@heliuslabs/spr";
type SprClient = Awaited<ReturnType<typeof createSprClient>>;
import { SignedTeePolicy } from "@heliuslabs/spr/client";
import {
  address, getBase64EncodedWireTransaction, pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, signTransactionMessageWithSigners,
  type Transaction,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import bs58 from "bs58";
import nacl from "tweetnacl";
import type { Cluster } from "@/lib/cluster";
import { getProvider } from "@/lib/cluster";

export const LAMPORTS = 1_000_000_000n;
/** Kept as public SOL in the private-balance key to pay network fees for deposit/transfer/withdraw. */
export const FEE_RESERVE_LAMPORTS = 10_000_000n; // 0.01 SOL

export function unlockMessage(wallet: string) {
  return [
    "biocraft private balance (Helius Privacy Rings) v1",
    `Wallet: ${wallet}`,
    "",
    "Signing opens your private balance on this device. It costs nothing and sends no transaction.",
    "The same wallet always opens the same private balance. Only sign this on biocraft.",
  ].join("\n");
}

type Net = "devnet" | "mainnet";
const netOf = (c: Cluster): Net => (c === "devnet" ? "devnet" : "mainnet");

function relayFetch(): typeof fetch {
  const origin = window.location.origin;
  return (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(raw);
    const m = /^(devnet|mainnet)\.helius-rpc\.com$/.exec(u.hostname);
    if (!m) return fetch(input, init);
    u.searchParams.delete("api-key");
    const target = `${origin}/api/public/helius/${m[1]}${u.pathname.replace(/\/+$/, "")}${u.search}`;
    if (input instanceof Request) return fetch(new Request(target, input), init);
    return fetch(target, init);
  };
}

export type PrivateSession = {
  cluster: Cluster;
  wallet: string;
  client: SprClient;
  keypair: ShieldedKeypair;
  keys: LocalKeys;
  state: Wallet;
  /** Public Solana address of the private-balance key (pays fees, visible on-chain). */
  feeAddress: string;
  /** Shareable private receiving address (base58). */
  shieldedAddress: string;
};

export async function openPrivateSession(cluster: Cluster, wallet: string): Promise<PrivateSession> {
  const provider = getProvider();
  if (!provider?.signMessage) throw new Error("Your wallet can't sign messages. Use Phantom or a compatible wallet.");
  const msg = new TextEncoder().encode(unlockMessage(wallet));
  const res = await provider.signMessage(msg, "utf8");
  const sig = res instanceof Uint8Array ? res : res.signature;
  if (!nacl.sign.detached.verify(msg, sig, bs58.decode(wallet))) throw new Error("The signature didn't come from the connected wallet.");
  const seed = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(sig)));
  const keypair = ShieldedKeypair.fromKeypair(SigningKey.fromEd25519Bytes(seed as never));
  seed.fill(0);
  const net = netOf(cluster);
  const client = await createSprClient({
    solanaRpcUrl: `https://${net}.helius-rpc.com`,
    proverTee: SignedTeePolicy.forNetwork(net),
    fetch: relayFetch(),
  });
  const keys = LocalKeys.fromKeypair(keypair, client.proofService);
  const shielded = keypair.shieldedAddress();
  return {
    cluster, wallet, client, keypair, keys,
    state: new Wallet({ identity: shielded }),
    feeAddress: String(shielded.solanaAddress()),
    shieldedAddress: bs58.encode(shielded.toBytes()),
  };
}

export function closePrivateSession(s: PrivateSession | null) {
  try { s?.keys.destroy(); } catch { /* already destroyed */ }
}

export function parseShieldedAddress(b58: string): ShieldedAddress {
  return ShieldedAddress.fromBytes(bs58.decode(b58));
}

export async function readBalances(s: PrivateSession) {
  await syncWallet({ wallet: s.state, keys: s.keys, client: s.client });
  const sol = getPrivateTokenBalances(s.state).find((b) => String(b.mint) === String(SOL_MINT));
  const feeLamports = await s.client.getBalance(address(s.feeAddress));
  return { privateLamports: sol?.amount ?? 0n, feeLamports };
}

async function signAndSend(s: PrivateSession, tx: Transaction, privacy: boolean): Promise<string> {
  const signer = s.keypair.toSolanaSigner();
  const [sigs] = await signer.signTransactions([tx]);
  const signed = { ...tx, signatures: { ...tx.signatures, ...sigs } } as Transaction;
  const wire = getBase64EncodedWireTransaction(signed as never);
  const signature = await s.client.solanaRpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
  if (privacy) await s.client.confirmPrivateTransaction(signature);
  else await s.client.confirmTransaction(signature);
  return String(signature);
}

/** Move public SOL already sitting on the private-balance key into the encrypted balance (keeps the fee reserve). */
export async function depositFromFeeAddress(s: PrivateSession, lamports: bigint) {
  const fee = address(s.feeAddress);
  const tx = await buildDepositTransaction({ client: s.client, feePayer: fee, depositor: fee, recipient: s.keypair.shieldedAddress(), amount: lamports });
  return signAndSend(s, tx, true);
}

/** Confidential transfer: amount and asset encrypted on-chain. */
export async function sendPrivately(s: PrivateSession, recipientShielded: string, lamports: bigint) {
  const tx = await buildTransferTransaction({
    client: s.client, wallet: s.state, keys: s.keys, feePayer: address(s.feeAddress),
    recipient: parseShieldedAddress(recipientShielded), amount: lamports,
  });
  return signAndSend(s, tx, true);
}

export async function withdrawTo(s: PrivateSession, recipient: string, lamports: bigint) {
  const tx = await buildWithdrawalTransaction({
    client: s.client, wallet: s.state, keys: s.keys, feePayer: address(s.feeAddress),
    recipient: address(recipient), amount: lamports,
  });
  return signAndSend(s, tx, true);
}

/** Return leftover public SOL on the private-balance key to the user's wallet (leaves 5000 lamports for the fee). */
export async function sweepFeeAddress(s: PrivateSession, to: string, lamports: bigint) {
  const signer = s.keypair.toSolanaSigner();
  const { value: bh } = await s.client.solanaRpc.getLatestBlockhash().send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer as never, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) => appendTransactionMessageInstructions([getTransferSolInstruction({ source: signer as never, destination: address(to), amount: lamports })], m),
  );
  const signed = await signTransactionMessageWithSigners(msg);
  const signature = await s.client.solanaRpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64" }).send();
  await s.client.confirmTransaction(signature);
  return String(signature);
}

export function toLamports(sol: string): bigint {
  if (!/^\d+(\.\d{1,9})?$/.test(sol.trim())) throw new Error("Enter an amount like 0.25");
  const [w, f = ""] = sol.trim().split(".");
  return BigInt(w!) * LAMPORTS + BigInt((f + "000000000").slice(0, 9));
}
export function fromLamports(l: bigint): string {
  const w = l / LAMPORTS, f = (l % LAMPORTS).toString().padStart(9, "0").replace(/0+$/, "");
  return f ? `${w}.${f}` : `${w}`;
}
