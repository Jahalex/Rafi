use anchor_lang::prelude::*;

/// ──────────────────────────────────────────────────────────────
/// RAFI Custom Errors
/// ──────────────────────────────────────────────────────────────
#[error_code]
pub enum RafiError {
    // ── Pool creation ────────────────────────────────────────
    #[msg("Multiplier must be between ×1.10 (11000 bps) and ×1.80 (18000 bps)")]
    MultiplierOutOfRange,

    #[msg("Minimum probability per buyer must be >= 10 bps (0.1%)")]
    MinProbabilityTooLow,

    #[msg("Minimum probability cannot exceed 100% (10000 bps)")]
    MinProbabilityTooHigh,

    #[msg("Pool duration out of allowed range")]
    InvalidPoolDuration,

    #[msg("Asset amount must be greater than zero")]
    ZeroAssetAmount,

    #[msg("Pool total USDC is below the minimum of 1 SOL equivalent")]
    PoolBelowMinimumValue,

    #[msg("Pyth price feed is stale — price too old or not available")]
    StalePriceFeed,

    #[msg("Pyth SOL/USD price is negative or zero — invalid")]
    InvalidPriceData,

    #[msg("USDC mint does not match official protocol USDC")]
    InvalidUsdcMint,

    // ── Minting probability ──────────────────────────────────
    #[msg("Pool is not open for participation")]
    PoolNotOpen,

    #[msg("Requested probability below pool minimum")]
    ProbabilityBelowMinimum,

    #[msg("Requested probability exceeds available remaining")]
    ProbabilityExceedsRemaining,

    #[msg("Single buyer cannot exceed 95% of a pool")]
    ExceedsMaxSingleBuyer,

    #[msg("Pool has expired")]
    PoolExpired,

    #[msg("Insufficient USDC payment")]
    InsufficientPayment,

    // ── Settlement ───────────────────────────────────────────
    #[msg("Pool is not fully filled (100%)")]
    PoolNotFilled,

    #[msg("Pool is not in SettlementRequested state")]
    SettlementNotRequested,

    #[msg("Invalid randomness — VRF result not yet available")]
    RandomnessNotResolved,

    #[msg("Winning position range does not contain VRF result")]
    InvalidWinnerPosition,

    #[msg("Settlement window expired — must re-request")]
    SettlementWindowExpired,

    #[msg("Pool filled less than 30 minutes ago — draw countdown not elapsed")]
    DrawCountdownNotElapsed,

    #[msg("Duplicate accounts passed — seller and treasury must differ")]
    DuplicateAccounts,

    // ── Refund ───────────────────────────────────────────────
    #[msg("Pool has not expired yet — cannot refund")]
    PoolNotExpired,

    #[msg("Pool was settled — cannot refund")]
    PoolAlreadySettled,

    #[msg("Position already refunded")]
    AlreadyRefunded,

    #[msg("Pool is already closed")]
    PoolAlreadyClosed,

    // ── General ──────────────────────────────────────────────
    #[msg("Protocol is paused")]
    ProtocolPaused,

    #[msg("Unauthorized signer")]
    Unauthorized,

    #[msg("Arithmetic overflow")]
    MathOverflow,

    #[msg("Invalid pool state for this operation")]
    InvalidPoolState,

    #[msg("Invalid Switchboard program ID")]
    InvalidSwitchboardProgram,

    #[msg("Invalid fee value")]
    InvalidFee,
}
