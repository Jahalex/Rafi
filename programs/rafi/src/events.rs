use anchor_lang::prelude::*;

/// ──────────────────────────────────────────────────────────────
/// RAFI Protocol Events — emitted for indexing & frontend
/// ──────────────────────────────────────────────────────────────

#[event]
pub struct PoolCreated {
    pub pool_id: u64,
    pub pool: Pubkey,
    pub seller: Pubkey,
    pub asset_mint: Pubkey,
    pub asset_amount: u64,
    pub multiplier_bps: u16,
    pub pool_total_usdc: u64,
    pub expires_at: i64,
}

#[event]
pub struct ProbabilityMinted {
    pub pool_id: u64,
    pub pool: Pubkey,
    pub buyer: Pubkey,
    pub position_index: u32,
    pub probability_bps: u16,
    pub usdc_paid: u64,
    pub range_start_bps: u16,
    pub range_end_bps: u16,
    pub pool_filled: bool,
}

#[event]
pub struct SettlementRequestedEvent {
    pub pool_id: u64,
    pub pool: Pubkey,
    pub randomness_account: Pubkey,
    pub requested_slot: u64,
    pub requester: Pubkey,
}

#[event]
pub struct PoolSettled {
    pub pool_id: u64,
    pub pool: Pubkey,
    pub winner: Pubkey,
    pub vrf_result_bps: u16,
    pub vrf_slot: u64,
    pub seller_usdc: u64,
    pub fee_usdc: u64,
    pub asset_amount: u64,
}

#[event]
pub struct PoolExpiredEvent {
    pub pool_id: u64,
    pub pool: Pubkey,
    pub probability_sold_bps: u16,
    pub usdc_collected: u64,
}

#[event]
pub struct RefundClaimed {
    pub pool_id: u64,
    pub pool: Pubkey,
    pub buyer: Pubkey,
    pub position_index: u32,
    pub usdc_refunded: u64,
}

#[event]
pub struct AssetReclaimed {
    pub pool_id: u64,
    pub pool: Pubkey,
    pub seller: Pubkey,
    pub asset_amount: u64,
}

/// VULN-14 FIX: Use u8 field_id instead of String for CU efficiency.
/// 0 = fee_bps, 1 = treasury, 2 = paused, 3 = unpaused, 4 = usdc_mint
#[event]
pub struct ProtocolUpdated {
    pub field_id: u8,
    pub authority: Pubkey,
}
