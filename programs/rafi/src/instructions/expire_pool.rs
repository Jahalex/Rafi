use anchor_lang::prelude::*;
use crate::errors::RafiError;
use crate::constants::*;
use crate::state::{Pool, PoolState};
use crate::events::PoolExpiredEvent;

/// ──────────────────────────────────────────────────────────────
/// ExpirePool — mark a raffle pool as Expired, enabling refunds.
///
/// VULN-01 + VULN-02 FIXES:
/// - Open pools: expire when clock >= expires_at
/// - Filled pools: expire when clock >= expires_at + 24h grace
/// - SettlementRequested pools: expire when clock >= expires_at + 24h grace
///   (covers VRF failure, oracle downtime, missed draw window)
///
/// This ensures NO raffle pool can be stuck forever.
/// ──────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ExpirePool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    pub payer: Signer<'info>,
}

pub fn handler(ctx: Context<ExpirePool>) -> Result<()> {
    let clock = Clock::get()?;
    let pool = &mut ctx.accounts.pool;

    match pool.state {
        // Open pools: expire at deadline
        PoolState::Open => {
            require!(clock.unix_timestamp >= pool.expires_at, RafiError::PoolNotExpired);
        },
        // Filled or SettlementRequested: expire after grace period
        // This prevents permanent fund locking (VULN-01 + VULN-02)
        PoolState::Filled | PoolState::SettlementRequested => {
            let grace_deadline = pool.expires_at
                .checked_add(FILLED_GRACE_PERIOD_SECS)
                .ok_or(RafiError::MathOverflow)?;
            require!(clock.unix_timestamp >= grace_deadline, RafiError::PoolNotExpired);
        },
        // Already terminal states — cannot expire
        _ => {
            return Err(error!(RafiError::InvalidPoolState));
        }
    }

    pool.state = PoolState::Expired;

    emit!(PoolExpiredEvent {
        pool_id: pool.pool_id,
        pool: pool.key(),
        probability_sold_bps: pool.total_probability_sold_bps,
        usdc_collected: pool.usdc_collected,
    });

    msg!("Pool #{} EXPIRED — {} bps sold, {} USDC to refund",
        pool.pool_id, pool.total_probability_sold_bps, pool.usdc_collected);
    Ok(())
}
