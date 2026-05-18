"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import PoolCard from "@/components/PoolCard";
import { MOCK_POOLS } from "@/lib/mockData";
import { formatUsdc, formatTokenAmount } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { Trophy, Plus } from "lucide-react";
import Link from "next/link";

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Data ──
  const openPools = MOCK_POOLS.filter(p => p.state === "open");
  const filledPools = MOCK_POOLS.filter(p => p.state === "filled");
  const settledPools = MOCK_POOLS.filter(p => p.state === "settled");
  const livePools = [...openPools, ...filledPools];

  // ── Tabs: simple & useful ──
  const tabs = [
    { key: "all",      label: "Live" },
    { key: "settled",  label: "Ended" },
  ];

  const filtered = activeTab === "settled" ? settledPools : livePools;

  return (
    <>
      {/* ── Header row: title + CTA ── */}
      <div className="home-header">
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Pools</h1>
        <Link href="/sell">
          <button className="btn btn-rafi" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Plus size={15} /> Create pool
          </button>
        </Link>
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
          </button>
        ))}
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
              {filtered.map(pool => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
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
    </>
  );
}
