"use client";

import { PrivyProvider as Privy } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/lib/constants";

export default function PrivyProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <Privy
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#278664",
          logo: "/logo_rafi.png",
          landingHeader: "Welcome to Rafi",
          loginMessage: "Win real assets on-chain. Provably fair.",
          showWalletLoginFirst: false,
          walletChainType: "solana-only",
          walletList: ["phantom", "detected_wallets"],
        },
        loginMethods: ["email", "wallet", "google"],
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </Privy>
  );
}
