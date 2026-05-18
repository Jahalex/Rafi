use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::RafiError;
use crate::state::RafiProtocol;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProtocolParams {
    pub treasury: Pubkey,
    pub usdc_mint: Pubkey,
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + RafiProtocol::INIT_SPACE,
        seeds = [SEED_PROTOCOL],
        bump,
    )]
    pub protocol: Account<'info, RafiProtocol>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeProtocol>, params: InitializeProtocolParams) -> Result<()> {
    let protocol = &mut ctx.accounts.protocol;
    protocol.bump = ctx.bumps.protocol;
    protocol.authority = ctx.accounts.authority.key();
    protocol.treasury = params.treasury;
    protocol.usdc_mint = params.usdc_mint;
    protocol.fee_bps = DEFAULT_FEE_BPS;
    protocol.pool_counter = 0;
    protocol.total_volume_usdc = 0;
    protocol.total_fees_collected = 0;
    protocol.is_paused = false;

    msg!("RAFI Protocol initialized — treasury: {}, usdc_mint: {}", params.treasury, params.usdc_mint);
    Ok(())
}
