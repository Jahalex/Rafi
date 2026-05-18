use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg");

/// ──────────────────────────────────────────────────────────────
/// RAFI — The Probabilistic Exchange Protocol
/// ──────────────────────────────────────────────────────────────
#[program]
pub mod rafi {
    use super::*;

    /// Bootstrap the global protocol singleton (one-time).
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        params: InitializeProtocolParams,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(ctx, params)
    }

    /// Seller deposits an asset and opens a new pool.
    pub fn create_pool(
        ctx: Context<CreatePool>,
        params: CreatePoolParams,
    ) -> Result<()> {
        instructions::create_pool::handler(ctx, params)
    }

    /// Buyer mints a probability position by paying USDC.
    pub fn mint_probability(
        ctx: Context<MintProbability>,
        params: MintProbabilityParams,
    ) -> Result<()> {
        instructions::mint_probability::handler(ctx, params)
    }

    /// Commit to Switchboard VRF randomness (permissionless).
    pub fn request_settlement(ctx: Context<RequestSettlement>) -> Result<()> {
        instructions::request_settlement::handler(ctx)
    }

    /// Consume VRF, verify winner, distribute atomically (permissionless).
    pub fn settle_pool(ctx: Context<SettlePool>) -> Result<()> {
        instructions::settle_pool::handler(ctx)
    }

    /// Mark an unfilled pool as expired after its deadline (permissionless).
    pub fn expire_pool(ctx: Context<ExpirePool>) -> Result<()> {
        instructions::expire_pool::handler(ctx)
    }

    /// Buyer reclaims USDC from an expired pool.
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handler(ctx)
    }

    /// Seller reclaims their asset from an expired pool.
    pub fn claim_asset_back(ctx: Context<ClaimAssetBack>) -> Result<()> {
        instructions::claim_asset_back::handler(ctx)
    }

    // ── Admin ──

    /// Update protocol fee (authority only, max 10%).
    pub fn update_fee(ctx: Context<UpdateFee>, new_fee_bps: u16) -> Result<()> {
        instructions::admin::handler_update_fee(ctx, new_fee_bps)
    }

    /// Update treasury address (authority only).
    pub fn update_treasury(ctx: Context<UpdateTreasury>, new_treasury: Pubkey) -> Result<()> {
        instructions::admin::handler_update_treasury(ctx, new_treasury)
    }

    /// Emergency pause (authority only).
    pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::admin::handler_pause(ctx)
    }

    /// Resume after pause (authority only).
    pub fn unpause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::admin::handler_unpause(ctx)
    }
}
