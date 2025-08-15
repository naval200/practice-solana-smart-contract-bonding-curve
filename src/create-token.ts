import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import path from "path";

// Load keypairs
const creatorKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "../wallets/creator.json"), "utf-8")))
);

const tokenMintKeypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "../bonding-curve-program/token-mint-2.json"), "utf-8")))
);

async function createTokenWithBondingCurve() {
  // Set up the provider manually
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(creatorKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load the program
  const programId = new PublicKey("GQQQNJZdqKnFwB6di7u2PnsJZLX7hzaYW4g4b5BeQ3nE");
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../bonding-curve-program/target/idl/bonding_curve_program.json"), "utf-8"));
  const program = new Program(idl, provider);

  console.log("Program ID:", program.programId.toString());
  console.log("Creator:", creatorKeypair.publicKey.toString());
  console.log("Token Mint:", tokenMintKeypair.publicKey.toString());

  // Derive PDA accounts
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), tokenMintKeypair.publicKey.toBuffer()],
    program.programId
  );

  const [solVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), tokenMintKeypair.publicKey.toBuffer()],
    program.programId
  );

  console.log("Bonding Curve PDA:", bondingCurvePda.toString());
  console.log("SOL Vault PDA:", solVaultPda.toString());

  // Token parameters
  const initialPrice = new anchor.BN(1000000); // 0.001 SOL per token (1M lamports)
  const slope = new anchor.BN(100); // Price increases by 100 lamports per token
  const name = "Test Token";
  const symbol = "TEST";

  console.log("\nInitializing bonding curve...");

  try {
    const tx = await program.methods
      .initializeBondingCurve(initialPrice, slope, name, symbol)
      .accounts({
        creator: creatorKeypair.publicKey,
        tokenMint: tokenMintKeypair.publicKey,
        bondingCurve: bondingCurvePda,
        solVault: solVaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([creatorKeypair, tokenMintKeypair])
      .rpc();

    console.log("Transaction signature:", tx);
    console.log("✅ Token created successfully!");
    console.log("Token mint address:", tokenMintKeypair.publicKey.toString());
    console.log("Bonding curve address:", bondingCurvePda.toString());

  } catch (error) {
    console.error("Error creating token:", error);
  }
}

createTokenWithBondingCurve().catch(console.error);