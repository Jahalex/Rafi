"use client";

import { Pool } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { BPS_SCALE } from "@/lib/constants";
import { formatTokenAmount, timeRemaining, isUrgent, formatUsdc, drawCountdown } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import Link from "next/link";
import { Clock, Users, Zap, Sparkles } from "lucide-react";

interface Props {
  pool: Pool;
  size?: "standard" | "large";
  onQuickBuy?: (pool: Pool) => void;
}

export default function PoolCard({ pool, size = "standard", onQuickBuy }: Props) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const fillPct = (pool.total_probability_sold_bps / BPS_SCALE) * 100;
  const remainPct = 100 - fillPct;
  const symbol = pool.asset_symbol || "?";
  const token = getTokenInfo(symbol);
  const isOpen = pool.state === "open";
  const isFilled = pool.state === "filled";
  const urgent = mounted ? isUrgent(pool.expires_at) : false;
  const isNew = mounted ? (Date.now() / 1000 - pool.created_at) < 3_600 : false;

  // Only render badges div when at least one badge is visible
  const hasBadge = (isNew && isOpen) || (urgent && isOpen) || isFilled || pool.state === "settled";

  const prizeAmount = formatTokenAmount(pool.asset_amount, pool.asset_decimals);
  const drawLeft = mounted && isFilled ? drawCountdown(pool.filled_at) : null;
  const drawReady = drawLeft === "Ready";

  // Social identity — emoji or token icon fallback
  const emoji = pool.emoji || null;
  const title = pool.title || null;

  return (
    <Link href={`/pool/${pool.pool_id}`} style={{ textDecoration: "none" }}>
      <div className={`market-card ${size === "large" ? "large" : ""}`} id={`market-${pool.pool_id}`}>

        {/* ── State badges ── (only rendered when visible — avoids empty gap) */}
        {hasBadge && (
          <div className="mc-badges">
            {isNew && isOpen && (
              <span className="mc-badge mc-badge-new">🆕 New</span>
            )}
            {urgent && isOpen && (
              <span className="mc-badge mc-badge-urgent">🔥 Closing soon</span>
            )}
            {isFilled && (
              <span className={`mc-badge ${drawReady ? "mc-badge-draw-ready" : "mc-badge-draw"}`}>
                {drawReady ? "🎲 Draw ready" : `⏳ Draw in ${drawLeft}`}
              </span>
            )}
            {pool.state === "settled" && (
              <span className="mc-badge mc-badge-settled">✅ Settled</span>
            )}
          </div>
        )}

        {/* ── Header: emoji/icon + prize ── */}
        <div className="mc-header">
          <div className="mc-icon-wrap">
            {emoji ? (
              <div className="mc-emoji">{emoji}</div>
            ) : token.icon ? (
              <img src={token.icon} alt={symbol} width={44} height={44} style={{ borderRadius: 10 }} />
            ) : (
              <div className="mc-icon">{symbol[0]}</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <>
                <div className="mc-title">{title}</div>
                <div className="mc-prize-sub">Win {prizeAmount} {symbol}</div>
              </>
            ) : (
              <>
                <div className="mc-prize-label">Win</div>
                <div className="mc-prize">{prizeAmount} {symbol}</div>
              </>
            )}
          </div>
        </div>

        {/* ── THE RAFI MATRIX (Progress) ── */}
        <div className="rafi-matrix-container">
          <div className="rafi-matrix-header">
            <span>Probability Matrix</span>
            <span className="rafi-matrix-value">{fillPct.toFixed(1)}% FILLED</span>
          </div>
          <div className="rafi-matrix">
            {Array.from({ length: 50 }).map((_, i) => {
              const segmentPct = i * 2; // Each segment represents 2%
              const isSegmentFilled = fillPct > segmentPct;
              let colorClass = "filled";
              if (fillPct >= 90 && segmentPct >= 90) colorClass = "filled-orange";
              else if (fillPct >= 50 && segmentPct >= 50) colorClass = "filled-yellow";
              
              return (
                <div key={i} className={`rm-segment ${isSegmentFilled ? colorClass : ""}`} />
              );
            })}
          </div>
        </div>

        {/* ── CTA ── */}
        {isOpen && fillPct < 100 ? (
          <div className="mc-cta-row">
            <span className="mc-min-entry">From {formatUsdc(pool.pool_total_usdc / 100)} → 1%</span>
            <button
              className="quick-buy-btn"
              onClick={e => {
                e.preventDefault();
                if (onQuickBuy) onQuickBuy(pool);
              }}
            >
              Quick Enter
            </button>
          </div>

        ) : isFilled ? (
          <div className="mc-status drawing">
            <Zap size={13} />
            {drawReady ? "Draw launching…" : `Draw in ${drawLeft}`}
          </div>
        ) : pool.state === "settled" ? (
          <div className="mc-status settled">
            <Sparkles size={13} /> Winner drawn
          </div>
        ) : pool.state === "expired" || pool.state === "closed" ? (
          <div className="mc-status" style={{ background: "var(--bg-input)", color: "var(--text-tertiary)" }}>
            Expired — refunds available
          </div>
        ) : null}

        {/* ── Footer ── */}
        <div className="mc-footer">
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Users size={12} /> {pool.position_count} {pool.position_count === 1 ? "entry" : "entries"}
          </span>
          <span style={{
            display: "flex", alignItems: "center", gap: 4,
            color: urgent ? "var(--red)" : "var(--text-tertiary)",
            fontWeight: urgent ? 600 : 400,
          }}>
            <Clock size={12} />
            {mounted ? (
              isOpen ? timeRemaining(pool.expires_at)
              : isFilled ? (drawLeft && !drawReady ? `Draw ${drawLeft}` : pool.state)
              : pool.state
            ) : "—"}
          </span>
        </div>

      </div>
    </Link>
  );
}
