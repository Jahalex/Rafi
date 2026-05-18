use anchor_lang::prelude::*;

/// ──────────────────────────────────────────────────────────────
/// Global protocol singleton — tracks counters, fees, admin.
/// Seeds: ["rafi_protocol"]
/// ──────────────────────────────────────────────────────────────
#[account]
#[derive(InitSpace)]
pub struct RafiProtocol {
    /// PDA bump seed.
    pub bump: u8,

    /// Multisig authority that can update fee or pause.
    pub authority: Pubkey,

    /// Treasury wallet that receives protocol fees.
    pub treasury: Pubkey,

    /// Official USDC mint address (hardened against fake mints — VULN-03).
    pub usdc_mint: Pubkey,

    /// Protocol fee in bps (default 600 = 6 %).
    pub fee_bps: u16,

    /// Auto-incrementing pool counter (used as pool-id seed).
    pub pool_counter: u64,

    /// Lifetime settled volume in USDC lamports.
    pub total_volume_usdc: u64,

    /// Lifetime fees collected in USDC lamports.
    pub total_fees_collected: u64,

    /// Emergency pause flag.
    pub is_paused: bool,
}
