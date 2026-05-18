use anchor_lang::prelude::*;

/// ──────────────────────────────────────────────────────────────
/// Pool — core escrow PDA for a single probabilistic exchange.
/// Seeds: ["pool", seller, pool_id.to_le_bytes()]
/// ──────────────────────────────────────────────────────────────
#[account]
#[derive(InitSpace)]
pub struct Pool {
    // ── Identity ──────────────────────────────────────────────
    /// PDA bump seed.
    pub bump: u8,
    /// Unique sequential id assigned at creation.
    pub pool_id: u64,

    // ── Participants ──────────────────────────────────────────
    /// Seller who deposited the asset.
    pub seller: Pubkey,

    // ── Asset side ────────────────────────────────────────────
    /// SPL mint of the pooled asset (e.g. wBTC, wETH, SOL).
    pub asset_mint: Pubkey,
    /// Raw token amount locked in the asset vault.
    pub asset_amount: u64,
    /// Decimals of the asset mint (cached for display).
    pub asset_decimals: u8,

    // ── USDC side ─────────────────────────────────────────────
    /// USDC mint address (native Circle on Solana).
    pub usdc_mint: Pubkey,

    // ── Economics ──────────────────────────────────────────────
    /// Seller-chosen multiplier in bps (11 000 = ×1.10).
    pub multiplier_bps: u16,
    /// Total USDC target  =  asset_spot × multiplier.
    pub pool_total_usdc: u64,
    /// USDC collected so far.
    pub usdc_collected: u64,
    /// Protocol fee in bps at time of pool creation (snapshot).
    pub fee_bps: u16,

    // ── Probability tracking ─────────────────────────────────
    /// Minimum probability a buyer can mint, in bps (10 = 0.1 %).
    pub min_probability_bps: u16,
    /// Cumulative probability sold so far (max 10 000 = 100 %).
    pub total_probability_sold_bps: u16,
    /// Number of ProbabilityPosition accounts created.
    pub position_count: u32,

    // ── Vaults ────────────────────────────────────────────────
    /// PDA token account holding the locked asset.
    pub asset_vault: Pubkey,
    /// PDA token account holding accumulated USDC.
    pub usdc_vault: Pubkey,

    // ── Timing ────────────────────────────────────────────────
    /// Unix timestamp — pool creation.
    pub created_at: i64,
    /// Unix timestamp — pool expiry deadline (if never filled).
    pub expires_at: i64,
    /// Unix timestamp — when pool reached 100 % fill (0 if not yet filled).
    pub filled_at: i64,
    /// Unix timestamp — settlement (if settled).
    pub settled_at: i64,

    // ── Settlement ────────────────────────────────────────────
    /// Switchboard randomness account used for VRF.
    pub randomness_account: Pubkey,
    /// Slot at which settlement was requested (for window enforcement).
    pub settlement_requested_slot: u64,
    /// Raw VRF result bytes (set at settlement).
    pub vrf_result: [u8; 32],
    /// The mapped random value in [0, 10 000) bps.
    pub vrf_result_bps: u16,
    /// Slot at which VRF was consumed.
    pub vrf_slot: u64,
    /// Winner wallet (set at settlement).
    pub winner: Pubkey,

    // ── State machine ─────────────────────────────────────────
    pub state: PoolState,
}

/// Pool lifecycle states.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PoolState {
    /// Accepting buyer participation.
    Open,
    /// 100 % probability sold — awaiting VRF request.
    Filled,
    /// VRF randomness requested — awaiting oracle fulfillment.
    SettlementRequested,
    /// Asset distributed, USDC paid out, fees collected.
    Settled,
    /// Past expiry without reaching 100 % — refunds enabled.
    Expired,
    /// All claims processed — account can be closed for rent recovery.
    Closed,
}

impl Default for PoolState {
    fn default() -> Self {
        PoolState::Open
    }
}
