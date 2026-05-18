use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::RafiError;
use crate::state::{Pool, PoolState, ProbabilityPosition, RafiProtocol};
use crate::events::ProbabilityMinted;

/// ──────────────────────────────────────────────────────────────
/// MintProbability — a buyer enters a raffle pool by purchasing
/// a probability share (% chance of winning the escrowed asset).
///
/// Technical: the multiplier is the natural cap — buying 99% at
/// ×1.4 costs more than the asset, making it irrational.
/// ──────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MintProbabilityParams {
    /// Probability to acquire in bps (100 = 1 %).
    pub probability_bps: u16,
}

#[derive(Accounts)]
#[instruction(params: MintProbabilityParams)]
pub struct MintProbability<'info> {
    // ── Protocol (for pause check — GAP-4 FIX) ──
    #[account(
        seeds = [SEED_PROTOCOL],
        bump = protocol.bump,
        constraint = !protocol.is_paused @ RafiError::ProtocolPaused,
    )]
    pub protocol: Account<'info, RafiProtocol>,

    // ── Pool ──
    #[account(
        mut,
        constraint = pool.state == PoolState::Open @ RafiError::PoolNotOpen,
    )]
    pub pool: Account<'info, Pool>,

    // ── Position PDA (created per purchase) ──
    #[account(
        init,
        payer = buyer,
        space = 8 + ProbabilityPosition::INIT_SPACE,
        seeds = [
            SEED_POSITION,
            pool.key().as_ref(),
            pool.position_count.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub position: Account<'info, ProbabilityPosition>,

    // ── USDC vault owned by pool PDA ──
    #[account(
        mut,
        constraint = usdc_vault.key() == pool.usdc_vault,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    // ── Buyer's USDC source ──
    #[account(
        mut,
        constraint = buyer_usdc_account.mint == pool.usdc_mint,
        constraint = buyer_usdc_account.owner == buyer.key(),
    )]
    pub buyer_usdc_account: Account<'info, TokenAccount>,

    // ── Buyer ──
    #[account(mut)]
    pub buyer: Signer<'info>,

    // ── Programs ──
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MintProbability>, params: MintProbabilityParams) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let clock = Clock::get()?;

    // ── Check expiry ──
    require!(clock.unix_timestamp < pool.expires_at, RafiError::PoolExpired);

    // ── Validate probability amount ──
    require!(
        params.probability_bps >= pool.min_probability_bps,
        RafiError::ProbabilityBelowMinimum
    );

    // Note: No MAX_SINGLE_BUYER_BPS cap.
    // Per whitepaper §3: "The multiplier is the natural deterrent."
    // At ×1.4, buying 100% costs 140% of asset value → net loss.

    let remaining_bps = BPS_SCALE
        .checked_sub(pool.total_probability_sold_bps)
        .ok_or(RafiError::MathOverflow)?;

    require!(
        params.probability_bps <= remaining_bps,
        RafiError::ProbabilityExceedsRemaining
    );

    // ── Compute USDC cost ──
    let cost_usdc: u64 = (pool.pool_total_usdc as u128)
        .checked_mul(params.probability_bps as u128)
        .ok_or(RafiError::MathOverflow)?
        .checked_div(BPS_SCALE as u128)
        .ok_or(RafiError::MathOverflow)? as u64;

    require!(cost_usdc > 0, RafiError::InsufficientPayment);

    // ── Transfer USDC from buyer → pool vault ──
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer_usdc_account.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        cost_usdc,
    )?;

    // ── Create position ──
    let pool = &mut ctx.accounts.pool;
    let position = &mut ctx.accounts.position;

    let range_start = pool.total_probability_sold_bps;
    let range_end = range_start
        .checked_add(params.probability_bps)
        .ok_or(RafiError::MathOverflow)?;

    position.bump = ctx.bumps.position;
    position.pool = pool.key();
    position.buyer = ctx.accounts.buyer.key();
    position.position_index = pool.position_count;
    position.probability_bps = params.probability_bps;
    position.usdc_paid = cost_usdc;
    position.range_start_bps = range_start;
    position.range_end_bps = range_end;
    position.is_refunded = false;
    position.created_at = clock.unix_timestamp;

    // ── Update pool accumulators ──
    pool.total_probability_sold_bps = range_end;
    pool.usdc_collected = pool
        .usdc_collected
        .checked_add(cost_usdc)
        .ok_or(RafiError::MathOverflow)?;
    pool.position_count = pool
        .position_count
        .checked_add(1)
        .ok_or(RafiError::MathOverflow)?;

    // ── Auto-transition to Filled if 100 % ──
    if pool.total_probability_sold_bps == BPS_SCALE {
        pool.state = PoolState::Filled;
        pool.filled_at = clock.unix_timestamp;
        msg!("Pool #{} fully filled at {} — draw in 30 min", pool.pool_id, clock.unix_timestamp);
    }

    // ── Emit event ──
    emit!(ProbabilityMinted {
        pool_id: pool.pool_id,
        pool: pool.key(),
        buyer: position.buyer,
        position_index: position.position_index,
        probability_bps: position.probability_bps,
        usdc_paid: cost_usdc,
        range_start_bps: position.range_start_bps,
        range_end_bps: position.range_end_bps,
        pool_filled: pool.total_probability_sold_bps == BPS_SCALE,
    });

    msg!(
        "Position #{} minted — {} bps for {} USDC — pool now at {} / {} bps",
        position.position_index,
        position.probability_bps,
        cost_usdc,
        pool.total_probability_sold_bps,
        BPS_SCALE,
    );

    Ok(())
}
