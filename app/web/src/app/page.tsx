"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import PoolCard from "@/components/PoolCard";
import QuickBuyModal from "@/components/QuickBuyModal";
import { MOCK_POOLS } from "@/lib/mockData";
import { Pool } from "@/lib/supabase";
import RecentWinners from "@/components/RecentWinners";
import HowItWorks from "@/components/HowItWorks";
import Faq from "@/components/Faq";
import { ChevronDown, Plus, TrendingUp, Zap, ShieldCheck } from "lucide-react";
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
  { key: "all",   label: "Trending", icon: <TrendingUp size={14} /> },
  { key: "SOL",   label: "SOL",  img: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { key: "wBTC",  label: "wBTC", img: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { key: "wETH",  label: "wETH", img: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { key: "JTO",   label: "JTO",  img: "https://assets.coingecko.com/coins/images/34188/small/jup.png" },
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
      {/* ── Brutalist Conversion Hero ── */}
      {!authenticated && (
        <div className="brutalist-hero">
          <div className="brutalist-hero-inner">
            <h1 className="brutalist-title">Win Premium Crypto Assets for a Fraction of the Cost.</h1>
            <h2 className="brutalist-subtitle">
              The first on-chain probability exchange. No house edge. Pure mathematical fairness powered by Solana VRF.
            </h2>
            <div className="brutalist-cta-wrap">
              <button className="btn btn-rafi btn-massive" onClick={login}>
                Connect Wallet to Play
              </button>
              <div className="brutalist-social-proof">
                <ShieldCheck size={16} color="var(--rafi)" /> Audited Smart Contracts &nbsp;•&nbsp; Join 15,000+ wallets
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Winners Ticker ── */}
      <RecentWinners pools={MOCK_POOLS} />

      {/* ── Functional Subnav (formerly in layout.tsx) ── */}
      <nav className="subnav page-subnav">
        {ASSET_TABS.map(t => {
          if (t.key === "ended") return null; // Handle ended differently or keep at end
          return (
            <button
              key={t.key}
              className={`subnav-link ${assetTab === t.key ? "active" : ""}`}
              onClick={() => setAssetTab(t.key)}
            >
              {t.icon && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{t.icon}</span>}
              {t.img && <img src={t.img} width={16} height={16} style={{ borderRadius: 8 }} alt={t.label} />}
              {t.label}
            </button>
          );
        })}
        <div className="subnav-sep" />
        <button
          className={`subnav-link ${assetTab === "ended" ? "active" : ""}`}
          onClick={() => setAssetTab("ended")}
        >
          Ended
        </button>
      </nav>

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

      {/* ── SEO & Conversion Sections ── */}
      <div className="home-seo-sections">
        <HowItWorks />
        <Faq />
      </div>
    </>
  );
}
