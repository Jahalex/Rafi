"use client";

import { useState } from "react";
import { useLoginWithEmail, useLoginWithOAuth, useConnectWallet } from "@privy-io/react-auth";
import { Mail, ArrowLeft, Wallet, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "main" | "email" | "otp";

export default function LoginModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<Step>("main");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onComplete: () => {
      onClose();
      resetState();
    },
    onError: () => setError("Login failed. Please try again."),
  });

  const { initOAuth } = useLoginWithOAuth({
    onComplete: () => {
      onClose();
      resetState();
    },
    onError: () => setError("Google login failed."),
  });

  const { connectWallet } = useConnectWallet({
    onSuccess: () => {
      onClose();
      resetState();
    },
    onError: () => setError("Wallet connection failed."),
  });

  const resetState = () => {
    setStep("main");
    setEmail("");
    setOtp("");
    setError("");
    setLoading(false);
  };

  const handleSendCode = async () => {
    if (!email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendCode({ email });
      setStep("otp");
    } catch {
      setError("Failed to send code. Try again.");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    setError("");
    try {
      await loginWithCode({ code: otp });
    } catch {
      setError("Invalid code. Please try again.");
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button className="login-close" onClick={() => { onClose(); resetState(); }}>
          <X size={18} />
        </button>

        {/* Logo */}
        <div className="login-logo-wrap">
          <img src="/logo_rafi.png" alt="Rafi" height={32} />
        </div>

        {/* ── Main Screen ── */}
        {step === "main" && (
          <>
            <h2 className="login-title">Welcome to RAFI</h2>
            <p className="login-sub">Take your shot at real crypto assets.</p>

            <div className="login-options">
              {/* Email */}
              <button className="login-option" onClick={() => setStep("email")}>
                <div className="login-option-icon">
                  <Mail size={18} />
                </div>
                <span>Continue with Email</span>
              </button>

              {/* Google */}
              <button className="login-option" onClick={() => initOAuth({ provider: "google" })}>
                <div className="login-option-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <span>Continue with Google</span>
              </button>

              <div className="login-divider">
                <span>or</span>
              </div>

              {/* Wallet */}
              <button className="login-option wallet" onClick={() => connectWallet()}>
                <div className="login-option-icon wallet">
                  <Wallet size={18} />
                </div>
                <span>Connect Wallet</span>
              </button>
            </div>

            <p className="login-terms">
              By continuing, you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
            </p>
          </>
        )}

        {/* ── Email Input ── */}
        {step === "email" && (
          <>
            <button className="login-back" onClick={() => { setStep("main"); setError(""); }}>
              <ArrowLeft size={16} /> Back
            </button>
            <h2 className="login-title">Enter your email</h2>
            <p className="login-sub">We'll send you a verification code.</p>

            <div className="login-form">
              <input
                type="email"
                className="login-input"
                placeholder="name@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendCode()}
                autoFocus
              />
              {error && <div className="login-error">{error}</div>}
              <button className="login-cta" onClick={handleSendCode} disabled={loading || !email}>
                {loading ? "Sending..." : "Send code"}
              </button>
            </div>
          </>
        )}

        {/* ── OTP Verification ── */}
        {step === "otp" && (
          <>
            <button className="login-back" onClick={() => { setStep("email"); setError(""); setOtp(""); }}>
              <ArrowLeft size={16} /> Back
            </button>
            <h2 className="login-title">Check your email</h2>
            <p className="login-sub">Enter the 6-digit code sent to <strong>{email}</strong></p>

            <div className="login-form">
              <input
                type="text"
                className="login-input otp"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                maxLength={6}
                autoFocus
              />
              {error && <div className="login-error">{error}</div>}
              <button className="login-cta" onClick={handleVerifyOtp} disabled={loading || otp.length < 6}>
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
              <button className="login-resend" onClick={() => sendCode({ email })}>
                Didn't receive it? Resend
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
