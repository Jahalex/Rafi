use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::RafiError;
use crate::state::RafiProtocol;
use crate::events::ProtocolUpdated;

/// Admin instructions — all gated by protocol.authority

#[derive(Accounts)]
pub struct UpdateFee<'info> {
    #[account(mut, seeds = [SEED_PROTOCOL], bump = protocol.bump,
        constraint = protocol.authority == authority.key() @ RafiError::Unauthorized)]
    pub protocol: Account<'info, RafiProtocol>,
    pub authority: Signer<'info>,
}

pub fn handler_update_fee(ctx: Context<UpdateFee>, new_fee_bps: u16) -> Result<()> {
    require!(new_fee_bps <= MAX_FEE_BPS, RafiError::InvalidFee);
    ctx.accounts.protocol.fee_bps = new_fee_bps;
    emit!(ProtocolUpdated { field_id: 0, authority: ctx.accounts.authority.key() });
    msg!("Fee updated to {} bps", new_fee_bps);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateTreasury<'info> {
    #[account(mut, seeds = [SEED_PROTOCOL], bump = protocol.bump,
        constraint = protocol.authority == authority.key() @ RafiError::Unauthorized)]
    pub protocol: Account<'info, RafiProtocol>,
    pub authority: Signer<'info>,
}

pub fn handler_update_treasury(ctx: Context<UpdateTreasury>, new_treasury: Pubkey) -> Result<()> {
    ctx.accounts.protocol.treasury = new_treasury;
    emit!(ProtocolUpdated { field_id: 1, authority: ctx.accounts.authority.key() });
    msg!("Treasury updated to {}", new_treasury);
    Ok(())
}

#[derive(Accounts)]
pub struct PauseProtocol<'info> {
    #[account(mut, seeds = [SEED_PROTOCOL], bump = protocol.bump,
        constraint = protocol.authority == authority.key() @ RafiError::Unauthorized)]
    pub protocol: Account<'info, RafiProtocol>,
    pub authority: Signer<'info>,
}

pub fn handler_pause(ctx: Context<PauseProtocol>) -> Result<()> {
    ctx.accounts.protocol.is_paused = true;
    emit!(ProtocolUpdated { field_id: 2, authority: ctx.accounts.authority.key() });
    msg!("Protocol PAUSED");
    Ok(())
}

pub fn handler_unpause(ctx: Context<PauseProtocol>) -> Result<()> {
    ctx.accounts.protocol.is_paused = false;
    emit!(ProtocolUpdated { field_id: 3, authority: ctx.accounts.authority.key() });
    msg!("Protocol UNPAUSED");
    Ok(())
}
