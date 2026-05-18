use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::constants::*;
use crate::errors::RafiError;
use crate::state::{Pool, PoolState};
use crate::events::AssetReclaimed;

/// CRIT-2 FIX: Transitions pool → Closed after claim to prevent double-claim.

#[derive(Accounts)]
pub struct ClaimAssetBack<'info> {
    #[account(
        mut,
        constraint = pool.state == PoolState::Expired @ RafiError::InvalidPoolState,
        constraint = pool.seller == seller.key() @ RafiError::Unauthorized,
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut, constraint = asset_vault.key() == pool.asset_vault)]
    pub asset_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = seller_asset_account.mint == pool.asset_mint, constraint = seller_asset_account.owner == seller.key())]
    pub seller_asset_account: Account<'info, TokenAccount>,
    pub seller: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimAssetBack>) -> Result<()> {
    let pool = &ctx.accounts.pool;

    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let pool_seeds: &[&[u8]] = &[
        SEED_POOL, pool.seller.as_ref(), pool_id_bytes.as_ref(), &[pool.bump],
    ];

    token::transfer(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.asset_vault.to_account_info(),
            to: ctx.accounts.seller_asset_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        &[pool_seeds],
    ), pool.asset_amount)?;

    // CRIT-2 FIX: Transition to Closed — prevents double-claim
    let pool = &mut ctx.accounts.pool;
    pool.state = PoolState::Closed;

    emit!(AssetReclaimed {
        pool_id: pool.pool_id,
        pool: pool.key(),
        seller: pool.seller,
        asset_amount: pool.asset_amount,
    });

    msg!("Pool #{} — asset returned, pool CLOSED", pool.pool_id);
    Ok(())
}
