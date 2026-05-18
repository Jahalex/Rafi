"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from "react";
import PoolCard from "@/components/PoolCard";
import { MOCK_POOLS } from "@/lib/mockData";
import { formatUsdc, formatTokenAmount } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { Trophy, ArrowUpDown, Search, Plus } from "lucide-react";
import Link from "next/link";

type SortKey = "trending" | "newest" | "ending" | "prize";

export default function ExplorerPage() {
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>("trending");
  const [view, setView] = useState<"live" | "ended">("live");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Categories ──
  const categories = [
    { key: "all",   label: "All" },
    { key: "sol",   label: "SOL",  icon: "◎" },
    { key: "wbtc",  label: "wBTC", icon: "₿" },
    { key: "weth",  label: "wETH", icon: "◆" },
    { key: "jup",   label: "JUP",  icon: "⬡" },
    { key: "jto",   label: "JTO",  icon: "◈" },
  ];

  // ── Sort ──
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "trending", label: "Trending" },
    { key: "newest",   label: "Newest" },
    { key: "ending",   label: "Ending soon" },
    { key: "prize",    label: "Highest prize" },
  ];

  // ── Filter + sort logic ──
  const pools = useMemo(() => {
    let list = MOCK_POOLS;

    // View filter
    if (view === "live") list = list.filter(p => p.state === "open" || p.state === "filled");
    else list = list.filter(p => p.state === "settled" || p.state === "expired" || p.state === "closed");

    // Category filter
    if (category !== "all") list = list.filter(p => p.asset_symbol?.toLowerCase() === category);

    // Sort
    const sorted = [...list];
    switch (sort) {
      case "trending":
        sorted.sort((a, b) => b.total_probability_sold_bps - a.total_probability_sold_bps);
        break;
      case "newest":
        sorted.sort((a, b) => b.created_at - a.created_at);
        break;
      case "ending":
        sorted.sort((a, b) => a.expires_at - b.expires_at);
        break;
      case "prize":
        sorted.sort((a, b) => b.pool_total_usdc - a.pool_total_usdc);
        break;
    }
    return sorted;
  }, [category, sort, view]);

  const settledPools = MOCK_POOLS.filter(p => p.state === "settled");

  return (
    <>
      {/* ── Category bar ── */}
      <div className="cat-bar">
        <div className="cat-pills">
          {categories.map(c => (
            <button
              key={c.key}
              className={`cat-pill ${category === c.key ? "active" : ""}`}
              onClick={() => setCategory(c.key)}
            >
              {c.icon && <span className="cat-icon">{c.icon}</span>}
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Controls row ── */}
      <div className="ctrl-row">
        <div className="ctrl-tabs">
          <button
            className={`ctrl-tab ${view === "live" ? "active" : ""}`}
            onClick={() => setView("live")}
          >
            Live
          </button>
          <button
            className={`ctrl-tab ${view === "ended" ? "active" : ""}`}
            onClick={() => setView("ended")}
          >
            Ended
          </button>
        </div>

        <div className="ctrl-right">
          <div className="ctrl-sort">
            <ArrowUpDown size={13} />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="ctrl-sort-select"
            >
              {sortOptions.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="home-grid">
        {/* ─── Feed ─── */}
        <div>
          {pools.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔭</div>
              <p>No pools found.</p>
              <Link href="/sell">
                <button className="btn btn-rafi">Create the first one</button>
              </Link>
            </div>
          ) : (
            <div className="pool-grid">
              {pools.map(pool => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
            </div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div>
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
