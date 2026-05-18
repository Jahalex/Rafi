// ═══════════════════════════════════════════════════
// RAFI — Pyth Price Oracle via Hermes (Triton)
// ═══════════════════════════════════════════════════
//
// Uses Pyth Hermes REST API to fetch real-time prices.
// No hardcoded prices — all values come from the oracle.
//
// Hermes endpoint:
//   Public: https://hermes.pyth.network (free, rate-limited)
//   Triton: https://<subdomain>.mainnet.pythnet.rpcpool.com/hermes
//

// ── Pyth Price Feed IDs (mainnet/devnet — same IDs) ──
// Full list: https://pyth.network/developers/price-feed-ids
export const PYTH_FEED_IDS: Record<string, string> = {
  // IMPORTANT: This is the canonical Pyth SOL/USD feed ID.
  // Verified live against https://hermes.pyth.network/v2/updates/price/latest
  SOL:  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  JUP: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
  JTO: "0xb43660a5f790c69354b0729a5ef9d074d43f6d34c1e8da1da4a7aa08db82a08b",
  wBTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  wETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};

// Hermes endpoint — use public endpoint by default, Triton for production
const HERMES_URL =
  process.env.NEXT_PUBLIC_HERMES_URL || "https://hermes.pyth.network";

// ── Types ──
export interface PythPrice {
  symbol: string;
  price: number;         // USD price as a float
  confidence: number;    // confidence interval in USD
  publishTime: number;   // unix timestamp
  expo: number;
}

// ── In-memory cache (30s TTL) ──
const priceCache = new Map<string, { price: PythPrice; fetchedAt: number }>();
const CACHE_TTL_MS = 30_000;

/**
 * Fetch the latest price for a given symbol from Pyth Hermes.
 */
export async function fetchPythPrice(symbol: string): Promise<PythPrice | null> {
  const feedId = PYTH_FEED_IDS[symbol];
  if (!feedId) return null;

  // Check cache
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.price;
  }

  try {
    // Hermes V2 requires feed IDs WITHOUT the "0x" prefix.
    const cleanId = feedId.replace(/^0x/, "");
    const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${cleanId}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`Hermes ${res.status}`);

    const data = await res.json();
    const parsed = data?.parsed?.[0];
    if (!parsed?.price) return null;

    const { price: priceStr, conf, expo, publish_time } = parsed.price;
    const priceNum = Number(priceStr) * Math.pow(10, expo);
    const confNum = Number(conf) * Math.pow(10, expo);

    const result: PythPrice = {
      symbol,
      price: priceNum,
      confidence: confNum,
      publishTime: publish_time,
      expo,
    };

    priceCache.set(symbol, { price: result, fetchedAt: Date.now() });
    return result;

  } catch (err) {
    console.error(`[Pyth] Failed to fetch ${symbol}:`, err);
    // Return stale cache if available
    return cached?.price || null;
  }
}

/**
 * Fetch prices for multiple symbols in a single batch request.
 */
export async function fetchPythPrices(
  symbols: string[]
): Promise<Map<string, PythPrice>> {
  const results = new Map<string, PythPrice>();

  // Separate cached vs need-fetch
  const toFetch: string[] = [];
  for (const symbol of symbols) {
    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      results.set(symbol, cached.price);
    } else if (PYTH_FEED_IDS[symbol]) {
      toFetch.push(symbol);
    }
  }

  if (toFetch.length === 0) return results;

  try {
    // Hermes V2 requires feed IDs WITHOUT the "0x" prefix.
    const ids = toFetch.map(s => `ids[]=${PYTH_FEED_IDS[s].replace(/^0x/, "")}`).join("&");
    const url = `${HERMES_URL}/v2/updates/price/latest?${ids}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`Hermes ${res.status}`);

    const data = await res.json();
    const parsedArr = data?.parsed || [];

    for (const parsed of parsedArr) {
      // Match feed ID back to symbol
      const symbol = toFetch.find(
        s => PYTH_FEED_IDS[s].replace("0x", "") === parsed.id
      );
      if (!symbol || !parsed.price) continue;

      const { price: priceStr, conf, expo, publish_time } = parsed.price;
      const priceNum = Number(priceStr) * Math.pow(10, expo);
      const confNum = Number(conf) * Math.pow(10, expo);

      const result: PythPrice = {
        symbol,
        price: priceNum,
        confidence: confNum,
        publishTime: publish_time,
        expo,
      };

      results.set(symbol, result);
      priceCache.set(symbol, { price: result, fetchedAt: Date.now() });
    }

  } catch (err) {
    console.error(`[Pyth] Batch fetch failed:`, err);
    // Fill with stale cache
    for (const symbol of toFetch) {
      const cached = priceCache.get(symbol);
      if (cached) results.set(symbol, cached.price);
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════
// Minimum pool validation helpers
// ══════════════════════════════════════════════════════

/**
 * Fetch the live SOL/USD price (shorthand for the most common case).
 * Uses the same cache as fetchPythPrice().
 */
export async function fetchSolPrice(): Promise<number | null> {
  const p = await fetchPythPrice("SOL");
  return p ? p.price : null;
}

/**
 * Compute the minimum pool_total_usdc (raw, 6 decimals) equivalent
 * to `solAmount` SOL at the given USD price.
 *
 * This mirrors the on-chain arithmetic in create_pool.rs.
 *
 * @param solUsd  - SOL price in USD (e.g. 170.42)
 * @param solAmount - minimum in SOL units (default: 1)
 */
export function minUsdcRaw(solUsd: number, solAmount = 1): number {
  // Round up to ensure we always meet the on-chain minimum.
  return Math.ceil(solUsd * solAmount * 1_000_000);
}

/**
 * Format a raw USDC minimum (6 decimals) to a human-readable string.
 * e.g. 170_420_000 → "$170.42"
 */
export function formatMinUsdc(raw: number): string {
  const usd = raw / 1_000_000;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
  return `$${usd.toFixed(2)}`;
}
