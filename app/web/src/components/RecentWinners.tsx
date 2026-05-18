"use client";

import { Pool } from "@/lib/supabase";
import { formatTokenAmount } from "@/lib/format";
import { ArrowRight, Trophy } from "lucide-react";

export default function RecentWinners({ pools }: { pools: Pool[] }) {
  // Only show settled pools that have a winner
  const winners = pools.filter(p => p.state === "settled" && p.winner).slice(0, 5);

  if (winners.length === 0) return null;

  return (
    <div className="recent-winners-marquee">
      <div className="recent-winners-inner">
        <div className="recent-winners-label">
          <Trophy size={14} color="var(--rafi)" /> Live Winners:
        </div>
        <div className="recent-winners-scroll">
          <div className="recent-winners-track">
            {winners.map((w, i) => (
              <div key={i} className="recent-winner-item">
                <span className="rw-prize">
                  {formatTokenAmount(w.asset_amount, w.asset_decimals)} {w.asset_symbol}
                </span>
                <ArrowRight size={12} color="var(--text-tertiary)" />
                <span className="rw-wallet">
                  {w.winner!.slice(0, 4)}...{w.winner!.slice(-4)}
                </span>
              </div>
            ))}
            {/* Duplicate for infinite scroll effect */}
            {winners.map((w, i) => (
              <div key={`dup-${i}`} className="recent-winner-item">
                <span className="rw-prize">
                  {formatTokenAmount(w.asset_amount, w.asset_decimals)} {w.asset_symbol}
                </span>
                <ArrowRight size={12} color="var(--text-tertiary)" />
                <span className="rw-wallet">
                  {w.winner!.slice(0, 4)}...{w.winner!.slice(-4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
