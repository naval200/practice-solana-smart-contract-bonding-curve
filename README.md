# Bonding Curve Token Scripts

This directory contains TypeScript scripts for interacting with the bonding curve program.

## Files

### `create-token.ts`
Creates a new token with an associated bonding curve on Solana devnet.

**Features:**
- Initializes a new token mint
- Sets up bonding curve parameters
- Creates necessary PDA accounts
- Configures token metadata

**Usage:**
```bash
npm run create-token
```

### `buy-tokens.ts`
Purchases tokens from an existing bonding curve using SOL.

**Features:**
- Connects to existing bonding curve
- Calculates token amount based on SOL input
- Creates associated token account if needed
- Executes token purchase transaction

**Usage:**
```bash
npm run buy-tokens
```

## Configuration

Both scripts use the following configuration:

- **Network**: Devnet
- **Wallet**: `../wallets/creator.json`
- **Program ID**: `GQQQNJZdqKnFwB6di7u2PnsJZLX7hzaYW4g4b5BeQ3nE`
- **IDL Path**: `../bonding-curve-program/target/idl/bonding_curve_program.json`

## Current Token Details

The scripts are currently configured to work with:

- **Token Mint**: `3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw`
- **Bonding Curve**: `66fnzBWSLPTqb1cvFMgsEBFvzLzRaKhSb3RHLrDDdu28`
- **SOL Vault**: `DHecxzfcHAPgUReHdWLfD8k2MkyGCa2bQ4iMTZSM97yr`

## Requirements

- Node.js >= 16
- TypeScript
- Anchor framework
- Solana CLI configured for devnet
- Creator wallet with SOL balance

## Notes

- Ensure the creator wallet has sufficient SOL for transactions
- The mint authority must be transferred to the bonding curve PDA for token purchases to work
- These scripts are for educational purposes only