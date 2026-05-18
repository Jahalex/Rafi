use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use switchboard_on_demand::RandomnessAccountData;
use crate::constants::*;
use crate::errors::RafiError;
use crate::state::{Pool, PoolState, ProbabilityPosition, RafiProtocol};
use crate::events::PoolSettled;

/// ──────────────────────────────────────────────────────────────
/// SettlePool — Consume VRF randomness, verify winning position,
/// and execute atomic 3-way distribution: asset → winner,
/// USDC → seller, fee → treasury.
/// This is the provably-fair draw that concludes the raffle.
/// ──────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct SettlePool<'info> {
    #[account(mut, seeds = [SEED_PROTOCOL], bump = protocol.bump)]
    pub protocol: Account<'info, RafiProtocol>,
    #[account(mut, constraint = pool.state == PoolState::SettlementRequested @ RafiError::SettlementNotRequested)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(constraint = winning_position.pool == pool.key())]
    pub winning_position: Box<Account<'info, ProbabilityPosition>>,
    /// CHECK: Parsed via RandomnessAccountData::parse().
    #[account(constraint = randomness_account.key() == pool.randomness_account @ RafiError::InvalidPoolState)]
    pub randomness_account: AccountInfo<'info>,
    #[account(mut, constraint = asset_vault.key() == pool.asset_vault)]
    pub asset_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = winner_asset_account.mint == pool.asset_mint,
        constraint = winner_asset_account.owner == winning_position.buyer)]
    pub winner_asset_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = usdc_vault.key() == pool.usdc_vault)]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = seller_usdc_account.mint == pool.usdc_mint,
        constraint = seller_usdc_account.owner == pool.seller)]
    pub seller_usdc_account: Box<Account<'info, TokenAccount>>,
    /// VULN-10 FIX: Ensure treasury != seller account.
    #[account(mut, constraint = treasury_usdc_account.mint == pool.usdc_mint,
        constraint = treasury_usdc_account.owner == protocol.treasury,
        constraint = treasury_usdc_account.key() != seller_usdc_account.key() @ RafiError::DuplicateAccounts)]
    pub treasury_usdc_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SettlePool>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let clock = Clock::get()?;

    // CRIT-1: Enforce settlement window
    let slots_elapsed = clock.slot.saturating_sub(pool.settlement_requested_slot);
    require!(slots_elapsed <= MAX_SETTLEMENT_WINDOW_SLOTS, RafiError::SettlementWindowExpired);

    // 1. Consume Switchboard VRF
    let randomness_data = RandomnessAccountData::parse(
        ctx.accounts.randomness_account.data.borrow()
    ).map_err(|_| error!(RafiError::RandomnessNotResolved))?;

    let vrf_bytes = randomness_data
        .get_value(clock.slot)
        .map_err(|_| error!(RafiError::RandomnessNotResolved))?;

    let vrf_u32 = u32::from_le_bytes([vrf_bytes[0], vrf_bytes[1], vrf_bytes[2], vrf_bytes[3]]);
    let vrf_bps = (vrf_u32 % (BPS_SCALE as u32)) as u16;

    // 2. Verify winning position
    let position = &ctx.accounts.winning_position;
    require!(
        vrf_bps >= position.range_start_bps && vrf_bps < position.range_end_bps,
        RafiError::InvalidWinnerPosition
    );

    // 3. VULN-04 FIX: Use actual vault balance, not internal counter
    let total_usdc = ctx.accounts.usdc_vault.amount;
    let fee_amount: u64 = (total_usdc as u128)
        .checked_mul(pool.fee_bps as u128).ok_or(RafiError::MathOverflow)?
        .checked_div(BPS_SCALE as u128).ok_or(RafiError::MathOverflow)? as u64;
    let seller_amount = total_usdc.checked_sub(fee_amount).ok_or(RafiError::MathOverflow)?;

    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let pool_seeds: &[&[u8]] = &[
        SEED_POOL, pool.seller.as_ref(), pool_id_bytes.as_ref(), &[pool.bump],
    ];

    // 4. ATOMIC DISTRIBUTION — 3 transfers in single tx
    token::transfer(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.asset_vault.to_account_info(),
            to: ctx.accounts.winner_asset_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        &[pool_seeds],
    ), pool.asset_amount)?;

    token::transfer(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.usdc_vault.to_account_info(),
            to: ctx.accounts.seller_usdc_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        &[pool_seeds],
    ), seller_amount)?;

    token::transfer(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.usdc_vault.to_account_info(),
            to: ctx.accounts.treasury_usdc_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        &[pool_seeds],
    ), fee_amount)?;

    // 5. Finalize
    let pool = &mut ctx.accounts.pool;
    pool.vrf_result = vrf_bytes;
    pool.vrf_result_bps = vrf_bps;
    pool.vrf_slot = clock.slot;
    pool.winner = position.buyer;
    pool.settled_at = clock.unix_timestamp;
    pool.state = PoolState::Settled;

    let protocol = &mut ctx.accounts.protocol;
    protocol.total_volume_usdc = protocol.total_volume_usdc.checked_add(total_usdc).ok_or(RafiError::MathOverflow)?;
    protocol.total_fees_collected = protocol.total_fees_collected.checked_add(fee_amount).ok_or(RafiError::MathOverflow)?;

    emit!(PoolSettled {
        pool_id: pool.pool_id, pool: pool.key(), winner: pool.winner,
        vrf_result_bps: vrf_bps, vrf_slot: clock.slot,
        seller_usdc: seller_amount, fee_usdc: fee_amount, asset_amount: pool.asset_amount,
    });

    msg!("Pool #{} SETTLED — VRF: {} bps — Winner: {}", pool.pool_id, vrf_bps, pool.winner);
    Ok(())
}
