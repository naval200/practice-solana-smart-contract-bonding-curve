import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { connection } from './utils/solana-config';
import {
  solToLamports,
  formatSol,
  ensureDirectoryExists,
  readJsonFile,
  writeJsonFile,
  getBalance,
  success,
  error,
  info,
  warning,
  sleep,
  truncatePublicKey
} from './utils/helpers';

/**
 * WalletManager class handles all wallet-related operations
 * This includes creating wallets, funding them, and transferring SOL
 */
export class WalletManager {
  private walletsDir: string;

  constructor(walletsDir: string = './wallets') {
    this.walletsDir = path.resolve(walletsDir);
    ensureDirectoryExists(this.walletsDir);
  }

  /**
   * Creates a new Solana keypair and saves it to a JSON file
   * The keypair contains both public and private keys needed for transactions
   * 
   * @param walletName - Name for the wallet file (without .json extension)
   * @returns Object containing the keypair and file path
   */
  async createWallet(walletName: string): Promise<{ keypair: Keypair; filePath: string }> {
    try {
      info(`Creating new wallet: ${walletName}`);

      // Generate a new random keypair using Solana's cryptographic functions
      const keypair = Keypair.generate();
      
      // Create the wallet file path
      const fileName = `${walletName}.json`;
      const filePath = path.join(this.walletsDir, fileName);

      // Check if wallet already exists to prevent accidental overwrites
      if (fs.existsSync(filePath)) {
        warning(`Wallet ${walletName} already exists at ${filePath}`);
        const existingKeypair = this.loadWallet(filePath);
        if (existingKeypair) {
          return { keypair: existingKeypair, filePath };
        }
      }

      // Save the keypair as a JSON array of bytes (Solana CLI format)
      // This format is compatible with Solana CLI tools
      const keypairData = Array.from(keypair.secretKey);
      
      if (!writeJsonFile(filePath, keypairData)) {
        throw new Error('Failed to save wallet file');
      }

      success(`Wallet created successfully!`);
      console.log(chalk.cyan(`📍 Public Key: ${keypair.publicKey.toString()}`));
      console.log(chalk.cyan(`💾 Saved to: ${filePath}`));
      console.log('');
      console.log(chalk.yellow('🔐 IMPORTANT SECURITY NOTES:'));
      console.log(chalk.yellow('• Keep your private key file secure and never share it'));
      console.log(chalk.yellow('• This file gives complete control over the wallet'));
      console.log(chalk.yellow('• Consider backing up this file in a secure location'));
      console.log(chalk.yellow('• This is for educational purposes - use proper key management in production'));

      return { keypair, filePath };
    } catch (err) {
      error(`Failed to create wallet: ${err}`);
      throw err;
    }
  }

  /**
   * Loads an existing wallet from a JSON file
   * 
   * @param walletPath - Path to the wallet JSON file
   * @returns Loaded Keypair or null if failed
   */
  loadWallet(walletPath: string): Keypair | null {
    try {
      const keypairData = readJsonFile(walletPath);
      if (!keypairData || !Array.isArray(keypairData)) {
        error('Invalid wallet file format');
        return null;
      }

      // Convert the array of bytes back to a Uint8Array and create Keypair
      const secretKey = new Uint8Array(keypairData);
      const keypair = Keypair.fromSecretKey(secretKey);

      info(`Loaded wallet: ${truncatePublicKey(keypair.publicKey)}`);
      return keypair;
    } catch (err) {
      error(`Failed to load wallet from ${walletPath}: ${err}`);
      return null;
    }
  }

