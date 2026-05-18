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
  onQuickBuy?: (pool: Pool) => void;
}

export default function PoolCard({ pool, onQuickBuy }: Props) {
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
    <div 
      className="market-card" 
      id={`market-${pool.pool_id}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) {
          window.location.href = `/pool/${pool.pool_id}`;
        }
      }}
    >
      
      {/* ── Top section: Icon/Title (Left) and Progress Ring (Right) ── */}
      <div className="mc-top">
        <div className="mc-top-left">
          <div className="mc-icon">
            {emoji ? (
              <span style={{ fontSize: 20 }}>{emoji}</span>
            ) : token.icon ? (
              <img src={token.icon} alt={symbol} width={36} height={36} style={{ borderRadius: 8 }} />
            ) : (
              <span>{symbol[0]}</span>
            )}
          </div>
          <div className="mc-title">
            {title ? title : `Win ${prizeAmount} ${symbol}`}
          </div>
        </div>
        
        {/* SVG Circular Ring for Fill Percentage */}
        <div className="mc-ring-container">
          <svg className="mc-ring-svg" viewBox="0 0 36 36">
            <circle className="mc-ring-bg" cx="18" cy="18" r="16" />
            <circle 
              className="mc-ring-fill" 
              cx="18" cy="18" r="16" 
              strokeDasharray={`${(fillPct / 100) * 100} 100`}
              style={{ stroke: fillPct >= 90 ? '#f59e0b' : 'var(--rafi)' }}
            />
          </svg>
          <div className="mc-ring-text">
            <span className="mc-ring-pct">{fillPct.toFixed(0)}%</span>
            <span className="mc-ring-label">Filled</span>
          </div>
        </div>
      </div>

      {/* ── Middle section: Action Buttons ── */}
      <div className="mc-middle">
        {isOpen ? (
          <>
            <button className="mc-action-btn mc-action-btn-secondary">
              View
            </button>
            <button 
              className="mc-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (onQuickBuy) onQuickBuy(pool);
              }}
            >
              Enter
            </button>
          </>
        ) : (
          <button className="mc-action-btn mc-action-btn-secondary" style={{ width: '100%' }}>
            {pool.state === "filled" ? "Draw Pending" : "Settled"}
          </button>
        )}
      </div>

      {/* ── Bottom section: Footer info ── */}
      <div className="mc-bottom">
        <div>
          {formatUsdc(pool.pool_total_usdc)} Vol.
        </div>
        <div className="mc-bottom-right">
          {isOpen ? (
            <span style={{ color: urgent ? 'var(--orange)' : 'inherit' }}>
              {urgent ? "🔥 Closing soon" : "Active"}
            </span>
          ) : isFilled ? (
            <span style={{ color: drawReady ? 'var(--rafi)' : 'inherit' }}>
              {drawReady ? "🎲 Draw ready" : `⏳ ${drawLeft}`}
            </span>
          ) : (
            <span>✅ Settled</span>
          )}
        </div>
      </div>

    </div>
  );

}
