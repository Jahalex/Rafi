// ═══════════════════════════════════════════════════
// RAFI — Anchor Client for Frontend
// ═══════════════════════════════════════════════════

import { Program, AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import { PublicKey, Connection, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { HermesClient } from "@pythnetwork/hermes-client";
import idl from "./idl.json";
import type { Rafi } from "./rafi-types";
import {
  RAFI_PROGRAM_ID,
  SOLANA_RPC_URL,
  USDC_MINT_DEVNET,
  SEED_PROTOCOL,
  SEED_POOL,
  SEED_ASSET_VAULT,
  SEED_USDC_VAULT,
  SEED_POSITION,
} from "./constants";

// ── Connection ──
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
export function getConnection(): Connection { return connection; }

// ── Program ID ──
const programId = new PublicKey(RAFI_PROGRAM_ID);

// ── Pyth constants ──
const PYTH_SOL_USD_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const PYTH_PULL_ORACLE_PID = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"
);
const HERMES_URL =
  process.env.NEXT_PUBLIC_HERMES_URL || "https://hermes.pyth.network";

// ── PDA Helpers ──
export function getProtocolPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_PROTOCOL)], programId
  )[0];
}

export function getPoolPda(seller: PublicKey, poolId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_POOL), seller.toBuffer(), new BN(poolId).toArrayLike(Buffer, "le", 8)],
    programId
  )[0];
}

export function getAssetVault(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_ASSET_VAULT), pool.toBuffer()], programId
  )[0];
}

export function getUsdcVault(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_USDC_VAULT), pool.toBuffer()], programId
  )[0];
}

export function getPositionPda(pool: PublicKey, positionIndex: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEED_POSITION), pool.toBuffer(), new BN(positionIndex).toArrayLike(Buffer, "le", 4)],
    programId
  )[0];
}

// ── Wallet adapter interface ──
interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

// ── Create Program (read-only) ──
export function getReadOnlyProgram(): Program<Rafi> {
  const dummyWallet: WalletAdapter = {
    publicKey: PublicKey.default,
    signAllTransactions: async (txs: Transaction[]) => txs,
    signTransaction: async (tx: Transaction) => tx,
  };
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: "confirmed" });
  return new Program(idl as any, provider);
}

// ── Create Program with wallet ──
export function getSigningProgram(wallet: WalletAdapter): Program<Rafi> {
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  return new Program(idl as any, provider);
}

// ══════════════════════════════════════════════════
// Pyth Price Update Account
// ══════════════════════════════════════════════════
//
// The Pyth Pull Oracle requires a PriceUpdateV2 account that contains
// a freshly-verified price signed by Wormhole validators.
//
// Flow for create_pool:
//   1. Fetch binary price update data from Hermes (VAA-encoded)
//   2. Derive the deterministic PriceUpdateV2 PDA address
//   3. Post the price update to Solana (creates/updates the account)
//   4. Pass that account to createPool — on-chain reads & validates it
//
// The PriceUpdateV2 account address is a PDA derived from:
//   seeds = [b"price_update", shard_id_bytes, feed_id_bytes]
//   program = PYTH_PULL_ORACLE_PID
//
// Shard 0 is the default shard for single-feed updates.
// ══════════════════════════════════════════════════

/**
 * Get the deterministic PriceUpdateV2 PDA address for a given feed ID.
 * This is the account our program reads. We derive it client-side to
 * pass as an account without needing to POST the update first.
 */
export function getPriceUpdatePda(feedIdHex: string): PublicKey {
  // Feed ID is 32 bytes, stored as hex string with optional 0x prefix
  const feedIdClean = feedIdHex.replace(/^0x/, "");
  const feedIdBytes = Buffer.from(feedIdClean, "hex");

  // Shard ID = 0 (default shard), as 2 bytes little-endian
  const shardIdBytes = Buffer.from([0, 0]);

  return PublicKey.findProgramAddressSync(
    [Buffer.from("price_update"), shardIdBytes, feedIdBytes],
    PYTH_PULL_ORACLE_PID
  )[0];
}

/**
 * Fetch the latest SOL/USD price update data from Hermes (binary, base64-encoded).
 * This data is used to post a fresh PriceUpdateV2 account before createPool.
 *
 * Returns null if Hermes is unreachable (caller should handle gracefully).
 */
