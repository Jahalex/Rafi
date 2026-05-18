// ═══════════════════════════════════════════════════
// RAFI — usePythPrice Hook
// ═══════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPythPrice, fetchPythPrices, type PythPrice } from "./pyth";

/**
 * Hook: single symbol price from Pyth Hermes.
 * Refreshes every 30s.
 */
export function usePythPrice(symbol: string) {
  const [price, setPrice] = useState<PythPrice | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = await fetchPythPrice(symbol);
    if (p) setPrice(p);
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { price, loading, refresh };
}

/**
 * Hook: batch prices for multiple symbols.
 * Refreshes every 30s.
 */
export function usePythPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, PythPrice>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const map = await fetchPythPrices(symbols);
    setPrices(map);
    setLoading(false);
  }, [symbols.join(",")]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Helper to get price as number
  const getPrice = (symbol: string): number => {
    return prices.get(symbol)?.price || 0;
  };

  return { prices, loading, refresh, getPrice };
}
