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
  const [activeTab, setActiveTab] = useState("all");
  const [mounted, setMounted] = useState(false);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Data ──
  const openPools = MOCK_POOLS.filter(p => p.state === "open");
  const filledPools = MOCK_POOLS.filter(p => p.state === "filled");
  const settledPools = MOCK_POOLS.filter(p => p.state === "settled");
  const livePools = [...openPools, ...filledPools];

  // ── Tabs: simple & useful ──
  const tabs = [
    { key: "all",      label: "All" },
    { key: "sol",      label: "SOL" },
    { key: "wbtc",     label: "wBTC" },
    { key: "weth",     label: "wETH" },
    { key: "jup",      label: "JUP" },
    { key: "jto",      label: "JTO" },
    { key: "bonk",     label: "BONK" },
    { key: "settled",  label: "Ended" },
  ];

  const filtered = activeTab === "settled" ? settledPools : 
                   activeTab === "all" ? livePools :
                   livePools.filter(p => p.asset_symbol?.toLowerCase() === activeTab);

  return (
    <>
      {/* ── Top Header ── */}
      <div className="home-header" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Pools</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}>
            Sort: Volume
          </button>
          <Link href="/sell">
            <button className="btn btn-rafi" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}>
              <Plus size={16} /> Create
            </button>
          </Link>
        </div>
      </div>

      {/* ── Horizontal Tags Bar ── */}
      <div className="tags-bar">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tag-pill ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="home-grid">
        {filtered.length === 0 ? (
          <div className="empty" style={{ gridColumn: "1 / -1" }}>
            <div className="empty-icon">🔭</div>
            <p>No pools in this category yet.</p>
            <Link href="/sell">
              <button className="btn btn-rafi">Create the first one</button>
            </Link>
          </div>
        ) : (
          <div className="markets-grid">
            {filtered.map(pool => (
              <PoolCard 
                key={pool.id} 
                pool={pool} 
                onQuickBuy={(p) => {
                  setSelectedPool(p);
                  setBuyModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Buy Modal */}
      <QuickBuyModal 
        pool={selectedPool}
        isOpen={buyModalOpen}
        onClose={() => setBuyModalOpen(false)}
      />
    </>
  );
}