export async function fetchPriceUpdateData(): Promise<string | null> {
  try {
    const feedIdClean = PYTH_SOL_USD_FEED_ID.replace(/^0x/, "");
    const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${feedIdClean}&encoding=base64&parsed=true`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[Pyth] Hermes fetch failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const binaryData = data?.binary?.data?.[0];
    if (!binaryData) {
      console.error("[Pyth] No binary data in Hermes response");
      return null;
    }
    return binaryData; // base64 encoded VAA
  } catch (err) {
    console.error("[Pyth] fetchPriceUpdateData error:", err);
    return null;
  }
}

/**
 * Post a Pyth price update to Solana via the Pyth Pull Oracle program.
 *
 * This instruction creates/updates the PriceUpdateV2 account on-chain,
 * making it available for the next createPool instruction to read.
 *
 * Returns the PriceUpdateV2 account public key, or null on failure.
 */
export async function postPythPriceUpdate(
  wallet: WalletAdapter,
  priceUpdateDataBase64: string
): Promise<PublicKey | null> {
  try {
    const priceUpdatePda = getPriceUpdatePda(PYTH_SOL_USD_FEED_ID);

    // Build postUpdate instruction data
    // Instruction discriminator for "postUpdate" in Pyth Receiver program: [133, 97, 28, 142, 231, 107, 200, 69]
    // The data is: discriminator (8 bytes) + shard_id (2 bytes LE) + update_data (prefixed length)
    const updateBytes = Buffer.from(priceUpdateDataBase64, "base64");
    const shardId = 0;

    // Instruction discriminator for postUpdate
    const discriminator = Buffer.from([133, 97, 28, 142, 231, 107, 200, 69]);
    const shardIdBuf = Buffer.allocUnsafe(2);
    shardIdBuf.writeUInt16LE(shardId, 0);
    const updateLenBuf = Buffer.allocUnsafe(4);
    updateLenBuf.writeUInt32LE(updateBytes.length, 0);

    const instructionData = Buffer.concat([
      discriminator,
      shardIdBuf,
      updateLenBuf,
      updateBytes,
    ]);

    // Accounts for postUpdate instruction
    const { blockhash } = await connection.getLatestBlockhash();
    const postUpdateIx = new web3.TransactionInstruction({
      programId: PYTH_PULL_ORACLE_PID,
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },  // payer
        { pubkey: priceUpdatePda, isSigner: false, isWritable: true },   // price_update_account
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    tx.add(postUpdateIx);

    const signed = await wallet.signTransaction(tx);
    await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    return priceUpdatePda;
  } catch (err) {
    console.error("[Pyth] postPythPriceUpdate error:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════
// Transaction Builders
// ══════════════════════════════════════════════════

export interface MintProbabilityArgs {
  poolPda: PublicKey;
  usdcVault: PublicKey;
  usdcMint: PublicKey;
  positionCount: number;
  probabilityBps: number;
  wallet: WalletAdapter;
}

export async function mintProbability(args: MintProbabilityArgs): Promise<string> {
  const { poolPda, usdcVault, usdcMint, positionCount, probabilityBps, wallet } = args;
  const program = getSigningProgram(wallet);
  const positionPda = getPositionPda(poolPda, positionCount);
  const buyerUsdcAta = await getAssociatedTokenAddress(usdcMint, wallet.publicKey);

  const tx = await program.methods
    .mintProbability({ probabilityBps })
    .accountsPartial({
      protocol: getProtocolPda(),
      pool: poolPda,
      position: positionPda,
      usdcVault,
      buyerUsdcAccount: buyerUsdcAta,
      buyer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  return tx;
}

export interface CreatePoolArgs {
  assetMint: PublicKey;
  assetAmount: number;
  multiplierBps: number;
  minProbabilityBps: number;
  durationSecs: number;
  poolTotalUsdc: number;
  wallet: WalletAdapter;
}

export async function createPool(args: CreatePoolArgs): Promise<string> {
  const {
    assetMint, assetAmount, multiplierBps, minProbabilityBps,
    durationSecs, poolTotalUsdc, wallet
  } = args;

  // ── Step 1: Fetch price update from Hermes ──────────────────────────────
  const priceUpdateDataB64 = await fetchPriceUpdateData();
  if (!priceUpdateDataB64) {
    throw new Error("StalePriceFeed: unable to fetch live SOL/USD price from Pyth Hermes");
  }

  // ── Step 2: Post price update to Solana (creates PriceUpdateV2 account) ─
  // This is a separate transaction that runs before createPool.
  // The PriceUpdateV2 account is then read by our program.
  const solPriceUpdatePda = await postPythPriceUpdate(wallet, priceUpdateDataB64);
  if (!solPriceUpdatePda) {
    throw new Error("StalePriceFeed: failed to post Pyth price update on-chain");
  }

  // ── Step 3: Build and send createPool transaction ───────────────────────
  const program = getSigningProgram(wallet);
  const protocolPda = getProtocolPda();
  const protocol = await program.account.rafiProtocol.fetch(protocolPda);
  const poolCounter = protocol.poolCounter.toNumber();

  const poolPda = getPoolPda(wallet.publicKey, poolCounter);
  const assetVault = getAssetVault(poolPda);
  const usdcVault = getUsdcVault(poolPda);
  const usdcMint = new PublicKey(USDC_MINT_DEVNET);
  const sellerAssetAta = await getAssociatedTokenAddress(assetMint, wallet.publicKey);

  const tx = await program.methods
    .createPool({
      multiplierBps,
      minProbabilityBps,
      durationSecs: new BN(durationSecs),
      assetAmount: new BN(assetAmount),
      poolTotalUsdc: new BN(poolTotalUsdc),
    })
    // Use (as any) because rafi-types.ts is generated from an older IDL
    // that doesn't include sol_price_update / pyth_program yet.
    // TODO: regenerate rafi-types.ts from the latest IDL.
    .accounts({
      protocol: protocolPda,
      pool: poolPda,
      assetVault,
      usdcVault,
      assetMint,
      usdcMint,
      sellerAssetAccount: sellerAssetAta,
      seller: wallet.publicKey,
      solPriceUpdate: solPriceUpdatePda,
      pythProgram: PYTH_PULL_ORACLE_PID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    } as any)
    .rpc();

  return tx;
}

// ── On-chain fetch helpers ──
export async function fetchPoolOnChain(poolPda: PublicKey) {
  const program = getReadOnlyProgram();
  return program.account.pool.fetch(poolPda);
}

export async function fetchAllPoolsOnChain() {
  const program = getReadOnlyProgram();
  return program.account.pool.all();
}

export async function fetchProtocol() {
  const program = getReadOnlyProgram();
  return program.account.rafiProtocol.fetch(getProtocolPda());
}

// ══════════════════════════════════════════════════
// Claim Refund — buyer reclaims USDC from expired pool
// ══════════════════════════════════════════════════

export interface ClaimRefundArgs {
  poolPda: PublicKey;
  positionPda: PublicKey;
  usdcVault: PublicKey;
  usdcMint: PublicKey;
  wallet: WalletAdapter;
}

export async function claimRefund(args: ClaimRefundArgs): Promise<string> {
  const { poolPda, positionPda, usdcVault, usdcMint, wallet } = args;
  const program = getSigningProgram(wallet);
  const buyerUsdcAta = await getAssociatedTokenAddress(usdcMint, wallet.publicKey);

  const tx = await program.methods
    .claimRefund()
    .accounts({
      pool: poolPda,
      position: positionPda,
      usdcVault,
      buyerUsdcAccount: buyerUsdcAta,
      buyer: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  return tx;
}

// ══════════════════════════════════════════════════
// Claim Asset Back — seller reclaims asset from expired pool
// ══════════════════════════════════════════════════

export interface ClaimAssetBackArgs {
  poolPda: PublicKey;
  assetVault: PublicKey;
  assetMint: PublicKey;
  wallet: WalletAdapter;
}

export async function claimAssetBack(args: ClaimAssetBackArgs): Promise<string> {
  const { poolPda, assetVault, assetMint, wallet } = args;
  const program = getSigningProgram(wallet);
  const sellerAssetAta = await getAssociatedTokenAddress(assetMint, wallet.publicKey);

  const tx = await program.methods
    .claimAssetBack()
    .accounts({
      pool: poolPda,
      assetVault,
      sellerAssetAccount: sellerAssetAta,
      seller: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();

  return tx;
}

// ══════════════════════════════════════════════════
// Request Settlement — trigger VRF draw for a filled pool
// (permissionless — anyone can call once 30min countdown elapsed)
// ══════════════════════════════════════════════════

const SB_ON_DEMAND_PID_DEVNET = new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");

export interface RequestSettlementArgs {
  poolPda: PublicKey;
  randomnessAccount: PublicKey;
  queue: PublicKey;
  oracle: PublicKey;
  wallet: WalletAdapter;
}

export async function requestSettlement(args: RequestSettlementArgs): Promise<string> {
  const { poolPda, randomnessAccount, queue, oracle, wallet } = args;
  const program = getSigningProgram(wallet);

  const tx = await program.methods
    .requestSettlement()
    .accounts({
      pool: poolPda,
      randomnessAccount,
      queue,
      oracle,
      recentSlothashes: new PublicKey("SysvarS1otHashes111111111111111111111111111"),
      switchboardProgram: SB_ON_DEMAND_PID_DEVNET,
      payer: wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    } as any)
    .rpc();

  return tx;
}

