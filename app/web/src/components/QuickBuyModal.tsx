"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Pool } from "@/lib/supabase";
import { BPS_SCALE } from "@/lib/constants";
import { formatTokenAmount, usdcToNumber } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { X, Loader2, CheckCircle, XCircle } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { mintProbability, getConnection } from "@/lib/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { USDC_MINT_DEVNET } from "@/lib/constants";
import FillRing from "./FillRing";

interface Props {
  pool: Pool;
  onClose: () => void;
}

type TxState = "idle" | "signing" | "confirming" | "success" | "error";

const QUICK_AMOUNTS = [5, 10, 25, 50];

export default function QuickBuyModal({ pool, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const symbol = pool.asset_symbol || "?";
  const token = getTokenInfo(symbol);
  const prizeLabel = `${formatTokenAmount(pool.asset_amount, pool.asset_decimals)} ${symbol}`;
  const poolTotalUsd = usdcToNumber(pool.pool_total_usdc);
  const fillPct = (pool.total_probability_sold_bps / BPS_SCALE) * 100;
  const remainPct = 100 - fillPct;

  const numAmount = parseFloat(amount) || 0;
  const estProbability = poolTotalUsd > 0
    ? Math.min((numAmount / poolTotalUsd) * 100, remainPct)
    : 0;
  const estProbabilityBps = Math.floor(estProbability * 100);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // ── Execute on-chain mint ──
  const handleMint = useCallback(async () => {
    if (estProbabilityBps <= 0 || !pool.pool_pda) return;

    const solanaWallet = wallets.find(w => w.walletClientType === "privy") || wallets[0];
    if (!solanaWallet) {
      setTxError("No Solana wallet found. Please reconnect.");
      setTxState("error");
      return;
    }

    setTxState("signing");
    setTxError(null);
    setTxSignature(null);

    try {
      const walletPublicKey = new PublicKey(solanaWallet.address);

      const walletAdapter = {
        publicKey: walletPublicKey,
        signTransaction: async (tx: Transaction): Promise<Transaction> => {
          const connection = getConnection();
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = walletPublicKey;
          const provider = await solanaWallet.getEthereumProvider();
          const serialized = tx.serialize({ requireAllSignatures: false });
          const signedBytes = await (provider as any).request({
            method: "signTransaction",
            params: { message: Buffer.from(serialized).toString("base64") },
          });
          return Transaction.from(Buffer.from(signedBytes, "base64"));
        },
        signAllTransactions: async (txs: Transaction[]): Promise<Transaction[]> => {
          return Promise.all(txs.map(async tx => {
            const connection = getConnection();
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = walletPublicKey;
            const provider = await solanaWallet.getEthereumProvider();
            const serialized = tx.serialize({ requireAllSignatures: false });
            const signedBytes = await (provider as any).request({
              method: "signTransaction",
              params: { message: Buffer.from(serialized).toString("base64") },
            });
            return Transaction.from(Buffer.from(signedBytes, "base64"));
          }));
        },
      };

      setTxState("confirming");

      const sig = await mintProbability({
        wallet: walletAdapter as any,
        poolPda: new PublicKey(pool.pool_pda),
        usdcVault: new PublicKey(pool.pool_pda),
        usdcMint: new PublicKey(USDC_MINT_DEVNET),
        positionCount: pool.position_count,
        probabilityBps: estProbabilityBps,
      });

      setTxSignature(sig);
      setTxState("success");
      setAmount("");
      setTimeout(() => setTxState("idle"), 4000);

    } catch (err: any) {
      console.error("Mint failed:", err);
      setTxError(err?.message || "Transaction failed");
      setTxState("error");
      setTimeout(() => setTxState("idle"), 5000);
    }
  }, [estProbabilityBps, pool, wallets]);

  const isBusy = txState === "signing" || txState === "confirming";

  return (
    <div className="qb-backdrop" onClick={onClose}>
      <div
        className="qb-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Enter pool — ${prizeLabel}`}
      >
        {/* ── Close button ── */}
        <button className="qb-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* ── Pool identity header ── */}
        <div className="qb-header">
          <FillRing percent={fillPct} size={64} strokeWidth={5} urgent={fillPct >= 95}>
            {token.icon ? (
              <img
                src={token.icon}
                alt={symbol}
                width={44}
                height={44}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 22, fontWeight: 800 }}>{symbol[0]}</span>
            )}
          </FillRing>
          <div className="qb-header-text">
            <div className="qb-prize-label">Win</div>
            <div className="qb-prize">{prizeLabel}</div>
            <div className="qb-fill-info">
              <span style={{ color: fillPct >= 90 ? "#f59e0b" : "var(--rafi)", fontWeight: 600 }}>
                {fillPct.toFixed(0)}% filled
              </span>
              <span style={{ color: "var(--text-tertiary)", margin: "0 5px" }}>·</span>
              <span style={{ color: "var(--text-tertiary)" }}>{remainPct.toFixed(0)}% left</span>
            </div>
          </div>
        </div>

        {/* ── Quick pick amounts ── */}
        <div className="qb-section-label">Quick pick</div>
        <div className="qb-quick-grid">
          {QUICK_AMOUNTS.map(usd => {
            const prob = poolTotalUsd > 0
              ? Math.min((usd / poolTotalUsd) * 100, remainPct)
              : 0;
            const isSelected = amount === String(usd);
            return (
              <button
                key={usd}
                className={`qb-quick-btn ${isSelected ? "selected" : ""}`}
                onClick={() => setAmount(isSelected ? "" : String(usd))}
                disabled={isBusy}
              >
                <span className="qb-quick-amount">${usd}</span>
                <span className="qb-quick-prob">{prob.toFixed(1)}%</span>
              </button>
            );
          })}
        </div>

        {/* ── Custom amount input ── */}
        <div className="qb-input-wrap">
          <span className="qb-input-dollar">$</span>
          <input
            className="qb-input"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Custom amount"
            min="0"
            step="1"
            disabled={isBusy}
            autoFocus
          />
          {amount && (
            <button
              className="qb-input-clear"
              onClick={() => setAmount("")}
              disabled={isBusy}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Chance preview ── */}
        {numAmount > 0 && (
          <div className="qb-chance-preview">
            <span className="qb-chance-value">{estProbability.toFixed(2)}%</span>
            <span className="qb-chance-label">chance to win {prizeLabel}</span>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="qb-cta">
          {txState === "success" ? (
            <div className="qb-feedback qb-feedback-success">
              <CheckCircle size={18} />
              <div>
                <div style={{ fontWeight: 700 }}>You're in!</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{estProbability.toFixed(2)}% chance secured</div>
              </div>
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="qb-solscan"
                >
                  View ↗
                </a>
              )}
            </div>
          ) : txState === "error" ? (
            <div className="qb-feedback qb-feedback-error">
              <XCircle size={18} />
              <span>{txError || "Transaction failed"}</span>
            </div>
          ) : !authenticated ? (
            <button className="btn btn-rafi btn-full btn-lg" onClick={login}>
              Log in to enter
            </button>
          ) : (
            <button
              className="btn btn-rafi btn-full btn-lg"
              onClick={handleMint}
              disabled={numAmount <= 0 || estProbabilityBps <= 0 || isBusy}
            >
              {isBusy ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  {txState === "signing" ? "Approve in wallet…" : "Confirming…"}
                </>
              ) : numAmount > 0 ? (
                `Enter for $${numAmount}`
              ) : (
                "Choose an amount"
              )}
            </button>
          )}
        </div>

        <div className="qb-footer-note">
          Provably fair · On-chain VRF · No house edge
        </div>
      </div>
    </div>
  );
}
