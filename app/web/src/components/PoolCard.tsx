"use client";

import { Pool } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { BPS_SCALE } from "@/lib/constants";
import { formatTokenAmount, timeRemaining, isUrgent, formatUsdc, drawCountdown } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import Link from "next/link";
import { Users, Clock, Zap } from "lucide-react";
import FillRing from "./FillRing";

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

        {/* ── Hero: Fill Ring + token icon ── */}
        <div className="pool-card-hero">
          <FillRing
            percent={fillPct}
            size={76}
            strokeWidth={5}
            urgent={urgent}
          >
            {pool.emoji ? (
              <span style={{ fontSize: 28, lineHeight: 1 }}>{pool.emoji}</span>
            ) : token.icon ? (
              <img
                src={token.icon}
                alt={symbol}
                width={46}
                height={46}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 20, fontWeight: 800, color: "var(--rafi)" }}>
                {symbol[0]}
              </span>
            )}
          </FillRing>

          {/* Fill % displayed under the ring */}
          <div
            className="pool-card-fill-pct"
            style={{
              color:
                urgent || fillPct >= 95 ? "#ef4444"
                : fillPct >= 80 ? "#f59e0b"
                : fillPct > 0 ? "var(--rafi)"
                : "var(--text-tertiary)",
            }}
          >
            {isSettled ? "100%" : `${fillPct.toFixed(0)}%`}
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
            style={{ color: urgent ? "var(--red)" : undefined, fontWeight: urgent ? 600 : undefined }}
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
          Enter →
        </button>
      ) : stateLabel ? (
        <div className="pool-card-state-label">
          {stateLabel}
        </div>
      ) : null}

    </div>
  );
}
