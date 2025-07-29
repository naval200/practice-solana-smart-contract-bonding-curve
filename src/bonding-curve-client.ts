import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { Program, BN } from '@coral-xyz/anchor';
import chalk from 'chalk';
import { connection } from './utils/solana-config';
import {
  success,
  error,
  info,
  formatSol,
  formatTokenAmount,
  truncatePublicKey,
  lamportsToSol,
  solToLamports,
} from './utils/helpers';

// Define the program's account types
type BondingCurveProgram = {
  version: "0.1.0",
  name: "bonding_curve_program",
  instructions: [
    {
      name: "initializeBondingCurve",
      accounts: [
        { name: "creator", isMut: true, isSigner: true },
        { name: "tokenMint", isMut: true, isSigner: false },
        { name: "bondingCurve", isMut: true, isSigner: false },
        { name: "solVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false }
      ],
      args: [
        { name: "initialPrice", type: "u64" },
        { name: "slope", type: "u64" },
        { name: "bump", type: "u8" },
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "uri", type: "string" }
      ]
    },
    {
      name: "buyTokens",
      accounts: [
        { name: "buyer", isMut: true, isSigner: true },
        { name: "bondingCurve", isMut: true, isSigner: false },
        { name: "tokenMint", isMut: true, isSigner: false },
        { name: "buyerTokenAccount", isMut: true, isSigner: false },
        { name: "solVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "solAmount", type: "u64" }]
    },
    {
      name: "sellTokens",
      accounts: [
        { name: "seller", isMut: true, isSigner: true },
        { name: "bondingCurve", isMut: true, isSigner: false },
        { name: "tokenMint", isMut: true, isSigner: false },
        { name: "sellerTokenAccount", isMut: true, isSigner: false },
        { name: "solVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "tokenAmount", type: "u64" }]
    },
    {
      name: "getCurrentPrice",
      accounts: [
        { name: "bondingCurve", isMut: false, isSigner: false }
      ],
      args: []
    }
  ],
  accounts: [
    {
      name: "bondingCurve",
      type: {
        kind: "struct",
        fields: [
          { name: "tokenMint", type: "publicKey" },
          { name: "creator", type: "publicKey" },
          { name: "initialPrice", type: "u64" },
          { name: "slope", type: "u64" },
          { name: "currentSupply", type: "u64" },
          { name: "solReserves", type: "u64" },
          { name: "bump", type: "u8" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "uri", type: "string" },
          { name: "createdAt", type: "i64" }
        ]
      }
    }
  ]
};

// Add BondingCurve interface to match Rust struct
interface BondingCurveAccount {
  tokenMint: PublicKey;
  creator: PublicKey;
  initialPrice: BN;
  slope: BN;
  currentSupply: BN;
  solReserves: BN;
  bump: number;
  name: string;
  symbol: string;
  uri: string;
  createdAt: BN;
}

/**
 * BondingCurveClient handles interactions with tokens created through our bonding curve program
 * This demonstrates how to buy, sell, and query bonding curve tokens
 */

export interface TokenPurchaseResult {
  tokensReceived: string;     // Formatted token amount received
  solSpent: string;          // Formatted SOL amount spent
  newPrice: string;          // New token price after purchase
  signature: string;         // Transaction signature
}

export interface TokenSaleResult {
  tokensSold: string;        // Formatted token amount sold
  solReceived: string;       // Formatted SOL amount received
  newPrice: string;          // New token price after sale
  signature: string;         // Transaction signature
}

export interface TokenInfo {
  mint: string;              // Token mint address
  name: string;              // Token name
  symbol: string;            // Token symbol
  decimals: number;          // Token decimals
  supply: string;            // Current token supply (formatted)
  currentPrice: string;      // Current price in SOL per token
  marketCap: string;         // Market cap in SOL
  bondingCurve: string;      // Bonding curve account address
  solReserves: string;       // SOL reserves in the curve
  creator: string;           // Token creator address
}

export class BondingCurveClient {
  private program: Program<BondingCurveProgram> | null = null;

  constructor() {
    // Program will be initialized when needed
  }

  /**
   * Initialize the Anchor program for bonding curve interactions
   * This is similar to TokenCreator but focused on read/trade operations
   */
  private async initializeProgram(): Promise<Program<BondingCurveProgram>> {
    if (this.program) return this.program;

    try {
      const programId = new PublicKey('7312f8pgpoquo7RZnPh7hGnhyi4UAteW5Y2xwFonB6eR');
      
      // Create a minimal wallet for the program
      const wallet = new anchor.Wallet(Keypair.generate());
      
      // Create provider
      const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
      });

      // Fetch IDL from the deployed program
      const idl = await Program.fetchIdl(programId, provider);
      
      if (!idl) {
        throw new Error('Program IDL not found. Make sure the bonding curve program is deployed.');
      }

      this.program = new Program(idl as BondingCurveProgram, programId, provider);
      return this.program;
    } catch (err) {
      error(`Failed to initialize bonding curve client: ${err}`);
      throw err;
    }
  }

  /**
   * Buy tokens using SOL through the bonding curve
   * This demonstrates the core functionality of automated market making
   * 
   * @param buyer - Keypair of the token buyer
   * @param tokenMint - Public key of the token to buy
   * @param solAmount - Amount of SOL to spend
   * @returns Purchase result with transaction details
   */
  async buyTokens(
    buyer: Keypair,
    tokenMint: PublicKey,
    solAmount: number
  ): Promise<TokenPurchaseResult | null> {
    try {
      info(`🛒 Buying tokens with ${formatSol(solAmount)}...`);
      console.log(chalk.cyan(`📍 Token: ${truncatePublicKey(tokenMint)}`));
      console.log(chalk.cyan(`💰 Buyer: ${truncatePublicKey(buyer.publicKey)}`));

      // Initialize program
      await this.initializeProgram();
      if (!this.program) throw new Error('Failed to initialize program');

      // Derive bonding curve PDA
      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
        this.program.programId
      );

      // Derive SOL vault PDA
      const [solVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('sol_vault'), bondingCurvePda.toBuffer()],
        this.program.programId
      );

      // Get buyer's associated token account (will be created if needed)
      const buyerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        buyer.publicKey
      );

      console.log(chalk.gray(`📊 Bonding curve: ${truncatePublicKey(bondingCurvePda)}`));
      console.log(chalk.gray(`🪙 Token account: ${truncatePublicKey(buyerTokenAccount)}`));

      // Get current bonding curve state for price calculation
      const bondingCurveAccount = await this.program.account.bondingCurve.fetch(bondingCurvePda) as BondingCurveAccount;
      const currentSupply = bondingCurveAccount.currentSupply.toNumber();
      const currentPrice = this.calculateCurrentPrice(bondingCurveAccount);

      console.log(chalk.gray(`📈 Current price: ${formatSol(currentPrice)} per token`));
      console.log(chalk.gray(`📊 Current supply: ${formatTokenAmount(currentSupply, 9, bondingCurveAccount.symbol)}`));

      // Convert SOL amount to lamports
      const solAmountLamports = solToLamports(solAmount);

      // Create buy instruction
      const buyInstruction = await this.program.methods
        .buyTokens(new anchor.BN(solAmountLamports))
        .accounts({
          buyer: buyer.publicKey,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint,
          buyerTokenAccount: buyerTokenAccount,
          solVault: solVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();

      // Create and send transaction
      const transaction = new Transaction().add(buyInstruction);
      
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = buyer.publicKey;

      info('📝 Signing and sending buy transaction...');
      transaction.sign(buyer);

      const signature = await connection.sendRawTransaction(transaction.serialize());
      
      info('⏳ Confirming transaction...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      // Fetch updated bonding curve state
      const updatedBondingCurve = await this.program.account.bondingCurve.fetch(bondingCurvePda);
      const newSupply = updatedBondingCurve.currentSupply.toNumber();
      const newPrice = this.calculateCurrentPrice(updatedBondingCurve);
      
      // Calculate tokens received (approximate from supply change)
      const tokensReceived = newSupply - currentSupply;

      success('🎉 Token purchase successful!');

      const result: TokenPurchaseResult = {
        tokensReceived: formatTokenAmount(tokensReceived, 9, bondingCurveAccount.symbol),
        solSpent: formatSol(solAmount),
        newPrice: formatSol(newPrice),
        signature: signature,
      };

      // Display results
      this.displayPurchaseResults(result);

      return result;
    } catch (err: any) {
      error(`Token purchase failed: ${err}`);
      
      // Provide helpful tips
      if (err.toString().includes('insufficient funds')) {
        info('💡 Tip: Make sure you have enough SOL for the purchase + transaction fees');
      } else if (err.toString().includes('InsufficientSol')) {
        info('💡 Tip: The SOL amount is too small to buy any tokens at current price');
        info('💡 Try: Increase the SOL amount or check current token price');
      }
      
      return null;
    }
  }

  /**
   * Sell tokens back to the bonding curve for SOL
   * This demonstrates how the bonding curve provides liquidity in both directions
   * 
   * @param seller - Keypair of the token seller
   * @param tokenMint - Public key of the token to sell
   * @param tokenAmount - Amount of tokens to sell
   * @returns Sale result with transaction details
   */
  async sellTokens(
    seller: Keypair,
    tokenMint: PublicKey,
    tokenAmount: number
  ): Promise<TokenSaleResult | null> {
    try {
      info(`💸 Selling ${tokenAmount} tokens...`);
      console.log(chalk.cyan(`📍 Token: ${truncatePublicKey(tokenMint)}`));
      console.log(chalk.cyan(`👤 Seller: ${truncatePublicKey(seller.publicKey)}`));

      // Initialize program
      await this.initializeProgram();
      if (!this.program) throw new Error('Failed to initialize program');

      // Derive PDAs
      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
        this.program.programId
      );

      const [solVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('sol_vault'), bondingCurvePda.toBuffer()],
        this.program.programId
      );

      // Get seller's associated token account
      const sellerTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        seller.publicKey
      );

      // Get current state
      const bondingCurveAccount = await this.program.account.bondingCurve.fetch(bondingCurvePda) as BondingCurveAccount;
      const currentSupply = bondingCurveAccount.currentSupply.toNumber();
      const currentPrice = this.calculateCurrentPrice(bondingCurveAccount);

      console.log(chalk.gray(`📈 Current price: ${formatSol(currentPrice)} per token`));
      console.log(chalk.gray(`💰 SOL reserves: ${formatSol(lamportsToSol(bondingCurveAccount.solReserves.toNumber()))}`));

      // Convert token amount to proper decimals (multiply by 10^9 for 9 decimals)
      const tokenAmountWithDecimals = tokenAmount * Math.pow(10, 9);

      // Create sell instruction
      const sellInstruction = await this.program.methods
        .sellTokens(new anchor.BN(tokenAmountWithDecimals))
        .accounts({
          seller: seller.publicKey,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint,
          sellerTokenAccount: sellerTokenAccount,
          solVault: solVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();

      // Create and send transaction
      const transaction = new Transaction().add(sellInstruction);
      
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = seller.publicKey;

      info('📝 Signing and sending sell transaction...');
      transaction.sign(seller);

      const signature = await connection.sendRawTransaction(transaction.serialize());
      
      info('⏳ Confirming transaction...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      // Fetch updated state
      const updatedBondingCurve = await this.program.account.bondingCurve.fetch(bondingCurvePda);
      const newPrice = this.calculateCurrentPrice(updatedBondingCurve);
      
      // Estimate SOL received (this is approximate)
      const solReceived = tokenAmount * currentPrice;

      success('💰 Token sale successful!');

      const result: TokenSaleResult = {
        tokensSold: formatTokenAmount(tokenAmountWithDecimals, 9, bondingCurveAccount.symbol),
        solReceived: formatSol(solReceived),
        newPrice: formatSol(newPrice),
        signature: signature,
      };

      // Display results
      this.displaySaleResults(result);

      return result;
    } catch (err: any) {
      error(`Token sale failed: ${err}`);
      
      // Provide helpful tips
      if (err.toString().includes('InsufficientSupply')) {
        info('💡 Tip: You are trying to sell more tokens than you own');
      } else if (err.toString().includes('InsufficientReserves')) {
        info('💡 Tip: The bonding curve does not have enough SOL reserves for this sale');
      }
      
      return null;
    }
  }

  /**
   * Get comprehensive information about a bonding curve token
   * This is useful for displaying token details and market data
   * 
   * @param tokenMint - Public key of the token to query
   * @returns Token information or null if not found
   */
  async getTokenInfo(tokenMint: PublicKey): Promise<TokenInfo | null> {
    try {
      info(`📊 Fetching token information...`);

      // Initialize program
      await this.initializeProgram();
      if (!this.program) throw new Error('Failed to initialize program');

      // Derive bonding curve PDA
      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
        this.program.programId
      );

      // Fetch bonding curve account
      const bondingCurveAccount = await this.program.account.bondingCurve.fetch(bondingCurvePda) as BondingCurveAccount;

      // Get token mint info for decimals
      const mintInfo = await connection.getParsedAccountInfo(tokenMint);
      let decimals = 9; // Default
      
      if (mintInfo.value && 'parsed' in mintInfo.value.data) {
        decimals = mintInfo.value.data.parsed.info.decimals;
      }

      // Calculate derived values
      const currentPrice = this.calculateCurrentPrice(bondingCurveAccount);
      const supply = bondingCurveAccount.currentSupply.toNumber();
      const solReserves = lamportsToSol(bondingCurveAccount.solReserves.toNumber());
      const marketCap = (supply / Math.pow(10, decimals)) * currentPrice;

      const tokenInfo: TokenInfo = {
        mint: tokenMint.toString(),
        name: bondingCurveAccount.name,
        symbol: bondingCurveAccount.symbol,
        decimals: decimals,
        supply: formatTokenAmount(supply, decimals, bondingCurveAccount.symbol),
        currentPrice: formatSol(currentPrice),
        marketCap: formatSol(marketCap),
        bondingCurve: bondingCurvePda.toString(),
        solReserves: formatSol(solReserves),
        creator: bondingCurveAccount.creator.toString(),
      };

      return tokenInfo;
    } catch (err: any) {
      error(`Failed to fetch token info: ${err}`);
      
      if (err.toString().includes('Account does not exist')) {
        info('💡 Tip: This token was not created through our bonding curve program');
      }
      
      return null;
    }
  }

  /**
   * Calculate current token price based on bonding curve parameters
   * Uses the linear formula: price = initial_price + (supply * slope)
   */
  private calculateCurrentPrice(bondingCurveAccount: BondingCurveAccount): number {
    const initialPrice = bondingCurveAccount.initialPrice.toNumber();
    const slope = bondingCurveAccount.slope.toNumber();
    const supply = bondingCurveAccount.currentSupply.toNumber();

    // Convert from lamports to SOL
    const currentPriceLamports = initialPrice + (supply * slope);
    return lamportsToSol(currentPriceLamports);
  }

  /**
   * Display formatted purchase results
   */
  private displayPurchaseResults(result: TokenPurchaseResult): void {
    console.log('\n' + chalk.green('🎉 PURCHASE SUCCESSFUL!'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.cyan(`🪙 Tokens Received: ${result.tokensReceived}`));
    console.log(chalk.cyan(`💰 SOL Spent: ${result.solSpent}`));
    console.log(chalk.cyan(`📈 New Price: ${result.newPrice} per token`));
    console.log(chalk.gray(`🔗 Transaction: ${result.signature}`));
    console.log(chalk.gray(`📊 Explorer: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`));
  }

  /**
   * Display formatted sale results
   */
  private displaySaleResults(result: TokenSaleResult): void {
    console.log('\n' + chalk.green('💰 SALE SUCCESSFUL!'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.cyan(`🪙 Tokens Sold: ${result.tokensSold}`));
    console.log(chalk.cyan(`💰 SOL Received: ${result.solReceived}`));
    console.log(chalk.cyan(`📉 New Price: ${result.newPrice} per token`));
    console.log(chalk.gray(`🔗 Transaction: ${result.signature}`));
    console.log(chalk.gray(`📊 Explorer: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`));
  }

  /**
   * Estimate how many tokens can be bought with a given SOL amount
   * This is useful for showing users expected outcomes before transactions
   */
  async estimateTokensForSol(tokenMint: PublicKey, solAmount: number): Promise<number> {
    try {
      await this.initializeProgram();
      if (!this.program) return 0;

      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
        this.program.programId
      );

      const bondingCurveAccount = await this.program.account.bondingCurve.fetch(bondingCurvePda);
      const currentPrice = this.calculateCurrentPrice(bondingCurveAccount);
      
      // Simple approximation: SOL amount / current price
      // In reality, the price increases as tokens are minted
      return solAmount / currentPrice;
    } catch (err) {
      error(`Failed to estimate tokens: ${err}`);
      return 0;
    }
  }

  /**
   * Estimate how much SOL would be received for selling tokens
   * This helps users understand the value of their holdings
   */
  async estimateSolForTokens(tokenMint: PublicKey, tokenAmount: number): Promise<number> {
    try {
      await this.initializeProgram();
      if (!this.program) return 0;

      const [bondingCurvePda] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), tokenMint.toBuffer()],
        this.program.programId
      );

      const bondingCurveAccount = await this.program.account.bondingCurve.fetch(bondingCurvePda);
      const currentPrice = this.calculateCurrentPrice(bondingCurveAccount);
      
      // Simple approximation: token amount * current price
      // In reality, the price decreases as tokens are burned
      return tokenAmount * currentPrice;
    } catch (err) {
      error(`Failed to estimate SOL: ${err}`);
      return 0;
    }
  }
}