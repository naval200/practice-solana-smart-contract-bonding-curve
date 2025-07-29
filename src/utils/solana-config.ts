import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js';

/**
 * Solana network configuration and connection management
 * This file centralizes network settings for easy switching between environments
 */

// Network endpoints - using devnet for educational purposes
export const NETWORKS = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  mainnet: 'https://api.mainnet-beta.solana.com',
  // QuickNode provides reliable RPC endpoints (replace with your endpoint if you have one)
  quicknode_devnet: 'https://api.devnet.solana.com' // Replace with your QuickNode endpoint
} as const;

// Default network for educational purposes - NEVER use mainnet for learning!
export const DEFAULT_NETWORK = NETWORKS.devnet;

// Commitment level for transaction confirmation
// 'confirmed' provides a good balance between speed and finality for educational purposes
export const DEFAULT_COMMITMENT: Commitment = 'confirmed';

/**
 * Creates and returns a Solana connection instance
 * @param network - The network to connect to (defaults to devnet)
 * @param commitment - The commitment level for transactions
 * @returns Connection instance configured for the specified network
 */
export function getSolanaConnection(
  network: string = DEFAULT_NETWORK,
  commitment: Commitment = DEFAULT_COMMITMENT
): Connection {
  console.log(`🌐 Connecting to Solana network: ${network}`);
  
  return new Connection(network, {
    commitment,
    // Increase timeout for educational examples that might run slower
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
 * Validates that we're not accidentally connecting to mainnet
 * This is a safety check for educational purposes
 */
export function validateNetworkSafety(network: string): void {
  if (network.includes('mainnet')) {
    throw new Error(
      '🚨 SAFETY CHECK: This educational project should never connect to mainnet! ' +
      'Please use devnet or testnet only. Set SOLANA_NETWORK=devnet'
    );
  }
}

/**
 * Helper to get network name from URL for display purposes
 */
export function getNetworkName(url: string): string {
  if (url.includes('devnet')) return 'Devnet';
  if (url.includes('testnet')) return 'Testnet';
  if (url.includes('mainnet')) return '⚠️  Mainnet';
  return 'Custom Network';
}

// Export a default connection for convenience
export const connection = getSolanaConnection();