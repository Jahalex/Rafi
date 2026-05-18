"use client";

import { useState, useMemo, useCallback } from "react";
import { Pool } from "@/lib/supabase";
import { BPS_SCALE } from "@/lib/constants";
import { formatUsdc, formatTokenAmount, usdcToNumber } from "@/lib/format";
import { getTokenInfo } from "@/lib/tokens";
import { Info, Loader2, CheckCircle, XCircle } from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import LoginModal from "./LoginModal";
import { mintProbability, getConnection } from "@/lib/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { USDC_MINT_DEVNET } from "@/lib/constants";

interface Props {
  pool: Pool;
  onMintSuccess?: () => void;
}

type TxState = "idle" | "signing" | "confirming" | "success" | "error";

export default function BuySlider({ pool, onMintSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const symbol = pool.asset_symbol || "?";
  const token = getTokenInfo(symbol);

  const poolTotalUsd = usdcToNumber(pool.pool_total_usdc);
  const numAmount = parseFloat(amount) || 0;
  const fillPct = (pool.total_probability_sold_bps / BPS_SCALE) * 100;
  const remainPct = 100 - fillPct;
  const estProbability = poolTotalUsd > 0 ? Math.min((numAmount / poolTotalUsd) * 100, remainPct) : 0;
  const estProbabilityBps = Math.floor(estProbability * 100);
  const prizeLabel = `${formatTokenAmount(pool.asset_amount, pool.asset_decimals)} ${symbol}`;

  const addAmount = (add: number) => {
    setAmount(prev => String((parseFloat(prev) || 0) + add));
  };

  const quickOptions = useMemo(() => {
    return [5, 25, 100].map(usd => ({
      usd,
      probability: poolTotalUsd > 0 ? Math.min((usd / poolTotalUsd) * 100, remainPct) : 0,
    }));
  }, [poolTotalUsd, remainPct]);

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
        usdcVault: new PublicKey(pool.pool_pda), // TODO: derive actual vault PDA
        usdcMint: new PublicKey(USDC_MINT_DEVNET),
        positionCount: pool.position_count,
        probabilityBps: estProbabilityBps,
      });

      setTxSignature(sig);
      setTxState("success");
      onMintSuccess?.();
      setAmount("");

      setTimeout(() => setTxState("idle"), 3000);

    } catch (err: any) {
      console.error("Mint failed:", err);
      setTxError(err?.message || "Transaction failed");
      setTxState("error");
      setTimeout(() => setTxState("idle"), 5000);
    }
  }, [estProbabilityBps, pool, wallets, onMintSuccess]);

  const isPoolActive = pool.state === "open" && fillPct < 100;

  const renderCTA = () => {
    if (!isPoolActive) {
      return (
        <button className="order-submit-btn" disabled>
          Pool closed
        </button>
      );
    }

    if (txState === "signing" || txState === "confirming") {
      return (
        <button className="order-submit-btn" disabled>
          <Loader2 size={16} className="spinner" />
          {txState === "signing" ? "Sign in wallet…" : "Confirming…"}
        </button>
      );
    }

    if (txState === "success") {
      return (
        <div className="tx-feedback success">
          <CheckCircle size={16} />
          <span>You're in! {estProbability.toFixed(2)}% chance secured</span>
          {txSignature && (
            <a href={`https://solscan.io/tx/${txSignature}?cluster=devnet`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--rafi)" }}>
              View on Solscan ↗
            </a>
          )}
        </div>
      );
    }

    if (txState === "error") {
      return (
        <div className="tx-feedback error">
          <XCircle size={16} />
          <span>{txError || "Something went wrong"}</span>
        </div>
      );
    }

    if (!authenticated) {
      return (
        <button className="order-submit-btn" onClick={() => setLoginOpen(true)}>
          Log In to Enter
        </button>
      );
    }

    return (
      <button className="order-submit-btn" disabled={numAmount <= 0 || estProbabilityBps <= 0}
        onClick={handleMint}>
        {numAmount > 0 ? `Enter for $${numAmount}` : "Enter an amount"}
      </button>
    );
  };

  return (
    <div className="order-panel">
      {/* Header — the prize */}
      <div className="order-panel-header">
        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", overflow: "hidden", flexShrink: 0 }}>
          {token.icon ? (
            <img src={token.icon} width={36} height={36} alt={symbol} style={{ objectFit: "cover" }} />
          ) : (
            <div className="order-panel-icon">{symbol[0]}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Win
          </div>
          <div className="order-panel-label">
            {prizeLabel}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Left</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--rafi)" }}>{remainPct.toFixed(0)}%</div>
        </div>
      </div>

      <div className="order-panel-inner">
        {/* Quick picks */}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          Pick your shot <Info size={13} color="var(--text-tertiary)" />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {quickOptions.map(opt => (
            <div key={opt.usd} onClick={() => setAmount(String(opt.usd))}
              className={`quick-pick ${amount === String(opt.usd) ? "active" : ""}`}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>${opt.usd}</div>
              <div className="quick-pick-chance">
                {opt.probability.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        {/* Custom amount */}
        <div className="order-amount-row">
          <div className="order-amount-label">Or enter custom</div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 32, fontWeight: 600, color: amount ? "var(--text-primary)" : "var(--text-tertiary)" }}>$</span>
            <input type="number" className={`order-amount-input ${amount ? "has-val" : ""}`}
              value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
              disabled={txState === "signing" || txState === "confirming"} />
          </div>
        </div>

        <div className="order-quick-btns">
          {[1, 5, 10, 100].map(v => (
            <button key={v} className="order-quick-btn" onClick={() => addAmount(v)}
              disabled={txState === "signing" || txState === "confirming"}>+${v}</button>
          ))}
        </div>

        {/* Summary — only your chance, big and green */}
        {numAmount > 0 && (
          <div className="order-chance-hero">
            <div className="order-chance-label">Your chance of winning</div>
            <div className="order-chance-value">{estProbability.toFixed(2)}%</div>
            <div className="order-chance-sub">
              for {prizeLabel}
            </div>
          </div>
        )}

        {renderCTA()}

        <div className="order-tos">
          Provably fair · On-chain VRF · <a href="#">How it works</a>
        </div>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
