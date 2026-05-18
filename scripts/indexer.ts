/**
 * RAFI — On-Chain Indexer
 *
 * Reads all Pool and Position PDAs from the Solana program,
 * deserializes them using the Anchor IDL, and upserts into Supabase.
 *
 * Run: npx tsx scripts/indexer.ts
 * Cron: Run every 10s for near-real-time indexing.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rafi } from "../target/types/rafi";
import { PublicKey, Connection } from "@solana/web3.js";
import WebSocket from "ws";
// Polyfill WebSocket for Node.js < 22
(globalThis as any).WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";

// ── Config ──
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.NEXT_PUBLIC_SUPABASE_service_role || "";
const PROGRAM_ID = "5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg";

// ── Supabase client (service role for writes, no realtime needed) ──
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  realtime: { transport: undefined as any },
  auth: { persistSession: false },
});

// ── State name map ──
function poolStateToString(state: any): string {
  if (state.open) return "open";
  if (state.filled) return "filled";
  if (state.settlementRequested) return "settlementRequested";
  if (state.settled) return "settled";
  if (state.expired) return "expired";
  if (state.closed) return "closed";
  return "open";
}

// ── Mint → Symbol resolution ──
const MINT_SYMBOL_MAP: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "SOL",
  "5xLsCVKHjZZ4dbcSkGxrduNav1cmJenDSdza7hnrWYS1": "USDC",
};

function resolveSymbol(mint: string): string | null {
  return MINT_SYMBOL_MAP[mint] || null;
}

async function indexPools(program: Program<Rafi>): Promise<Map<string, number>> {
  console.log("📡 Fetching all pools from chain...");
  const pools = await program.account.pool.all();
  console.log(`   Found ${pools.length} pools`);

  const poolMap = new Map<string, number>();

  for (const { publicKey, account } of pools) {
    const pool = account;
    poolMap.set(publicKey.toBase58(), pool.poolId.toNumber());

    const row = {
      pool_id: pool.poolId.toNumber(),
      pool_pda: publicKey.toBase58(),
      seller: pool.seller.toBase58(),
      asset_mint: pool.assetMint.toBase58(),
      asset_symbol: resolveSymbol(pool.assetMint.toBase58()),
      asset_amount: pool.assetAmount.toNumber(),
      asset_decimals: pool.assetDecimals,
      multiplier_bps: pool.multiplierBps,
      pool_total_usdc: pool.poolTotalUsdc.toNumber(),
      usdc_collected: pool.usdcCollected.toNumber(),
      fee_bps: pool.feeBps,
      min_probability_bps: pool.minProbabilityBps,
      total_probability_sold_bps: pool.totalProbabilitySoldBps,
      position_count: pool.positionCount,
      asset_vault: pool.assetVault.toBase58(),
      usdc_vault: pool.usdcVault.toBase58(),
      created_at: pool.createdAt.toNumber(),
      expires_at: pool.expiresAt.toNumber(),
      settled_at: pool.settledAt.toNumber() || null,
      randomness_account: pool.randomnessAccount.toBase58() === PublicKey.default.toBase58()
        ? null : pool.randomnessAccount.toBase58(),
      settlement_requested_slot: pool.settlementRequestedSlot.toNumber() || null,
      vrf_result_bps: pool.vrfResultBps || null,
      vrf_slot: pool.vrfSlot.toNumber() || null,
      winner: pool.winner.toBase58() === PublicKey.default.toBase58()
        ? null : pool.winner.toBase58(),
      state: poolStateToString(pool.state),
    };

    const { error } = await supabase
      .from("pools")
      .upsert(row, { onConflict: "pool_id" });

    if (error) {
      console.error(`   ❌ Pool #${row.pool_id}:`, error.message);
    } else {
      console.log(`   ✅ Pool #${row.pool_id} — ${row.state} — ${row.total_probability_sold_bps/100}% filled`);
    }
  }

  return poolMap;
}

async function indexPositions(program: Program<Rafi>, poolMap: Map<string, number>) {
  console.log("📡 Fetching all positions from chain...");
  const positions = await program.account.probabilityPosition.all();
  console.log(`   Found ${positions.length} positions`);

  for (const { publicKey, account } of positions) {
    const pos = account;
    const poolPdaStr = pos.pool.toBase58();

    // Use pre-built pool map instead of individual RPC calls
    let poolId = poolMap.get(poolPdaStr);
    if (poolId === undefined) {
      // Fallback: fetch individually if not in map
      try {
        const poolAccount = await program.account.pool.fetch(pos.pool);
        poolId = poolAccount.poolId.toNumber();
      } catch {
        console.error(`   ⚠️ Cannot resolve pool for position ${publicKey.toBase58().slice(0,8)}`);
        continue;
      }
    }

    const row = {
      pool_id: poolId,
      position_pda: publicKey.toBase58(),
      buyer: pos.buyer.toBase58(),
      position_index: pos.positionIndex,
      probability_bps: pos.probabilityBps,
      usdc_paid: pos.usdcPaid.toNumber(),
      range_start_bps: pos.rangeStartBps,
      range_end_bps: pos.rangeEndBps,
      is_refunded: pos.isRefunded,
      created_at: pos.createdAt.toNumber(),
    };

    const { error } = await supabase
      .from("positions")
      .upsert(row, { onConflict: "position_pda" });

    if (error) {
      console.error(`   ❌ Position ${row.position_pda.slice(0,8)}:`, error.message);
    } else {
      console.log(`   ✅ Position #${row.position_index} on pool #${row.pool_id} — ${row.probability_bps/100}%`);
    }
  }
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("RAFI Indexer — On-chain → Supabase");
  console.log("═══════════════════════════════════════");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Missing SUPABASE_URL or service_role key in env");
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = anchor.workspace.Rafi as Program<Rafi>;
  console.log(`Program: ${program.programId.toBase58()}\n`);

  // Single run
  const mode = process.argv[2];

  if (mode === "--watch") {
    // Continuous mode
    console.log("🔄 Watch mode — indexing every 10s\n");
    const run = async () => {
      try {
        const poolMap = await indexPools(program);
        await indexPositions(program, poolMap);
        console.log(`\n✅ Indexed at ${new Date().toISOString()}\n${"─".repeat(40)}\n`);
      } catch (err: any) {
        console.error("❌ Index error:", err.message);
      }
    };
    await run();
    setInterval(run, 10_000);
  } else {
    // One-shot
    const poolMap = await indexPools(program);
    await indexPositions(program, poolMap);
    console.log("\n✅ Done!");
  }
}

main().catch(console.error);
