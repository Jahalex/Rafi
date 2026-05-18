// ═══════════════════════════════════════════════════
// RAFI — Supabase Client & Types
// ═══════════════════════════════════════════════════
//
// Architecture:
//   Supabase = read-only indexer of on-chain Solana state
//   Auth = Privy JWT passed via accessToken to Supabase
//   No user table — wallet address IS the user identity
//   Frontend uses anon key + Privy JWT for auth'd queries
//   Indexer uses service_role key for writes
//

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./constants";

// ── Anon client (no auth — for public reads when user is not logged in) ──
export function createAnonClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ── Auth'd client (with Privy JWT — for RLS-protected queries) ──
export function createAuthClient(
  getAccessToken: () => Promise<string | null>
): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    accessToken: async () => {
      const token = await getAccessToken();
      return token ?? "";
    },
  });
}

// Legacy export for backward compatibility (hooks that don't need auth)
export const supabase = createAnonClient();


// ── On-chain Pool States ──────────────────────────
export type PoolState =
  | "open"
  | "filled"
  | "settlementRequested"
  | "settled"
  | "expired"
  | "closed";

// ── Pool (mirrors on-chain Pool account) ──────────
export interface Pool {
  id: string;

  // On-chain identity
  pool_id: number;
  pool_pda: string;
  tx_signature: string | null;
  slot: number | null;

  // Social identity (stored off-chain in Supabase, set by creator post-TX)
  title?: string | null;        // e.g. "Bitcoin or bust 🔥"
  description?: string | null;  // 140-char pitch for the pool
  emoji?: string | null;        // e.g. "🎯" — fallback to token icon

  // Participants
  seller: string;               // wallet address

  // Asset
  asset_mint: string;
  asset_symbol: string | null;
  asset_amount: number;
  asset_decimals: number;

  // Economics
  multiplier_bps: number;
  pool_total_usdc: number;
  usdc_collected: number;
  fee_bps: number;
  min_probability_bps: number;

  // Probability tracking
  total_probability_sold_bps: number;
  position_count: number;

  // Vaults
  asset_vault: string | null;
  usdc_vault: string | null;

  // Timing (unix timestamps from on-chain)
  created_at: number;
  expires_at: number;
  filled_at: number;   // 0 if not yet filled; unix ts when pool hit 100%
  settled_at: number | null;

  // Settlement / VRF
  randomness_account: string | null;
  settlement_requested_slot: number | null;
  vrf_result_bps: number | null;
  vrf_slot: number | null;
  winner: string | null;

  // State machine
  state: PoolState;

  // Indexer
  indexed_at: string;
}

// ── Position (mirrors on-chain ProbabilityPosition) ──
export interface Position {
  id: string;

  // On-chain identity
  pool_id: number;
  position_pda: string;
  tx_signature: string | null;
  slot: number | null;

  // Participant
  buyer: string;               // wallet address

  // Position data
  position_index: number;
  probability_bps: number;
  usdc_paid: number;
  range_start_bps: number;
  range_end_bps: number;

  // Refund
  is_refunded: boolean;
  refund_tx: string | null;

  // Timing
  created_at: number;
  indexed_at: string;
}

// ── Event (indexed from Solana TX logs) ──
export type EventType =
  | "pool_created"
  | "probability_minted"
  | "settlement_requested"
  | "pool_settled"
  | "pool_expired"
  | "refund_claimed"
  | "asset_claimed_back";

export interface RafiEvent {
  id: string;
  pool_id: number;
  tx_signature: string;
  slot: number;
  event_type: EventType;
  actor: string;               // wallet that signed the TX
  data: Record<string, unknown>;
  created_at: number;
  indexed_at: string;
}

// ── Token Price Cache ──
export interface TokenPrice {
  symbol: string;
  mint_address: string;
  price_usd: number;
  updated_at: string;
}
