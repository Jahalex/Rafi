"use client";
export const dynamic = 'force-dynamic';

import { useParams } from "next/navigation";
import Link from "next/link";
import { MOCK_POOLS, MOCK_POSITIONS } from "@/lib/mockData";
import { formatUsdc, formatTokenAmount, bpsToPercent, shortenAddress, fillPercent, formatMultiplier, timeRemaining, isUrgent, drawCountdown } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import BuySlider from "@/components/BuySlider";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, Share2, Code, Bookmark, Shield, Users, Clock, DollarSign, Zap, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { BPS_SCALE } from "@/lib/constants";

export default function PoolDetailPage() {
  const params = useParams();
  const poolId = Number(params.id);
  const pool = MOCK_POOLS.find(p => p.pool_id === poolId);
  const [contentTab, setContentTab] = useState("rules");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!pool) {
    return <div className="empty"><div className="empty-icon">❌</div><p>Pool not found</p></div>;
  }

  const symbol = pool.asset_symbol || "?";
  const token = getTokenInfo(symbol);
  const fill = fillPercent(pool.total_probability_sold_bps);
  const remainPct = 100 - fill;
  const positions = MOCK_POSITIONS.filter(p => p.pool_id === pool.pool_id);
  const assetValueUsdc = Math.floor(pool.pool_total_usdc / (pool.multiplier_bps / BPS_SCALE));
  const urgent = mounted ? isUrgent(pool.expires_at) : false;
  const isFilled = pool.state === "filled";
  const drawLeft = mounted && isFilled ? drawCountdown(pool.filled_at) : null;
  const drawReady = drawLeft === "Ready";
  const prizeLabel = `${formatTokenAmount(pool.asset_amount, pool.asset_decimals)} ${symbol}`;
  const minEntryUsd = pool.pool_total_usdc / 100; // 1% of pool

  const chartData = [
    { t: "Day 1", fill: 5 },
    { t: "Day 2", fill: 18 },
    { t: "Day 3", fill: 35 },
    { t: "Day 4", fill: 42 },
    { t: "Day 5", fill: 58 },
    { t: "Now", fill: Math.round(fill) },
  ];

  return (
    <>
      {/* Breadcrumb */}
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-tertiary)", fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
        <ChevronLeft size={14} /> All pools
      </Link>

      <div className="detail-grid">
        {/* ─── Left: Content ─── */}
        <div>
          {/* Hero card */}
          <div className="detail-card">
            <div className="detail-card-inner">

              {/* ══ Prize hero — the star of the page ══ */}
              <div className="pool-hero">
                <div className="pool-hero-left">
                  <div className="pool-hero-icon">
                    {token.icon ? (
                      <img src={token.icon} width={56} height={56} alt={symbol} style={{ borderRadius: 14 }} />
                    ) : (
                      <div style={{ width: 56, height: 56, background: "var(--rafi-dim)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 24, color: "var(--rafi-dark)" }}>{symbol[0]}</div>
                    )}
                  </div>
                  <div>
                    <div className="pool-hero-label">Win</div>
                    <h1 className="pool-hero-prize">{prizeLabel}</h1>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="pool-action-icon"><Code size={16} /></button>
                  <button className="pool-action-icon"><Share2 size={16} /></button>
                  <button className="pool-action-icon"><Bookmark size={16} /></button>
                </div>
              </div>

              {/* ══ Progress — the most important visual ══ */}
              <div className="pool-progress-section">
                <div className="pool-progress-bar-wrap">
                  <div className="pool-progress-bar">
                    <div className="pool-progress-fill" style={{ width: `${fill}%` }}>
                      {fill >= 15 && (
                        <span className="pool-progress-inside">{fill.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  <div className="pool-progress-labels">
                    <span>{fill.toFixed(0)}% filled</span>
                    <span style={{ color: "var(--rafi)", fontWeight: 600 }}>
                      {remainPct.toFixed(0)}% left — enter now
                    </span>
                  </div>
                </div>
              </div>

              {/* ══ Key stats — 4 cards ══ */}
              <div className="pool-stats-grid">
                <div className="pool-stat-card">
                  <div className="pool-stat-icon"><DollarSign size={16} color="var(--rafi)" /></div>
                  <div className="pool-stat-label">From</div>
                  <div className="pool-stat-value">{formatUsdc(minEntryUsd)}</div>
                </div>
                <div className="pool-stat-card">
                  <div className="pool-stat-icon"><Zap size={16} color="var(--rafi)" /></div>
                  <div className="pool-stat-label">Available</div>
                  <div className="pool-stat-value" style={{ color: "var(--rafi)" }}>{remainPct.toFixed(0)}%</div>
                </div>
                <div className="pool-stat-card">
                  <div className="pool-stat-icon"><Users size={16} color="var(--text-tertiary)" /></div>
                  <div className="pool-stat-label">Entries</div>
                  <div className="pool-stat-value">{pool.position_count}</div>
                </div>
                {isFilled ? (
                  <div className={`pool-stat-card ${drawReady ? "urgent" : ""}`}>
                    <div className="pool-stat-icon"><Sparkles size={16} color="var(--rafi)" /></div>
                    <div className="pool-stat-label">Draw in</div>
                    <div className="pool-stat-value" style={{ color: "var(--rafi)", fontWeight: 700 }}>
                      {mounted ? (drawReady ? "Ready" : drawLeft) : "—"}
                    </div>
                  </div>
                ) : (
                  <div className={`pool-stat-card ${urgent ? "urgent" : ""}`}>
                    <div className="pool-stat-icon"><Clock size={16} color={urgent ? "var(--red)" : "var(--text-tertiary)"} /></div>
                    <div className="pool-stat-label">Fills in</div>
                    <div className="pool-stat-value" style={{ color: urgent ? "var(--red)" : "inherit" }}>{mounted ? timeRemaining(pool.expires_at) : "—"}</div>
                  </div>
                )}
              </div>

              {/* ══ Chart ══ */}
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--rafi)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="var(--rafi)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} orientation="right" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border-light)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 13 }} formatter={(v) => [`${Number(v)}%`, "Filled"]} />
                    <Area type="monotone" dataKey="fill" stroke="var(--rafi)" strokeWidth={2.5} fill="url(#fillGrad)" dot={false} activeDot={{ r: 5, fill: "var(--rafi)", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Transparency row — secondary info */}
              <div className="pool-transparency">
                <span>Asset value <strong>{formatUsdc(assetValueUsdc)}</strong></span>
                <span className="pool-transparency-dot">·</span>
                <span>Premium <strong>{formatMultiplier(pool.multiplier_bps)}</strong></span>
                <span className="pool-transparency-dot">·</span>
                <span>Pool target <strong>{formatUsdc(pool.pool_total_usdc)}</strong></span>
              </div>
            </div>
          </div>

          {/* ══ How it works ══ */}
          <div className="pool-info-card">
            <div className="content-tabs">
              <button className={`content-tab ${contentTab === "rules" ? "active" : ""}`} onClick={() => setContentTab("rules")}>How it works</button>
              <button className={`content-tab ${contentTab === "context" ? "active" : ""}`} onClick={() => setContentTab("context")}>Security</button>
            </div>

            {contentTab === "rules" ? (
              <div className="pool-how-grid">
                <div className="pool-how-step">
                  <div className="pool-how-num">1</div>
                  <div>
                    <div className="pool-how-title">Asset locked</div>
                    <div className="pool-how-desc"><strong>{prizeLabel}</strong> (≈{formatUsdc(assetValueUsdc)}) is locked in an on-chain escrow. Nobody can touch it.</div>
                  </div>
                </div>
                <div className="pool-how-step">
                  <div className="pool-how-num">2</div>
                  <div>
                    <div className="pool-how-title">You enter</div>
                    <div className="pool-how-desc">Put in USDC. The more you add, the higher your chance. $5 might be all it takes.</div>
                  </div>
                </div>
                <div className="pool-how-step">
                  <div className="pool-how-num">3</div>
                  <div>
                    <div className="pool-how-title">Pool fills to 100%</div>
                    <div className="pool-how-desc">When total entries reach {formatUsdc(pool.pool_total_usdc)}, the draw triggers automatically.</div>
                  </div>
                </div>
                <div className="pool-how-step">
                  <div className="pool-how-num">🏆</div>
                  <div>
                    <div className="pool-how-title">One winner takes it all</div>
                    <div className="pool-how-desc">Switchboard VRF picks one winner on-chain. The winner gets the full <strong>{prizeLabel}</strong>.</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", gridColumn: "1 / -1", marginTop: 4 }}>
                  Doesn't fill in time? All entries get an automatic on-chain refund.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Shield size={16} color="var(--rafi)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>Asset locked in a <strong>Program Derived Address (PDA)</strong> — no admin key can move it</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Shield size={16} color="var(--rafi)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>Random number generated by <strong>Switchboard VRF</strong> inside SGX enclaves — nobody can predict or influence it</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Shield size={16} color="var(--rafi)" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>All transactions verifiable on <strong>Solana Explorer</strong> — full transparency</span>
                </div>
              </div>
            )}
          </div>

          {/* ══ Entries list ══ */}
          <div className="pool-info-card">
            <div className="content-tabs">
              <button className="content-tab active">Entries ({positions.length})</button>
              <button className="content-tab">Activity</button>
            </div>

            {positions.map(pos => (
              <div key={pos.id} className="activity-item">
                <div className="activity-avatar">
                  {shortenAddress(pos.buyer, 2).slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{shortenAddress(pos.buyer)}</span>
                    <span className="activity-badge mint">
                      {bpsToPercent(pos.probability_bps)} chance
                    </span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>2h ago</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Paid {formatUsdc(pos.usdc_paid)}
                  </div>
                </div>
              </div>
            ))}

            {positions.length === 0 && (
              <div className="empty" style={{ padding: 32 }}>
                <p className="text-tertiary">No entries yet — be the first.</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Order Panel ─── */}
        <div>
          {isFilled ? (
            <div className="order-panel">
              <div className="order-panel-header">
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", overflow: "hidden", flexShrink: 0 }}>
                  {token.icon
                    ? <img src={token.icon} width={36} height={36} alt={symbol} style={{ objectFit: "cover" }} />
                    : <div className="order-panel-icon">{symbol[0]}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Win</div>
                  <div className="order-panel-label">{prizeLabel}</div>
                </div>
              </div>
              <div className="order-panel-inner" style={{ textAlign: "center", padding: "32px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎲</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  {drawReady ? "Draw launching…" : `Draw in ${drawLeft}`}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6, marginBottom: 24 }}>
                  This pool is 100% filled.<br />
                  The on-chain VRF draw will be triggered shortly.<br />
                  One winner takes all.
                </div>
                <div className="order-tos">Provably fair · On-chain VRF · <a href="#">How it works</a></div>
              </div>
            </div>
          ) : (
            <BuySlider pool={pool} />
          )}
        </div>
      </div>
    </>
  );
}
