/// ──────────────────────────────────────────────────────────────
/// RAFI Protocol Constants
/// ──────────────────────────────────────────────────────────────

/// Basis-point scale: 10 000 bps = 100%.
pub const BPS_SCALE: u16 = 10_000;

/// ── Pyth Oracle ──────────────────────────────────────────────
/// SOL/USD price feed ID (same on devnet & mainnet).
/// Verified: https://hermes.pyth.network/v2/updates/price/latest?ids[]=ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
pub const PYTH_SOL_USD_FEED_ID: &str =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

/// Pyth Pull Oracle program ID — same address on devnet and mainnet.
/// Source: https://docs.pyth.network/price-feeds/contract-addresses/solana
pub const PYTH_PULL_ORACLE_PID: &str = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";

/// Maximum age of the Pyth price update accepted during pool creation.
/// 60 seconds — enough for normal network conditions, tight enough to
/// prevent stale-price attacks.
pub const PYTH_MAX_AGE_SECS: u64 = 60;

/// Minimum pool asset value: 1 SOL (in micro-lamport-equivalent).
/// The on-chain check converts this to USDC using the live Pyth price.
/// 1_000_000_000 = 1 SOL in lamports, used as the human reference unit.
pub const MIN_POOL_SOL_EQUIVALENT: u64 = 1_000_000_000; // 1 SOL

/// ── Multiplier bounds (in bps where 10 000 = ×1.0) ──────────
/// ×1.10
pub const MIN_MULTIPLIER_BPS: u16 = 11_000;
/// ×1.80
pub const MAX_MULTIPLIER_BPS: u16 = 18_000;

/// ── Protocol fee ─────────────────────────────────────────────
/// 5 % = 500 bps (seller keeps 95 %)
pub const DEFAULT_FEE_BPS: u16 = 600;
/// Max fee the admin can set: 10 % = 1000 bps
pub const MAX_FEE_BPS: u16 = 1_000;

/// ── Minimum pool asset value ──────────────────────────────────
/// A pool cannot be created if the asset is worth less than this
/// in USDC (6 decimals). Default = $150 ≈ 1 SOL at ~$150/SOL.
/// Admin can update via UpdateMinAsset to track SOL price.
pub const DEFAULT_MIN_ASSET_USDC_VALUE: u64 = 150_000_000; // $150

/// ── Probability bounds ──────────────────────────────────────
/// Smallest slice a buyer can mint: 0.1 % = 10 bps
pub const MIN_PROBABILITY_BPS: u16 = 10;

/// ── Pool duration — fixed allowed values only ────────────────
/// Sellers choose from exactly these four options (in seconds).
pub const DURATION_1D:  i64 = 86_400;          //  1 day
pub const DURATION_3D:  i64 = 3 * 86_400;      //  3 days
pub const DURATION_7D:  i64 = 7 * 86_400;      //  7 days
pub const DURATION_14D: i64 = 14 * 86_400;     // 14 days

/// ── Filled → Draw countdown ──────────────────────────────────
/// After a pool reaches 100 %, settlement cannot be requested
/// before this delay has elapsed (gives time for VRF oracle to
/// prepare and prevents instant manipulation).
/// 30 minutes = 1 800 seconds.
pub const FILLED_COUNTDOWN_SECS: i64 = 1_800;

/// ── VRF Settlement ───────────────────────────────────────────
/// Maximum slots between request_settlement and settle_pool.
/// ~150 slots ≈ 60 seconds at 400ms/slot.
pub const MAX_SETTLEMENT_WINDOW_SLOTS: u64 = 150;

/// Grace period after expiry for Filled pools (VULN-02).
/// 24 hours — if a Filled pool hasn't been settled 24h after
/// its expires_at, anyone can expire it for refunds.
pub const FILLED_GRACE_PERIOD_SECS: i64 = 86_400;

/// ── Switchboard Program IDs ──────────────────────────────────
pub const SB_ON_DEMAND_PID_DEVNET: &str = "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv";
pub const SB_ON_DEMAND_PID_MAINNET: &str = "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv";

/// ── PDA seeds ────────────────────────────────────────────────
pub const SEED_PROTOCOL: &[u8] = b"rafi_protocol";
pub const SEED_POOL: &[u8] = b"pool";
pub const SEED_ASSET_VAULT: &[u8] = b"asset_vault";
pub const SEED_USDC_VAULT: &[u8] = b"usdc_vault";
pub const SEED_POSITION: &[u8] = b"position";
pub const SEED_TREASURY: &[u8] = b"treasury";
