/**
 * Meteora DBC server functions. Server-only logic lives in dbc.server.ts and is loaded inside handlers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addr = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const sig = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/);
const cluster = z.enum(["devnet", "mainnet-beta"]);
const curveIn = z.object({
  initialMarketCapSol: z.number().positive().max(1_000_000),
  migrationMarketCapSol: z.number().positive().max(10_000_000),
});

const BIOCODE_EXTERNAL_MINT = "9fiMGcvfGYcDEJW7rAacYchYEGr5gitLXmuXvZGjUbio";
const BIOCODE_EXTERNAL_OWNER = "3b4f26e0-c683-4b35-8aa5-3ba5d5aa5033";
const BIOCODE_IMAGE_URL = "/__l5e/assets-v1/7c262e4e-ca17-4bd8-b012-a21916eb2d78/biocode-token.jpg";

type Fail = { ok: false; code: string; message: string };

async function ownDraft(context: { supabase: any }, projectId: string, c: string) {
  const { data, error } = await context.supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error || !data) throw new Error("Project not found.");
  if (data.cluster !== c) throw new Error(`This draft belongs to ${data.cluster}. Switch networks first.`);
  return data;
}

/** SDK curve preview — no chain writes. */
export const previewCurve = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => curveIn.extend({ totalSupply: z.number().int().min(1_000).max(1_000_000_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const curve = s.buildBiocodeCurve(data);
      return { ok: true as const, ...s.summarizeCurve(curve as never) };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) } satisfies Fail;
    }
  });

/** RPC + program health for the selected cluster. */
export const getChainHealth = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const conn = s.getConnection(data.cluster);
      const slot = await conn.getSlot();
      await s.assertProgramExecutable(conn, data.cluster);
      return { ok: true as const, slot, program: s.DBC_PROGRAM };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Build config+pool creation. Mint and config keypairs are generated and signed in the browser. */
