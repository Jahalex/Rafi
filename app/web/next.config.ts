import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is a fully client-side Web3 app.
  // Privy, Solana wallet adapters, and Anchor all require browser APIs.
  // Static pre-rendering is disabled to prevent SSR errors during build.
  experimental: {
    // Disable static generation for all pages
  },

  // Solana / Anchor / Privy use ESM-only packages that need transpilation
  transpilePackages: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token",
  ],

  // Suppress bigint warnings from Solana libs
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
