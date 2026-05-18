"use client";

import { Pool } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { BPS_SCALE } from "@/lib/constants";
import { formatTokenAmount, timeRemaining, isUrgent, formatUsdc, drawCountdown } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import Link from "next/link";
import { Users, Clock } from "lucide-react";

interface Props { pool: Pool; }

export default function PoolCard({ pool }: Props) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const fillPct = (pool.total_probability_sold_bps / BPS_SCALE) * 100;
  const symbol = pool.asset_symbol || "?";
  const token = getTokenInfo(symbol);
  const isOpen = pool.state === "open";
  const isFilled = pool.state === "filled";
  const urgent = mounted ? isUrgent(pool.expires_at) : false;
  const isNew = mounted ? (Date.now() / 1000 - pool.created_at) < 3_600 : false;

  const prizeAmount = formatTokenAmount(pool.asset_amount, pool.asset_decimals);
  const drawLeft = mounted && isFilled ? drawCountdown(pool.filled_at) : null;
  const drawReady = drawLeft === "Ready";

  const emoji = pool.emoji || null;
  const title = pool.title || null;
  const hasBadge = (isNew && isOpen) || (urgent && isOpen) || isFilled || pool.state === "settled";

  // Ring color adapts to state
  const ringColor = isFilled ? "var(--rafi)"
    : fillPct >= 90 ? "var(--orange)"
    : urgent ? "var(--red)"
    : "var(--rafi)";

  const fillDeg = fillPct * 3.6; // 0-360

  return (
    <Link href={`/pool/${pool.pool_id}`} style={{ textDecoration: "none" }}>
      <div className="pc" id={`pool-${pool.pool_id}`}>

        {/* ── Badge row ── */}
        {hasBadge && (
          <div className="pc-badges">
            {isNew && isOpen && <span className="pc-badge pc-badge-new">New</span>}
            {urgent && isOpen && <span className="pc-badge pc-badge-urgent">Ending soon</span>}
            {isFilled && (
              <span className={`pc-badge ${drawReady ? "pc-badge-ready" : "pc-badge-draw"}`}>
                {drawReady ? "Draw ready" : `Draw ${drawLeft}`}
              </span>
            )}
            {pool.state === "settled" && <span className="pc-badge pc-badge-settled">Settled</span>}
          </div>
        )}

        {/* ── Header: icon + title ── */}
        <div className="pc-header">
          <div className="pc-icon">
            {emoji ? (
              <span className="pc-emoji">{emoji}</span>
            ) : token.icon ? (
              <img src={token.icon} alt={symbol} width={36} height={36} style={{ borderRadius: 8 }} />
            ) : (
              <span className="pc-icon-letter">{symbol[0]}</span>
            )}
          </div>
          <div className="pc-titles">
            <div className="pc-title">{title || `${prizeAmount} ${symbol}`}</div>
            {title && <div className="pc-subtitle">Win {prizeAmount} {symbol}</div>}
            {!title && <div className="pc-subtitle">Pool #{pool.pool_id}</div>}
          </div>
        </div>

        {/* ── Body: ring + stats ── */}
        <div className="pc-body">
          <div
            className="pc-ring"
            style={{
              background: `conic-gradient(${ringColor} 0deg ${fillDeg}deg, var(--ring-track) ${fillDeg}deg 360deg)`
            }}
          >
            <div className="pc-ring-center">
              <span className="pc-ring-num">{fillPct.toFixed(0)}</span>
              <span className="pc-ring-pct">%</span>
            </div>
          </div>
          <div className="pc-metrics">
            <div className="pc-metric">
              <span className="pc-metric-val" style={{ color: fillPct >= 90 ? "var(--orange)" : "var(--rafi)" }}>
                {(100 - fillPct).toFixed(0)}% left
              </span>
            </div>
            <div className="pc-metric">
              <Users size={11} />
              <span>{pool.position_count} {pool.position_count === 1 ? "entry" : "entries"}</span>
            </div>
            <div className="pc-metric">
              <Clock size={11} />
              <span style={{
                color: urgent ? "var(--red)" : "inherit",
                fontWeight: urgent ? 600 : 400,
              }}>
                {mounted ? (
                  isOpen ? timeRemaining(pool.expires_at)
                  : isFilled ? (drawReady ? "Draw ready" : drawLeft)
                  : pool.state
                ) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pc-footer">
          {isOpen && fillPct < 100 ? (
            <>
              <span className="pc-min">From {formatUsdc(pool.pool_total_usdc / 100)}</span>
              <button className="pc-enter" onClick={e => { e.stopPropagation(); e.preventDefault(); }}>
                Enter
              </button>
            </>
          ) : isFilled ? (
            <div className="pc-status pc-status-draw">
              {drawReady ? "🎲 Draw launching…" : `⏳ Draw in ${drawLeft}`}
            </div>
          ) : pool.state === "settled" ? (
            <div className="pc-status pc-status-settled">
              🏆 {pool.winner?.slice(0,4)}…{pool.winner?.slice(-4)}
            </div>
          ) : (
            <div className="pc-status">Expired</div>
          )}
        </div>

      </div>
    </Link>
  );
}
