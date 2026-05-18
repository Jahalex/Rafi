use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::RafiError;
use crate::state::{Pool, PoolState, ProbabilityPosition};
use crate::events::RefundClaimed;

/// ──────────────────────────────────────────────────────────────
/// ClaimRefund — buyer reclaims USDC from an expired raffle pool.
///
/// VULN-08 FIX: Accepts both Expired AND Closed states.
/// The seller calling claim_asset_back (→ Closed) must NOT
/// block buyers from getting their USDC refunds.
/// ──────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        constraint = (pool.state == PoolState::Expired || pool.state == PoolState::Closed)
            @ RafiError::PoolAlreadySettled
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        constraint = position.pool == pool.key(),
        constraint = position.buyer == buyer.key() @ RafiError::Unauthorized,
        constraint = !position.is_refunded @ RafiError::AlreadyRefunded,
    )]
    pub position: Account<'info, ProbabilityPosition>,
    #[account(mut, constraint = usdc_vault.key() == pool.usdc_vault)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = buyer_usdc_account.mint == pool.usdc_mint, constraint = buyer_usdc_account.owner == buyer.key())]
    pub buyer_usdc_account: Account<'info, TokenAccount>,
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let position = &ctx.accounts.position;

    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let pool_seeds: &[&[u8]] = &[
        SEED_POOL, pool.seller.as_ref(), pool_id_bytes.as_ref(), &[pool.bump],
    ];

    token::transfer(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.usdc_vault.to_account_info(),
            to: ctx.accounts.buyer_usdc_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        &[pool_seeds],
    ), position.usdc_paid)?;

    let position = &mut ctx.accounts.position;
    position.is_refunded = true;

    emit!(RefundClaimed {
        pool_id: pool.pool_id, pool: pool.key(), buyer: position.buyer,
        position_index: position.position_index, usdc_refunded: position.usdc_paid,
    });

    msg!("Position #{} refunded — {} USDC to {}", position.position_index, position.usdc_paid, position.buyer);
    Ok(())
}
