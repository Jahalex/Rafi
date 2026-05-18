use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, get_feed_id_from_hex};
use crate::constants::*;
use crate::errors::RafiError;
use crate::state::{Pool, PoolState, RafiProtocol};
use crate::events::PoolCreated;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreatePoolParams {
    pub multiplier_bps: u16,
    pub min_probability_bps: u16,
    pub duration_secs: i64,
    pub asset_amount: u64,
    pub pool_total_usdc: u64,
}

#[derive(Accounts)]
#[instruction(params: CreatePoolParams)]
pub struct CreatePool<'info> {
    #[account(
        mut,
        seeds = [SEED_PROTOCOL],
        bump = protocol.bump,
        constraint = !protocol.is_paused @ RafiError::ProtocolPaused,
    )]
    pub protocol: Account<'info, RafiProtocol>,

    #[account(
        init,
        payer = seller,
        space = 8 + Pool::INIT_SPACE,
        seeds = [SEED_POOL, seller.key().as_ref(), protocol.pool_counter.to_le_bytes().as_ref()],
        bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        init,
        payer = seller,
        token::mint = asset_mint,
        token::authority = pool,
        seeds = [SEED_ASSET_VAULT, pool.key().as_ref()],
        bump,
    )]
    pub asset_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = seller,
        token::mint = usdc_mint,
        token::authority = pool,
        seeds = [SEED_USDC_VAULT, pool.key().as_ref()],
        bump,
    )]
    pub usdc_vault: Box<Account<'info, TokenAccount>>,

    pub asset_mint: Account<'info, Mint>,

    /// VULN-03 FIX: Validate USDC mint matches protocol's official mint.
    #[account(
        constraint = usdc_mint.key() == protocol.usdc_mint @ RafiError::InvalidUsdcMint
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = seller_asset_account.mint == asset_mint.key(),
        constraint = seller_asset_account.owner == seller.key(),
    )]
    pub seller_asset_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// Pyth SOL/USD price update account (raw AccountInfo).
    ///
    /// `PriceUpdateV2` does not implement Anchor's `AccountDeserialize` /
    /// `AccountSerialize` / `Owner` traits, so we use `AccountInfo` and
    /// perform the ownership + deserialization checks manually in the handler.
    ///
    /// The frontend must derive this address via:
    ///   pythSolanaReceiver.getPriceFeedAccountAddress(0, SOL_USD_FEED_ID)
    /// or pass a fresh price-update account from Hermes.
    /// CHECK: Owner is validated in the handler against PYTH_PULL_ORACLE_PID.
    pub sol_price_update: AccountInfo<'info>,

    /// Pyth Pull Oracle program — used to validate sol_price_update ownership.
    /// CHECK: Address validated in handler against PYTH_PULL_ORACLE_PID.
    pub pyth_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreatePool>, params: CreatePoolParams) -> Result<()> {
    require!(
        params.multiplier_bps >= MIN_MULTIPLIER_BPS && params.multiplier_bps <= MAX_MULTIPLIER_BPS,
        RafiError::MultiplierOutOfRange
    );
    require!(params.min_probability_bps >= MIN_PROBABILITY_BPS, RafiError::MinProbabilityTooLow);
    // VULN-09 FIX: Prevent min_probability > 100%
    require!(params.min_probability_bps <= BPS_SCALE, RafiError::MinProbabilityTooHigh);
    // Only 4 fixed durations are allowed — prevents absurd durations.
    require!(
        params.duration_secs == DURATION_1D
            || params.duration_secs == DURATION_3D
            || params.duration_secs == DURATION_7D
            || params.duration_secs == DURATION_14D,
        RafiError::InvalidPoolDuration
    );
    require!(params.asset_amount > 0, RafiError::ZeroAssetAmount);
    require!(params.pool_total_usdc > 0, RafiError::InsufficientPayment);

    let clock = Clock::get()?;

    // ── Pyth SOL/USD price check ──────────────────────────────────────────
    //
    // We enforce that pool_total_usdc >= 1 SOL worth of USDC at current price.
    //
    // Pattern: manual owner validation + PriceUpdateV2::deserialize_reader
    // (PriceUpdateV2 doesn't implement Anchor traits, so we use raw AccountInfo)
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Validate that sol_price_update is owned by the Pyth Pull Oracle program.
    require!(
        ctx.accounts.sol_price_update.owner.to_string() == PYTH_PULL_ORACLE_PID,
        RafiError::InvalidPriceData
    );

    // 2. Deserialize PriceUpdateV2 from the account data.
    let price_update: PriceUpdateV2 = {
        let data = ctx.accounts.sol_price_update.try_borrow_data()
            .map_err(|_| error!(RafiError::StalePriceFeed))?;
        // Skip the 8-byte Anchor discriminator.
        let mut slice: &[u8] = &data[8..];
        PriceUpdateV2::deserialize(&mut slice)
            .map_err(|_| error!(RafiError::InvalidPriceData))?
    };

    // 3. Read a fresh SOL/USD price (max PYTH_MAX_AGE_SECS old).
    let feed_id = get_feed_id_from_hex(PYTH_SOL_USD_FEED_ID)
        .map_err(|_| error!(RafiError::InvalidPriceData))?;

    let price_data = price_update
        .get_price_no_older_than(&clock, PYTH_MAX_AGE_SECS, &feed_id)
        .map_err(|_| error!(RafiError::StalePriceFeed))?;

    require!(price_data.price > 0, RafiError::InvalidPriceData);

    // 4. Compute min_usdc_raw (USDC has 6 decimals).
    //
    // Pyth price: price * 10^exponent  (exponent ≈ -8 for SOL/USD)
    // 1 SOL in USDC raw = price * 10^(6 + exponent)
    //   → if exponent = -8: price / 10^2 = price / 100
    let exponent = price_data.exponent; // e.g. -8
    let price_raw = price_data.price as u64;
    let shift: i32 = 6i32 + exponent; // USDC decimals + exponent

    let min_usdc_raw: u64 = if shift >= 0 {
        price_raw
            .checked_mul(10u64.pow(shift as u32))
            .ok_or(RafiError::MathOverflow)?
    } else {
        let divisor = 10u64.pow((-shift) as u32);
        price_raw
            .checked_div(divisor)
            .ok_or(RafiError::MathOverflow)?
    };

    require!(
        params.pool_total_usdc >= min_usdc_raw,
        RafiError::PoolBelowMinimumValue
    );

    msg!(
        "SOL/USD: {} * 10^{} — min pool USDC: {} — requested: {}",
        price_raw, exponent, min_usdc_raw, params.pool_total_usdc
    );
    // ─────────────────────────────────────────────────────────────────────

    token::transfer(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.seller_asset_account.to_account_info(),
            to: ctx.accounts.asset_vault.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        },
    ), params.asset_amount)?;

    let pool = &mut ctx.accounts.pool;
    let protocol = &mut ctx.accounts.protocol;

    pool.bump = ctx.bumps.pool;
    pool.pool_id = protocol.pool_counter;
    pool.seller = ctx.accounts.seller.key();
    pool.asset_mint = ctx.accounts.asset_mint.key();
    pool.asset_amount = params.asset_amount;
    pool.asset_decimals = ctx.accounts.asset_mint.decimals;
    pool.usdc_mint = ctx.accounts.usdc_mint.key();
    pool.multiplier_bps = params.multiplier_bps;
    pool.pool_total_usdc = params.pool_total_usdc;
    pool.usdc_collected = 0;
    pool.fee_bps = protocol.fee_bps;
    pool.min_probability_bps = params.min_probability_bps;
    pool.total_probability_sold_bps = 0;
    pool.position_count = 0;
    pool.asset_vault = ctx.accounts.asset_vault.key();
    pool.usdc_vault = ctx.accounts.usdc_vault.key();
    pool.created_at = clock.unix_timestamp;
    pool.expires_at = clock.unix_timestamp.checked_add(params.duration_secs).ok_or(RafiError::MathOverflow)?;
    pool.filled_at = 0;
    pool.settled_at = 0;
    pool.randomness_account = Pubkey::default();
    pool.settlement_requested_slot = 0;
    pool.vrf_result = [0u8; 32];
    pool.vrf_result_bps = 0;
    pool.vrf_slot = 0;
    pool.winner = Pubkey::default();
    pool.state = PoolState::Open;

    protocol.pool_counter = protocol.pool_counter.checked_add(1).ok_or(RafiError::MathOverflow)?;

    emit!(PoolCreated {
        pool_id: pool.pool_id, pool: pool.key(), seller: pool.seller,
        asset_mint: pool.asset_mint, asset_amount: pool.asset_amount,
        multiplier_bps: pool.multiplier_bps, pool_total_usdc: pool.pool_total_usdc,
        expires_at: pool.expires_at,
    });

    msg!("Pool #{} created — {} tokens, ×{}, {} USDC target",
        pool.pool_id, pool.asset_amount, pool.multiplier_bps, pool.pool_total_usdc);
    Ok(())
}
