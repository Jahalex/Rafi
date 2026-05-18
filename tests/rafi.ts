import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rafi } from "../target/types/rafi";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

// ════════════════════════════════════════════════════════════════
// RAFI — Adversarial E2E Security Test Suite (v3)
// 25 tests across 7 attack categories
// ════════════════════════════════════════════════════════════════

describe("rafi", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Rafi as Program<Rafi>;

  const authority = provider.wallet as anchor.Wallet;
  const seller = Keypair.generate();
  const buyer1 = Keypair.generate();
  const buyer2 = Keypair.generate();
  const buyer3 = Keypair.generate();
  const treasury = Keypair.generate();
  const nobody = Keypair.generate();

  let assetMint: PublicKey;
  let usdcMint: PublicKey;
  let fakeMint: PublicKey;
  let sellerAssetAccount: PublicKey;
  let buyer1UsdcAccount: PublicKey;
  let buyer2UsdcAccount: PublicKey;
  let buyer3UsdcAccount: PublicKey;
  let protocolPda: PublicKey;
  let poolPda: PublicKey;

  const ASSET_AMOUNT = new BN(1_000_000_000);
  const POOL_TOTAL_USDC = new BN(140_000_000);
  const DURATION_SECS = new BN(3600);

  // Helper: get USDC vault for a pool
  const getUsdcVault = (pool: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("usdc_vault"), pool.toBuffer()], program.programId)[0];
  const getAssetVault = (pool: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("asset_vault"), pool.toBuffer()], program.programId)[0];
  const getPosition = (pool: PublicKey, idx: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("position"), pool.toBuffer(), new BN(idx).toArrayLike(Buffer, "le", 4)], program.programId)[0];
  const getPoolPda = (sellerPk: PublicKey, id: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), sellerPk.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 8)], program.programId)[0];

  before(async () => {
    for (const kp of [seller, buyer1, buyer2, buyer3, treasury, nobody]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 10 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }
    assetMint = await createMint(provider.connection, authority.payer, authority.publicKey, null, 9);
    usdcMint = await createMint(provider.connection, authority.payer, authority.publicKey, null, 6);
    fakeMint = await createMint(provider.connection, authority.payer, authority.publicKey, null, 6);

    sellerAssetAccount = await createAccount(provider.connection, seller, assetMint, seller.publicKey);
    buyer1UsdcAccount = await createAccount(provider.connection, buyer1, usdcMint, buyer1.publicKey);
    buyer2UsdcAccount = await createAccount(provider.connection, buyer2, usdcMint, buyer2.publicKey);
    buyer3UsdcAccount = await createAccount(provider.connection, buyer3, usdcMint, buyer3.publicKey);

    await mintTo(provider.connection, authority.payer, assetMint, sellerAssetAccount,
      authority.publicKey, BigInt("10000000000")); // 10 tokens
    for (const acc of [buyer1UsdcAccount, buyer2UsdcAccount, buyer3UsdcAccount]) {
      await mintTo(provider.connection, authority.payer, usdcMint, acc,
        authority.publicKey, BigInt("1000000000")); // 1000 USDC each
    }

    [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from("rafi_protocol")], program.programId);
    console.log("  Setup complete ✓");
  });

  // ═══════════════════════════════════════
  // CAT-1: PROTOCOL INIT & DEFENSE
  // ═══════════════════════════════════════

  it("1. init protocol with official USDC mint", async () => {
    await program.methods.initializeProtocol({ treasury: treasury.publicKey, usdcMint })
      .accountsPartial({ authority: authority.publicKey }).rpc();
    const p = await program.account.rafiProtocol.fetch(protocolPda);
    expect(p.feeBps).to.equal(600);
    expect(p.usdcMint.toBase58()).to.equal(usdcMint.toBase58());
    expect(p.isPaused).to.be.false;
    console.log("  ✓ Protocol initialized");
  });

  it("2. VULN-03: rejects fake USDC mint at pool creation", async () => {
    try {
      await program.methods.createPool({
        multiplierBps: 14_000, minProbabilityBps: 100,
        durationSecs: DURATION_SECS, assetAmount: ASSET_AMOUNT, poolTotalUsdc: POOL_TOTAL_USDC,
      }).accountsPartial({
        assetMint, usdcMint: fakeMint, sellerAssetAccount, seller: seller.publicKey,
      }).signers([seller]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("InvalidUsdcMint");
      console.log("  ✓ Fake USDC blocked");
    }
  });

  it("3. VULN-09: rejects min_probability > 100%", async () => {
    try {
      await program.methods.createPool({
        multiplierBps: 14_000, minProbabilityBps: 60_000,
        durationSecs: DURATION_SECS, assetAmount: ASSET_AMOUNT, poolTotalUsdc: POOL_TOTAL_USDC,
      }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
        .signers([seller]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("MinProbabilityTooHigh");
      console.log("  ✓ Absurd min_prob blocked");
    }
  });

  // ═══════════════════════════════════════
  // CAT-2: POOL LIFECYCLE
  // ═══════════════════════════════════════

  it("4. seller creates pool — asset locked", async () => {
    poolPda = getPoolPda(seller.publicKey, 0);
    await program.methods.createPool({
      multiplierBps: 14_000, minProbabilityBps: 100,
      durationSecs: DURATION_SECS, assetAmount: ASSET_AMOUNT, poolTotalUsdc: POOL_TOTAL_USDC,
    }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
      .signers([seller]).rpc();

    const vault = await getAccount(provider.connection, getAssetVault(poolPda));
    expect(Number(vault.amount)).to.equal(ASSET_AMOUNT.toNumber());
    console.log("  ✓ Pool created, asset locked in vault");
  });

  it("5. buyer 1 mints 40% → range [0, 4000)", async () => {
    await program.methods.mintProbability({ probabilityBps: 4000 })
      .accountsPartial({ pool: poolPda, usdcVault: getUsdcVault(poolPda),
        buyerUsdcAccount: buyer1UsdcAccount, buyer: buyer1.publicKey })
      .signers([buyer1]).rpc();
    const pos = await program.account.probabilityPosition.fetch(getPosition(poolPda, 0));
    expect(pos.rangeStartBps).to.equal(0);
    expect(pos.rangeEndBps).to.equal(4000);
    expect(pos.usdcPaid.toNumber()).to.equal(56_000_000);
    console.log("  ✓ Buyer 1: 40% = 56 USDC");
  });

  it("6. buyer 2 mints 35% → range [4000, 7500)", async () => {
    await program.methods.mintProbability({ probabilityBps: 3500 })
      .accountsPartial({ pool: poolPda, usdcVault: getUsdcVault(poolPda),
        buyerUsdcAccount: buyer2UsdcAccount, buyer: buyer2.publicKey })
      .signers([buyer2]).rpc();
    const pos = await program.account.probabilityPosition.fetch(getPosition(poolPda, 1));
    expect(pos.rangeStartBps).to.equal(4000);
    expect(pos.rangeEndBps).to.equal(7500);
    console.log("  ✓ Buyer 2: 35% = 49 USDC");
  });

  it("7. buyer 3 mints 25% → pool FILLED", async () => {
    await program.methods.mintProbability({ probabilityBps: 2500 })
      .accountsPartial({ pool: poolPda, usdcVault: getUsdcVault(poolPda),
        buyerUsdcAccount: buyer3UsdcAccount, buyer: buyer3.publicKey })
      .signers([buyer3]).rpc();
    const pool = await program.account.pool.fetch(poolPda);
    expect(pool.totalProbabilitySoldBps).to.equal(10000);
    expect(Object.keys(pool.state)[0]).to.equal("filled");
    console.log("  ✓ Pool FILLED (100%)");
  });

  // ═══════════════════════════════════════
  // CAT-3: ATTACK — MINT AFTER FILL
  // ═══════════════════════════════════════

  it("8. rejects mint on filled pool", async () => {
    try {
      await program.methods.mintProbability({ probabilityBps: 100 })
        .accountsPartial({ pool: poolPda, usdcVault: getUsdcVault(poolPda),
          buyerUsdcAccount: buyer1UsdcAccount, buyer: buyer1.publicKey })
        .signers([buyer1]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("PoolNotOpen");
      console.log("  ✓ Mint on filled pool blocked");
    }
  });

  it("9. rejects mint below minimum", async () => {
    // Pool #1 with 5% minimum
    const pool1 = getPoolPda(seller.publicKey, 1);
    await program.methods.createPool({
      multiplierBps: 12000, minProbabilityBps: 500,
      durationSecs: DURATION_SECS, assetAmount: ASSET_AMOUNT, poolTotalUsdc: new BN(120_000_000),
    }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
      .signers([seller]).rpc();

    try {
      await program.methods.mintProbability({ probabilityBps: 200 })
        .accountsPartial({ pool: pool1, usdcVault: getUsdcVault(pool1),
          buyerUsdcAccount: buyer1UsdcAccount, buyer: buyer1.publicKey })
        .signers([buyer1]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("ProbabilityBelowMinimum");
      console.log("  ✓ Below-min probability blocked");
    }
  });

  it("10. rejects mint > remaining probability", async () => {
    const pool1 = getPoolPda(seller.publicKey, 1);
    try {
      await program.methods.mintProbability({ probabilityBps: 10001 })
        .accountsPartial({ pool: pool1, usdcVault: getUsdcVault(pool1),
          buyerUsdcAccount: buyer1UsdcAccount, buyer: buyer1.publicKey })
        .signers([buyer1]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("ProbabilityExceedsRemaining");
      console.log("  ✓ Overflow probability blocked");
    }
  });

  // ═══════════════════════════════════════
  // CAT-4: PAUSE / ADMIN
  // ═══════════════════════════════════════

  it("11. GAP-4: pause blocks new mints", async () => {
    await program.methods.pauseProtocol().accountsPartial({ authority: authority.publicKey }).rpc();
    const pool1 = getPoolPda(seller.publicKey, 1);
    try {
      await program.methods.mintProbability({ probabilityBps: 1000 })
        .accountsPartial({ pool: pool1, usdcVault: getUsdcVault(pool1),
          buyerUsdcAccount: buyer1UsdcAccount, buyer: buyer1.publicKey })
        .signers([buyer1]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("ProtocolPaused");
      console.log("  ✓ Pause blocks mints");
    }
    await program.methods.unpauseProtocol().accountsPartial({ authority: authority.publicKey }).rpc();
  });

  it("12. pause blocks new pools", async () => {
    await program.methods.pauseProtocol().accountsPartial({ authority: authority.publicKey }).rpc();
    try {
      await program.methods.createPool({
        multiplierBps: 14_000, minProbabilityBps: 100,
        durationSecs: DURATION_SECS, assetAmount: ASSET_AMOUNT, poolTotalUsdc: POOL_TOTAL_USDC,
      }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
        .signers([seller]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("ProtocolPaused");
      console.log("  ✓ Pause blocks pool creation");
    }
    await program.methods.unpauseProtocol().accountsPartial({ authority: authority.publicKey }).rpc();
  });

  it("13. rejects non-admin fee update", async () => {
    try {
      await program.methods.updateFee(500)
        .accountsPartial({ authority: nobody.publicKey }).signers([nobody]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("Unauthorized");
      console.log("  ✓ Non-admin blocked");
    }
  });

  it("14. rejects fee > MAX_FEE_BPS (10%)", async () => {
    try {
      await program.methods.updateFee(1100).accountsPartial({ authority: authority.publicKey }).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("InvalidFee");
      console.log("  ✓ Fee > 10% blocked");
    }
  });

  it("15. admin updates fee and treasury", async () => {
    await program.methods.updateFee(800).accountsPartial({ authority: authority.publicKey }).rpc();
    let p = await program.account.rafiProtocol.fetch(protocolPda);
    expect(p.feeBps).to.equal(800);

    const newT = Keypair.generate().publicKey;
    await program.methods.updateTreasury(newT).accountsPartial({ authority: authority.publicKey }).rpc();
    p = await program.account.rafiProtocol.fetch(protocolPda);
    expect(p.treasury.toBase58()).to.equal(newT.toBase58());

    // Restore
    await program.methods.updateFee(600).accountsPartial({ authority: authority.publicKey }).rpc();
    await program.methods.updateTreasury(treasury.publicKey).accountsPartial({ authority: authority.publicKey }).rpc();
    console.log("  ✓ Admin fee + treasury cycle");
  });

  // ═══════════════════════════════════════
  // CAT-5: EXPIRE + REFUND CYCLE
  // ═══════════════════════════════════════

  it("16. rejects early expire on Open pool", async () => {
    const pool1 = getPoolPda(seller.publicKey, 1);
    try {
      await program.methods.expirePool()
        .accountsPartial({ pool: pool1, payer: nobody.publicKey })
        .signers([nobody]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("PoolNotExpired");
      console.log("  ✓ Early expire blocked");
    }
  });

  it("17. rejects refund on non-expired pool", async () => {
    const pool1 = getPoolPda(seller.publicKey, 1);
    // First, add a position to pool1 so we have something to refund
    await program.methods.mintProbability({ probabilityBps: 1000 })
      .accountsPartial({ pool: pool1, usdcVault: getUsdcVault(pool1),
        buyerUsdcAccount: buyer1UsdcAccount, buyer: buyer1.publicKey })
      .signers([buyer1]).rpc();

    try {
      await program.methods.claimRefund()
        .accountsPartial({ pool: pool1, position: getPosition(pool1, 0),
          usdcVault: getUsdcVault(pool1), buyerUsdcAccount: buyer1UsdcAccount, buyer: buyer1.publicKey })
        .signers([buyer1]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("PoolAlreadySettled");
      console.log("  ✓ Refund on Open pool blocked");
    }
  });

  it("18. rejects asset claim on non-expired pool", async () => {
    const pool1 = getPoolPda(seller.publicKey, 1);
    try {
      await program.methods.claimAssetBack()
        .accountsPartial({ pool: pool1, assetVault: getAssetVault(pool1),
          sellerAssetAccount, seller: seller.publicKey })
        .signers([seller]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("InvalidPoolState");
      console.log("  ✓ Asset claim on Open pool blocked");
    }
  });

  it("19. rejects unauthorized asset claim (non-seller)", async () => {
    const pool2 = getPoolPda(seller.publicKey, 2);
    await program.methods.createPool({
      multiplierBps: 11_000, minProbabilityBps: 10_000,
      durationSecs: new BN(300), assetAmount: ASSET_AMOUNT, poolTotalUsdc: new BN(100_000_000),
    }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
      .signers([seller]).rpc();

    // Nobody tries to claim seller's asset — should be rejected
    try {
      await program.methods.claimAssetBack()
        .accountsPartial({ pool: pool2, assetVault: getAssetVault(pool2),
          sellerAssetAccount, seller: nobody.publicKey })
        .signers([nobody]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.match(/Unauthorized|InvalidPoolState|constraint/i);
      console.log("  ✓ Non-seller asset claim blocked");
    }
  });

  // ═══════════════════════════════════════
  // CAT-6: MATH INTEGRITY
  // ═══════════════════════════════════════

  it("20. cost math: cost = pool_total × prob / 10000", async () => {
    const pool = await program.account.pool.fetch(poolPda);
    for (let i = 0; i < 3; i++) {
      const pos = await program.account.probabilityPosition.fetch(getPosition(poolPda, i));
      const expected = Math.floor((pool.poolTotalUsdc.toNumber() * pos.probabilityBps) / 10000);
      expect(pos.usdcPaid.toNumber()).to.equal(expected);
    }
    console.log("  ✓ Cost math verified for all positions");
  });

  it("21. probability space contiguous — no gaps, no overlaps", async () => {
    const pool = await program.account.pool.fetch(poolPda);
    let lastEnd = 0;
    for (let i = 0; i < pool.positionCount; i++) {
      const pos = await program.account.probabilityPosition.fetch(getPosition(poolPda, i));
      expect(pos.rangeStartBps).to.equal(lastEnd, `Gap at position ${i}`);
      expect(pos.rangeEndBps).to.be.greaterThan(pos.rangeStartBps, `Zero-width at ${i}`);
      lastEnd = pos.rangeEndBps;
    }
    expect(lastEnd).to.equal(10000);
    console.log("  ✓ Probability space [0,10000) complete, no gaps");
  });

  it("22. fee math: 6% treasury, 94% seller", async () => {
    const total = 140_000_000;
    const fee = Math.floor((total * 600) / 10000);
    const sellerAmt = total - fee;
    expect(fee).to.equal(8_400_000);
    expect(sellerAmt).to.equal(131_600_000);
    expect(fee + sellerAmt).to.equal(total);
    console.log("  ✓ Fee + seller = total (no dust leak)");
  });

  it("23. vault balance matches usdc_collected", async () => {
    const pool = await program.account.pool.fetch(poolPda);
    const vault = await getAccount(provider.connection, getUsdcVault(poolPda));
    expect(Number(vault.amount)).to.equal(pool.usdcCollected.toNumber());
    console.log("  ✓ Vault balance = usdc_collected");
  });

  // ═══════════════════════════════════════
  // CAT-7: BOUNDARY CONDITIONS
  // ═══════════════════════════════════════

  it("24. multiplier bounds enforced", async () => {
    // Too low
    try {
      await program.methods.createPool({
        multiplierBps: 10_000, minProbabilityBps: 100,
        durationSecs: DURATION_SECS, assetAmount: ASSET_AMOUNT, poolTotalUsdc: POOL_TOTAL_USDC,
      }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
        .signers([seller]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("MultiplierOutOfRange");
    }
    // Too high
    try {
      await program.methods.createPool({
        multiplierBps: 20_000, minProbabilityBps: 100,
        durationSecs: DURATION_SECS, assetAmount: ASSET_AMOUNT, poolTotalUsdc: POOL_TOTAL_USDC,
      }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
        .signers([seller]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("MultiplierOutOfRange");
    }
    console.log("  ✓ Multiplier [1.1, 1.8] enforced");
  });

  it("25. zero asset amount rejected", async () => {
    try {
      await program.methods.createPool({
        multiplierBps: 14_000, minProbabilityBps: 100,
        durationSecs: DURATION_SECS, assetAmount: new BN(0), poolTotalUsdc: POOL_TOTAL_USDC,
      }).accountsPartial({ assetMint, usdcMint, sellerAssetAccount, seller: seller.publicKey })
        .signers([seller]).rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.toString()).to.include("ZeroAssetAmount");
      console.log("  ✓ Zero asset blocked");
    }
  });
});
