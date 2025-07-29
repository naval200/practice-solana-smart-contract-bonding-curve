import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import chalk from 'chalk';
import { connection } from './utils/solana-config';
import { success, error, info, formatSol, truncatePublicKey } from './utils/helpers';

/**
 * TokenCreator class handles the creation of SPL tokens with bonding curves
 * This demonstrates how to interact with our custom Anchor program
 */

export interface TokenCreationParams {
  creator: Keypair;           // The keypair creating the token
  name: string;               // Token name (max 32 chars)
  symbol: string;             // Token symbol (max 10 chars)
  uri?: string;               // Metadata URI (optional for educational)
  decimals: number;           // Token decimals (usually 9)
  initialPrice: number;       // Starting price in SOL per token
  curveSlope: number;         // Bonding curve slope parameter
}

export interface TokenCreationResult {
  tokenMint: string;          // Address of the created token mint
  bondingCurve: string;       // Address of the bonding curve account
  solVault: string;           // Address of SOL reserves vault
  signature: string;          // Creation transaction signature
}

export class TokenCreator {
  private program: Program | null = null;

  constructor() {
    // We'll initialize the program when needed to avoid dependency issues
  }

  /**
   * Initialize the Anchor program for interacting with our bonding curve contract
   * This loads the IDL and creates a program instance
   */
  private async initializeProgram(): Promise<Program> {
    if (this.program) return this.program;

    try {
      // In a real application, you'd load the IDL from a file or network
      // For this educational example, we'll create a minimal IDL structure
      
      const programId = new PublicKey('7312f8pgpoquo7RZnPh7hGnhyi4UAteW5Y2xwFonB6eR');
      
      // Create a minimal wallet for the program
      const wallet = new anchor.Wallet(Keypair.generate());
      
      // Create provider (connection + wallet)
      const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
      });

      // For educational purposes, we'll create the program reference manually
      // In production, you'd use: anchor.workspace.BondingCurveProgram
      const idl = await Program.fetchIdl(programId, provider);
      
      if (!idl) {
        throw new Error('Program IDL not found. Make sure the program is deployed.');
      }

