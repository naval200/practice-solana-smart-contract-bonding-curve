import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import fs from "fs";
import path from "path";

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let walletPath = "";
  let tokenMint = "";
  let tokenAmount = "1";

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
        tokenAmount = args[i + 1];
        i++;
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: npm run sell-tokens -- [options]

Options:
  -w, --wallet <path>     Path to wallet JSON file (required)
  -t, --token <pubkey>    Token mint public key (required)
  -a, --amount <tokens>   Amount of tokens to sell (default: 1)
  -h, --help              Show help

Example:
  npm run sell-tokens -- --wallet ./wallets/user_1.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 5
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

  return { walletPath, tokenMint, tokenAmount: parseFloat(tokenAmount) };
}

// Parse arguments
const { walletPath, tokenMint, tokenAmount } = parseArgs();

// Load seller wallet
let sellerKeypair: Keypair;
try {
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  sellerKeypair = Keypair.fromSecretKey(new Uint8Array(walletData));
} catch (error) {
  console.error(`Error loading wallet from ${walletPath}:`, error);
  process.exit(1);
}

const tokenMintPubkey = new PublicKey(tokenMint);

async function sellTokens() {
  // Set up the provider
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = new anchor.Wallet(sellerKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  // Load the program
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../bonding-curve-program/target/idl/bonding_curve_program.json"), "utf-8"));
  const program = new Program(idl, provider);

  console.log("Program ID:", program.programId.toString());
  console.log("Seller:", sellerKeypair.publicKey.toString());
  console.log("Token Mint:", tokenMintPubkey.toString());
  console.log("Token Amount:", tokenAmount, "tokens");

  // Derive PDA accounts
  const [bondingCurvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), tokenMintPubkey.toBuffer()],
    program.programId
  );

  const [solVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), tokenMintPubkey.toBuffer()],
    program.programId
  );

  // Get seller's associated token account
  const sellerTokenAccount = await getAssociatedTokenAddress(
    tokenMintPubkey,
    sellerKeypair.publicKey
  );

  console.log("Bonding Curve PDA:", bondingCurvePda.toString());
  console.log("SOL Vault PDA:", solVaultPda.toString());
  console.log("Seller Token Account:", sellerTokenAccount.toString());

  // Check token balance before selling
  try {
    const tokenBalance = await connection.getTokenAccountBalance(sellerTokenAccount);
    const currentBalance = tokenBalance.value.uiAmount || 0;
    console.log("Current token balance:", currentBalance, "tokens");

    if (currentBalance < tokenAmount) {
      console.error(`Error: Insufficient token balance. You have ${currentBalance} tokens but trying to sell ${tokenAmount} tokens.`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Error: Token account not found or has no balance.");
    process.exit(1);
  }

  // Check SOL balance before transaction
  const initialSolBalance = await connection.getBalance(sellerKeypair.publicKey);
  console.log("Initial SOL balance:", initialSolBalance / 1_000_000_000, "SOL");

  // Convert token amount to program units (assuming 0 decimals)
  const tokenAmountBN = new anchor.BN(Math.floor(tokenAmount));

  console.log("\nSelling tokens...");

  try {
    const tx = await program.methods
      .sellTokens(tokenAmountBN)
      .accounts({
        seller: sellerKeypair.publicKey,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMintPubkey,
        sellerTokenAccount: sellerTokenAccount,
        solVault: solVaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([sellerKeypair])
      .rpc();

    console.log("Transaction signature:", tx);
    console.log("✅ Tokens sold successfully!");

    // Check balances after transaction
    try {
      const newTokenBalance = await connection.getTokenAccountBalance(sellerTokenAccount);
      console.log("New token balance:", newTokenBalance.value.uiAmount, "tokens");
    } catch (balanceError) {
      console.log("Note: Token account may have been closed if balance is zero.");
    }

    const finalSolBalance = await connection.getBalance(sellerKeypair.publicKey);
    const solReceived = (finalSolBalance - initialSolBalance) / 1_000_000_000;
    console.log("Final SOL balance:", finalSolBalance / 1_000_000_000, "SOL");
    console.log("SOL received (minus fees):", solReceived.toFixed(6), "SOL");

  } catch (error: any) {
    console.error("Error selling tokens:", error);
    
    // Provide helpful error messages
    if (error.message?.includes("InsufficientReserves")) {
      console.error("The bonding curve doesn't have enough SOL reserves to complete this sale.");
    } else if (error.message?.includes("InsufficientSupply")) {
      console.error("Trying to sell more tokens than available in the supply.");
    } else if (error.message?.includes("AccountNotFound")) {
      console.error("Token account not found. Make sure you have tokens to sell.");
    }
  }
}

sellTokens().catch(console.error);