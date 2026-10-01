/** Browser signing helpers. Ephemeral keypairs live only in memory for one transaction. */
import { Buffer } from "buffer";
import { Keypair, Transaction } from "@solana/web3.js";
import { getProvider } from "@/lib/cluster";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;

export { Keypair };

export async function signWithWallet(transactionBase64: string, localSigners: Keypair[] = []): Promise<string> {
  const provider = getProvider();
  if (!provider?.signTransaction) throw new Error("Your wallet cannot sign transactions. Use Phantom or a compatible wallet.");
  const tx = Transaction.from(Buffer.from(transactionBase64, "base64"));
  // fee payer + blockhash were set server-side before any signature.
  if (localSigners.length) tx.partialSign(...localSigners);
  const signed = await provider.signTransaction(tx);
  return Buffer.from(signed.serialize({ requireAllSignatures: true, verifySignatures: true })).toString("base64");
}

export function explorerTx(sig: string, cluster: string) {
  return `https://explorer.solana.com/tx/${sig}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}
export function explorerAddr(a: string, cluster: string) {
  return `https://explorer.solana.com/address/${a}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
}

export function signingError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return /reject|declin|cancel/i.test(m) ? "You declined the signature. Nothing was sent." : m;
}
