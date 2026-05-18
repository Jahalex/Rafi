"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { PublicKey } from "@solana/web3.js";
import { Trophy, Clock, RefreshCw, ArrowUpRight, Wallet, Zap, TrendingUp, AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useMyPositions } from "@/lib/hooks";
import { usePool } from "@/lib/hooks";
import { formatUsdc, bpsToPercent, shortenAddress, timeRemaining, drawCountdown } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { claimRefund, claimAssetBack, getPositionPda, getAssetVault, getUsdcVault, getPoolPda } from "@/lib/anchor";
import { USDC_MINT_DEVNET } from "@/lib/constants";
import LoginModal from "@/components/LoginModal";

// ── Position row with live pool data + claim actions ──
function PositionRow({
  position,
  wallet,
  onClaimed,
}: {
  position: ReturnType<typeof useMyPositions>["positions"][number];
  wallet: { publicKey: PublicKey; signTransaction: (tx: any) => Promise<any>; signAllTransactions: (txs: any[]) => Promise<any[]> } | null;
  onClaimed: () => void;
}) {
  const { pool } = usePool(position.pool_id);
  const [txState, setTxState] = useState<"idle" | "signing" | "confirming" | "done" | "error">("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  if (!pool) return null;

  const token = getTokenInfo(pool.asset_symbol || "?");
  const symbol = pool.asset_symbol || "?";
  const isExpired = pool.state === "expired" || pool.state === "closed";
  const isSettled = pool.state === "settled";
  const isWinner = isSettled && pool.winner?.toLowerCase() === wallet?.publicKey.toString().toLowerCase();
  const canRefund = isExpired && !position.is_refunded && wallet;

  const fillPct = (pool.total_probability_sold_bps / 10000) * 100;
  const isFilled = pool.state === "filled";
  const drawLeft = isFilled ? drawCountdown(pool.filled_at) : null;

  // ── State badge ──
  let stateBadge: { label: string; color: string; icon: React.ReactNode } | null = null;
  if (isWinner) {
    stateBadge = { label: "You won! 🏆", color: "var(--rafi)", icon: <Trophy size={12} /> };
  } else if (isSettled) {
    stateBadge = { label: "Draw closed", color: "var(--text-tertiary)", icon: <XCircle size={12} /> };
  } else if (isExpired) {
    stateBadge = { label: position.is_refunded ? "Refunded" : "Expired", color: position.is_refunded ? "var(--text-tertiary)" : "var(--red)", icon: <AlertCircle size={12} /> };
  } else if (isFilled) {
    stateBadge = { label: drawLeft === "Ready" ? "Draw launching…" : `Draw in ${drawLeft}`, color: "var(--rafi)", icon: <Zap size={12} /> };
  } else {
    stateBadge = { label: `${fillPct.toFixed(0)}% filled`, color: "var(--text-secondary)", icon: <TrendingUp size={12} /> };
  }

  const handleClaim = useCallback(async () => {
    if (!wallet || !pool || position.is_refunded) return;
    setTxState("signing");
    setTxError(null);
    try {
      const poolPda = new PublicKey(pool.pool_pda);
      const positionPda = getPositionPda(poolPda, position.position_index);
      const usdcVault = new PublicKey(pool.usdc_vault!);
      const usdcMint = new PublicKey(USDC_MINT_DEVNET);

      setTxState("confirming");
      const sig = await claimRefund({ poolPda, positionPda, usdcVault, usdcMint, wallet });
      setTxSig(sig);
      setTxState("done");
      onClaimed();
    } catch (err: any) {
      setTxError(err?.message || "Transaction failed");
      setTxState("error");
    }
  }, [wallet, pool, position, onClaimed]);

  return (
    <div className="portfolio-row">
      {/* Pool info */}
      <div className="portfolio-row-left">
        <div className="portfolio-token-icon">
          {token.icon
            ? <img src={token.icon} width={36} height={36} alt={symbol} style={{ borderRadius: 10 }} />
            : <div style={{ width: 36, height: 36, background: "var(--rafi-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "var(--rafi)" }}>{symbol[0]}</div>
          }
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{symbol} pool #{pool.pool_id}</span>
            {stateBadge && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 600, padding: "2px 8px",
                borderRadius: 20, background: `${stateBadge.color}18`, color: stateBadge.color
              }}>
                {stateBadge.icon}{stateBadge.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
            <span style={{ color: "var(--rafi)", fontWeight: 600 }}>{bpsToPercent(position.probability_bps)}</span> chance
            {" · "}paid <strong>{formatUsdc(position.usdc_paid)}</strong>
            {" · "}range {position.range_start_bps}–{position.range_end_bps} bps
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isWinner && (
          <div style={{ fontSize: 13, color: "var(--rafi)", fontWeight: 700 }}>
            🏆 You won {formatUsdc(pool.pool_total_usdc * (1 - pool.fee_bps / 10000))} USDC
          </div>
        )}

        {canRefund && txState === "idle" && (
          <button
            className="btn-primary"
            onClick={handleClaim}
            style={{ fontSize: 13, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={13} />
            Claim refund
          </button>
        )}

        {txState === "signing" && (
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={13} className="spin" /> Sign in wallet…
          </span>
        )}
        {txState === "confirming" && (
          <span style={{ fontSize: 13, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={13} className="spin" /> Confirming…
          </span>
        )}
        {txState === "done" && (
          <span style={{ fontSize: 13, color: "var(--green)", display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={13} /> Refunded!
            {txSig && (
              <a href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--rafi)", fontSize: 12 }}>
                <ArrowUpRight size={12} />
              </a>
            )}
          </span>
        )}
        {txState === "error" && (
          <span style={{ fontSize: 12, color: "var(--red)" }}>
            {txError || "Error"}
          </span>
        )}

        <Link
          href={`/pool/${pool.pool_id}`}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", color: "var(--text-tertiary)" }}
        >
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}

// ── Main Portfolio page ──
export default function PortfolioPage() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [loginOpen, setLoginOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const wallet = wallets[0] ?? null;
  const walletAddress = wallet?.address;

  const { positions, loading } = useMyPositions(walletAddress);

  const solanaWallet = walletAddress ? {
    publicKey: new PublicKey(walletAddress),
    signTransaction: async (tx: any) => {
      const provider = await wallets[0].getEthereumProvider().catch(() => null);
      return tx;
    },
    signAllTransactions: async (txs: any[]) => txs,
  } : null;

  const handleClaimed = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  // ── Stats ──
  const totalInvested = positions.reduce((s, p) => s + p.usdc_paid, 0);
  const activeCount = positions.filter(p => !p.is_refunded).length;
  const refundedCount = positions.filter(p => p.is_refunded).length;

  if (!authenticated) {
    return (
      <>
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>👻</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Your portfolio</h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: 15, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
            Connect your wallet to see your positions, track your chances, and claim refunds.
          </p>
          <button className="btn-primary" onClick={() => setLoginOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", fontSize: 15 }}>
            <Wallet size={16} />
            Connect wallet
          </button>
        </div>
        {loginOpen && <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />}
      </>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Portfolio</h1>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
          <Wallet size={12} />
          {shortenAddress(walletAddress || "")}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { icon: <TrendingUp size={16} color="var(--rafi)" />, label: "Total invested", value: formatUsdc(totalInvested) },
          { icon: <Zap size={16} color="var(--rafi)" />, label: "Active positions", value: `${activeCount}` },
          { icon: <CheckCircle2 size={16} color="var(--green)" />, label: "Refunded", value: `${refundedCount}` },
        ].map(({ icon, label, value }) => (
          <div key={label} className="pool-stat-card" style={{ padding: "18px 20px" }}>
            <div className="pool-stat-icon">{icon}</div>
            <div className="pool-stat-label">{label}</div>
            <div className="pool-stat-value">{value}</div>
          </div>
        ))}
      </div>

      {/* Positions */}
      <div className="pool-info-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>My positions</h2>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-tertiary)" }}
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-tertiary)" }}>
            <Loader2 size={24} className="spin" style={{ margin: "0 auto 12px" }} />
            <p>Loading positions…</p>
          </div>
        ) : positions.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No positions yet</div>
            <div style={{ color: "var(--text-tertiary)", fontSize: 14, marginBottom: 24 }}>
              Enter a pool to start accumulating chances to win.
            </div>
            <Link href="/" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 24px", textDecoration: "none" }}>
              Browse pools
            </Link>
          </div>
        ) : (
          <div key={refreshKey}>
            {positions.map(pos => (
              <PositionRow
                key={pos.id}
                position={pos}
                wallet={solanaWallet}
                onClaimed={handleClaimed}
              />
            ))}
          </div>
        )}
      </div>

      {/* Help section */}
      {positions.some(p => {
        // Has refundable positions
        return true;
      }) && (
        <div style={{ marginTop: 20, padding: "16px 20px", background: "var(--rafi-dim)", border: "1px solid var(--rafi-border)", borderRadius: "var(--radius-md)", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Clock size={16} color="var(--rafi)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <strong>Pool didn't fill?</strong> If a pool expires before reaching 100%, your USDC is automatically refundable on-chain. Click "Claim refund" to get it back.
          </div>
        </div>
      )}
    </div>
  );
}
