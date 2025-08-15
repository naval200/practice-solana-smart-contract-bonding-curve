import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import fs from "fs";
import path from "path";

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let walletPath = "";
  let tokenMint = "";
  let solAmount = "0.01";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--wallet":
      case "-w":
        walletPath = args[i + 1];
        i++;
        break;
      case "--token":
      case "-t":
        tokenMint = args[i + 1];
        i++;
        break;
      case "--amount":
      case "-a":
        solAmount = args[i + 1];
        i++;
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: npm run buy-tokens -- [options]

Options:
  -w, --wallet <path>     Path to wallet JSON file (required)
  -t, --token <pubkey>    Token mint public key (required)
  -a, --amount <sol>      Amount of SOL to spend (default: 0.01)
  -h, --help              Show help

Example:
  npm run buy-tokens -- --wallet ./wallets/user1.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 0.05
`);
        process.exit(0);
    }
  }

  if (!walletPath) {
    console.error("Error: Wallet path is required. Use --wallet or -w flag.");
    console.log("Use --help for usage information.");
    process.exit(1);
  }

  if (!tokenMint) {
    console.error("Error: Token mint is required. Use --token or -t flag.");
    console.log("Use --help for usage information.");
    process.exit(1);
  }

  return { walletPath, tokenMint, solAmount: parseFloat(solAmount) };
}

// Parse arguments
const { walletPath, tokenMint, solAmount } = parseArgs();

// Load buyer wallet
let buyerKeypair: Keypair;
try {
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  buyerKeypair = Keypair.fromSecretKey(new Uint8Array(walletData));
} catch (error) {
  console.error(`Error loading wallet from ${walletPath}:`, error);
  process.exit(1);
}

const tokenMintPubkey = new PublicKey(tokenMint);

async function buyTokens() {
  // Set up the provider
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(buyerKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load the program
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../bonding-curve-program/target/idl/bonding_curve_program.json"), "utf-8"));
  const program = new Program(idl, provider);

  console.log("Program ID:", program.programId.toString());
  console.log("Buyer:", buyerKeypair.publicKey.toString());
  console.log("Token Mint:", tokenMintPubkey.toString());
  console.log("SOL Amount:", solAmount, "SOL");

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
    buyerKeypair.publicKey
  );

  console.log("Bonding Curve PDA:", bondingCurvePda.toString());
  console.log("SOL Vault PDA:", solVaultPda.toString());
  console.log("Buyer Token Account:", buyerTokenAccount.toString());

  // Convert SOL amount to lamports
  const solAmountLamports = new anchor.BN(Math.floor(solAmount * 1_000_000_000)); // Convert SOL to lamports

  console.log("\nBuying tokens...");

  try {
    const tx = await program.methods
      .buyTokens(solAmountLamports)
      .accounts({
        buyer: buyerKeypair.publicKey,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMintPubkey,
        buyerTokenAccount: buyerTokenAccount,
        solVault: solVaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([buyerKeypair])
      .rpc();

    console.log("Transaction signature:", tx);
    console.log("✅ Tokens purchased successfully!");

    // Check token balance
    try {
      const tokenBalance = await connection.getTokenAccountBalance(buyerTokenAccount);
      console.log("Token balance:", tokenBalance.value.uiAmount, "tokens");
    } catch (balanceError) {
      console.log("Note: Token account may need a moment to be created. Transaction was successful.");
    }

  } catch (error) {
    console.error("Error buying tokens:", error);
  }
}

buyTokens().catch(console.error);