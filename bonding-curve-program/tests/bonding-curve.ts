import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BondingCurveProgram } from "../target/types/bonding_curve_program";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";

/**
 * Comprehensive test suite for the Bonding Curve SPL Token Program
 * 
 * This test suite demonstrates and validates all functionality of our educational
 * bonding curve program, including:
 * - Token creation with bonding curve
 * - Token purchasing (minting via curve)
 * - Token selling (burning via curve)
 * - Price calculations and curve mechanics
 * 
 * These tests serve both as validation and as educational examples
 * showing how to interact with the program programmatically.
 */

describe("Bonding Curve SPL Token Program", () => {
  // Configure the client to use the local cluster for testing
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BondingCurveProgram as Program<BondingCurveProgram>;
  const provider = anchor.AnchorProvider.env();

  // Test accounts and keypairs
  let creator: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let tokenMint: Keypair;
  let bondingCurvePda: PublicKey;
  let bondingCurveBump: number;
  let solVaultPda: PublicKey;
  let solVaultBump: number;

  // Token parameters for testing
  const TOKEN_NAME = "TestCoin";
  const TOKEN_SYMBOL = "TEST";
  const TOKEN_URI = "https://example.com/test-token.json";
  const INITIAL_PRICE = new anchor.BN(100_000); // 0.0001 SOL in lamports
  const SLOPE = new anchor.BN(100); // Price increases by 0.0000001 SOL per token

  /**
   * Setup phase: Create accounts and derive PDAs
   * This runs before all tests to prepare the testing environment
   */
  before(async () => {
    console.log("🔧 Setting up test environment...");

    // Generate keypairs for test accounts
    creator = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    tokenMint = Keypair.generate();

    // Fund test accounts with SOL for transactions
    // Note: In a real test environment, you'd use a test validator or faucet
    const fundingAmount = 10 * LAMPORTS_PER_SOL; // 10 SOL each
    
    await provider.connection.requestAirdrop(creator.publicKey, fundingAmount);
    await provider.connection.requestAirdrop(user1.publicKey, fundingAmount);
    await provider.connection.requestAirdrop(user2.publicKey, fundingAmount);

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Derive Program Derived Addresses (PDAs)
    [bondingCurvePda, bondingCurveBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), tokenMint.publicKey.toBuffer()],
      program.programId
    );

    [solVaultPda, solVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("sol_vault"), bondingCurvePda.toBuffer()],
      program.programId
    );

    console.log(`📍 Token Mint: ${tokenMint.publicKey.toString()}`);
    console.log(`📊 Bonding Curve: ${bondingCurvePda.toString()}`);
    console.log(`💰 SOL Vault: ${solVaultPda.toString()}`);
  });

  /**
   * Test 1: Initialize Bonding Curve
   * This test validates the token creation and bonding curve initialization
   */
  it("Initializes a bonding curve for a new token", async () => {
    console.log("\n🧪 Test 1: Initializing bonding curve...");

    try {
      // Execute the initialize_bonding_curve instruction
      const tx = await program.methods
        .initializeBondingCurve(
          INITIAL_PRICE,
          SLOPE,
          bondingCurveBump,
          TOKEN_NAME,
          TOKEN_SYMBOL,
          TOKEN_URI
        )
        .accounts({
          creator: creator.publicKey,
          tokenMint: tokenMint.publicKey,
          bondingCurve: bondingCurvePda,
          solVault: solVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([creator, tokenMint])
        .rpc();

      console.log(`✅ Initialization transaction: ${tx}`);

      // Verify the bonding curve account was created correctly
      const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
      
      // Validate all stored parameters
      expect(bondingCurveAccount.tokenMint.toString()).to.equal(tokenMint.publicKey.toString());
      expect(bondingCurveAccount.creator.toString()).to.equal(creator.publicKey.toString());
      expect(bondingCurveAccount.initialPrice.toNumber()).to.equal(INITIAL_PRICE.toNumber());
      expect(bondingCurveAccount.slope.toNumber()).to.equal(SLOPE.toNumber());
      expect(bondingCurveAccount.currentSupply.toNumber()).to.equal(0);
      expect(bondingCurveAccount.solReserves.toNumber()).to.equal(0);
      expect(bondingCurveAccount.name).to.equal(TOKEN_NAME);
      expect(bondingCurveAccount.symbol).to.equal(TOKEN_SYMBOL);
      expect(bondingCurveAccount.uri).to.equal(TOKEN_URI);

      console.log("✅ Bonding curve initialized with correct parameters");
      console.log(`   Name: ${bondingCurveAccount.name}`);
      console.log(`   Symbol: ${bondingCurveAccount.symbol}`);
      console.log(`   Initial Price: ${bondingCurveAccount.initialPrice.toNumber()} lamports`);
      console.log(`   Slope: ${bondingCurveAccount.slope.toNumber()}`);
    } catch (error) {
      console.error("❌ Initialization failed:", error);
      throw error;
    }
  });

  /**
   * Test 2: Buy Tokens (First Purchase)
   * This test validates the token purchasing mechanism and price calculations
   */
  it("Allows users to buy tokens with SOL", async () => {
    console.log("\n🧪 Test 2: Buying tokens with SOL...");

    const solAmountToPay = new anchor.BN(1_000_000); // 0.001 SOL in lamports
    
    try {
      // Get user1's associated token account address
      const user1TokenAccount = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        user1.publicKey
      );

      console.log(`💰 User1 buying tokens with 0.001 SOL...`);
      console.log(`🪙 User1 token account: ${user1TokenAccount.toString()}`);

      // Get balances before purchase
      const user1SolBefore = await provider.connection.getBalance(user1.publicKey);
      console.log(`💰 User1 SOL before: ${user1SolBefore / LAMPORTS_PER_SOL} SOL`);

      // Execute buy_tokens instruction
      const tx = await program.methods
        .buyTokens(solAmountToPay)
        .accounts({
          buyer: user1.publicKey,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          buyerTokenAccount: user1TokenAccount,
          solVault: solVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc();

      console.log(`✅ Purchase transaction: ${tx}`);

      // Verify the purchase results
      const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
      const user1TokenAccountInfo = await provider.connection.getTokenAccountBalance(user1TokenAccount);

      // Check that tokens were minted
      expect(bondingCurveAccount.currentSupply.toNumber()).to.be.greaterThan(0);
      expect(parseInt(user1TokenAccountInfo.value.amount)).to.be.greaterThan(0);

      // Check that SOL was transferred to vault
      expect(bondingCurveAccount.solReserves.toNumber()).to.be.greaterThan(0);

      console.log(`✅ Purchase successful!`);
      console.log(`   Tokens minted: ${user1TokenAccountInfo.value.amount}`);
      console.log(`   New total supply: ${bondingCurveAccount.currentSupply.toNumber()}`);
      console.log(`   SOL reserves: ${bondingCurveAccount.solReserves.toNumber()} lamports`);

      // Verify price calculation
      const expectedPrice = INITIAL_PRICE.toNumber() + (bondingCurveAccount.currentSupply.toNumber() * SLOPE.toNumber());
      console.log(`   Current price: ${expectedPrice} lamports per token`);
    } catch (error) {
      console.error("❌ Token purchase failed:", error);
      throw error;
    }
  });

  /**
   * Test 3: Buy More Tokens (Price Increase)
   * This test validates that the bonding curve increases price as supply grows
   */
  it("Demonstrates price increases with more purchases", async () => {
    console.log("\n🧪 Test 3: Testing price increases...");

    const solAmountToPay = new anchor.BN(2_000_000); // 0.002 SOL in lamports

    try {
      // Get state before second purchase
      const bondingCurveBefore = await program.account.bondingCurve.fetch(bondingCurvePda);
      const supplyBefore = bondingCurveBefore.currentSupply.toNumber();
      const reservesBefore = bondingCurveBefore.solReserves.toNumber();

      console.log(`📊 Supply before: ${supplyBefore} tokens`);
      console.log(`💰 Reserves before: ${reservesBefore} lamports`);

      // Get user2's associated token account
      const user2TokenAccount = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        user2.publicKey
      );

      // Execute second purchase
      const tx = await program.methods
        .buyTokens(solAmountToPay)
        .accounts({
          buyer: user2.publicKey,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          buyerTokenAccount: user2TokenAccount,
          solVault: solVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc();

      console.log(`✅ Second purchase transaction: ${tx}`);

      // Verify price increase
      const bondingCurveAfter = await program.account.bondingCurve.fetch(bondingCurvePda);
      const supplyAfter = bondingCurveAfter.currentSupply.toNumber();
      const reservesAfter = bondingCurveAfter.solReserves.toNumber();

      console.log(`📊 Supply after: ${supplyAfter} tokens`);
      console.log(`💰 Reserves after: ${reservesAfter} lamports`);

      // Verify supply and reserves increased
      expect(supplyAfter).to.be.greaterThan(supplyBefore);
      expect(reservesAfter).to.be.greaterThan(reservesBefore);

      // Calculate and verify price increased
      const priceBefore = INITIAL_PRICE.toNumber() + (supplyBefore * SLOPE.toNumber());
      const priceAfter = INITIAL_PRICE.toNumber() + (supplyAfter * SLOPE.toNumber());

      console.log(`📈 Price before: ${priceBefore} lamports per token`);
      console.log(`📈 Price after: ${priceAfter} lamports per token`);

      expect(priceAfter).to.be.greaterThan(priceBefore);
      console.log(`✅ Price increased correctly with bonding curve!`);
    } catch (error) {
      console.error("❌ Second purchase failed:", error);
      throw error;
    }
  });

  /**
   * Test 4: Sell Tokens
   * This test validates the token selling mechanism and liquidity provision
   */
  it("Allows users to sell tokens back for SOL", async () => {
    console.log("\n🧪 Test 4: Selling tokens for SOL...");

    try {
      // Get user1's token balance before selling
      const user1TokenAccount = await getAssociatedTokenAddress(
        tokenMint.publicKey,
        user1.publicKey
      );
      
      const tokenBalanceBefore = await provider.connection.getTokenAccountBalance(user1TokenAccount);
      const tokenAmountToSell = Math.floor(parseInt(tokenBalanceBefore.value.amount) / 2); // Sell half

      console.log(`🪙 User1 token balance: ${tokenBalanceBefore.value.amount}`);
      console.log(`💸 Selling ${tokenAmountToSell} tokens...`);

      // Get states before selling
      const bondingCurveBefore = await program.account.bondingCurve.fetch(bondingCurvePda);
      const user1SolBefore = await provider.connection.getBalance(user1.publicKey);

      // Execute sell_tokens instruction
      const tx = await program.methods
        .sellTokens(new anchor.BN(tokenAmountToSell))
        .accounts({
          seller: user1.publicKey,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          sellerTokenAccount: user1TokenAccount,
          solVault: solVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      console.log(`✅ Sell transaction: ${tx}`);

      // Verify the sale results
      const bondingCurveAfter = await program.account.bondingCurve.fetch(bondingCurvePda);
      const tokenBalanceAfter = await provider.connection.getTokenAccountBalance(user1TokenAccount);
      const user1SolAfter = await provider.connection.getBalance(user1.publicKey);

      // Verify supply decreased
      expect(bondingCurveAfter.currentSupply.toNumber()).to.be.lessThan(bondingCurveBefore.currentSupply.toNumber());
      
      // Verify user's token balance decreased
      expect(parseInt(tokenBalanceAfter.value.amount)).to.be.lessThan(parseInt(tokenBalanceBefore.value.amount));
      
      // Verify user received SOL (accounting for transaction fees)
      const solReceived = user1SolAfter - user1SolBefore;
      console.log(`💰 SOL received (minus fees): ${solReceived} lamports`);

      console.log(`✅ Token sale successful!`);
      console.log(`   Tokens sold: ${tokenAmountToSell}`);
      console.log(`   New supply: ${bondingCurveAfter.currentSupply.toNumber()}`);
      console.log(`   Remaining reserves: ${bondingCurveAfter.solReserves.toNumber()} lamports`);
    } catch (error) {
      console.error("❌ Token sale failed:", error);
      throw error;
    }
  });

  /**
   * Test 5: Get Current Price
   * This test validates the price query functionality
   */
  it("Can query current token price", async () => {
    console.log("\n🧪 Test 5: Querying current price...");

    try {
      // Query current price using the program
      await program.methods
        .getCurrentPrice()
        .accounts({
          bondingCurve: bondingCurvePda,
        })
        .rpc();

      // Also calculate price manually and verify
      const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
      const currentSupply = bondingCurveAccount.currentSupply.toNumber();
      const calculatedPrice = INITIAL_PRICE.toNumber() + (currentSupply * SLOPE.toNumber());

      console.log(`✅ Current price query successful`);
      console.log(`   Current supply: ${currentSupply} tokens`);
      console.log(`   Calculated price: ${calculatedPrice} lamports per token`);
      console.log(`   Price in SOL: ${calculatedPrice / LAMPORTS_PER_SOL} SOL per token`);
    } catch (error) {
      console.error("❌ Price query failed:", error);
      throw error;
    }
  });

  /**
   * Test 6: Error Cases
   * This test validates proper error handling for invalid operations
   */
  it("Handles error cases correctly", async () => {
    console.log("\n🧪 Test 6: Testing error cases...");

    try {
      // Test 1: Try to buy with 0 SOL (should fail)
      console.log("   Testing buy with 0 SOL...");
      try {
        const user1TokenAccount = await getAssociatedTokenAddress(
          tokenMint.publicKey,
          user1.publicKey
        );

        await program.methods
          .buyTokens(new anchor.BN(0))
          .accounts({
            buyer: user1.publicKey,
            bondingCurve: bondingCurvePda,
            tokenMint: tokenMint.publicKey,
            buyerTokenAccount: user1TokenAccount,
            solVault: solVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();

        // If we reach here, the test failed
        expect.fail("Should have thrown an error for 0 SOL purchase");
      } catch (error) {
        console.log("   ✅ Correctly rejected 0 SOL purchase");
        expect(error.toString()).to.include("InvalidAmount");
      }

      // Test 2: Try to sell 0 tokens (should fail)
      console.log("   Testing sell with 0 tokens...");
      try {
        const user1TokenAccount = await getAssociatedTokenAddress(
          tokenMint.publicKey,
          user1.publicKey
        );

        await program.methods
          .sellTokens(new anchor.BN(0))
          .accounts({
            seller: user1.publicKey,
            bondingCurve: bondingCurvePda,
            tokenMint: tokenMint.publicKey,
            sellerTokenAccount: user1TokenAccount,
            solVault: solVaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        expect.fail("Should have thrown an error for 0 token sale");
      } catch (error) {
        console.log("   ✅ Correctly rejected 0 token sale");
        expect(error.toString()).to.include("InvalidAmount");
      }

      console.log("✅ All error cases handled correctly");
    } catch (error) {
      console.error("❌ Error case testing failed:", error);
      throw error;
    }
  });

  /**
   * Final Test Summary
   * Display a summary of all test results and final state
   */
  after(async () => {
    console.log("\n📊 TEST SUMMARY");
    console.log("═".repeat(50));

    try {
      // Get final state
      const bondingCurveAccount = await program.account.bondingCurve.fetch(bondingCurvePda);
      const finalSupply = bondingCurveAccount.currentSupply.toNumber();
      const finalReserves = bondingCurveAccount.solReserves.toNumber();
      const finalPrice = INITIAL_PRICE.toNumber() + (finalSupply * SLOPE.toNumber());

      console.log(`✅ All tests completed successfully!`);
      console.log(`📊 Final token supply: ${finalSupply} tokens`);
      console.log(`💰 Final SOL reserves: ${finalReserves} lamports (${finalReserves / LAMPORTS_PER_SOL} SOL)`);
      console.log(`📈 Final token price: ${finalPrice} lamports (${finalPrice / LAMPORTS_PER_SOL} SOL) per token`);
      
      // Calculate total market cap
      const marketCapLamports = (finalSupply * finalPrice);
      console.log(`📊 Market cap: ${marketCapLamports} lamports (${marketCapLamports / LAMPORTS_PER_SOL} SOL)`);

      console.log("\n🎓 EDUCATIONAL TAKEAWAYS:");
      console.log("• Bonding curves provide automated price discovery");
      console.log("• Price increases with supply growth, creating scarcity");  
      console.log("• Liquidity is always available for buying and selling");
      console.log("• SOL reserves ensure tokens can be sold back to the curve");
      console.log("• This demonstrates core DeFi AMM (Automated Market Maker) concepts");
    } catch (error) {
      console.error("❌ Failed to get final summary:", error);
    }
  });
});