"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import PoolCard from "@/components/PoolCard";
import QuickBuyModal from "@/components/QuickBuyModal";
import { MOCK_POOLS } from "@/lib/mockData";
import { Pool } from "@/lib/supabase";
import { ChevronDown, Plus, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

type SortKey = "fill" | "newest" | "prize" | "ending";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "fill",   label: "Most filled"   },
  { key: "newest", label: "Newest"         },
  { key: "prize",  label: "Biggest prize"  },
  { key: "ending", label: "Ending soon"    },
];

const ASSET_TABS = [
  { key: "all",   label: "All"   },
  { key: "SOL",   label: "◎ SOL" },
  { key: "wBTC",  label: "₿ wBTC"},
  { key: "wETH",  label: "Ξ wETH"},
  { key: "JTO",   label: "JTO"   },
  { key: "ended", label: "Ended" },
];

function sortPools(pools: Pool[], sort: SortKey): Pool[] {
  return [...pools].sort((a, b) => {
    switch (sort) {
      case "fill":
        return b.total_probability_sold_bps - a.total_probability_sold_bps;
      case "newest":
        return b.created_at - a.created_at;
      case "prize":
        return b.pool_total_usdc - a.pool_total_usdc;
      case "ending":
        return a.expires_at - b.expires_at;
      default:
        return 0;
    }
  });
}

export default function HomePage() {
  const { authenticated, login }          = usePrivy();
  const [assetTab, setAssetTab]           = useState("all");
  const [sort, setSort]                   = useState<SortKey>("fill");
  const [sortOpen, setSortOpen]           = useState(false);
  const [selectedPool, setSelectedPool]   = useState<Pool | null>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    const handler = () => setSortOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [sortOpen]);

  // ── Filter ──
  const filtered = useMemo(() => {
    let pools: Pool[];
    if (assetTab === "ended") {
      pools = MOCK_POOLS.filter(p => p.state === "settled" || p.state === "expired" || p.state === "closed" || p.state === "filled");
    } else if (assetTab === "all") {
      // Priority 1: Default view ONLY shows active (open) markets.
      pools = MOCK_POOLS.filter(p => p.state === "open");
    } else {
      pools = MOCK_POOLS.filter(
        p => p.state === "open" && p.asset_symbol === assetTab
      );
    }
    return sortPools(pools, sort);
  }, [assetTab, sort]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.key === sort)?.label ?? "Sort";

  return (
    <>
      {/* ── Unauthenticated Hero Section ── */}
      {!authenticated && (
        <div className="home-hero-banner">
          <div className="home-hero-content">
            <h1 className="home-hero-title">Take your shot. Win premium assets on-chain.</h1>
            <p className="home-hero-subtitle">
              Provably fair, decentralized raffles powered by Solana. No house edge, pure opportunity.
            </p>
            <div className="home-hero-actions">
              <button className="btn btn-rafi btn-lg" onClick={login}>
                <Zap size={16} /> Connect Wallet
              </button>
              <div className="home-hero-trust">
                <ShieldCheck size={14} /> 100% on-chain VRF
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="home-header">
        <h2 className="home-title">Active Markets</h2>
        <div className="home-toolbar">

          {/* Sort dropdown */}
          <div className="sort-wrap">
            <button
              className="sort-btn"
              onClick={e => { e.stopPropagation(); setSortOpen(v => !v); }}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
            >
              {currentSortLabel}
              <ChevronDown size={14} style={{ transition: "transform 0.15s", transform: sortOpen ? "rotate(180deg)" : "none" }} />
            </button>
            {sortOpen && (
              <div className="sort-dropdown" role="listbox">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    className={`sort-option ${sort === opt.key ? "active" : ""}`}
                    onClick={e => { e.stopPropagation(); setSort(opt.key); setSortOpen(false); }}
                    role="option"
                    aria-selected={sort === opt.key}
                  >
                    {opt.label}
                    {sort === opt.key && <span className="sort-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create pool CTA */}
          <Link href="/sell">
            <button className="btn btn-rafi home-create-btn">
              <Plus size={15} />
              Create
            </button>
          </Link>
        </div>
      </div>

      {/* ── Asset tabs ── */}
      <div className="tabs home-tabs">
        {ASSET_TABS.map(t => (
          <button
            key={t.key}
            className={`tab-pill ${assetTab === t.key ? "active" : ""}`}
            onClick={() => setAssetTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pool grid ── */}
      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔭</div>
          <p>No pools in this category yet.</p>
          <Link href="/sell">
            <button className="btn btn-rafi">Be the first — create a pool</button>
          </Link>
        </div>
      ) : (
        <div className="pools-grid">
          {filtered.map(pool => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onQuickBuy={setSelectedPool}
            />
          ))}
        </div>
      )}

      {/* ── QuickBuy Modal ── */}
      {selectedPool && (
        <QuickBuyModal
          pool={selectedPool}
          onClose={() => setSelectedPool(null)}
        />
      )}
    </>
  );
}