  /**
   * Requests SOL from the Solana devnet faucet
   * The faucet provides free SOL for testing and development
   * 
   * @param publicKey - Public key to fund
   * @param amount - Amount of SOL to request (default: 2 SOL)
   * @returns Success status
   */
  async requestAirdrop(publicKey: PublicKey, amount: number = 2): Promise<boolean> {
    try {
      info(`Requesting ${formatSol(amount)} from devnet faucet...`);
      console.log(chalk.cyan(`📍 Wallet: ${truncatePublicKey(publicKey)}`));

      // Check current balance before airdrop
      const balanceBefore = await getBalance(connection, publicKey);
      console.log(chalk.gray(`💰 Current balance: ${formatSol(balanceBefore)}`));

      // Request airdrop from Solana's devnet faucet
      // The faucet has rate limits to prevent abuse
      const amountLamports = solToLamports(amount);
      const signature = await connection.requestAirdrop(publicKey, amountLamports);

      info('Confirming airdrop transaction...');
      
      // Wait for transaction confirmation with timeout
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Airdrop failed: ${confirmation.value.err}`);
      }

      // Verify the balance increased
      const balanceAfter = await getBalance(connection, publicKey);
      const received = balanceAfter - balanceBefore;

      success(`Airdrop successful! Received ${formatSol(received)}`);
      console.log(chalk.cyan(`💰 New balance: ${formatSol(balanceAfter)}`));
      console.log(chalk.gray(`🔗 Transaction: ${signature}`));

      return true;
    } catch (err: unknown) {
      // Handle common faucet errors with helpful messages
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      if (errorMessage.includes('rate limit')) {
        error('Faucet rate limit reached. Please wait a few minutes and try again.');
        info('💡 Alternative: Use QuickNode faucet at https://faucet.quicknode.com/solana/testnet');
      } else if (errorMessage.includes('insufficient funds')) {
        error('Faucet is temporarily out of funds. Please try again later.');
      } else {
        error(`Airdrop failed: ${err}`);
      }

      return false;
    }
  }

  /**
   * Transfers SOL from one wallet to another
   * This demonstrates basic Solana transaction creation and signing
   * 
   * @param fromKeypair - Sender's keypair
   * @param toPublicKey - Recipient's public key
   * @param amount - Amount of SOL to send
   * @param allowUnfundedRecipient - Whether to allow sending to new accounts
   * @returns Transaction signature or null if failed
   */
  async transferSol(
    fromKeypair: Keypair,
    toPublicKey: PublicKey,
    amount: number,
    allowUnfundedRecipient: boolean = false
  ): Promise<string | null> {
    try {
      info(`Transferring ${formatSol(amount)} SOL...`);
      console.log(chalk.cyan(`📤 From: ${truncatePublicKey(fromKeypair.publicKey)}`));
      console.log(chalk.cyan(`📥 To: ${truncatePublicKey(toPublicKey)}`));

      // Check sender balance
      const senderBalance = await getBalance(connection, fromKeypair.publicKey);
      console.log(chalk.gray(`💰 Sender balance: ${formatSol(senderBalance)}`));

      // Validate sender has sufficient funds (including transaction fees)
      const amountLamports = solToLamports(amount);
      const estimatedFee = 5000; // Approximate fee in lamports for a simple transfer
      
      if (senderBalance < amount + (estimatedFee / LAMPORTS_PER_SOL)) {
        throw new Error(`Insufficient funds. Need ${formatSol(amount)} + fees, have ${formatSol(senderBalance)}`);
      }

      // Check if recipient account exists (for educational purposes)
      const recipientBalance = await getBalance(connection, toPublicKey);
      const isNewAccount = recipientBalance === 0;
      
      if (isNewAccount && !allowUnfundedRecipient) {
        warning('Recipient appears to be a new account (0 SOL balance)');
        console.log('Use --allow-unfunded-recipient flag if this is intentional');
        return null;
      }

      if (isNewAccount) {
        info('Creating new account for recipient...');
      }

      // Create a transfer instruction using Solana's System Program
      // The System Program handles basic operations like transfers and account creation
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: amountLamports,
      });

      // Create and configure the transaction
      const transaction = new Transaction().add(transferInstruction);
      
      // Get recent blockhash for transaction validity
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;

      info('Sending transaction...');
      
      // Sign and send the transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair], // Array of signers
        {
          commitment: 'confirmed',
          maxRetries: 3,
        }
      );

      // Verify the transfer completed successfully
      const newSenderBalance = await getBalance(connection, fromKeypair.publicKey);
      const newRecipientBalance = await getBalance(connection, toPublicKey);

      success('Transfer completed successfully!');
      console.log(chalk.cyan(`📤 Sender new balance: ${formatSol(newSenderBalance)}`));
      console.log(chalk.cyan(`📥 Recipient balance: ${formatSol(newRecipientBalance)}`));
      console.log(chalk.gray(`🔗 Transaction: ${signature}`));

      return signature;
    } catch (err) {
      error(`Transfer failed: ${err}`);
      return null;
    }
  }

  /**
   * Lists all wallets in the wallets directory
   * Useful for seeing what wallets are available
   * 
   * @returns Array of wallet information
   */
  async listWallets(): Promise<Array<{ name: string; path: string; publicKey: string; balance: number }>> {
    try {
      const walletFiles = fs.readdirSync(this.walletsDir)
        .filter(file => file.endsWith('.json'));

      const wallets = [];

      for (const file of walletFiles) {
        const filePath = path.join(this.walletsDir, file);
        const keypair = this.loadWallet(filePath);
        
        if (keypair) {
          const balance = await getBalance(connection, keypair.publicKey);
          wallets.push({
            name: file.replace('.json', ''),
            path: filePath,
            publicKey: keypair.publicKey.toString(),
            balance
          });
        }
      }

      return wallets;
    } catch (err) {
      error(`Failed to list wallets: ${err}`);
      return [];
    }
  }

  /**
   * Displays wallet information in a formatted table
   */
  async displayWallets(): Promise<void> {
    const wallets = await this.listWallets();
    
    if (wallets.length === 0) {
      info('No wallets found in the wallets directory');
      return;
    }

    console.log(chalk.cyan('\n📁 Available Wallets:'));
    console.log(chalk.gray('─'.repeat(80)));
    
    for (const wallet of wallets) {
      console.log(chalk.white(`📄 ${wallet.name}`));
      console.log(chalk.gray(`   Public Key: ${truncatePublicKey(wallet.publicKey)}`));
      console.log(chalk.gray(`   Balance: ${formatSol(wallet.balance)}`));
      console.log(chalk.gray(`   Path: ${wallet.path}`));
      console.log('');
    }
  }
}