// ═══════════════════════════════════════════════
// RAFI — Token Icons (Real crypto logos via CDN)
// ═══════════════════════════════════════════════

// Using CoinGecko CDN for production-quality token logos
const COINGECKO_CDN = "https://assets.coingecko.com/coins/images";

export const TOKEN_ICONS: Record<string, { icon: string; color: string; name: string }> = {
  SOL: {
    icon: `${COINGECKO_CDN}/4128/large/solana.png`,
    color: "#9945FF",
    name: "Solana",
  },
  wBTC: {
    icon: `${COINGECKO_CDN}/1/large/bitcoin.png`,
    color: "#F7931A",
    name: "Wrapped Bitcoin",
  },
  wETH: {
    icon: `${COINGECKO_CDN}/279/large/ethereum.png`,
    color: "#627EEA",
    name: "Wrapped Ether",
  },
  JUP: {
    icon: `${COINGECKO_CDN}/34188/large/jup.png`,
    color: "#18B496",
    name: "Jupiter",
  },
  JTO: {
    icon: `${COINGECKO_CDN}/33228/large/jto.png`,
    color: "#6BB8A4",
    name: "Jito",
  },
  PYTH: {
    icon: `${COINGECKO_CDN}/31924/large/pyth.png`,
    color: "#6D42C2",
    name: "Pyth Network",
  },
  RAY: {
    icon: `${COINGECKO_CDN}/13928/large/PSigc4ie_400x400.jpg`,
    color: "#6C5CE7",
    name: "Raydium",
  },
};

export function getTokenInfo(symbol: string) {
  return TOKEN_ICONS[symbol] || {
    icon: "",
    color: "#71717a",
    name: symbol,
  };
}
