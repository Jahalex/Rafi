use anchor_lang::prelude::*;
use switchboard_on_demand::prelude::RandomnessCommit;
use crate::errors::RafiError;
use crate::constants::*;
use crate::state::{Pool, PoolState};
use crate::events::SettlementRequestedEvent;

#[derive(Accounts)]
pub struct RequestSettlement<'info> {
    #[account(mut, constraint = pool.state == PoolState::Filled @ RafiError::PoolNotFilled)]
    pub pool: Account<'info, Pool>,
    /// CHECK: Validated by Switchboard CPI.
    #[account(mut)]
    pub randomness_account: AccountInfo<'info>,
    /// CHECK: Validated by Switchboard CPI.
    pub queue: AccountInfo<'info>,
    /// CHECK: Validated by Switchboard CPI.
    #[account(mut)]
    pub oracle: AccountInfo<'info>,
    /// CHECK: address verified.
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub recent_slothashes: AccountInfo<'info>,
    /// CHECK: Program ID validated below.
    pub switchboard_program: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestSettlement>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let clock = Clock::get()?;

    // MED-1 FIX: Validate Switchboard program ID
    let sb_key = ctx.accounts.switchboard_program.key().to_string();
    require!(
        sb_key == SB_ON_DEMAND_PID_DEVNET || sb_key == SB_ON_DEMAND_PID_MAINNET,
        RafiError::InvalidSwitchboardProgram
    );

    // ── Enforce 30-min countdown post-fill ──
    // Prevents immediate settlement right after the last buyer enters.
    let draw_available_at = pool.filled_at
        .checked_add(FILLED_COUNTDOWN_SECS)
        .ok_or(RafiError::MathOverflow)?;
    require!(
        clock.unix_timestamp >= draw_available_at,
        RafiError::DrawCountdownNotElapsed
    );

    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let pool_seeds: &[&[&[u8]]] = &[&[
        SEED_POOL, pool.seller.as_ref(), pool_id_bytes.as_ref(), &[pool.bump],
    ]];

    RandomnessCommit::invoke(
        ctx.accounts.switchboard_program.to_account_info(),
        ctx.accounts.randomness_account.to_account_info(),
        ctx.accounts.queue.to_account_info(),
        ctx.accounts.oracle.to_account_info(),
        ctx.accounts.pool.to_account_info(),
        ctx.accounts.recent_slothashes.to_account_info(),
        pool_seeds,
    ).map_err(|_| error!(RafiError::RandomnessNotResolved))?;

    let pool = &mut ctx.accounts.pool;
    pool.randomness_account = ctx.accounts.randomness_account.key();
    pool.settlement_requested_slot = clock.slot;
    pool.state = PoolState::SettlementRequested;

    emit!(SettlementRequestedEvent {
        pool_id: pool.pool_id,
        pool: pool.key(),
        randomness_account: pool.randomness_account,
        requested_slot: clock.slot,
        requester: ctx.accounts.payer.key(),
    });

    msg!("Pool #{} — settlement requested at slot {}", pool.pool_id, clock.slot);
    Ok(())
}
