import { Keypair, LAMPORTS_PER_SOL, sendAndConfirmRawTransaction, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { SwapMode } from "@meteora-ag/dynamic-bonding-curve-sdk";
import * as s from "../src/lib/dbc.server";

const cluster = "devnet" as const;
const conn = s.getConnection(cluster);
const client = s.getClient(cluster);
await s.assertProgramExecutable(conn, cluster);
console.log("program executable OK, slot", await conn.getSlot());
const curve = s.buildBiocodeCurve({ initialMarketCapSol: 30, migrationMarketCapSol: 85, totalSupply: 1_000_000_000 });
console.log("curve", s.summarizeCurve(curve as never));
console.log("toBaseUnits 1.5@9 =", s.toBaseUnits("1.5", 9).toString(), "from", s.fromBaseUnits("1500000000", 9));

const payer = process.env.PAYER ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.PAYER))) : Keypair.generate();
let bal = await conn.getBalance(payer.publicKey);
if (bal < 0.2 * LAMPORTS_PER_SOL) {
  try {
    const sig = await conn.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    bal = await conn.getBalance(payer.publicKey);
  } catch (e) { console.log("airdrop failed:", (e as Error).message.slice(0, 150)); }
}
console.log("payer", payer.publicKey.toBase58(), "balance", bal / LAMPORTS_PER_SOL);
const mint = Keypair.generate(), config = Keypair.generate();
const tx = await client.partner.createConfigAndPool({
  config: config.publicKey, feeClaimer: payer.publicKey, leftoverReceiver: payer.publicKey, quoteMint: s.pk(s.WSOL_MINT, "w"), payer: payer.publicKey, ...curve,
  preCreatePoolParam: { name: "biocode test", symbol: "BIOT", uri: "https://biocode.cfd/api/public/metadata/test", poolCreator: payer.publicKey, baseMint: mint.publicKey },
} as never);
const prep = await s.prepare(conn, tx, payer.publicKey);
console.log("launch sim", prep.simulation.ok, prep.simulation.error, "size", Buffer.from(prep.transactionBase64, "base64").length);
if (bal < 0.1 * LAMPORTS_PER_SOL) { console.log("no devnet SOL: stopping after simulation"); process.exit(0); }
const t = Transaction.from(Buffer.from(prep.transactionBase64, "base64"));
t.partialSign(mint, config); t.partialSign(payer);
const sig = await sendAndConfirmRawTransaction(conn, t.serialize(), { signature: undefined as never, blockhash: prep.blockhash, lastValidBlockHeight: prep.lastValidBlockHeight } as never, { commitment: "confirmed" });
console.log("launch sig", sig);
const { address, vp, pool, config: cfg } = await s.loadPool(client, mint.publicKey.toBase58());
const info = await s.assertConfirmedTx(conn, sig, [address.toBase58(), mint.publicKey.toBase58(), config.publicKey.toBase58()]);
console.log("verified: signer", info.signer === payer.publicKey.toBase58(), "creator", pool.creator.equals(payer.publicKey), "claimer", cfg.feeClaimer.equals(payer.publicKey));
const amountIn = s.toBaseUnits("0.05", 9);
const q = client.pool.swapQuote2({ virtualPool: vp, config: cfg, swapBaseForQuote: false, hasReferral: false, eligibleForFirstSwapWithMinFee: false, currentPoint: await s.currentPoint(conn, cfg), slippageBps: 100, swapMode: SwapMode.ExactIn, amountIn });
console.log("quote out", s.fromBaseUnits(q.outputAmount, 6), "min", s.fromBaseUnits(q.minimumAmountOut!, 6), "fee", s.fromBaseUnits(q.tradingFee, 9));
const stx = await client.pool.swap2({ owner: payer.publicKey, pool: address, swapBaseForQuote: false, referralTokenAccount: null, swapMode: SwapMode.ExactIn, amountIn, minimumAmountOut: q.minimumAmountOut! });
const sp = await s.prepare(conn, stx, payer.publicKey);
console.log("buy sim", sp.simulation.ok, sp.simulation.error);
const st = Transaction.from(Buffer.from(sp.transactionBase64, "base64")); st.sign(payer);
const bsig = await conn.sendRawTransaction(st.serialize()); await conn.confirmTransaction({ signature: bsig, blockhash: sp.blockhash, lastValidBlockHeight: sp.lastValidBlockHeight }, "confirmed");
console.log("buy sig", bsig);
const after = await s.loadPool(client, mint.publicKey.toBase58());
console.log("creator fee", s.fromBaseUnits(after.pool.creatorQuoteFee, 9), "partner fee", s.fromBaseUnits(after.pool.partnerQuoteFee, 9), "reserve", s.fromBaseUnits(after.pool.quoteReserve, 9));
const ctx = new Transaction();
ctx.add(await client.creator.claimCreatorTradingFee({ creator: payer.publicKey, payer: payer.publicKey, pool: address, maxBaseAmount: after.pool.creatorBaseFee, maxQuoteAmount: after.pool.creatorQuoteFee }));
ctx.add(await client.partner.claimPartnerTradingFee({ feeClaimer: payer.publicKey, payer: payer.publicKey, pool: address, maxBaseAmount: after.pool.partnerBaseFee, maxQuoteAmount: after.pool.partnerQuoteFee }));
const cp = await s.prepare(conn, ctx, payer.publicKey);
console.log("claim sim", cp.simulation.ok, cp.simulation.error, cp.simulation.logs.slice(-2));
void BN;
