"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import PoolCard from "@/components/PoolCard";
import { MOCK_POOLS } from "@/lib/mockData";
import { formatUsdc, formatTokenAmount } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { Trophy, Plus } from "lucide-react";
import Link from "next/link";
import QuickBuyModal from "@/components/QuickBuyModal";
import { Pool } from "@/lib/supabase";

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState("all"); // "all" (live) | "settled"
  const [sortOption, setSortOption] = useState("trending");
  const [assetFilter, setAssetFilter] = useState("all");
  const [quickBuyPool, setQuickBuyPool] = useState<Pool | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Data ──
  const openPools = MOCK_POOLS.filter(p => p.state === "open");
  const filledPools = MOCK_POOLS.filter(p => p.state === "filled");
  const settledPools = MOCK_POOLS.filter(p => p.state === "settled");
  let livePools = [...openPools, ...filledPools];

  // Apply filters
  if (assetFilter !== "all") {
    livePools = livePools.filter(p => p.asset_symbol?.toLowerCase() === assetFilter);
  }

  // Apply sort
  livePools.sort((a, b) => {
    if (sortOption === "volume") return b.usdc_collected - a.usdc_collected;
    if (sortOption === "newest") return b.created_at - a.created_at;
    if (sortOption === "ending_soon") return a.expires_at - b.expires_at;
    // default trending: high fill % and high volume
    const fillA = a.total_probability_sold_bps;
    const fillB = b.total_probability_sold_bps;
    return (fillB * b.usdc_collected) - (fillA * a.usdc_collected);
  });

  const filtered = activeTab === "settled" ? settledPools : livePools;

  return (
    <>
      {/* ── Premium Controls Bar ── */}
      <div className="home-controls">
        <div className="controls-left">
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Pools</h1>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab-pill ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>Live</button>
            <button className={`tab-pill ${activeTab === "settled" ? "active" : ""}`} onClick={() => setActiveTab("settled")}>Ended</button>
          </div>
        </div>
        
        <div className="controls-right">
          {activeTab === "all" && (
            <>
              <select className="filter-select" value={assetFilter} onChange={e => setAssetFilter(e.target.value)}>
                <option value="all">All Assets</option>
                <option value="sol">SOL</option>
                <option value="wbtc">wBTC</option>
                <option value="weth">wETH</option>
                <option value="jup">JUP</option>
              </select>
              <select className="filter-select" value={sortOption} onChange={e => setSortOption(e.target.value)}>
                <option value="trending">🔥 Trending</option>
                <option value="newest">✨ Newest</option>
                <option value="ending_soon">⏰ Ending Soon</option>
                <option value="volume">💰 Top Volume</option>
              </select>
            </>
          )}
          <Link href="/sell">
            <button className="btn btn-rafi" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Plus size={15} /> Create
            </button>
          </Link>
        </div>
      </div>

      <div className="home-grid">

        {/* ─── Left: Pool feed ─── */}
        <div>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔭</div>
              <p>No pools here yet.</p>
              <Link href="/sell">
                <button className="btn btn-rafi">Create the first one</button>
              </Link>
            </div>
          ) : (
            <div className="markets-grid">
              {filtered.map((pool, index) => {
                // The top pool in Live view spans 2 columns (Hero Pool)
                const isHero = activeTab === "all" && index === 0;
                return (
                  <PoolCard 
                    key={pool.id} 
                    pool={pool} 
                    size={isHero ? "large" : "standard"}
                    onQuickBuy={setQuickBuyPool}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Right: Sidebar ─── */}
        <div>

          {/* Recent winners — social proof */}
          {settledPools.length > 0 && (
            <div className="sidebar-card">
              <div className="sidebar-card-title">
                <Trophy size={15} color="var(--orange)" />
                Recent winners
              </div>
              {settledPools.slice(0, 3).map(pool => {
                const token = getTokenInfo(pool.asset_symbol ?? "");
                return (
                  <Link key={pool.id} href={`/pool/${pool.pool_id}`}>
                    <div className="winner-item">
                      <div className="winner-icon">
                        {pool.emoji ? (
                          <span>{pool.emoji}</span>
                        ) : token.icon ? (
                          <img src={token.icon} width={28} height={28} alt={pool.asset_symbol ?? ""} style={{ borderRadius: 6 }} />
                        ) : (
                          <span style={{ fontWeight: 700 }}>{(pool.asset_symbol ?? "?")[0]}</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="winner-prize">
                          {formatTokenAmount(pool.asset_amount, pool.asset_decimals)} {pool.asset_symbol}
                        </div>
                        <div className="winner-addr">
                          {pool.winner?.slice(0, 4)}…{pool.winner?.slice(-4)}
                        </div>
                      </div>
                      <div className="winner-amount">{formatUsdc(pool.pool_total_usdc)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* How it works — compact, first-time visitor only concept */}
          <div className="sidebar-card sidebar-explainer">
            <div className="sidebar-card-title">
              How it works
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

        </div>
      </div>

      {/* ── Modal Quick Buy ── */}
      <QuickBuyModal 
        pool={quickBuyPool} 
        isOpen={!!quickBuyPool} 
        onClose={() => setQuickBuyPool(null)} 
      />
    </>
  );
}
