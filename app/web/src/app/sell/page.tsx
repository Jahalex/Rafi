"use client";
export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect, useRef } from "react";
import { BPS_SCALE, USDC_DECIMALS, POOL_DURATIONS } from "@/lib/constants";
import { formatMultiplier } from "@/lib/format";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPool, getConnection } from "@/lib/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { Loader2, CheckCircle, XCircle, RefreshCw, AlertTriangle, ChevronRight, ChevronLeft } from "lucide-react";
import { usePythPrice } from "@/lib/usePythPrice";
import { minUsdcRaw, formatMinUsdc } from "@/lib/pyth";

type TxState = "idle" | "signing" | "confirming" | "success" | "error";

// ── Emoji picker options ──
const EMOJI_OPTIONS = ["🎯", "🔥", "🌊", "⚡", "💎", "🚀", "🎲", "🏆", "🌙", "⚔️", "🦁", "🐉", "💫", "🎪", "🃏", "🌈"];

// ── Token config (devnet: SOL only, others mainnet-only) ──
const TOKENS = [
  { symbol: "SOL", label: "Solana", icon: "https://assets.coingecko.com/coins/images/4128/large/solana.png", mint: "So11111111111111111111111111111111111111112", decimals: 9, available: true },
  { symbol: "wBTC", label: "Wrapped Bitcoin", icon: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", mint: "", decimals: 8, available: false },
  { symbol: "wETH", label: "Wrapped Ether", icon: "https://assets.coingecko.com/coins/images/279/large/ethereum.png", mint: "", decimals: 8, available: false },
  { symbol: "JUP", label: "Jupiter", icon: "https://assets.coingecko.com/coins/images/34188/large/jup.png", mint: "", decimals: 6, available: false },
  { symbol: "JTO", label: "Jito", icon: "https://assets.coingecko.com/coins/images/33228/large/jto.png", mint: "", decimals: 9, available: false },
  { symbol: "BONK", label: "Bonk", icon: "https://assets.coingecko.com/coins/images/28600/large/bonk.jpg", mint: "", decimals: 5, available: false },
];

export default function SellPage() {
  // ── Step state ──
  const [step, setStep] = useState(1);

  // ── Step 1: Asset ──
  const [asset, setAsset] = useState("SOL");
  const [amount, setAmount] = useState("10");

  // ── Step 2: Deal ──
  const [multiplier, setMultiplier] = useState(13500);
  const [durationSecs, setDurationSecs] = useState(7 * 86_400);
  const [minProbPct, setMinProbPct] = useState("1");

  // ── Step 3: Identity ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ── TX state ──
  const [txState, setTxState] = useState<TxState>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const selectedToken = TOKENS.find(t => t.symbol === asset)!;

  // ── Price ──
  const { price: pythPrice, loading: priceLoading, refresh: refreshPrice } = usePythPrice(asset);
  const solUsd = pythPrice?.price || 0;

  const numAmount = parseFloat(amount) || 0;
  const assetValue = numAmount * solUsd;
  const target = assetValue * (multiplier / BPS_SCALE);
  const fee = target * 0.06; // 6% protocol fee (600 bps)
  const net = target - fee;

  const assetAmountRaw = selectedToken ? Math.floor(numAmount * Math.pow(10, selectedToken.decimals)) : 0;
  const poolTotalUsdc = Math.floor(target * Math.pow(10, USDC_DECIMALS));
  const minProbBps = Math.floor(parseFloat(minProbPct) * 100);

  const minUsdc = solUsd > 0 ? minUsdcRaw(solUsd, 1) : null;
  const belowMinimum = minUsdc !== null && poolTotalUsdc < minUsdc && numAmount > 0;

  // ── Create pool TX ──
  const handleCreate = useCallback(async () => {
    if (assetAmountRaw <= 0 || !selectedToken?.available) return;
    if (belowMinimum) return;

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
        assetMint: new PublicKey(selectedToken.mint),
        assetAmount: assetAmountRaw,
        multiplierBps: multiplier,
        minProbabilityBps: minProbBps,
        durationSecs,
        poolTotalUsdc,
        wallet: walletAdapter,
      });

      setTxSignature(sig);

      // Save social metadata to Supabase (off-chain, post-TX)
      if (title || description || emoji !== "🎯") {
        try {
          await fetch("/api/pool-meta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signature: sig, title, description, emoji }),
          });
        } catch {
          // Non-blocking — metadata is optional
          console.warn("[Rafi] Could not save pool metadata");
        }
      }

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
  }, [assetAmountRaw, selectedToken, wallets, multiplier, minProbBps, durationSecs, poolTotalUsdc, belowMinimum, minUsdc, title, description, emoji]);

  const canGoStep2 = numAmount > 0 && !belowMinimum && !priceLoading && selectedToken?.available;
  const canCreate = numAmount > 0 && !belowMinimum && !priceLoading && authenticated;

  // ── Steps meta ──
  const steps = [
    { num: 1, label: "Asset" },
    { num: 2, label: "Deal" },
    { num: 3, label: "Identity" },
  ];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingTop: 24 }}>
      <h1 style={{ marginBottom: 6 }}>Create a pool</h1>
      <p className="text-secondary" style={{ marginBottom: 28, fontSize: 15 }}>
        Lock an asset. Set your premium. Give it a vibe — let the pool fill.
      </p>

      <div className="create-form">

        {/* ── Stepper ── */}
        <div className="stepper">
          {steps.map((s, i) => (
            <div key={s.num} className="stepper-item">
              <div
                className={`stepper-circle ${step >= s.num ? "active" : ""} ${step > s.num ? "done" : ""}`}
                onClick={() => step > s.num && setStep(s.num)}
                style={{ cursor: step > s.num ? "pointer" : "default" }}
              >
                {step > s.num ? "✓" : s.num}
              </div>
              <span className={`stepper-label ${step === s.num ? "active" : ""}`}>{s.label}</span>
              {i < steps.length - 1 && <div className={`stepper-line ${step > s.num ? "done" : ""}`} />}
            </div>
          ))}
        </div>

        <div className="stepper-divider" />

        {/* ══ STEP 1 — Asset ══ */}
        {step === 1 && (
          <>
            <div className="form-group">
              <label className="form-label">Choose your asset</label>
              <div className="token-picker">
                {TOKENS.map(t => (
                  <button
                    key={t.symbol}
                    className={`token-tile ${asset === t.symbol ? "selected" : ""} ${!t.available ? "disabled" : ""}`}
                    onClick={() => t.available && setAsset(t.symbol)}
                    disabled={!t.available}
                    title={!t.available ? "Available on Mainnet" : t.label}
                  >
                    <img src={t.icon} alt={t.symbol} width={32} height={32} style={{ borderRadius: 8 }} />
                    <span className="token-tile-sym">{t.symbol}</span>
                    {!t.available && <span className="token-tile-soon">Mainnet</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Amount to lock</label>
              <div className="amount-input-wrap">
                <input
                  className="form-input amount-input"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.0"
                  min="0"
                  step="0.1"
                />
                <span className="amount-suffix">
                  <img src={selectedToken.icon} width={18} height={18} style={{ borderRadius: 4 }} alt={asset} />
                  {asset}
                </span>
              </div>

              {/* Live price */}
              {priceLoading ? (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
                  Fetching price…
                </div>
              ) : solUsd > 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>1 {asset} = ${solUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  {numAmount > 0 && <span>· ${assetValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} total</span>}
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

              {/* Minimum warning */}
              {belowMinimum && minUsdc !== null && (
                <div className="alert-warning">
                  <AlertTriangle size={14} />
                  <span>
                    Minimum pool is <strong>{formatMinUsdc(minUsdc)}</strong> (= 1 SOL equivalent).
                    Enter at least <strong>{(minUsdc / 1_000_000 / solUsd / (multiplier / BPS_SCALE)).toFixed(3)} {asset}</strong>.
                  </span>
                </div>
              )}
            </div>

            <button
              className="btn btn-rafi btn-full btn-lg"
              onClick={() => setStep(2)}
              disabled={!canGoStep2}
              style={!canGoStep2 ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              Next — Set the deal <ChevronRight size={18} style={{ marginLeft: 4 }} />
            </button>
          </>
        )}

        {/* ══ STEP 2 — Deal ══ */}
        {step === 2 && (
          <>
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Premium multiplier</label>
                <span style={{ fontWeight: 700, fontSize: 18, color: "var(--rafi)" }}>{formatMultiplier(multiplier)}</span>
              </div>
              <input
                type="range" min={11000} max={18000} step={500} value={multiplier}
                onChange={e => setMultiplier(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--rafi)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                <span>×1.10 — easiest to fill</span>
                <span>×1.80 — max premium</span>
              </div>
              <div className="multiplier-hint">
                Buyers pay <strong>{formatMultiplier(multiplier)}×</strong> the asset value to fill your pool.
                Higher multiplier = more revenue for you, harder to fill.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Duration</label>
                <select
                  className="form-input"
                  value={durationSecs}
                  onChange={e => setDurationSecs(Number(e.target.value))}
                >
                  {POOL_DURATIONS.map(d => (
                    <option key={d.secs} value={d.secs}>{d.label}</option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Auto-refund if unfilled</div>
              </div>
              <div className="form-group">
                <label className="form-label">Min entry</label>
                <select
                  className="form-input"
                  value={minProbPct}
                  onChange={e => setMinProbPct(e.target.value)}
                >
                  <option value="0.1">0.1%</option>
                  <option value="1">1%</option>
                  <option value="5">5%</option>
                </select>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Min per buyer</div>
              </div>
            </div>

            {/* Summary */}
            <div className="form-summary">
              <div className="form-summary-row">
                <span className="text-secondary">Pool target</span>
                <span style={{ fontWeight: 600 }}>${target.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="form-summary-row">
                <span className="text-secondary">Protocol fee (6%)</span>
                <span style={{ color: "var(--red)", fontWeight: 500 }}>-${fee.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="form-summary-row" style={{ borderTop: "1px solid var(--border-default)", paddingTop: 10, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>You receive when drawn</span>
                <span style={{ fontWeight: 700, color: "var(--rafi)" }}>${net.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* vs. market sale comparison */}
            {assetValue > 0 && (
              <div className="deal-vs-market">
                <div className="deal-vs-row">
                  <span style={{ color: "var(--text-secondary)" }}>Selling {amount} {asset} at market</span>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                    ${assetValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="deal-vs-row" style={{ borderTop: "1px dashed var(--border-light)", paddingTop: 8, marginTop: 4 }}>
                  <span style={{ fontWeight: 700, color: "var(--rafi)" }}>
                    💰 Your Rafi premium
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: "var(--rafi)" }}>
                    +${(net - assetValue).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 4, opacity: 0.8 }}>
                      (+{(((net - assetValue) / assetValue) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setStep(1)}>
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-rafi btn-full btn-lg" onClick={() => setStep(3)}>
                Next — Give it a vibe <ChevronRight size={18} style={{ marginLeft: 4 }} />
              </button>
            </div>
          </>
        )}

        {/* ══ STEP 3 — Identity ══ */}
        {step === 3 && (
          <>
            <div className="identity-section">
              <div className="identity-preview">
                <div className="identity-preview-emoji">{emoji}</div>
                <div className="identity-preview-text">
                  <div className="identity-preview-title">{title || "Give your pool a name…"}</div>
                  <div className="identity-preview-sub">Win {amount} {asset} · {formatMultiplier(multiplier)}</div>
                </div>
              </div>
            </div>

            {/* Emoji picker */}
            <div className="form-group">
              <label className="form-label">Pick an emoji</label>
              <div className="emoji-grid">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    className={`emoji-btn ${emoji === e ? "selected" : ""}`}
                    onClick={() => { setEmoji(e); setShowEmojiPicker(false); }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Pool title <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optional)</span></label>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{title.length}/60</span>
              </div>
              <input
                className="form-input"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 60))}
                placeholder="Bitcoin or bust 🔥"
                maxLength={60}
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Your pitch <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optional)</span></label>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{description.length}/140</span>
              </div>
              <textarea
                className="form-input"
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 140))}
                placeholder="Tell people why they should enter your pool… (140 chars)"
                maxLength={140}
                rows={3}
                style={{ resize: "none", fontFamily: "inherit" }}
              />
            </div>

            {/* CTA */}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setStep(2)}>
                <ChevronLeft size={16} />
              </button>

              {!authenticated ? (
                <button className="btn btn-rafi btn-full btn-lg" onClick={login}>
                  Log in to create
                </button>
              ) : txState === "signing" || txState === "confirming" ? (
                <button className="btn btn-rafi btn-full btn-lg" disabled style={{ opacity: 0.7 }}>
                  <Loader2 size={18} className="spinner" style={{ marginRight: 8 }} />
                  {txState === "signing" ? "Approve in wallet…" : "Creating pool…"}
                </button>
              ) : txState === "success" ? (
                <button className="btn btn-full btn-lg" disabled style={{ background: "var(--rafi-dim)", color: "var(--rafi)", border: "1.5px solid var(--rafi)", cursor: "default" }}>
                  <CheckCircle size={18} style={{ marginRight: 8 }} />
                  Pool created! {txSignature ? `${txSignature.slice(0, 8)}…` : ""}
                </button>
              ) : txState === "error" ? (
                <button className="btn btn-full btn-lg" onClick={() => setTxState("idle")} style={{ background: "var(--red-dim)", color: "var(--red)", border: "1.5px solid var(--red)", cursor: "pointer" }}>
                  <XCircle size={18} style={{ marginRight: 8 }} />
                  {txError || "Failed"} — Tap to retry
                </button>
              ) : (
                <button
                  className="btn btn-rafi btn-full btn-lg"
                  onClick={handleCreate}
                  disabled={!canCreate}
                  style={!canCreate ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                >
                  🚀 Create pool — {amount} {asset}
                </button>
              )}
            </div>

            <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              Your {asset} is locked in a PDA escrow until the pool draws or the {POOL_DURATIONS.find(d => d.secs === durationSecs)?.label} expire.
              If it expires unfilled, your {asset} is returned automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
