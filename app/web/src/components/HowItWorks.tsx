"use client";

import { MousePointerClick, Zap, ShieldCheck } from "lucide-react";

export default function HowItWorks() {
  return (
    <section className="seo-section how-it-works-section">
      <div className="seo-header">
        <h2>How Rafi Works</h2>
        <p>The simplest way to win crypto on Solana. Fully decentralized.</p>
      </div>
      <div className="hiw-grid">
        <div className="hiw-card">
          <div className="hiw-icon">
            <MousePointerClick size={24} color="var(--rafi)" />
          </div>
          <h3>1. Choose a Market</h3>
          <p>Browse active raffles for premium assets like SOL, wBTC, and JTO. Pick the pool size and odds that fit your risk profile.</p>
        </div>
        <div className="hiw-card">
          <div className="hiw-icon">
            <Zap size={24} color="var(--rafi)" />
          </div>
          <h3>2. Buy Probability</h3>
          <p>Pay a fraction of the asset's value to secure your probability. Funds are locked safely in an on-chain vault.</p>
        </div>
        <div className="hiw-card">
          <div className="hiw-icon">
            <ShieldCheck size={24} color="var(--rafi)" />
          </div>
          <h3>3. Verifiable Draw</h3>
          <p>Once filled, Switchboard VRF selects a winner entirely on-chain. If you win, the prize is sent directly to your wallet.</p>
        </div>
      </div>
    </section>
  );
}
