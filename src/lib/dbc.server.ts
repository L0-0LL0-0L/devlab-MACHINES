/**
 * Server-only Meteora Dynamic Bonding Curve adapter for biocode.
 * Every value comes from the chain or from validated input; failures are explicit.
 */
import { Connection, PublicKey, Transaction, type Keypair } from "@solana/web3.js";
import BN from "bn.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DynamicBondingCurveClient,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
  type PoolConfig,
  type VirtualPool,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

export const DBC_PROGRAM = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const BASE_DECIMALS = 6;
export const QUOTE_DECIMALS = 9;
export const FLAT_FEE_BPS = 100;

export type ClusterName = "devnet" | "mainnet-beta";

export class DbcError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "DbcError";
  }
}

export function rpcUrl(cluster: ClusterName): string {
  if (cluster === "devnet") return process.env["SOLANA_DEVNET_RPC_URL"] || "https://api.devnet.solana.com";
  return process.env["SOLANA_MAINNET_RPC_URL"] || "https://api.mainnet-beta.solana.com";
}

export function getConnection(cluster: ClusterName) {
  return new Connection(rpcUrl(cluster), "confirmed");
}
export function getClient(cluster: ClusterName) {
  return DynamicBondingCurveClient.create(getConnection(cluster), "confirmed");
}

export function assertProgram() {
  if (DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58() !== DBC_PROGRAM) {
    throw new DbcError("program_mismatch", "Installed Meteora SDK program ID does not match the official DBC program.");
  }
}

let programChecked: Partial<Record<ClusterName, boolean>> = {};
export async function assertProgramExecutable(connection: Connection, cluster: ClusterName) {
  assertProgram();
  if (programChecked[cluster]) return;
  const info = await connection.getAccountInfo(new PublicKey(DBC_PROGRAM));
  if (!info?.executable) throw new DbcError("program_missing", `Meteora DBC program is not executable on ${cluster}.`);
  programChecked = { ...programChecked, [cluster]: true };
}

export function pk(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new DbcError("invalid_address", `${label} is not a valid Solana address.`);
  }
}

/** Exact decimal string -> BN base units (no floating point). */
export function toBaseUnits(amount: string, decimals: number): BN {
  const t = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) throw new DbcError("invalid_amount", "Enter a positive number.");
  const [w, f = ""] = t.split(".");
  if (f.length > decimals) throw new DbcError("invalid_amount", `At most ${decimals} decimal places.`);
  const v = new BN((w || "0") + f.padEnd(decimals, "0"));
  if (v.isZero()) throw new DbcError("invalid_amount", "Amount must be greater than zero.");
  return v;
}

