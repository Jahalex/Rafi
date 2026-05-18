/**
 * RAFI — Initialize Protocol on Devnet
 *
 * Run: npx tsx scripts/init-protocol.ts
 *
 * This script:
 * 1. Connects to devnet using your CLI wallet
 * 2. Calls initialize_protocol with your wallet as authority
 * 3. Sets the fake USDC mint as the official USDC
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rafi } from "../target/types/rafi";
import { PublicKey } from "@solana/web3.js";

const FAKE_USDC_MINT = new PublicKey("5xLsCVKHjZZ4dbcSkGxrduNav1cmJenDSdza7hnrWYS1");

async function main() {
  // Use devnet RPC
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Load wallet from ~/.config/solana/id.json
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.Rafi as Program<Rafi>;

  console.log("Program ID:", program.programId.toBase58());
  console.log("Authority:", wallet.publicKey.toBase58());
  console.log("USDC Mint:", FAKE_USDC_MINT.toBase58());

  // Derive protocol PDA
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rafi_protocol")],
    program.programId
  );

  console.log("Protocol PDA:", protocolPda.toBase58());

  // Check if already initialized
  try {
    const existing = await program.account.rafiProtocol.fetch(protocolPda);
    console.log("✅ Protocol already initialized!");
    console.log("   Authority:", existing.authority.toBase58());
    console.log("   USDC Mint:", existing.usdcMint.toBase58());
    console.log("   Fee BPS:", existing.feeBps);
    console.log("   Pool Counter:", existing.poolCounter.toString());
    console.log("   Paused:", existing.isPaused);
    return;
  } catch {
    console.log("Protocol not yet initialized. Initializing...");
  }

  // Initialize
  const tx = await program.methods
    .initializeProtocol({
      treasury: wallet.publicKey,  // Treasury = authority for devnet
      usdcMint: FAKE_USDC_MINT,
    })
    .accounts({
      protocol: protocolPda,
      authority: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("✅ Protocol initialized!");
  console.log("   TX:", tx);

  // Verify
  const protocol = await program.account.rafiProtocol.fetch(protocolPda);
  console.log("\n── Protocol State ──");
  console.log("   Authority:", protocol.authority.toBase58());
  console.log("   Treasury:", protocol.treasury.toBase58());
  console.log("   USDC Mint:", protocol.usdcMint.toBase58());
  console.log("   Fee BPS:", protocol.feeBps);
  console.log("   Pool Counter:", protocol.poolCounter.toString());
  console.log("   Paused:", protocol.isPaused);
}

main().catch(console.error);
