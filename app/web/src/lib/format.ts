// ═══════════════════════════════════════════════
// RAFI — Formatting Utilities
// ═══════════════════════════════════════════════

import { USDC_DECIMALS, BPS_SCALE } from "./constants";

/** Format USDC amount (6 decimals) to human-readable string */
export function formatUsdc(lamports: number): string {
  const val = lamports / 10 ** USDC_DECIMALS;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  return `$${val.toFixed(4)}`;
}

/** Format raw USDC to plain number */
export function usdcToNumber(lamports: number): number {
  return lamports / 10 ** USDC_DECIMALS;
}

/** Format bps to percentage string */
export function bpsToPercent(bps: number): string {
  const pct = (bps / BPS_SCALE) * 100;
  if (pct === Math.floor(pct)) return `${pct}%`;
  return `${pct.toFixed(1)}%`;
}

/** Format multiplier bps to "×1.35" style */
export function formatMultiplier(bps: number): string {
  return `×${(bps / BPS_SCALE).toFixed(2)}`;
}

/** Format token amount with given decimals — no trailing zeros */
export function formatTokenAmount(raw: number | bigint, decimals: number, symbol?: string | null): string {
  const val = Number(raw) / (10 ** decimals);
  let formatted: string;
  if (val >= 1_000_000) {
    formatted = `${parseFloat((val / 1_000_000).toFixed(2))}M`;
  } else if (val >= 1000) {
    formatted = val.toLocaleString("en-US", { maximumFractionDigits: 2 });
  } else {
    // toFixed then parseFloat strips trailing zeros: "10.0000" → "10", "1.4200" → "1.42"
    const maxDecimals = val >= 1 ? Math.min(decimals, 4) : Math.min(decimals, 6);
    formatted = String(parseFloat(val.toFixed(maxDecimals)));
  }
  return symbol ? `${formatted} ${symbol}` : formatted;
}

/** Time remaining as human-readable string.
 *  Accepts unix timestamp (seconds) or ISO string. */
export function timeRemaining(expiresAt: number | string): string {
  const expiresMs = typeof expiresAt === "number" ? expiresAt * 1000 : new Date(expiresAt).getTime();
  const diff = expiresMs - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Is pool ending soon (< 1h). Accepts unix timestamp or ISO string. */
export function isUrgent(expiresAt: number | string): boolean {
  const ms = typeof expiresAt === "number" ? expiresAt * 1000 : new Date(expiresAt).getTime();
  return ms - Date.now() < 3_600_000 && ms > Date.now();
}

/** Shorten wallet address */
export function shortenAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/** Calculate cost for a given probability on a pool */
export function calculateCost(poolTotalUsdc: number, probabilityBps: number): number {
  return Math.floor((poolTotalUsdc * probabilityBps) / BPS_SCALE);
}

/** Get fill percentage */
export function fillPercent(totalProbSoldBps: number): number {
  return (totalProbSoldBps / BPS_SCALE) * 100;
}

/** Countdown remaining after a pool fills (30 min draw delay).
 *  Returns a formatted string like "28m" or "4m 30s" while waiting,
 *  "Ready" once elapsed, or null if filled_at is 0 (not yet filled). */
export function drawCountdown(filledAt: number, countdownSecs = 1_800): string | null {
  if (!filledAt) return null;
  const drawAt = (filledAt + countdownSecs) * 1_000;
  const diff = drawAt - Date.now();
  if (diff <= 0) return "Ready";
  const mins = Math.floor(diff / 60_000);
  const secs = Math.floor((diff % 60_000) / 1_000);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
