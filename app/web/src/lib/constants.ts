// ═══════════════════════════════════════════════
// RAFI — Constants
// ═══════════════════════════════════════════════

// Program
export const RAFI_PROGRAM_ID = "5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg";

// Network
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";

// Privy
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

// Supabase
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Protocol
export const BPS_SCALE = 10_000;
export const USDC_DECIMALS = 6;
export const DEFAULT_FEE_BPS = 600; // 6% — matches on-chain DEFAULT_FEE_BPS

// On-chain addresses (devnet)
export const PROTOCOL_PDA = "5cLgCuYHAJccqo3gDkaCQgiyDTL2Hh91R167sv7v5sBr";
export const USDC_MINT_DEVNET = "5xLsCVKHjZZ4dbcSkGxrduNav1cmJenDSdza7hnrWYS1";

// PDA Seeds
export const SEED_PROTOCOL = "rafi_protocol";
export const SEED_POOL = "pool";
export const SEED_ASSET_VAULT = "asset_vault";
export const SEED_USDC_VAULT = "usdc_vault";
export const SEED_POSITION = "position";

// UI
export const POOL_STATES = {
  open: { label: "Live", color: "green", icon: "🟢" },
  filled: { label: "Draw pending", color: "blue", icon: "⏳" },
  settlementRequested: { label: "Drawing…", color: "purple", icon: "🎲" },
  settled: { label: "Winner drawn", color: "purple", icon: "✅" },
  expired: { label: "Expired", color: "red", icon: "⏰" },
  closed: { label: "Closed", color: "orange", icon: "🔒" },
} as const;

// Pool duration options (seconds) — must match on-chain constants
export const POOL_DURATIONS = [
  { secs: 86_400,      label: "1 day" },
  { secs: 3 * 86_400,  label: "3 days" },
  { secs: 7 * 86_400,  label: "7 days" },
  { secs: 14 * 86_400, label: "14 days" },
] as const;

// After a pool fills, this many seconds must pass before the VRF draw.
export const FILLED_COUNTDOWN_SECS = 1_800; // 30 minutes