      this.program = new Program(idl, programId, provider);
      return this.program;
    } catch (err) {
      error(`Failed to initialize program: ${err}`);
      throw err;
    }
  }

  /**
   * Creates a new SPL token with a bonding curve mechanism
   * This function orchestrates the entire token creation process
   * 
   * @param params - Token creation parameters
   * @returns Token creation result with addresses and transaction signature
   */
  async createToken(params: TokenCreationParams): Promise<TokenCreationResult | null> {
    try {
      info('🚀 Starting token creation process...');
      
      // Validate parameters
      this.validateTokenParams(params);

      // Initialize the Anchor program
      await this.initializeProgram();
      if (!this.program) throw new Error('Failed to initialize program');

      // Generate keypairs for new accounts
      const tokenMint = Keypair.generate();
      
      info(`📍 Token mint will be: ${truncatePublicKey(tokenMint.publicKey)}`);

      // Derive PDA (Program Derived Address) for bonding curve
      const [bondingCurvePda, bondingCurveBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), tokenMint.publicKey.toBuffer()],
        this.program.programId
      );

      // Derive PDA for SOL vault
      const [solVaultPda, solVaultBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('sol_vault'), bondingCurvePda.toBuffer()],
        this.program.programId
      );

      info(`📊 Bonding curve: ${truncatePublicKey(bondingCurvePda)}`);
      info(`💰 SOL vault: ${truncatePublicKey(solVaultPda)}`);

      // Convert prices from SOL to lamports
      // For a token with 9 decimals, we need to account for both SOL and token decimals
      const initialPriceLamports = Math.floor(params.initialPrice * 1e9); // SOL to lamports
      const slopeLamports = Math.floor(params.curveSlope * 1e9);

      console.log(chalk.gray(`💡 Initial price: ${formatSol(params.initialPrice)} per token`));
      console.log(chalk.gray(`📈 Curve slope: ${params.curveSlope} SOL per token squared`));

      // Create the transaction to initialize the bonding curve
      const initializeInstruction = await this.program.methods
        .initializeBondingCurve(
          new anchor.BN(initialPriceLamports),
          new anchor.BN(slopeLamports),
          bondingCurveBump,
          params.name,
          params.symbol,
          params.uri || ''
        )
        .accounts({
          creator: params.creator.publicKey,
          tokenMint: tokenMint.publicKey,
          bondingCurve: bondingCurvePda,
          solVault: solVaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      // Create and send transaction
      const transaction = new Transaction().add(initializeInstruction);
      
      // Get recent blockhash for transaction validity
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = params.creator.publicKey;

      info('📝 Signing and sending transaction...');

      // Sign transaction with both creator and token mint keypairs
      transaction.sign(params.creator, tokenMint);

      // Send transaction to the network
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      info('⏳ Confirming transaction...');

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      success('🎉 Token created successfully!');
      
      // Return the results
      const result: TokenCreationResult = {
        tokenMint: tokenMint.publicKey.toString(),
        bondingCurve: bondingCurvePda.toString(),
        solVault: solVaultPda.toString(),
        signature: signature,
      };

      // Display comprehensive results
      this.displayCreationResults(result, params);

      return result;
    } catch (err: unknown) {
      error(`Token creation failed: ${err}`);
      
      // Provide helpful debugging information
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      if (errorMessage.includes('insufficient funds')) {
        info('💡 Tip: Make sure your creator wallet has enough SOL for transaction fees');
        info('💡 Try: npm run wallet:deposit -- --wallet <your-wallet>');
      } else if (errorMessage.includes('program')) {
        info('💡 Tip: Make sure the bonding curve program is deployed');
        info('💡 Try: npm run deploy');
      }
      
      return null;
    }
  }

  /**
   * Validates token creation parameters to prevent common mistakes
   * This helps catch issues early before sending transactions
   */
  private validateTokenParams(params: TokenCreationParams): void {
    // Validate name length (Solana/Metaplex standards)
    if (!params.name || params.name.length === 0) {
      throw new Error('Token name cannot be empty');
    }
    if (params.name.length > 32) {
      throw new Error('Token name too long (max 32 characters)');
    }

    // Validate symbol length
    if (!params.symbol || params.symbol.length === 0) {
      throw new Error('Token symbol cannot be empty');
    }
    if (params.symbol.length > 10) {
      throw new Error('Token symbol too long (max 10 characters)');
    }

    // Validate decimals (standard range for SPL tokens)
    if (params.decimals < 0 || params.decimals > 18) {
      throw new Error('Token decimals must be between 0 and 18');
    }

    // Validate pricing parameters
    if (params.initialPrice <= 0) {
      throw new Error('Initial price must be greater than 0');
    }
    if (params.initialPrice > 1000) {
      throw new Error('Initial price seems too high (>1000 SOL per token)');
    }

    if (params.curveSlope <= 0) {
      throw new Error('Curve slope must be greater than 0');
    }
    if (params.curveSlope > 1) {
      throw new Error('Curve slope seems too high (>1 SOL per token)');
    }

    // Validate URI if provided
    if (params.uri && params.uri.length > 200) {
      throw new Error('Metadata URI too long (max 200 characters)');
    }

    info('✅ Token parameters validated successfully');
  }

  /**
   * Displays comprehensive results after successful token creation
   * This provides users with all the information they need for next steps
   */
  private displayCreationResults(result: TokenCreationResult, params: TokenCreationParams): void {
    console.log('\n' + chalk.green('🎉 TOKEN CREATION SUCCESSFUL!'));
    console.log(chalk.gray('═'.repeat(60)));
    
    // Token information
    console.log(chalk.cyan('\n📋 Token Information:'));
    console.log(chalk.white(`   Name: ${params.name}`));
    console.log(chalk.white(`   Symbol: ${params.symbol}`));
    console.log(chalk.white(`   Decimals: ${params.decimals}`));
    console.log(chalk.white(`   Initial Price: ${formatSol(params.initialPrice)} per token`));
    
    // Important addresses
    console.log(chalk.cyan('\n📍 Important Addresses:'));
    console.log(chalk.white(`   Token Mint: ${result.tokenMint}`));
    console.log(chalk.white(`   Bonding Curve: ${result.bondingCurve}`));
    console.log(chalk.white(`   SOL Vault: ${result.solVault}`));
    
    // Transaction details
    console.log(chalk.cyan('\n🔗 Transaction Details:'));
    console.log(chalk.white(`   Signature: ${result.signature}`));
    console.log(chalk.gray(`   Explorer: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`));
    
    // Next steps
    console.log(chalk.yellow('\n📋 Next Steps:'));
    console.log(chalk.white('   1. Buy tokens:'));
    console.log(chalk.gray(`      node dist/cli.js token buy --wallet <wallet> --token ${result.tokenMint} --sol-amount 0.1`));
    console.log(chalk.white('   2. Check token info:'));
    console.log(chalk.gray(`      node dist/cli.js token info --token ${result.tokenMint}`));
    console.log(chalk.white('   3. View on Solana Explorer:'));
    console.log(chalk.gray(`      https://explorer.solana.com/address/${result.tokenMint}?cluster=devnet`));
    
    // Educational notes
    console.log(chalk.yellow('\n💡 Educational Notes:'));
    console.log(chalk.white('   • The bonding curve will increase token price as supply grows'));
    console.log(chalk.white('   • Users can buy/sell tokens directly through the curve'));
    console.log(chalk.white('   • SOL reserves ensure liquidity for selling tokens back'));
    console.log(chalk.white('   • This is for educational purposes - not for production use!'));
  }

  /**
   * Utility method to estimate transaction costs
   * Helps users understand the SOL needed for token creation
   */
  async estimateCreationCost(): Promise<number> {
    try {
      // Typical costs for token creation on Solana (in SOL):
      // - Token mint account: ~0.00203928 SOL
      // - Bonding curve account: ~0.00284544 SOL (400 bytes)
      // - Transaction fees: ~0.000005 SOL
      // - Associated token accounts: ~0.00203928 SOL (per user)
      
      const tokenMintRent = 0.00203928;
      const bondingCurveRent = 0.00284544;
      const transactionFees = 0.000005;
      
      const totalCost = tokenMintRent + bondingCurveRent + transactionFees;
      
      return totalCost;
    } catch (err) {
      error(`Failed to estimate costs: ${err}`);
      return 0.005; // Conservative estimate
    }
  }

  /**
   * Helper method to generate a random token for educational demos
   * This creates example tokens with realistic but safe parameters
   */
  generateExampleTokenParams(creator: Keypair): TokenCreationParams {
    const examples = [
      { name: 'DevCoin', symbol: 'DEV', initialPrice: 0.0001, curveSlope: 0.0000001 },
      { name: 'TestToken', symbol: 'TEST', initialPrice: 0.0005, curveSlope: 0.0000005 },
      { name: 'EduCoin', symbol: 'EDU', initialPrice: 0.0002, curveSlope: 0.0000002 },
      { name: 'LearnToken', symbol: 'LEARN', initialPrice: 0.0003, curveSlope: 0.0000003 },
    ];

    const example = examples[Math.floor(Math.random() * examples.length)];
    
    return {
      creator,
      name: example.name,
      symbol: example.symbol,
      uri: 'https://example.com/token-metadata.json',
      decimals: 9,
      initialPrice: example.initialPrice,
      curveSlope: example.curveSlope,
    };
  }
}