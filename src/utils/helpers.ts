import { PublicKey, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

/**
 * Utility functions for the educational SPL token project
 * These helpers provide common functionality used throughout the application
 */

/**
 * Converts SOL amount to lamports (smallest unit in Solana)
 * 1 SOL = 1,000,000,000 lamports
 * @param sol - Amount in SOL
 * @returns Amount in lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

/**
 * Converts lamports to SOL for display purposes
 * @param lamports - Amount in lamports
 * @returns Amount in SOL with up to 9 decimal places
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Validates that a string is a valid Solana public key
 * @param address - The address string to validate
 * @returns True if valid, false otherwise
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely creates a PublicKey from a string with error handling
 * @param address - The address string
 * @returns PublicKey object or null if invalid
 */
export function createPublicKey(address: string): PublicKey | null {
  try {
    return new PublicKey(address);
  } catch (error) {
    console.error(chalk.red(`❌ Invalid public key: ${address}`));
    return null;
  }
}

/**
 * Formats SOL amounts for display with appropriate decimal places
 * @param sol - Amount in SOL
 * @returns Formatted string with SOL suffix
 */
export function formatSol(sol: number): string {
  // Show more decimal places for small amounts
  const decimals = sol < 0.001 ? 9 : sol < 1 ? 6 : 3;
  return `${sol.toFixed(decimals)} SOL`;
}

/**
 * Formats token amounts for display
 * @param amount - Token amount
 * @param decimals - Token decimal places
 * @param symbol - Token symbol
 * @returns Formatted string
 */
export function formatTokenAmount(amount: number, decimals: number, symbol: string): string {
  const adjustedAmount = amount / Math.pow(10, decimals);
  return `${adjustedAmount.toLocaleString()} ${symbol}`;
}

/**
 * Creates a directory if it doesn't exist
 * Used for wallet storage and other file operations
 * @param dirPath - Path to directory
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(chalk.blue(`📁 Created directory: ${dirPath}`));
  }
}

/**
 * Safely reads a JSON file with error handling
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON object or null if error
 */
export function readJsonFile(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`❌ File not found: ${filePath}`));
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(chalk.red(`❌ Error reading file ${filePath}:`), error);
    return null;
  }
}

/**
 * Safely writes a JSON file with error handling
 * @param filePath - Path to write the file
 * @param data - Data to write
 * @returns True if successful, false otherwise
 */
export function writeJsonFile(filePath: string, data: any): boolean {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    ensureDirectoryExists(dir);
    
    // Write file with proper formatting
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error writing file ${filePath}:`), error);
    return false;
  }
}

/**
 * Gets the current SOL balance for a public key
 * @param connection - Solana connection
 * @param publicKey - Public key to check
 * @returns Balance in SOL
 */
export async function getBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  try {
    const balance = await connection.getBalance(publicKey);
    return lamportsToSol(balance);
  } catch (error) {
    console.error(chalk.red('❌ Error fetching balance:'), error);
    return 0;
  }
}

/**
 * Waits for a specified number of milliseconds
 * Useful for rate limiting and giving time for blockchain operations
 * @param ms - Milliseconds to wait
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncates a public key for display purposes
 * Shows first 4 and last 4 characters with ellipsis
 * @param publicKey - PublicKey or string to truncate
 * @returns Truncated string
 */
export function truncatePublicKey(publicKey: PublicKey | string): string {
  const keyString = publicKey.toString();
  if (keyString.length <= 12) return keyString;
  return `${keyString.slice(0, 4)}...${keyString.slice(-4)}`;
}

/**
 * Validates required environment variables and configuration
 * @returns Object containing validation results
 */
export function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if we're accidentally pointing to mainnet
  const network = process.env.SOLANA_NETWORK || 'devnet';
  if (network.includes('mainnet')) {
    errors.push('🚨 SAFETY: Never use mainnet for educational projects!');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Success message formatter with emoji and colors
 */
export const success = (message: string) => console.log(chalk.green(`✅ ${message}`));

/**
 * Error message formatter with emoji and colors
 */
export const error = (message: string) => console.log(chalk.red(`❌ ${message}`));

/**
 * Info message formatter with emoji and colors
 */
export const info = (message: string) => console.log(chalk.blue(`ℹ️  ${message}`));

/**
 * Warning message formatter with emoji and colors
 */
export const warning = (message: string) => console.log(chalk.yellow(`⚠️  ${message}`));