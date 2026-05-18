"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import PoolCard from "@/components/PoolCard";
import { MOCK_POOLS } from "@/lib/mockData";
import { formatUsdc, formatTokenAmount } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { Flame, Zap, Clock, TrendingUp, Plus } from "lucide-react";
import Link from "next/link";

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const now = Date.now() / 1000;
  const openPools = MOCK_POOLS.filter(p => p.state === "open");
  const urgentPools = mounted ? openPools.filter(p => {
    const diff = new Date(p.expires_at).getTime() - Date.now();
    return diff > 0 && diff < 6 * 3_600_000; // < 6h
  }) : [];
  const hotPools = mounted ? openPools.filter(p =>
    p.total_probability_sold_bps >= 5000
  ) : [];
  const topPools = [...openPools].sort((a, b) => b.usdc_collected - a.usdc_collected).slice(0, 3);

  // Stats
  const totalInPlay = MOCK_POOLS.filter(p => p.state === "open" || p.state === "filled")
    .reduce((sum, p) => sum + p.pool_total_usdc, 0);
  const winnersCount = MOCK_POOLS.filter(p => p.state === "settled").length;

  const tabs = [
    { key: "all", label: "All", count: openPools.length },
    { key: "hot", label: "🔥 Hot", count: hotPools.length },
    { key: "urgent", label: "⏰ Urgent", count: urgentPools.length },
    { key: "sol", label: "◎ SOL", count: openPools.filter(p => p.asset_symbol === "SOL").length },
    { key: "wbtc", label: "₿ wBTC", count: openPools.filter(p => p.asset_symbol === "wBTC").length },
    { key: "weth", label: "Ξ wETH", count: openPools.filter(p => p.asset_symbol === "wETH").length },
    { key: "jup", label: "JUP", count: openPools.filter(p => p.asset_symbol === "JUP").length },
  ];

  const filtered = (() => {
    switch (activeTab) {
      case "hot": return mounted ? openPools.filter(p => p.total_probability_sold_bps >= 5000) : openPools;
      case "urgent": return mounted ? urgentPools : openPools;
      case "all": return MOCK_POOLS;
      default: return MOCK_POOLS.filter(p => p.asset_symbol?.toLowerCase() === activeTab);
    }
  })();

  return (
    <>
      {/* ── Hero stat bar ── */}
      <div className="hero-stats">
        <div className="hero-stat">
          <div className="hero-stat-value">{openPools.length + MOCK_POOLS.filter(p => p.state === "filled").length}</div>
          <div className="hero-stat-label">⚡ Active pools</div>
        </div>
        <div className="hero-stat-divider" />
        <div className="hero-stat">
          <div className="hero-stat-value">{formatUsdc(totalInPlay)}</div>
          <div className="hero-stat-label">💰 Total in play</div>
        </div>
        <div className="hero-stat-divider" />
        <div className="hero-stat">
          <div className="hero-stat-value">{winnersCount}</div>
          <div className="hero-stat-label">🏆 Winners so far</div>
        </div>
        <div className="hero-stat-cta">
          <Link href="/sell">
            <button className="btn btn-rafi" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Plus size={15} /> Create pool
            </button>
          </Link>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-pill ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.count > 0 && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="home-grid">

        {/* ─── Left: Feed ─── */}
        <div>
          {/* Urgent banner */}
          {mounted && urgentPools.length > 0 && activeTab === "all" && (
            <div className="urgent-banner">
              <Clock size={15} />
              <span>
                {urgentPools.length} pool{urgentPools.length > 1 ? "s" : ""} closing in less than 6 hours — enter before it's gone
              </span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              {activeTab === "hot" ? "🔥 Hot pools" :
               activeTab === "urgent" ? "⏰ Urgent" :
               activeTab === "all" ? "Active pools" :
               `${tabs.find(t => t.key === activeTab)?.label} pools`}
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)", marginLeft: 8 }}>
                ({filtered.filter(p => p.state === "open").length} open)
              </span>
            </h2>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔭</div>
              <p>No pools in this category yet.</p>
              <Link href="/sell">
                <button className="btn btn-rafi">Create the first one</button>
              </Link>
            </div>
          ) : (
            <div className="markets-grid">
              {filtered.map(pool => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
            </div>
          )}
        </div>

        {/* ─── Right: Sidebar ─── */}
        <div>

          {/* Trending */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <Flame size={15} color="var(--red)" />
              Trending now
            </div>
            {topPools.map((pool, i) => {
              const token = getTokenInfo(pool.asset_symbol ?? "");
              const fill = (pool.total_probability_sold_bps / 10000) * 100;
              return (
                <Link key={pool.id} href={`/pool/${pool.pool_id}`}>
                  <div className="hot-pool-item">
                    <div className="hot-pool-rank">{i + 1}</div>
                    <div style={{ width: 28, height: 28, borderRadius: 8, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {pool.emoji || (token.icon && <img src={token.icon} width={28} height={28} alt={pool.asset_symbol ?? ""} />)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="hot-pool-name">
                        {pool.title || `Win ${formatTokenAmount(pool.asset_amount, pool.asset_decimals)} ${pool.asset_symbol}`}
                      </div>
                      <div className="hot-pool-bar-wrap">
                        <div className="hot-pool-bar">
                          <div className="hot-pool-bar-fill" style={{ width: `${fill}%` }} />
                        </div>
                        <span className="hot-pool-pct">{fill.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* How RAFI works */}
          <div className="sidebar-card sidebar-explainer">
            <div className="sidebar-card-title">
              💡 How it works
            </div>
            <div className="explainer-steps">
              <div className="explainer-step">
                <div className="explainer-num">1</div>
                <div className="explainer-text">Someone locks an asset in escrow</div>
              </div>
              <div className="explainer-step">
                <div className="explainer-num">2</div>
                <div className="explainer-text">You enter with USDC — more = higher chance</div>
              </div>
              <div className="explainer-step">
                <div className="explainer-num">3</div>
                <div className="explainer-text">VRF draw picks one winner — takes it all</div>
              </div>
            </div>
            <div className="explainer-footer">
              Provably fair · On-chain · No house edge
            </div>
          </div>

          {/* Recent winners */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <Zap size={15} color="var(--orange)" />
              Recent winners
            </div>
            {MOCK_POOLS.filter(p => p.state === "settled").slice(0, 3).map(pool => {
              const token = getTokenInfo(pool.asset_symbol ?? "");
              return (
                <Link key={pool.id} href={`/pool/${pool.pool_id}`}>
                  <div className="winner-item">
                    <div style={{ width: 28, height: 28, borderRadius: 8, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {pool.emoji || (token.icon && <img src={token.icon} width={28} height={28} alt={pool.asset_symbol ?? ""} />)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="winner-prize">
                        {pool.title || `${formatTokenAmount(pool.asset_amount, pool.asset_decimals)} ${pool.asset_symbol}`}
                      </div>
                      <div className="winner-addr">
                        🏆 {pool.winner?.slice(0, 4)}...{pool.winner?.slice(-4)}
                      </div>
                    </div>
                    <div className="winner-amount">{formatUsdc(pool.pool_total_usdc)}</div>
                  </div>
                </Link>
              );
            })}
          </div>

        </div>
      </div>
    </>
  );
}
