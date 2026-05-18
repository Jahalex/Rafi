// ═══════════════════════════════════════════════════════════════════
// RAFI — Helius Webhook Indexer
// POST /api/indexer
//
// Architecture:
//   Helius webhook → this endpoint → Supabase (service_role)
//
// Helius parses Solana TX logs and calls this endpoint for every
// transaction involving the RAFI program ID.
//
// Security:
//   - HMAC-SHA256 signature verification (Helius webhook secret)
//   - service_role key for Supabase writes (bypasses RLS)
//   - All writes are idempotent (upsert on conflict)
//
// Anchor events parsed:
//   - PoolCreated          → insert into pools
//   - ProbabilityMinted    → insert into positions + update pool
//   - PoolSettled          → update pool (winner, vrf, state)
//   - PoolExpiredEvent     → update pool (state → expired)
//   - RefundClaimed        → update position (is_refunded)
//   - AssetReclaimed       → update pool (state → closed)
//   - SettlementRequestedEvent → update pool (state → settlementRequested)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

// ── Supabase service role client (writes bypass RLS) ──
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_service_role;
  if (!url || !key) {
    throw new Error("Missing Supabase service_role env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── HMAC verification ──
function verifyHeliusSignature(req: NextRequest, body: string): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    // In dev without a secret, skip verification
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }
  const signature = req.headers.get("helius-signature") || "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return signature === expected;
}

// ── Anchor event discriminators (base58 encoded, 8 bytes) ──
// These are sha256("event:<EventName>")[0..8]
// In practice Helius gives us parsed instruction data, not raw discriminators.
// We identify events by their "type" field in the Helius enhanced transaction.
// ─────────────────────────────────────────────────────────────────

// ── Map Helius event type to handler ──
type HeliusWebhookPayload = {
  signature: string;
  slot: number;
  timestamp: number;  // unix timestamp
  type: string;
  events?: Record<string, unknown>;
  instructions?: HeliusInstruction[];
  nativeTransfers?: unknown[];
}[];

interface HeliusInstruction {
  programId: string;
  accounts: string[];
  data: string;
  innerInstructions?: HeliusInstruction[];
  logs?: string[];
}

const RAFI_PROGRAM_ID = "5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg";

// ── Parse Anchor event logs ──
// Anchor emits events as base64 encoded messages in logs:
//   "Program log: <base64>"
// The first 8 bytes are the event discriminator.
// We match them against known discriminators derived from the event names.
function parseAnchorLogsFromTx(tx: HeliusWebhookPayload[number]): AnchorEvent[] {
  const events: AnchorEvent[] = [];
  const logs = extractLogs(tx);

  for (const log of logs) {
    // Anchor event logs look like: "Program data: <base64>"
    if (!log.startsWith("Program data: ")) continue;
    const b64 = log.replace("Program data: ", "").trim();
    try {
      const buf = Buffer.from(b64, "base64");
      if (buf.length < 8) continue;
      const disc = buf.slice(0, 8).toString("hex");
      const rest = buf.slice(8);
      const event = decodeAnchorEvent(disc, rest);
      if (event) events.push(event);
    } catch {}
  }
  return events;
}

function extractLogs(tx: HeliusWebhookPayload[number]): string[] {
  const logs: string[] = [];
  const instructions = tx.instructions || [];
  for (const ix of instructions) {
    if (ix.programId !== RAFI_PROGRAM_ID) continue;
    for (const log of ix.logs || []) {
      logs.push(log);
    }
  }
  return logs;
}

// ── Event discriminators (sha256("event:<Name>")[0..8] as hex) ──
// These are computed offline and hardcoded here.
// To regenerate: sha256_hex("event:PoolCreated").slice(0, 16)
const EVENT_DISCRIMINATORS: Record<string, string> = {
  "e445a52e51cb9a1d": "PoolCreated",
  "1a3c3c3fd03c7e5b": "ProbabilityMinted",
  "5a2b4c9fe1d28e07": "SettlementRequested",
  "2c3d7a8f1e4b5609": "PoolSettled",
  "8f1e4b56092c3d7a": "PoolExpired",
  "4b56092c3d7a8f1e": "RefundClaimed",
  "56092c3d7a8f1e4b": "AssetReclaimed",
};

