"use client";

import { useState, useEffect } from "react";

/**
 * ClientOnly — Prevents SSR for children.
 *
 * Rafi is a 100% client-side Web3 app. Privy, Solana wallet adapters,
 * and Anchor all require browser APIs. This wrapper ensures nothing
 * renders on the server, avoiding "useWallets outside PrivyProvider" errors.
 *
 * Children render only after the component is mounted in the browser.
 */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
