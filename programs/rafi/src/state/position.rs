use anchor_lang::prelude::*;

/// ──────────────────────────────────────────────────────────────
/// ProbabilityPosition — a buyer's stake in a specific pool.
/// Seeds: ["position", pool, position_index.to_le_bytes()]
/// ──────────────────────────────────────────────────────────────
#[account]
#[derive(InitSpace)]
pub struct ProbabilityPosition {
    /// PDA bump seed.
    pub bump: u8,

    /// Pool this position belongs to.
    pub pool: Pubkey,

    /// Buyer wallet.
    pub buyer: Pubkey,

    /// Sequential index within the pool (0-based).
    pub position_index: u32,

    /// Probability acquired in bps (100 bps = 1 %).
    pub probability_bps: u16,

    /// USDC paid for this position (lamports).
    pub usdc_paid: u64,

    /// Inclusive start of probability range [start, end).
    pub range_start_bps: u16,

    /// Exclusive end of probability range [start, end).
    pub range_end_bps: u16,

    /// Whether this position has been refunded.
    pub is_refunded: bool,

    /// Unix timestamp of creation.
    pub created_at: i64,
}