export const buildLaunchTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    curveIn.extend({ cluster, projectId: z.string().uuid(), baseMint: addr, configAddress: addr, origin: z.string().regex(/^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const s = await import("./dbc.server");
    try {
      const wallet = await s.verifiedWallet(context);
      const project = await ownDraft(context, data.projectId, data.cluster);
      if (project.status !== "draft") throw new s.DbcError("not_draft", "This project is already launched.");
      const conn = s.getConnection(data.cluster);
      await s.assertProgramExecutable(conn, data.cluster);
      const client = s.getClient(data.cluster);
      const creator = s.pk(wallet, "Wallet");
      const curve = s.buildBiocodeCurve({ ...data, totalSupply: Number(project.token_supply ?? 1_000_000_000) });
      const uri = `${data.origin}/api/public/metadata/${project.id}`;
      const tx = await client.partner.createConfigAndPool({
        config: s.pk(data.configAddress, "Config"),
        feeClaimer: creator,
        leftoverReceiver: creator,
        quoteMint: s.pk(s.WSOL_MINT, "wSOL"),
        payer: creator,
        ...curve,
        preCreatePoolParam: {
          name: String(project.title).slice(0, 32),
          symbol: String(project.symbol).slice(0, 10),
          uri,
          poolCreator: creator,
          baseMint: s.pk(data.baseMint, "Mint"),
        },
      } as never);
      const prepared = await s.prepare(conn, tx, creator);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("projects")
        .update({ pending_mint: data.baseMint, pending_config: data.configAddress, creator_wallet: wallet, initial_market_cap_sol: data.initialMarketCapSol, migration_market_cap_sol: data.migrationMarketCapSol })
        .eq("id", project.id)
        .eq("status", "draft");
      return { ok: true as const, ...prepared, curve: s.summarizeCurve(curve as never) };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Broadcast a fully signed transaction and confirm against its blockhash window. */
export const submitSignedTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ cluster, transactionBase64: z.string().min(1).max(3000), blockhash: z.string().min(32).max(64), lastValidBlockHeight: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const conn = s.getConnection(data.cluster);
      const height = await conn.getBlockHeight("confirmed");
      if (height >= data.lastValidBlockHeight - 5) return { ok: false as const, code: "expired", message: "Approval window expired. Rebuild and sign again." };
      const signature = await conn.sendRawTransaction(Buffer.from(data.transactionBase64, "base64"), { skipPreflight: false, maxRetries: 3 });
      try {
        const res = await conn.confirmTransaction({ signature, blockhash: data.blockhash, lastValidBlockHeight: data.lastValidBlockHeight }, "confirmed");
        if (res.value.err) return { ok: false as const, code: "tx_failed", message: `Failed on-chain: ${JSON.stringify(res.value.err)}`, signature };
      } catch {
        const st = await conn.getSignatureStatus(signature, { searchTransactionHistory: true });
        if (st.value?.err) return { ok: false as const, code: "tx_failed", message: `Failed on-chain: ${JSON.stringify(st.value.err)}`, signature };
        if (!st.value?.confirmationStatus) return { ok: false as const, code: "unconfirmed", message: "Not confirmed before the blockhash expired. Check the explorer before retrying.", signature };
      }
      return { ok: true as const, signature };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Independently verify the pool on-chain, then publish the project. Idempotent per cluster/signature. */
export const recordLaunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cluster, projectId: z.string().uuid(), signature: sig }).parse(d))
  .handler(async ({ data, context }) => {
    const s = await import("./dbc.server");
    try {
      const wallet = await s.verifiedWallet(context);
      const project = await ownDraft(context, data.projectId, data.cluster);
      if (project.status !== "draft") return { ok: true as const, already: true };
      if (!project.pending_mint || !project.pending_config) throw new s.DbcError("no_pending", "No pending launch to verify.");
      const conn = s.getConnection(data.cluster);
      const client = s.getClient(data.cluster);
      const { address, pool, config } = await s.loadPool(client, project.pending_mint);
      const txInfo = await s.assertConfirmedTx(conn, data.signature, [address.toBase58(), project.pending_mint, project.pending_config]);
      if (txInfo.signer !== wallet) throw new s.DbcError("signer_mismatch", "Launch was not paid by your verified wallet.");
      if (pool.creator.toBase58() !== wallet) throw new s.DbcError("creator_mismatch", "Pool creator is not your verified wallet.");
      if (pool.config.toBase58() !== project.pending_config) throw new s.DbcError("config_mismatch", "Pool config does not match.");
      if (config.feeClaimer.toBase58() !== wallet) throw new s.DbcError("claimer_mismatch", "Fee claimer is not your wallet.");
      if (config.quoteMint.toBase58() !== s.WSOL_MINT) throw new s.DbcError("quote_mismatch", "Pool is not quoted in SOL.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const now = new Date().toISOString();
      await supabaseAdmin.from("chain_transactions").upsert(
        { cluster: data.cluster, signature: data.signature, kind: "launch", project_id: project.id, wallet, detail: { pool: address.toBase58(), mint: project.pending_mint, config: project.pending_config } },
        { onConflict: "cluster,signature", ignoreDuplicates: true },
      );
      const { error } = await supabaseAdmin
        .from("projects")
        .update({ status: "live", mint_address: project.pending_mint, pool_address: address.toBase58(), config_address: project.pending_config, launch_signature: data.signature, launched_at: now, creator_wallet: wallet, token_decimals: 6 })
        .eq("id", project.id)
        .eq("status", "draft");
      if (error) throw error;
      return { ok: true as const, already: false };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Live pool state straight from the chain. */
export const getPoolState = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster, mint: addr }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const client = s.getClient(data.cluster);
      const { address, pool, config } = await s.loadPool(client, data.mint);
      const { getPriceFromSqrtPrice } = await import("@meteora-ag/dynamic-bonding-curve-sdk");
      const price = getPriceFromSqrtPrice(pool.sqrtPrice, s.BASE_DECIMALS, s.QUOTE_DECIMALS);
      const threshold = config.migrationQuoteThreshold;
      const progressBps = threshold.isZero() ? 0 : Math.min(10000, pool.quoteReserve.muln(10000).div(threshold).toNumber());
      return {
        ok: true as const,
        pool: address.toBase58(),
        creator: pool.creator.toBase58(),
        feeClaimer: config.feeClaimer.toBase58(),
        priceSolPerToken: price.toString(),
        baseReserve: s.fromBaseUnits(pool.baseReserve, s.BASE_DECIMALS),
        quoteReserveSol: s.fromBaseUnits(pool.quoteReserve, s.QUOTE_DECIMALS),
        migrationThresholdSol: s.fromBaseUnits(threshold, s.QUOTE_DECIMALS),
        progressBps,
        curveComplete: pool.quoteReserve.gte(threshold),
        migrated: Number(pool.isMigrated) === 1,
        creatorFeeSol: s.fromBaseUnits(pool.creatorQuoteFee, s.QUOTE_DECIMALS),
        partnerFeeSol: s.fromBaseUnits(pool.partnerQuoteFee, s.QUOTE_DECIMALS),
        feeBps: s.FLAT_FEE_BPS,
      };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Publish the pre-registered biocode mint only after its mainnet DBC pool is independently verified. */
export const syncExternalBiocodeLaunch = createServerFn({ method: "POST" }).handler(async () => {
  const s = await import("./dbc.server");
  try {
    const { address, pool, config } = await s.loadPool(s.getClient("mainnet-beta"), BIOCODE_EXTERNAL_MINT);
    if (config.quoteMint.toBase58() !== s.WSOL_MINT) throw new s.DbcError("quote_mismatch", "Pool is not quoted in SOL.");
    const wallet = pool.creator.toBase58();
    if (config.feeClaimer.toBase58() !== wallet) throw new s.DbcError("claimer_mismatch", "Pool fee claimer does not match its creator.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from("projects").upsert({
      owner_id: BIOCODE_EXTERNAL_OWNER,
      title: "biocode",
      symbol: "BIOCODE",
      thesis: "A decentralized-science platform for AI-assisted research and community-funded scientific work.",
      category: "other",
      evidence: [
        { label: "Website", url: "https://biocode.cfd/" },
        { label: "X", url: "https://x.com/biocodeDBC" },
      ],
      cluster: "mainnet-beta",
      status: Number(pool.isMigrated) === 1 ? "migrated" : "live",
      mint_address: BIOCODE_EXTERNAL_MINT,
      pool_address: address.toBase58(),
      config_address: pool.config.toBase58(),
      creator_wallet: wallet,
      treasury_address: wallet,
      token_decimals: s.BASE_DECIMALS,
      image_url: BIOCODE_IMAGE_URL,
      website_url: "https://biocode.cfd/",
      x_url: "https://x.com/biocodeDBC",
      launched_at: now,
      updated_at: now,
    }, { onConflict: "cluster,mint_address" }).select("id,status").single();
    if (error) throw error;
    return { ok: true as const, projectId: data.id, status: data.status };
  } catch (e) {
    if (e instanceof s.DbcError && e.code === "pool_not_found") return { ok: true as const, pending: true as const };
    return { ok: false as const, ...s.describe(e) };
  }
});

const tradeIn = z.object({ cluster, mint: addr, side: z.enum(["buy", "sell"]), amount: z.string().regex(/^\d+(\.\d+)?$/).max(30), slippageBps: z.number().int().min(10).max(2000) });

async function quoteCore(data: z.infer<typeof tradeIn>) {
  const s = await import("./dbc.server");
  const { SwapMode } = await import("@meteora-ag/dynamic-bonding-curve-sdk");
  const conn = s.getConnection(data.cluster);
  const client = s.getClient(data.cluster);
  const { address, vp, pool, config } = await s.loadPool(client, data.mint);
  if (Number(pool.isMigrated) === 1) throw new s.DbcError("migrated", "This curve has migrated to DAMM v2. Trade on Meteora instead.");
  const sell = data.side === "sell";
  const amountIn = s.toBaseUnits(data.amount, sell ? s.BASE_DECIMALS : s.QUOTE_DECIMALS);
  const point = await s.currentPoint(conn, config);
  const q = client.pool.swapQuote2({
    virtualPool: vp, config, swapBaseForQuote: sell, hasReferral: false, eligibleForFirstSwapWithMinFee: false, currentPoint: point, slippageBps: data.slippageBps, swapMode: SwapMode.ExactIn, amountIn,
  });
  const outDec = sell ? s.QUOTE_DECIMALS : s.BASE_DECIMALS;
  return { s, conn, client, address, sell, amountIn, q, outDec };
}

export const getSwapQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tradeIn.parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const { q, outDec } = await quoteCore(data);
      return {
        ok: true as const,
        amountOut: s.fromBaseUnits(q.outputAmount, outDec),
        minimumAmountOut: s.fromBaseUnits(q.minimumAmountOut!, outDec),
        tradingFeeSol: s.fromBaseUnits(q.tradingFee, s.QUOTE_DECIMALS),
        protocolFeeSol: s.fromBaseUnits(q.protocolFee, s.QUOTE_DECIMALS),
        expiresAt: Date.now() + 20_000,
      };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Re-quotes server-side so the minimum output is never taken from the client. */
export const buildSwapTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tradeIn.extend({ owner: addr }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const { SwapMode } = await import("@meteora-ag/dynamic-bonding-curve-sdk");
      const { conn, client, address, sell, amountIn, q, outDec } = await quoteCore(data);
      const owner = s.pk(data.owner, "Wallet");
      const tx = await client.pool.swap2({ owner, pool: address, swapBaseForQuote: sell, referralTokenAccount: null, swapMode: SwapMode.ExactIn, amountIn, minimumAmountOut: q.minimumAmountOut! });
      const prepared = await s.prepare(conn, tx, owner);
      return { ok: true as const, ...prepared, amountOut: s.fromBaseUnits(q.outputAmount, outDec), minimumAmountOut: s.fromBaseUnits(q.minimumAmountOut!, outDec) };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Creator claims both creator and partner (fee-claimer) shares — both roles are the creator wallet. */
export const buildClaimFeesTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster, mint: addr, owner: addr }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const { Transaction } = await import("@solana/web3.js");
      const conn = s.getConnection(data.cluster);
      const client = s.getClient(data.cluster);
      const { address, pool, config } = await s.loadPool(client, data.mint);
      const owner = s.pk(data.owner, "Wallet");
      const tx = new Transaction();
      if (pool.creator.equals(owner) && (!pool.creatorQuoteFee.isZero() || !pool.creatorBaseFee.isZero())) {
        tx.add(await client.creator.claimCreatorTradingFee({ creator: owner, payer: owner, pool: address, maxBaseAmount: pool.creatorBaseFee, maxQuoteAmount: pool.creatorQuoteFee }));
      }
      if (config.feeClaimer.equals(owner) && (!pool.partnerQuoteFee.isZero() || !pool.partnerBaseFee.isZero())) {
        tx.add(await client.partner.claimPartnerTradingFee({ feeClaimer: owner, payer: owner, pool: address, maxBaseAmount: pool.partnerBaseFee, maxQuoteAmount: pool.partnerQuoteFee }));
      }
      if (!tx.instructions.length) throw new s.DbcError("nothing_to_claim", "No unclaimed fees for this wallet right now.");
      return { ok: true as const, ...(await s.prepare(conn, tx, owner)) };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Permissionless DAMM v2 migration once the curve is complete. Position NFT keypairs sign server-side after blockhash is set; never stored. */
export const buildMigrationTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster, mint: addr, payer: addr }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const { DAMM_V2_MIGRATION_FEE_ADDRESS } = await import("@meteora-ag/dynamic-bonding-curve-sdk");
      const conn = s.getConnection(data.cluster);
      const client = s.getClient(data.cluster);
      const { address, pool, config } = await s.loadPool(client, data.mint);
      if (Number(pool.isMigrated) === 1) throw new s.DbcError("migrated", "Already migrated.");
      if (pool.quoteReserve.lt(config.migrationQuoteThreshold)) throw new s.DbcError("not_ready", "Curve has not reached its migration threshold.");
      const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[config.migrationFeeOption];
      if (!dammConfig) throw new s.DbcError("no_damm_config", "No DAMM v2 config for this fee option.");
      const payer = s.pk(data.payer, "Wallet");
      const res = await client.migration.migrateToDammV2({ payer, pool: address, dammConfig });
      return { ok: true as const, ...(await s.prepare(conn, res.transaction, payer, [res.firstPositionNftKeypair, res.secondPositionNftKeypair])) };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** Record a confirmed trade/claim/migration after on-chain verification. Idempotent. */
export const recordChainTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster, mint: addr, signature: sig, kind: z.enum(["buy", "sell", "claim", "migrate"]) }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: project } = await supabaseAdmin.from("projects").select("id,pool_address,status").eq("cluster", data.cluster).eq("mint_address", data.mint).maybeSingle();
      if (!project?.pool_address) throw new s.DbcError("unknown_project", "Not a biocode launch.");
      const conn = s.getConnection(data.cluster);
      const info = await s.assertConfirmedTx(conn, data.signature, [project.pool_address]);
      await supabaseAdmin.from("chain_transactions").upsert(
        { cluster: data.cluster, signature: data.signature, kind: data.kind, project_id: project.id, wallet: info.signer, detail: { slot: info.slot } },
        { onConflict: "cluster,signature", ignoreDuplicates: true },
      );
      if (data.kind === "migrate") {
        const { pool } = await s.loadPool(s.getClient(data.cluster), data.mint);
        if (Number(pool.isMigrated) === 1) {
          await supabaseAdmin.from("projects").update({ status: "migrated", migrated_at: new Date().toISOString(), migration_signature: data.signature }).eq("id", project.id);
        }
      }
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

export const getWalletSolBalance = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster, wallet: addr }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const BN = (await import("bn.js")).default;
      const conn = s.getConnection(data.cluster);
      const lamports = await conn.getBalance(new PublicKey(data.wallet), "confirmed");
      const slot = await conn.getSlot("confirmed");
      return { ok: true as const, sol: s.fromBaseUnits(new BN(lamports), s.QUOTE_DECIMALS), slot };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });

/** If the chain shows the pool migrated (by anyone, incl. Meteora's cranker), sync project status. Chain is the source of truth. */
export const syncMigrationStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cluster, mint: addr }).parse(d))
  .handler(async ({ data }) => {
    const s = await import("./dbc.server");
    try {
      const { pool } = await s.loadPool(s.getClient(data.cluster), data.mint);
      if (Number(pool.isMigrated) !== 1) return { ok: true as const, migrated: false };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("projects").update({ status: "migrated", migrated_at: new Date().toISOString() })
        .eq("cluster", data.cluster).eq("mint_address", data.mint).eq("status", "live");
      return { ok: true as const, migrated: true };
    } catch (e) {
      return { ok: false as const, ...s.describe(e) };
    }
  });
