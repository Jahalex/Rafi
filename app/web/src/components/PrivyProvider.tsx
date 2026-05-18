"use client";

/**
 * PrivyProvider — Auth & Wallet configuration for Rafi
 *
 * Doc: https://docs.privy.io/guide/react/wallets/external/solana
 *
 * Key points from official Privy docs:
 * 1. Must import toSolanaWalletConnectors from @privy-io/react-auth/solana
 *    → Without this, clicking Phantom redirects to phantom.app instead of connecting
 * 2. Must configure externalWallets.solana.connectors
 * 3. Use connectOrCreateWallet() for best UX (login + wallet in one step)
 * 4. walletChainType: 'solana-only' hides all EVM wallet options
 */

import { PrivyProvider as Privy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { PRIVY_APP_ID } from "@/lib/constants";

// Solana external wallet connectors (Phantom, Solflare, Backpack, etc.)
// shouldAutoConnect: true → reconnects automatically if user was already connected
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

export default function PrivyProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    // Dev mode without Privy configured — render children directly
    return <>{children}</>;
  }

  return (
    <Privy
      appId={PRIVY_APP_ID}
      config={{
        // ── Appearance ──────────────────────────────────────────
        appearance: {
          theme: "light",
          accentColor: "#27a86c",
          logo: "/logo_rafi.png",
          landingHeader: "Welcome to Rafi",
          loginMessage: "Win real assets on-chain. Provably fair.",
          // solana-only: hides all EVM wallets from the modal
          walletChainType: "solana-only",
          // Show wallet login first (better UX for a Web3 app)
          showWalletLoginFirst: true,
          // Wallet list shown in the modal
          walletList: ["phantom", "solflare", "backpack", "detected_wallets"],
        },

        // ── Login methods ────────────────────────────────────────
        // wallet first, then social/email as fallback
        loginMethods: ["wallet", "email", "google"],

        // ── Embedded wallets (auto-created for email/social users) ──
        embeddedWallets: {
          solana: {
            // Create a Solana embedded wallet automatically for users
            // who don't have an external wallet (email/social login)
            createOnLogin: "users-without-wallets",
          },
        },

        // ── External Solana wallets ──────────────────────────────
        // THIS IS REQUIRED for Phantom/Solflare to connect properly.
        // Without this, clicking Phantom opens phantom.app instead of connecting.
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      {children}
    </Privy>
  );
}