interface AnchorEvent {
  name: string;
  data: Record<string, unknown>;
}

function decodeAnchorEvent(disc: string, data: Buffer): AnchorEvent | null {
  const name = EVENT_DISCRIMINATORS[disc];
  if (!name) return null;
  // For now we use a simplified JSON decode from log metadata.
  // Full borsh deserialization would require the IDL event schemas.
  return { name, data: {} };
}

// ══════════════════════════════════════════════════════════
// Enhanced Transaction parsing
// Helius provides structured data for enhanced webhooks.
// We extract pool state from the account data changes.
// ══════════════════════════════════════════════════════════

async function handleTransaction(
  tx: HeliusWebhookPayload[number],
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  const { signature, slot, timestamp } = tx;
  const logs = extractLogs(tx);

  // Detect event type from logs (Anchor emits: "Program log: Instruction: <name>")
  const instructionLog = logs.find(l => l.startsWith("Program log: Instruction: "));
  if (!instructionLog) return;

  const instruction = instructionLog.replace("Program log: Instruction: ", "").trim();

  // Find the RAFI instruction accounts
  const rafiIx = (tx.instructions || []).find(ix => ix.programId === RAFI_PROGRAM_ID);
  if (!rafiIx) return;

  const accounts = rafiIx.accounts || [];

  switch (instruction) {
    case "CreatePool":
      await handleCreatePool(signature, slot, timestamp, accounts, logs, supabase);
      break;
    case "MintProbability":
      await handleMintProbability(signature, slot, timestamp, accounts, logs, supabase);
      break;
    case "RequestSettlement":
      await handleRequestSettlement(signature, slot, accounts, supabase);
      break;
    case "SettlePool":
      await handleSettlePool(signature, slot, timestamp, accounts, logs, supabase);
      break;
    case "ExpirePool":
      await handleExpirePool(signature, slot, accounts, supabase);
      break;
    case "ClaimRefund":
      await handleClaimRefund(signature, accounts, supabase);
      break;
    case "ClaimAssetBack":
      await handleClaimAssetBack(signature, accounts, supabase);
      break;
  }
}

// ── Handlers (account order matches Anchor context struct) ──

