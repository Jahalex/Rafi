import { useState } from "react";
import { X, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatUsdc } from "@/lib/format";
import { Pool } from "@/lib/supabase";

interface Props {
  pool: Pool | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickBuyModal({ pool, isOpen, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<"idle" | "signing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !pool) return null;

  const numAmount = parseFloat(amount) || 0;
  const targetUsdc = pool.pool_total_usdc / 100;
  const currentUsdc = pool.usdc_collected / 100;
  const remainingUsdc = targetUsdc - currentUsdc;
  const validAmount = numAmount > 0 && numAmount <= remainingUsdc;
  
  const handleBuy = async () => {
    if (!validAmount) return;
    setState("signing");
    // TODO: Integrate actual Anchor buy function
    setTimeout(() => {
      setState("success");
    }, 1500);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700 }}>Enter Pool</h2>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {pool.title || `Win ${pool.asset_amount / Math.pow(10, pool.asset_decimals)} ${pool.asset_symbol}`}
          </div>
        </div>

        {state === "idle" && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>Amount (USDC)</span>
                <span style={{ color: "var(--text-tertiary)" }}>
                  Max: {formatUsdc(remainingUsdc * 100)}
                </span>
              </div>
              <div className="input-group">
                <input
                  type="number"
                  className="form-input"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{ fontSize: 24, fontWeight: 700, padding: "16px", height: "auto" }}
                  autoFocus
                />
              </div>
              
              {numAmount > 0 && (
                <div style={{ marginTop: 16, padding: "12px", background: "rgba(39, 134, 100, 0.08)", borderRadius: "var(--radius-md)", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Your chance to win</span>
                    <span style={{ fontWeight: 700, color: "var(--rafi)" }}>
                      {((numAmount / targetUsdc) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Potential payout</span>
                    <span style={{ fontWeight: 600 }}>
                      {pool.asset_amount / Math.pow(10, pool.asset_decimals)} {pool.asset_symbol}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button 
              className="btn btn-rafi btn-full btn-lg" 
              onClick={handleBuy}
              disabled={!validAmount}
            >
              Confirm Entry
            </button>
          </>
        )}

        {state === "signing" && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <Loader2 size={32} className="spin" style={{ margin: "0 auto 16px", color: "var(--rafi)" }} />
            <div style={{ fontWeight: 600, fontSize: 16 }}>Confirming transaction…</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>Please sign in your wallet</div>
          </div>
        )}

        {state === "success" && (
          <div style={{ padding: "30px 0", textAlign: "center" }}>
            <CheckCircle size={40} style={{ margin: "0 auto 16px", color: "var(--rafi)" }} />
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Entry Confirmed!</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
              You are now in the pool. Good luck!
            </div>
            <button className="btn btn-outline btn-full" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {state === "error" && (
          <div style={{ padding: "30px 0", textAlign: "center" }}>
            <AlertTriangle size={40} style={{ margin: "0 auto 16px", color: "var(--red)" }} />
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Transaction Failed</div>
            <div style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
              {errorMsg || "An error occurred during the transaction."}
            </div>
            <button className="btn btn-outline btn-full" onClick={() => setState("idle")}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
