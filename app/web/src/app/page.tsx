"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import PoolCard from "@/components/PoolCard";
import { MOCK_POOLS } from "@/lib/mockData";
import { formatUsdc, formatTokenAmount } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { Flame, Zap, Clock } from "lucide-react";
import Link from "next/link";

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const openPools = MOCK_POOLS.filter(p => p.state === "open");
  const urgentPools = mounted ? openPools.filter(p => {
    const diff = new Date(p.expires_at).getTime() - Date.now();
    return diff > 0 && diff < 3_600_000;
  }) : [];
  const topPools = openPools.sort((a, b) => b.usdc_collected - a.usdc_collected).slice(0, 3);

  const tabs = [
    { key: "all", label: "All" },
    { key: "sol", label: "SOL" },
    { key: "wbtc", label: "wBTC" },
    { key: "weth", label: "wETH" },
    { key: "jup", label: "JUP" },
  ];

  const filtered = activeTab === "all" ? MOCK_POOLS :
    MOCK_POOLS.filter(p => p.asset_symbol?.toLowerCase() === activeTab);

  return (
    <>
      {/* Tag bar */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab-pill ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="home-grid">

        {/* ─── Left: Feed ─── */}
        <div>
          {/* Urgent banner */}
          {urgentPools.length > 0 && (
            <div style={{ background: "var(--red-dim)", border: "1px solid #fecaca", borderRadius: "var(--radius-lg)", padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <Clock size={16} color="var(--red)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}>
                {urgentPools.length} pool{urgentPools.length > 1 ? "s" : ""} closing within 1 hour — enter before it’s gone
              </span>
            </div>
          )}

          <h2 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            Active pools
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-tertiary)" }}>
              ({filtered.filter(p => p.state === "open").length} open)
            </span>
          </h2>

          <div className="markets-grid">
            {filtered.map(pool => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        </div>

        {/* ─── Right: Sidebar ─── */}
        <div>

          {/* Hot Pools — mini cards */}
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
                    <div style={{ width: 28, height: 28, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                      {token.icon && <img src={token.icon} width={28} height={28} alt={pool.asset_symbol ?? "token"} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="hot-pool-name">
                        Win {formatTokenAmount(pool.asset_amount, pool.asset_decimals)} {pool.asset_symbol}
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

          {/* How RAFI works — compact */}
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

          {/* Recently drawn */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              <Zap size={15} color="var(--orange)" />
              Recent winners
            </div>
            {MOCK_POOLS.filter(p => p.state === "settled").slice(0, 3).map((pool, i) => {
              const token = getTokenInfo(pool.asset_symbol ?? "");
              return (
                <Link key={pool.id} href={`/pool/${pool.pool_id}`}>
                  <div className="winner-item">
                    <div style={{ width: 28, height: 28, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                      {token.icon && <img src={token.icon} width={28} height={28} alt={pool.asset_symbol ?? "token"} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="winner-prize">
                        {formatTokenAmount(pool.asset_amount, pool.asset_decimals)} {pool.asset_symbol}
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
