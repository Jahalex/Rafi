<div align="center">
  <img src="app/web/public/logo_rafi.png" alt="Rafi" height="80" />
  <br /><br />
  <strong>Permissionless on-chain raffles on Solana.</strong><br />
  <em>List an asset. Fill the pool. One winner — chosen by verifiable randomness.</em>
  <br /><br />

  [![Solana](https://img.shields.io/badge/Solana-9945FF?style=flat&logo=solana&logoColor=white)](https://solana.com)
  [![Anchor](https://img.shields.io/badge/Anchor-0.31-blue)](https://anchor-lang.com)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
  [![License](https://img.shields.io/badge/License-BUSL--1.1-green)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
  [![devnet](https://img.shields.io/badge/devnet-live-brightgreen)](https://explorer.solana.com/address/5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg?cluster=devnet)

  <br />

  **[rafi.run](https://rafi.run)** · [Explorer](https://explorer.solana.com/address/5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg?cluster=devnet) · [Program ID](#program)

</div>

---

## What is Rafi?

**Rafi** is a decentralized raffle protocol built on Solana. It enables anyone to list a real on-chain asset — SOL, wBTC, wETH, JUP, or any SPL token — and let the market compete for it through a provably-fair, fully on-chain draw.

- 🎯 **Seller** lists an asset at a premium (1.1× – 1.8×). Buyers collectively pay that premium in USDC.
- 💰 **Buyers** enter the pool with any amount. More USDC = higher chance of winning.
- 🎲 **Draw** is triggered on-chain by [Switchboard VRF](https://switchboard.xyz) once the pool reaches 100%.
- 🏆 **One winner** receives the full asset. The seller receives the USDC premium.

No house edge. No admin. No trust required. Every step is verifiable on-chain.

---

## Why Rafi?

| | Traditional Raffle | Rafi |
|---|---|---|
| **Fairness** | Operator-controlled | On-chain VRF (Switchboard) — cryptographically unmanipulable |
| **Permissionless** | ❌ Requires operator approval | ✅ Anyone creates a pool |
| **Asset custody** | Escrow by third party | Program Derived Address — no admin key |
| **Refunds** | Manual, trust-based | Automatic on-chain if pool doesn't fill |
| **Minimum entry** | Fixed high ticket | From any amount — more = better odds |
| **Transparency** | Opaque | All state on Solana — publicly verifiable |

---

## Protocol Mechanics

### Pool Lifecycle

```
CREATE (seller deposits asset)
    │
    ▼
OPEN — buyers enter with USDC (up to 7 days)
    │                           │
    │ 100% filled               │ Time expires
    ▼                           ▼
FILLED (30-min draw window)  EXPIRED → refunds claimable
    │
    ▼
SETTLEMENT REQUESTED (Switchboard VRF commit)
    │
    ▼
SETTLED → winner receives asset / seller receives USDC
```

### Probability Model

Each pool has a **total USDC target** = `asset_value × multiplier`.

```
Your probability = your_usdc / pool_total_usdc
```

Positions are assigned non-overlapping ranges on `[0, 10000]` (basis points).  
Switchboard VRF outputs a random value in `[0, 10000]`.  
The position whose range contains the VRF output wins.

### Fee Structure

- **Protocol fee**: 6% taken from USDC collected at settlement
- **Seller receives**: `pool_total_usdc × (1 - 0.06)`
- **Minimum pool size**: 1 SOL equivalent (enforced on-chain via Pyth oracle)

---

## Technical Architecture

### On-Chain Program (Anchor / Rust)

```
programs/rafi/src/
├── lib.rs                    # Entry point — 9 instructions
├── constants.rs              # Seeds, fee bps, countdown timers
├── errors.rs                 # Custom error codes
├── events.rs                 # Anchor events (indexed by webhook)
├── state/
│   ├── pool.rs               # Pool account (state machine)
│   ├── position.rs           # ProbabilityPosition account
│   └── protocol.rs           # Global protocol config
└── instructions/
    ├── initialize_protocol.rs
    ├── create_pool.rs         # Pyth oracle price validation
    ├── mint_probability.rs    # Buy positions, auto-fill detection
    ├── request_settlement.rs  # Switchboard VRF commit
    ├── settle_pool.rs         # VRF reveal + atomic distribution
    ├── expire_pool.rs         # Grace-period expiration logic
    ├── claim_refund.rs        # Buyer USDC refund
    ├── claim_asset_back.rs    # Seller asset recovery
    └── admin.rs               # Fee & treasury management
```

### Oracle Integration

**Pyth Pull Oracle** (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`) enforces the minimum 1 SOL pool value:

1. Frontend fetches a signed price update (VAA) from **Hermes** API
2. Price update is posted on-chain → `PriceUpdateV2` account
3. `create_pool` instruction reads and validates live SOL/USD price
4. Pool is rejected if value < 1 SOL equivalent

**Feed ID (SOL/USD)**: `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`

### VRF Integration

**Switchboard On-Demand** provides SGX-verified randomness:

1. After pool fills, a **30-minute mandatory countdown** prevents last-block VRF manipulation
2. `request_settlement` creates a Switchboard randomness request
3. Oracle resolves the request on-chain
4. `settle_pool` reads the verified random bytes, maps to `[0, 10000]`, finds winner

### Frontend Stack

```
app/web/
├── src/app/                  # Next.js App Router
│   ├── page.tsx              # Home — hot pools, how it works
│   ├── pool/[id]/page.tsx    # Pool detail — live progress, buy slider
│   ├── sell/page.tsx         # Create pool — Pyth-gated validation
│   ├── portfolio/page.tsx    # User positions + claim refunds
│   └── api/indexer/route.ts  # Helius webhook → Supabase indexer
├── src/lib/
│   ├── anchor.ts             # Solana transaction builders
│   ├── constants.ts          # Program ID, seeds, fee bps
│   ├── hooks.ts              # Supabase real-time hooks
│   ├── pyth.ts               # Hermes price fetch + formatting
│   └── supabase.ts           # Types + Supabase client
└── src/components/
    ├── BuySlider.tsx         # Entry UX with live probability calculation
    ├── PoolCard.tsx          # Pool card with dual countdown timer
    └── PrivyProvider.tsx     # Wallet / email auth (Privy)
```

### Data Architecture

```
Solana (source of truth)
    │
    ▼
Helius Webhook → /api/indexer (Next.js Edge)
    │
    ▼
Supabase (read-only indexer — Postgres + Realtime)
    │
    ▼
Frontend (Supabase real-time subscriptions → instant UI updates)
```

---

## Program

| Network | Program ID |
|---|---|
| **Devnet** | [`5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg`](https://explorer.solana.com/address/5eMM9jZraq6M9RtKJQqdmgQAAy1bJHohBQRGyiWeQ2kg?cluster=devnet) |
| **Mainnet** | Coming soon |

---

## Security

| Property | Implementation |
|---|---|
| Asset custody | PDA vault — no admin key can move funds |
| Randomness | Switchboard VRF in SGX enclave — unmanipulable |
| Price feed | Pyth Pull Oracle with Wormhole VAA verification |
| VRF manipulation window | 30-min mandatory delay after pool fills |
| Refund safety | Permissionless `claim_refund` — anyone can trigger |
| Integer arithmetic | Zero floating point on-chain — all BPS basis points |
| Overflow protection | Rust u128 intermediate math |
| Re-entrancy | None possible (Solana account model) |

---

## Supported Assets (Devnet)

| Asset | Type | Mint |
|---|---|---|
| **SOL** | Native SOL (wrapped) | `So11111111111111111111111111111111111111112` |
| **wBTC** | Bridged Bitcoin | `3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh` |
| **wETH** | Bridged Ethereum | `7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs` |
| **JUP** | Jupiter | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` |
| **BONK** | Bonk | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |

---

## Local Development

### Prerequisites

```bash
# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Anchor
cargo install --git https://github.com/coral-xyz/anchor avm
avm install 0.31.1 && avm use 0.31.1

# Node 20+
node --version
```

### Setup

```bash
git clone https://github.com/Jahalex/Rafi.git
cd Rafi

# Install dependencies (root + frontend)
npm install
cd app/web && npm install

# Configure environment
cp .env.example app/web/.env.local
# Fill in: Privy App ID, Supabase URL/keys, RPC URL

# Build the Anchor program
anchor build

# Run the frontend locally
cd app/web && npm run dev
# → http://localhost:3000
```

### Deploy to Devnet

```bash
# Airdrop SOL for deployment fees
solana airdrop 5 --url devnet

# Build + deploy
anchor build
anchor deploy --provider.cluster devnet

# Upgrade IDL
anchor idl upgrade --filepath target/idl/rafi.json <PROGRAM_ID> \
  --provider.cluster devnet

# Copy fresh IDL to frontend
cp target/idl/rafi.json app/web/src/lib/idl.json
```

---

## Repository Structure

```
Rafi/
├── programs/rafi/            # Anchor smart contract (Rust)
├── app/web/                  # Next.js frontend
│   ├── src/                  # Application source
│   ├── public/               # Static assets (logo, icons)
│   └── supabase/             # schema.sql (public schema)
├── tests/                    # Anchor integration tests (TypeScript)
├── scripts/                  # Indexer & protocol initialization
├── sdk/                      # (planned) Rafi SDK for integrators
├── Anchor.toml               # Anchor workspace config
├── vercel.json               # Vercel deployment config
└── .env.example              # Environment variable template
```

---

## Roadmap

- [x] Core protocol — pool lifecycle, VRF settlement, refunds
- [x] Pyth oracle integration — 1 SOL minimum enforcement
- [x] Frontend — pool creation, entry, portfolio, claim
- [x] Helius webhook indexer — real-time Supabase sync
- [ ] Mainnet deployment
- [ ] Rafi SDK (npm package for integrators)
- [ ] Mobile-optimized PWA
- [ ] Multi-asset pool support (NFTs)
- [ ] Governance & fee distribution to protocol stakers

---

## License

Business Source License 1.1 (BUSL-1.1).  
The protocol will convert to MIT after 4 years.

---

<div align="center">
  Built with ❤️ on Solana · <a href="https://rafi.run">rafi.run</a>
</div>
