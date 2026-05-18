import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solana / Anchor / Privy use ESM-only packages that need transpilation
  transpilePackages: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token",
  ],
};

export default nextConfig;
