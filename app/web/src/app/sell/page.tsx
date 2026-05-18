"use client";

import { useState, useCallback, useEffect } from "react";
import { BPS_SCALE, USDC_DECIMALS, POOL_DURATIONS } from "@/lib/constants";
import { formatMultiplier } from "@/lib/format";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPool, getConnection } from "@/lib/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { Loader2, CheckCircle, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import LoginModal from "@/components/LoginModal";
import { usePythPrice } from "@/lib/usePythPrice";
import { minUsdcRaw, formatMinUsdc } from "@/lib/pyth";

type TxState = "idle" | "signing" | "confirming" | "success" | "error";

export default function SellPage() {
  const [asset, setAsset] = useState("SOL");
  const [amount, setAmount] = useState("10");
  const [multiplier, setMultiplier] = useState(13500);
  const [durationSecs, setDurationSecs] = useState(7 * 86_400); // default 7 days
  const [minProbPct, setMinProbPct] = useState("1");

  const [txState, setTxState] = useState<TxState>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  // SOL-only for devnet (wrapped SOL = SPL token)
  const ASSET_MINTS: Record<string, { mint: string; decimals: number }> = {
    SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  };

  // Live SOL price from Pyth Hermes (30s cache)
  const { price: pythPrice, loading: priceLoading, refresh: refreshPrice } = usePythPrice(asset);
  const solUsd = pythPrice?.price || 0;

  const numAmount = parseFloat(amount) || 0;
  const assetValue = numAmount * solUsd;
  const target = assetValue * (multiplier / BPS_SCALE);
  const fee = target * 0.05; // 5% protocol fee
  const net = target - fee;

  const assetConfig = ASSET_MINTS[asset];
  const assetAmountRaw = assetConfig ? Math.floor(numAmount * Math.pow(10, assetConfig.decimals)) : 0;
  const poolTotalUsdc = Math.floor(target * Math.pow(10, USDC_DECIMALS));
  const minProbBps = Math.floor(parseFloat(minProbPct) * 100);

  // ── Minimum pool validation (mirrors on-chain check) ──────────────────────
  // min = 1 SOL equivalent in USDC at current Pyth price.
  const minUsdc = solUsd > 0 ? minUsdcRaw(solUsd, 1) : null;
  const belowMinimum = minUsdc !== null && poolTotalUsdc < minUsdc && numAmount > 0;
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (assetAmountRaw <= 0 || !assetConfig) return;
    if (belowMinimum) return; // guard — should never reach on-chain

    const solanaWallet = wallets.find(w => w.walletClientType === "privy") || wallets[0];
    if (!solanaWallet) {
      setTxError("No wallet found. Please reconnect.");
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
          const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
          const base64 = Buffer.from(serialized).toString("base64");
          const result = await (solanaWallet as any).sendRpc?.("signTransaction", [base64]);
          if (result?.signedTransaction) {
            return Transaction.from(Buffer.from(result.signedTransaction, "base64"));
          }
          throw new Error("Wallet does not support signing");
        },
        signAllTransactions: async (txs: Transaction[]): Promise<Transaction[]> => {
          const signed: Transaction[] = [];
          for (const tx of txs) signed.push(await walletAdapter.signTransaction(tx));
          return signed;
        },
      };

      setTxState("confirming");

      const sig = await createPool({
        assetMint: new PublicKey(assetConfig.mint),
        assetAmount: assetAmountRaw,
        multiplierBps: multiplier,
        minProbabilityBps: minProbBps,
        durationSecs,
        poolTotalUsdc,
        wallet: walletAdapter,
      });

      setTxSignature(sig);
      setTxState("success");
    } catch (err: any) {
      console.error("Create pool failed:", err);
      const msg = err?.message || "Transaction failed";
      if (msg.includes("PoolBelowMinimumValue"))
        setTxError(`Pool below minimum (${formatMinUsdc(minUsdc!)} = 1 SOL)`);
      else if (msg.includes("StalePriceFeed"))
        setTxError("Price feed stale — retry in a few seconds");
      else if (msg.includes("MultiplierOutOfRange"))
        setTxError("Multiplier must be ×1.1–×1.8");
      else if (msg.includes("InvalidPoolDuration"))
        setTxError("Invalid duration");
      else if (msg.includes("ZeroAssetAmount"))
        setTxError("Amount must be > 0");
      else if (msg.includes("ProtocolPaused"))
        setTxError("Protocol paused");
      else if (msg.includes("0x1"))
        setTxError("Insufficient balance");
      else if (msg.includes("rejected"))
        setTxError("Rejected");
      else
        setTxError(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
      setTxState("error");
      setTimeout(() => { setTxState("idle"); setTxError(null); }, 6000);
    }
  }, [assetAmountRaw, assetConfig, wallets, multiplier, minProbBps, durationSecs, poolTotalUsdc, belowMinimum, minUsdc]);

  const renderCTA = () => {
    if (!authenticated) {
      return (
        <button className="btn btn-rafi btn-full btn-lg" onClick={() => setLoginOpen(true)}>
          Log In to Create
        </button>
      );
    }

    if (txState === "signing" || txState === "confirming") {
      return (
        <button className="btn btn-rafi btn-full btn-lg" disabled style={{ opacity: 0.7 }}>
          <Loader2 size={18} className="spinner" style={{ marginRight: 8 }} />
          {txState === "signing" ? "Approve in wallet…" : "Creating pool…"}
        </button>
      );
    }

    if (txState === "success") {
      return (
        <button className="btn btn-full btn-lg" disabled style={{
          background: "var(--rafi-dim)", color: "var(--rafi)", border: "1.5px solid var(--rafi)", cursor: "default",
        }}>
          <CheckCircle size={18} style={{ marginRight: 8 }} />
          Pool created! {txSignature ? `${txSignature.slice(0, 8)}…` : ""}
        </button>
      );
    }

    if (txState === "error") {
      return (
        <button className="btn btn-full btn-lg" onClick={() => setTxState("idle")} style={{
          background: "var(--red-dim)", color: "var(--red)", border: "1.5px solid var(--red)", cursor: "pointer",
        }}>
          <XCircle size={18} style={{ marginRight: 8 }} />
          {txError || "Failed"} — Tap to retry
        </button>
      );
    }

    const canCreate = numAmount > 0 && !belowMinimum && !priceLoading;

    return (
      <button
        className="btn btn-rafi btn-full btn-lg"
        onClick={handleCreate}
        disabled={!canCreate}
        style={!canCreate ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
        Create pool — {amount} {asset}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 580, margin: "0 auto", paddingTop: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Create a pool</h1>
      <p className="text-secondary" style={{ marginBottom: 32, fontSize: 15 }}>
        Lock an asset. Set your premium. Let the pool fill — one winner takes it all.
      </p>

      <div className="create-form">
        {/* Asset + Amount */}
        <div className="form-group">
          <label className="form-label">Asset</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <select className="form-input" value={asset} onChange={e => setAsset(e.target.value)}>
              <option value="SOL">◎ SOL</option>
            </select>
            <input
              className="form-input"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount"
              min="0"
              step="0.1"
            />
          </div>

          {/* Live price row */}
          {priceLoading ? (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
              Fetching price…
            </div>
          ) : solUsd > 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>
                1 {asset} = ${solUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                {numAmount > 0 && ` · ${numAmount} ${asset} ≈ $${assetValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
              </span>
              <button onClick={refreshPrice} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <RefreshCw size={11} color="var(--text-tertiary)" />
              </button>
              <span style={{ fontSize: 10, color: "var(--rafi)", fontWeight: 600 }}>Pyth</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--red)", marginTop: 6 }}>
              Price unavailable — check connection
            </div>
          )}

          {/* Minimum pool warning */}
          {belowMinimum && minUsdc !== null && (
            <div style={{
              marginTop: 10, padding: "10px 14px", borderRadius: 10,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13,
            }}>
              <AlertTriangle size={15} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                <strong>Pool too small.</strong> Minimum is <strong>{formatMinUsdc(minUsdc)}</strong> (1 SOL at current price).
                Enter at least <strong>{(minUsdc / 1_000_000 / solUsd / (multiplier / BPS_SCALE)).toFixed(3)} {asset}</strong> to meet this threshold.
              </span>
            </div>
          )}
        </div>

        {/* Multiplier */}
        <div className="form-group">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Premium multiplier</label>
            <span style={{ fontWeight: 700, color: "var(--rafi)" }}>{formatMultiplier(multiplier)}</span>
          </div>
          <input
            type="range" min={11000} max={18000} step={500} value={multiplier}
            onChange={e => setMultiplier(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--rafi)" }}
            disabled={txState === "signing" || txState === "confirming"}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
            <span>×1.10 (easiest to fill)</span>
            <span>×1.80 (max premium)</span>
          </div>
        </div>

        {/* Duration — 4 fixed options only */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Duration</label>
            <select
              className="form-input"
              value={durationSecs}
              onChange={e => setDurationSecs(Number(e.target.value))}
              disabled={txState === "signing" || txState === "confirming"}
            >
              {POOL_DURATIONS.map(d => (
                <option key={d.secs} value={d.secs}>{d.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              Auto-refund if not 100% filled
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Min entry</label>
            <select
              className="form-input"
              value={minProbPct}
              onChange={e => setMinProbPct(e.target.value)}
              disabled={txState === "signing" || txState === "confirming"}
            >
              <option value="0.1">0.1%</option>
              <option value="1">1%</option>
              <option value="5">5%</option>
            </select>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              Minimum per buyer
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="form-summary">
          <div className="form-summary-row">
            <span className="text-secondary">Pool target</span>
            <span style={{ fontWeight: 600 }}>${target.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="form-summary-row">
            <span className="text-secondary">Protocol fee (5%)</span>
            <span style={{ color: "var(--red)", fontWeight: 500 }}>-${fee.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="form-summary-row" style={{ borderTop: "1px solid var(--border-default)", paddingTop: 10, marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>You receive when drawn</span>
            <span style={{ fontWeight: 700, color: "var(--rafi)" }}>${net.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          {minUsdc !== null && solUsd > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border-light)", fontSize: 12, color: "var(--text-tertiary)", display: "flex", justifyContent: "space-between" }}>
              <span>Minimum pool size</span>
              <span style={{ color: belowMinimum ? "var(--red)" : "var(--text-secondary)", fontWeight: 500 }}>
                {formatMinUsdc(minUsdc)} = 1 SOL at ${solUsd.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {renderCTA()}

        <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
          Your {asset} is locked in a PDA escrow until the pool draws or the {POOL_DURATIONS.find(d => d.secs === durationSecs)?.label} expire.
          If it expires unfilled, your {asset} is returned automatically.
        </p>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
