import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solana / Anchor / Privy use ESM-only packages that need transpilation
  transpilePackages: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token",
  ],

  // Next.js 16 uses Turbopack by default.
  // Empty config to acknowledge Turbopack — it handles Node.js polyfills automatically.
  turbopack: {},
};

export default nextConfig;