export function fromBaseUnits(value: BN | bigint | string | number, decimals: number): string {
  const raw = new BN(value.toString());
  const base = new BN(10).pow(new BN(decimals));
  const frac = raw.mod(base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${raw.div(base).toString()}.${frac}` : raw.div(base).toString();
}

export function buildBiocodeCurve(p: { initialMarketCapSol: number; migrationMarketCapSol: number; totalSupply: number }) {
  if (!(p.initialMarketCapSol > 0) || !(p.migrationMarketCapSol > p.initialMarketCapSol)) {
    throw new DbcError("invalid_curve", "Graduation market cap must be greater than the starting market cap.");
  }
  return buildCurveWithMarketCap({
    initialMarketCap: p.initialMarketCapSol,
    migrationMarketCap: p.migrationMarketCapSol,
    token: {
      tokenType: TokenType.SPL,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: p.totalSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: { startingFeeBps: FLAT_FEE_BPS, endingFeeBps: FLAT_FEE_BPS, numberOfPeriod: 0, totalDuration: 0 },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 100,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 0,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 100,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
    activationType: ActivationType.Slot,
  } as Parameters<typeof buildCurveWithMarketCap>[0]);
}

export function summarizeCurve(curve: Record<string, any>) {
  return {
    migrationQuoteThresholdSol: fromBaseUnits(curve["migrationQuoteThreshold"].toString(), QUOTE_DECIMALS),
    sqrtStartPrice: curve["sqrtStartPrice"].toString(),
    curvePoints: (curve["curve"] as unknown[]).length,
    feeBps: FLAT_FEE_BPS,
    creatorTradingFeePercentage: Number(curve["creatorTradingFeePercentage"]),
    creatorLockedLpPercentage: Number(curve["creatorLockedLpPercentage"]),
    partnerLpPercentage: Number(curve["partnerLpPercentage"]),
    migration: "Meteora DAMM v2 (MET_DAMM_V2), 1% pool fee",
    tokenAuthority: "immutable",
  };
}

export async function loadPool(client: DynamicBondingCurveClient, mint: string): Promise<{ address: PublicKey; pool: VirtualPool; config: PoolConfig }> {
  const found = await client.state.getPoolByBaseMint(mint);
  if (!found) throw new DbcError("pool_not_found", "No Meteora pool exists for this token on the selected network.");
  const config = await client.state.getPoolConfig(found.account.config);
  if (!config) throw new DbcError("config_not_found", "Pool configuration account is missing.");
  return { address: found.publicKey, pool: found.account, config };
}

export async function currentPoint(connection: Connection, config: PoolConfig): Promise<BN> {
  const slot = await connection.getSlot("confirmed");
  if (config.activationType === ActivationType.Slot) return new BN(slot);
  const t = await connection.getBlockTime(slot);
  if (t == null) throw new DbcError("clock_unavailable", "Could not read network time.");
  return new BN(t);
}

export type Prepared = {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  simulation: { ok: boolean; error: string | null; logs: string[]; unitsConsumed: number | null };
  networkFeeLamports: number | null;
};

/** Set fee payer + fresh blockhash FIRST, then partial-sign server-held ephemeral signers, then simulate. */
export async function prepare(connection: Connection, tx: Transaction, feePayer: PublicKey, serverSigners: Keypair[] = []): Promise<Prepared> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.feePayer = feePayer;
  tx.recentBlockhash = blockhash;
  if (serverSigners.length) tx.partialSign(...serverSigners);
  const msg = tx.compileMessage();
  const { VersionedTransaction } = await import("@solana/web3.js");
  const vtx = new VersionedTransaction(msg as never);
  const sim = await connection.simulateTransaction(vtx, { sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed" });
  let fee: number | null = null;
  try {
    fee = (await connection.getFeeForMessage(msg, "confirmed")).value ?? null;
  } catch {
    fee = null;
  }
  return {
    transactionBase64: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
    blockhash,
    lastValidBlockHeight,
    simulation: {
      ok: sim.value.err === null,
      error: sim.value.err ? JSON.stringify(sim.value.err) : null,
      logs: (sim.value.logs ?? []).slice(-30),
      unitsConsumed: sim.value.unitsConsumed ?? null,
    },
    networkFeeLamports: fee,
  };
}

/** Fetch a confirmed transaction and assert it succeeded and touched the given accounts. */
export async function assertConfirmedTx(connection: Connection, signature: string, mustInclude: string[]) {
  const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!tx) throw new DbcError("tx_not_found", "Transaction is not confirmed on this network yet.");
  if (tx.meta?.err) throw new DbcError("tx_failed", `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`);
  const keys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58());
  for (const k of mustInclude) {
    if (!keys.includes(k)) throw new DbcError("tx_mismatch", "Transaction does not reference the expected accounts.");
  }
  return { keys, signer: keys[0]!, slot: tx.slot, blockTime: tx.blockTime ?? null };
}

export async function verifiedWallet(context: { supabase: any; userId: string }): Promise<string> {
  const { data } = await context.supabase.from("profiles").select("wallet_address").eq("id", context.userId).maybeSingle();
  const w = data?.wallet_address as string | undefined;
  if (!w) throw new DbcError("wallet_unverified", "Sign in with your Solana wallet first.");
  return w;
}

export function describe(e: unknown) {
  if (e instanceof DbcError) return { code: e.code, message: e.message };
  const message = e instanceof Error ? e.message : "Unexpected Solana error.";
  return { code: "adapter_error", message: message.slice(0, 400) };
}
