-- ═══════════════════════════════════════════════════════════════
-- RAFI — Supabase Schema v2 (provably-fair raffle protocol)
-- ═══════════════════════════════════════════════════════════════
--
-- ARCHITECTURE:
--   Solana blockchain = source of truth (on-chain accounts)
--   Supabase = read-only indexer for fast frontend queries
--
--   Write path:  On-chain TX → Indexer (crank/webhook) → Supabase
--   Read path:   Frontend → Supabase (real-time subscriptions)
--
-- NO USER TABLE: In Web3, wallet address = identity.
-- Privy handles authentication. Supabase handles data indexing.
--
-- Every row maps 1:1 to an on-chain account and includes:
--   • tx_signature — the Solana TX that created/modified the record
--   • slot         — the Solana slot for on-chain ordering
--   • indexed_at   — when the indexer wrote the row
-- ═══════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════
-- 1. POOLS — mirrors on-chain Pool accounts
-- ══════════════════════════════════════════════════════════
create table if not exists pools (
  -- Internal
  id                          uuid      default gen_random_uuid() primary key,

  -- On-chain identity
  pool_id                     bigint    unique not null,
  pool_pda                    text      unique not null,
  tx_signature                text,       -- Solana TX that created the pool
  slot                        bigint,     -- Solana slot of creation TX

  -- Participants (wallet addresses, not user IDs)
  seller                      text      not null,

  -- Asset
  asset_mint                  text      not null,
  asset_symbol                text,       -- Derived (e.g. SOL, BTC, ETH)
  asset_amount                bigint    not null,
  asset_decimals              smallint  not null default 9,

  -- Economics
  multiplier_bps              int       not null,
  pool_total_usdc             bigint    not null,
  usdc_collected              bigint    not null default 0,
  fee_bps                     smallint  not null default 600,  -- 6% protocol fee
  min_probability_bps         smallint  not null default 10,

  -- Probability tracking
  total_probability_sold_bps  int       not null default 0,
  position_count              int       not null default 0,

  -- Vaults (on-chain PDAs)
  asset_vault                 text,
  usdc_vault                  text,

  -- Timing
  created_at                  bigint    not null, -- Unix timestamp from on-chain
  expires_at                  bigint    not null, -- Unix timestamp from on-chain
  filled_at                   bigint    not null default 0, -- Unix ts when pool hit 100% (0 = not yet)
  settled_at                  bigint,

  -- Settlement / VRF
  randomness_account          text,
  settlement_requested_slot   bigint,
  vrf_result_bps              smallint,
  vrf_slot                    bigint,
  winner                      text,       -- Winning wallet address

  -- State machine
  state                       text      not null default 'open'
                              check (state in (
                                'open',
                                'filled',
                                'settlementRequested',
                                'settled',
                                'expired',
                                'closed'
                              )),

  -- Indexer metadata
  indexed_at                  timestamptz not null default now()
);

-- Query patterns
create index if not exists idx_pools_state       on pools(state);
create index if not exists idx_pools_asset       on pools(asset_symbol);
create index if not exists idx_pools_expires     on pools(expires_at);
create index if not exists idx_pools_created     on pools(created_at desc);
create index if not exists idx_pools_seller      on pools(seller);
create index if not exists idx_pools_slot        on pools(slot desc);


-- ══════════════════════════════════════════════════════════
-- 2. POSITIONS — mirrors on-chain ProbabilityPosition accounts
-- ══════════════════════════════════════════════════════════
create table if not exists positions (
  -- Internal
  id                uuid      default gen_random_uuid() primary key,

  -- On-chain identity
  pool_id           bigint    not null references pools(pool_id),
  position_pda      text      unique not null,
  tx_signature      text,       -- Solana TX that minted this position
  slot              bigint,

  -- Participant (wallet address)
  buyer             text      not null,

  -- Position data
  position_index    int       not null,
  probability_bps   int       not null,
  usdc_paid         bigint    not null,
  range_start_bps   int       not null,
  range_end_bps     int       not null,

  -- Refund tracking
  is_refunded       boolean   not null default false,
  refund_tx         text,       -- TX signature of refund (if any)

  -- Timing
  created_at        bigint    not null, -- Unix timestamp from on-chain

  -- Indexer metadata
  indexed_at        timestamptz not null default now()
);

create index if not exists idx_positions_pool    on positions(pool_id);
create index if not exists idx_positions_buyer   on positions(buyer);
create index if not exists idx_positions_slot    on positions(slot desc);


-- ══════════════════════════════════════════════════════════
-- 3. EVENTS — on-chain activity log (indexed from TX parsing)
-- ══════════════════════════════════════════════════════════
create table if not exists events (
  id              uuid        default gen_random_uuid() primary key,
  pool_id         bigint      not null references pools(pool_id),
  tx_signature    text        not null,
  slot            bigint      not null,

  event_type      text        not null
                  check (event_type in (
                    'pool_created',
                    'probability_minted',
                    'settlement_requested',
                    'pool_settled',
                    'pool_expired',
                    'refund_claimed',
                    'asset_claimed_back'
                  )),

  -- The wallet that signed the TX
  actor           text        not null,

  -- Event-specific payload (flexible)
  data            jsonb       default '{}',

  -- Timing
  created_at      bigint      not null, -- Unix timestamp from on-chain
  indexed_at      timestamptz not null default now()
);

create index if not exists idx_events_pool    on events(pool_id);
create index if not exists idx_events_type    on events(event_type);
create index if not exists idx_events_slot    on events(slot desc);
create index if not exists idx_events_actor   on events(actor);


-- ══════════════════════════════════════════════════════════
-- 4. TOKEN_PRICES — cached oracle prices for display
-- ══════════════════════════════════════════════════════════
create table if not exists token_prices (
  symbol          text        primary key,
  mint_address    text        unique not null,
  price_usd       numeric     not null,
  updated_at      timestamptz not null default now()
);

-- Seed with supported tokens
insert into token_prices (symbol, mint_address, price_usd) values
  ('SOL', 'So11111111111111111111111111111111111111112', 0),
  ('BTC', '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh', 0),
  ('ETH', '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', 0)
on conflict (symbol) do nothing;


-- ══════════════════════════════════════════════════════════
-- 5. SECURITY — Row Level Security
-- ══════════════════════════════════════════════════════════

-- All tables are PUBLIC READ (on-chain data is already public)
-- All tables are WRITE-RESTRICTED (only indexer service role writes)

alter table pools enable row level security;
alter table positions enable row level security;
alter table events enable row level security;
alter table token_prices enable row level security;

-- Public read
create policy "pools_read"        on pools        for select using (true);
create policy "positions_read"    on positions    for select using (true);
create policy "events_read"       on events       for select using (true);
create policy "token_prices_read" on token_prices for select using (true);

-- Indexer write (service_role only — bypasses RLS)
-- No explicit insert/update policies = blocked for anon/authenticated roles
-- The indexer uses the service_role key which bypasses RLS entirely


-- ══════════════════════════════════════════════════════════
-- 6. REALTIME — enable Supabase Realtime for live updates
-- ══════════════════════════════════════════════════════════
alter publication supabase_realtime add table pools;
alter publication supabase_realtime add table positions;
alter publication supabase_realtime add table events;

-- token_prices NOT in realtime (updated by cron, not per-TX)
