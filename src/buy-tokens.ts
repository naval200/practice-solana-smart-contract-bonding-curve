import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import fs from "fs";
import path from "path";

// Load keypairs
const creatorKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "../wallets/creator.json"), "utf-8")))
);

const tokenMintPubkey = new PublicKey("3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw");

async function buyTokens() {
  // Set up the provider
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(creatorKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load the program
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../bonding-curve-program/target/idl/bonding_curve_program.json"), "utf-8"));
  const program = new Program(idl, provider);

  console.log("Program ID:", program.programId.toString());
  console.log("Buyer:", creatorKeypair.publicKey.toString());
  console.log("Token Mint:", tokenMintPubkey.toString());

  // Derive PDA accounts
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), tokenMintPubkey.toBuffer()],
    program.programId
  );

  const [solVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), tokenMintPubkey.toBuffer()],
    program.programId
  );

  // Get buyer's associated token account
  const buyerTokenAccount = await getAssociatedTokenAddress(
    tokenMintPubkey,
    creatorKeypair.publicKey
  );

  console.log("Bonding Curve PDA:", bondingCurvePda.toString());
  console.log("SOL Vault PDA:", solVaultPda.toString());
  console.log("Buyer Token Account:", buyerTokenAccount.toString());

  // Buy tokens with 0.01 SOL
  const solAmount = new anchor.BN(10_000_000); // 0.01 SOL in lamports

  console.log("\nBuying tokens...");

  try {
    const tx = await program.methods
      .buyTokens(solAmount)
      .accounts({
        buyer: creatorKeypair.publicKey,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMintPubkey,
        buyerTokenAccount: buyerTokenAccount,
        solVault: solVaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([creatorKeypair])
      .rpc();

    console.log("Transaction signature:", tx);
    console.log("✅ Tokens purchased successfully!");

    // Check token balance
    const tokenBalance = await connection.getTokenAccountBalance(buyerTokenAccount);
    console.log("Token balance:", tokenBalance.value.uiAmount, "tokens");

  } catch (error) {
    console.error("Error buying tokens:", error);
  }
}

buyTokens().catch(console.error);