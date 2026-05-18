"use client";

import { usePrivy } from "@privy-io/react-auth";
import { shortenAddress } from "@/lib/format";
import { LogOut, User, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import LoginModal from "./LoginModal";

export default function AuthButtons() {
  const { ready, authenticated, logout, user } = usePrivy();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close modal on successful auth
  useEffect(() => {
    if (authenticated) setLoginOpen(false);
  }, [authenticated]);

  if (!ready) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ width: 72, height: 36, borderRadius: "var(--radius-md)", background: "var(--bg-input)", animation: "pulse 1.5s infinite" }} />
        <div style={{ width: 72, height: 36, borderRadius: "var(--radius-md)", background: "var(--bg-input)", animation: "pulse 1.5s infinite" }} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => setLoginOpen(true)}>
            Log In
          </button>
          <button className="btn btn-rafi" style={{ fontSize: 13 }} onClick={() => setLoginOpen(true)}>
            Sign Up
          </button>
        </div>
        <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  // Connected
  const walletAddress = user?.wallet?.address || "";
  const email = user?.email?.address || "";
  const displayName = email ? email.split("@")[0] : shortenAddress(walletAddress);

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      <button className="auth-pill" onClick={() => setMenuOpen(!menuOpen)}>
        <div className="auth-avatar">
          {displayName[0]?.toUpperCase() || "?"}
        </div>
        <span className="auth-name">{displayName}</span>
        <ChevronDown size={12} style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "0.15s" }} />
      </button>

      {menuOpen && (
        <div className="auth-menu">
          {walletAddress && (
            <div className="auth-menu-item" style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 10, marginBottom: 6, cursor: "default" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>Wallet</div>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>
                {shortenAddress(walletAddress, 6)}
              </div>
            </div>
          )}
          <a href="/portfolio" className="auth-menu-item">
            <User size={14} /> Portfolio
          </a>
          <button className="auth-menu-item" onClick={() => { logout(); setMenuOpen(false); }}>
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
