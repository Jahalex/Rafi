"use client";

import { Pool } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { BPS_SCALE } from "@/lib/constants";
import { formatTokenAmount, timeRemaining, isUrgent, formatUsdc, drawCountdown } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import Link from "next/link";
import { Users, Clock } from "lucide-react";

interface Props {
  pool: Pool;
  onQuickBuy: (pool: Pool) => void;
}

export default function PoolCard({ pool, onQuickBuy }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Computed values ──
  const fillPct = (pool.total_probability_sold_bps / BPS_SCALE) * 100;
  const symbol = pool.asset_symbol || "?";
  const token = getTokenInfo(symbol);
  const isOpen = pool.state === "open";
  const isFilled = pool.state === "filled";
  const isSettled = pool.state === "settled";
  const urgent = mounted ? isUrgent(pool.expires_at) : false;
  const drawLeft = mounted && isFilled ? drawCountdown(pool.filled_at) : null;
  const drawReady = drawLeft === "Ready";

  const prizeAmount = formatTokenAmount(pool.asset_amount, pool.asset_decimals);
  const displayTitle = pool.title || `Win ${prizeAmount} ${symbol}`;

  // ── State label (bottom of card, replaces Enter button when not active) ──
  const stateLabel = isFilled
    ? (drawReady ? "🎲 Draw launching…" : `⏳ Draw in ${drawLeft}`)
    : isSettled
    ? "✅ Winner drawn"
    : null;

  return (
    <div className="pool-card" id={`pool-${pool.pool_id}`}>

      {/* ── Clickable zone → pool detail ── */}
      <Link href={`/pool/${pool.pool_id}`} className="pool-card-link">

        {/* ── State badge (top-right, absolute, only when noteworthy) ── */}
        {urgent && isOpen && (
          <span className="pool-card-badge pool-card-badge--urgent">🔥 Closing soon</span>
        )}
        {isFilled && !drawReady && (
          <span className="pool-card-badge pool-card-badge--draw">⏳ Draw soon</span>
        )}
        {drawReady && (
          <span className="pool-card-badge pool-card-badge--ready">🎲 Draw ready</span>
        )}

        {/* ── Hero: Token Icon & Fill Status ── */}
        <div className="pool-card-hero">
          <div className="pool-card-icon">
            {token.icon ? (
              <img
                src={token.icon}
                alt={symbol}
                width={36}
                height={36}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span className="pool-card-icon-fallback">
                {symbol[0]}
              </span>
            )}
          </div>
          <div className="pool-card-fill-pill">
            {isSettled ? "100%" : `${fillPct.toFixed(0)}%`} Filled
          </div>
        </div>

        {/* ── Title ── */}
        <div className="pool-card-title">{displayTitle}</div>

        {/* ── Sub-info: prize amount if custom title set ── */}
        {pool.title && (
          <div className="pool-card-sub">Win {prizeAmount} {symbol}</div>
        )}

        {/* ── Footer meta ── */}
        <div className="pool-card-meta">
          <span className="pool-card-meta-item">
            <Users size={11} />
            {pool.position_count}
          </span>
          <span className="pool-card-meta-dot">·</span>
          <span
            className="pool-card-meta-item"
          >
            <Clock size={11} />
            {mounted
              ? isOpen
                ? timeRemaining(pool.expires_at)
                : isFilled
                ? (drawLeft && !drawReady ? drawLeft : "Draw")
                : isSettled
                ? "Ended"
                : pool.state
              : "—"}
          </span>
          <span className="pool-card-meta-dot">·</span>
          <span className="pool-card-meta-item">
            {formatUsdc(pool.pool_total_usdc)}
          </span>
        </div>

      </Link>

      {/* ── CTA — outside the Link to avoid nested <a> ── */}
      {isOpen && fillPct < 100 ? (
        <button
          className="pool-card-enter"
          onClick={e => {
            e.stopPropagation();
            onQuickBuy(pool);
          }}
        >
          Enter
        </button>
      ) : stateLabel ? (
        <div className="pool-card-state-label">
          {stateLabel}
        </div>
      ) : null}

      {/* ── Progress Bar (Minimal 2px bottom line) ── */}
      <div className="pool-card-progress">
        <div className="pool-card-progress-bar" style={{ width: `${Math.min(fillPct, 100)}%` }} />
      </div>

    </div>
  );
}