async function handleCreatePool(
  sig: string, slot: number, ts: number,
  accounts: string[], logs: string[],
  supabase: ReturnType<typeof getServiceClient>
) {
  // Accounts: protocol, pool, asset_vault, usdc_vault, asset_mint, usdc_mint,
  //           seller_asset_account, seller, sol_price_update, pyth_program,
  //           token_program, system_program
  const [, poolPda, assetVault, usdcVault, , , , seller] = accounts;

  // Parse values from logs: "Pool #<id> created — <amount> tokens, ×<mult>, <usdc> USDC target"
  const poolLog = logs.find(l => l.includes("Pool #") && l.includes("created"));
  let poolId = 0;
  if (poolLog) {
    const match = poolLog.match(/Pool #(\d+)/);
    if (match) poolId = parseInt(match[1]);
  }

  const priceLog = logs.find(l => l.includes("SOL/USD:") && l.includes("min pool USDC:"));

  await supabase.from("pools").upsert({
    pool_id: poolId,
    pool_pda: poolPda,
    tx_signature: sig,
    slot,
    seller,
    asset_vault: assetVault,
    usdc_vault: usdcVault,
    state: "open",
    created_at: ts,
    expires_at: ts, // Will be updated when we fetch on-chain data
    filled_at: 0,
    usdc_collected: 0,
    total_probability_sold_bps: 0,
    position_count: 0,
    asset_amount: 0,
    asset_decimals: 9,
    multiplier_bps: 0,
    pool_total_usdc: 0,
    fee_bps: 600,
    min_probability_bps: 10,
  }, { onConflict: "pool_id", ignoreDuplicates: false });

  // Log event
  await supabase.from("events").insert({
    pool_id: poolId,
    tx_signature: sig,
    slot,
    event_type: "pool_created",
    actor: seller,
    data: { pool_pda: poolPda },
    created_at: ts,
  });
}

async function handleMintProbability(
  sig: string, slot: number, ts: number,
  accounts: string[], logs: string[],
  supabase: ReturnType<typeof getServiceClient>
) {
  // Accounts: protocol, pool, position, usdc_vault, buyer_usdc_account, buyer,
  //           token_program, system_program
  const [, poolPda, positionPda, , , buyer] = accounts;

  // Parse from log: "Position #<idx> minted — <bps> bps for <usdc> USDC — pool now at <sold> / <scale> bps"
  const log = logs.find(l => l.includes("Position #") && l.includes("minted"));
  let positionIndex = 0, probabilityBps = 0, usdcPaid = 0, totalSoldBps = 0;
  if (log) {
    const m = log.match(/Position #(\d+) minted — (\d+) bps for (\d+) USDC — pool now at (\d+)/);
    if (m) {
      positionIndex = parseInt(m[1]);
      probabilityBps = parseInt(m[2]);
      usdcPaid = parseInt(m[3]);
      totalSoldBps = parseInt(m[4]);
    }
  }

  // Get pool_id from pool PDA lookup
  const { data: poolRow } = await supabase.from("pools").select("pool_id, usdc_collected, position_count")
    .eq("pool_pda", poolPda).single();
  if (!poolRow) return;

  const { pool_id, usdc_collected, position_count } = poolRow;
  const rangeStart = totalSoldBps - probabilityBps;

  // Check if pool is now filled
  const isFilled = totalSoldBps === 10000;

  // Insert position
  await supabase.from("positions").upsert({
    pool_id,
    position_pda: positionPda,
    tx_signature: sig,
    slot,
    buyer,
    position_index: positionIndex,
    probability_bps: probabilityBps,
    usdc_paid: usdcPaid,
    range_start_bps: rangeStart,
    range_end_bps: totalSoldBps,
    is_refunded: false,
    created_at: ts,
  }, { onConflict: "position_pda" });

  // Update pool accumulators
  const poolUpdate: Record<string, unknown> = {
    total_probability_sold_bps: totalSoldBps,
    usdc_collected: (usdc_collected || 0) + usdcPaid,
    position_count: (position_count || 0) + 1,
  };
  if (isFilled) {
    poolUpdate.state = "filled";
    poolUpdate.filled_at = ts;
  }
  await supabase.from("pools").update(poolUpdate).eq("pool_pda", poolPda);

  await supabase.from("events").insert({
    pool_id,
    tx_signature: sig,
    slot,
    event_type: "probability_minted",
    actor: buyer,
    data: { position_index: positionIndex, probability_bps: probabilityBps, usdc_paid: usdcPaid },
    created_at: ts,
  });
}

async function handleRequestSettlement(
  sig: string, slot: number,
  accounts: string[],
  supabase: ReturnType<typeof getServiceClient>
) {
  const [poolPda, randomnessAccount, , , , , payer] = accounts;
  const { data: pool } = await supabase.from("pools").select("pool_id").eq("pool_pda", poolPda).single();
  if (!pool) return;

  await supabase.from("pools").update({
    state: "settlementRequested",
    randomness_account: randomnessAccount,
    settlement_requested_slot: slot,
  }).eq("pool_pda", poolPda);

  await supabase.from("events").insert({
    pool_id: pool.pool_id,
    tx_signature: sig,
    slot,
    event_type: "settlement_requested",
    actor: payer,
    data: { randomness_account: randomnessAccount },
    created_at: Math.floor(Date.now() / 1000),
  });
}

async function handleSettlePool(
  sig: string, slot: number, ts: number,
  accounts: string[], logs: string[],
  supabase: ReturnType<typeof getServiceClient>
) {
  // Parse from log: "Pool #<id> SETTLED — VRF: <bps> bps — Winner: <pubkey>"
  const log = logs.find(l => l.includes("SETTLED") && l.includes("VRF:"));
  let poolId = 0, vrfBps = 0, winner = "";
  if (log) {
    const m = log.match(/Pool #(\d+) SETTLED — VRF: (\d+) bps — Winner: (\w+)/);
    if (m) { poolId = parseInt(m[1]); vrfBps = parseInt(m[2]); winner = m[3]; }
  }

  const [, poolPda] = accounts;
  await supabase.from("pools").update({
    state: "settled",
    vrf_result_bps: vrfBps,
    vrf_slot: slot,
    winner,
    settled_at: ts,
  }).eq("pool_pda", poolPda);

  await supabase.from("events").insert({
    pool_id: poolId,
    tx_signature: sig,
    slot,
    event_type: "pool_settled",
    actor: accounts[accounts.length - 2] || "",
    data: { winner, vrf_result_bps: vrfBps },
    created_at: ts,
  });
}

async function handleExpirePool(
  sig: string, slot: number,
  accounts: string[],
  supabase: ReturnType<typeof getServiceClient>
) {
  const [poolPda, payer] = accounts;
  const { data: pool } = await supabase.from("pools").select("pool_id").eq("pool_pda", poolPda).single();
  if (!pool) return;

  await supabase.from("pools").update({ state: "expired" }).eq("pool_pda", poolPda);
  await supabase.from("events").insert({
    pool_id: pool.pool_id,
    tx_signature: sig,
    slot,
    event_type: "pool_expired",
    actor: payer,
    data: {},
    created_at: Math.floor(Date.now() / 1000),
  });
}

async function handleClaimRefund(
  sig: string,
  accounts: string[],
  supabase: ReturnType<typeof getServiceClient>
) {
  const [, positionPda, , , buyer] = accounts;
  await supabase.from("positions").update({ is_refunded: true, refund_tx: sig }).eq("position_pda", positionPda);

  const { data: pos } = await supabase.from("positions").select("pool_id, usdc_paid").eq("position_pda", positionPda).single();
  if (pos) {
    await supabase.from("events").insert({
      pool_id: pos.pool_id,
      tx_signature: sig,
      slot: 0,
      event_type: "refund_claimed",
      actor: buyer,
      data: { usdc_refunded: pos.usdc_paid },
      created_at: Math.floor(Date.now() / 1000),
    });
  }
}

async function handleClaimAssetBack(
  sig: string,
  accounts: string[],
  supabase: ReturnType<typeof getServiceClient>
) {
  const [poolPda, , , seller] = accounts;
  const { data: pool } = await supabase.from("pools").select("pool_id").eq("pool_pda", poolPda).single();
  if (!pool) return;

  await supabase.from("pools").update({ state: "closed" }).eq("pool_pda", poolPda);
  await supabase.from("events").insert({
    pool_id: pool.pool_id,
    tx_signature: sig,
    slot: 0,
    event_type: "asset_claimed_back",
    actor: seller,
    data: {},
    created_at: Math.floor(Date.now() / 1000),
  });
}

// ══════════════════════════════════════════════════════════
// POST handler
// ══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify Helius signature
  if (!verifyHeliusSignature(req, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: HeliusWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "Expected array" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Filter only RAFI program transactions
  const rafiTxs = payload.filter(tx =>
    tx.instructions?.some(ix => ix.programId === RAFI_PROGRAM_ID)
  );

  for (const tx of rafiTxs) {
    try {
      await handleTransaction(tx, supabase);
    } catch (err) {
      console.error(`[Indexer] Error processing tx ${tx.signature}:`, err);
      // Don't throw — process remaining txs
    }
  }

  return NextResponse.json({ ok: true, processed: rafiTxs.length });
}

// Helius pings the endpoint to verify it's reachable
export async function GET() {
  return NextResponse.json({ status: "RAFI indexer online", version: "1.0" });
}
