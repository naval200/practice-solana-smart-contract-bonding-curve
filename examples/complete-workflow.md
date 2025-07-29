# Complete Workflow Example: Creating "DevCoin" 

This example demonstrates the complete process of creating and interacting with a bonding curve token, walking through every step from wallet creation to token trading.

## 🎯 Scenario Overview

We'll create a educational token called "DevCoin" (DEV) that developers can use to learn about bonding curves and SPL token mechanics. This guide assumes you're starting from scratch.

## 📋 Prerequisites

Before starting, ensure you have:
- Node.js (v18+) installed
- Rust and Cargo installed
- Solana CLI tools installed
- Anchor framework installed
- This project cloned and dependencies installed (`npm install`)

## 🚀 Step-by-Step Workflow

### Step 1: Initial Setup

First, let's set up our Solana configuration for devnet:

```bash
# Set Solana to use devnet (NEVER use mainnet for educational projects!)
solana config set --url https://api.devnet.solana.com

# Verify configuration
solana config get
```

Expected output:
```
Config File: ~/.config/solana/cli/config.yml
RPC URL: https://api.devnet.solana.com
WebSocket URL: wss://api.devnet.solana.com/ (computed)
Keypair Path: ~/.config/solana/id.json
Commitment: confirmed
```

### Step 2: Create Creator Wallet

Create a wallet for the token creator (the person launching DevCoin):

```bash
# Create a new wallet named 'devcoin-creator'
npm run wallet:create

# When prompted, enter: devcoin-creator
```

Expected output:
```
🌐 Connecting to Solana network: https://api.devnet.solana.com
📁 Created directory: ./wallets
✅ Wallet created successfully!
📍 Public Key: 7x8kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE6jK7L
💾 Saved to: ./wallets/devcoin-creator.json

🔐 IMPORTANT SECURITY NOTES:
• Keep your private key file secure and never share it
• This file gives complete control over the wallet
• Consider backing up this file in a secure location
• This is for educational purposes - use proper key management in production
```

**Important**: Copy the public key for later use!

### Step 3: Fund the Creator Wallet

Request SOL from the devnet faucet to pay for transactions:

```bash
# Fund the creator wallet with 2 SOL
npm run wallet:deposit -- --wallet ./wallets/devcoin-creator.json --amount 2
```

Expected output:
```
ℹ️  Loaded wallet: 7x8k...6jK7L
ℹ️  Requesting 2.000 SOL from devnet faucet...
📍 Wallet: 7x8k...6jK7L
💰 Current balance: 0.000 SOL
ℹ️  Confirming airdrop transaction...
✅ Airdrop successful! Received 2.000 SOL
💰 New balance: 2.000 SOL
🔗 Transaction: 3kF9j2N8pQ7rS1vT4eU6wX8bY2cA5nD1fG9hE4jK6L7M
```

If the faucet is rate-limited, you can also use:
- [QuickNode Faucet](https://faucet.quicknode.com/solana/testnet)
- [Official Solana Faucet](https://faucet.solana.com/)

### Step 4: Build and Deploy the Bonding Curve Program

Now we need to build and deploy our Anchor program:

```bash
# Build the program
npm run build:program
```

Expected output:
```
yarn run v1.22.22
$ cd bonding-curve-program && anchor build
BPF SDK: ~/.local/share/solana/install/releases/1.17.0/solana-release/bin/sdk/bpf
cargo-build-bpf child: rustup toolchain list -v
...
✅ Build successful
```

```bash
# Deploy to devnet
npm run deploy
```

Expected output:
```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: ~/.config/solana/id.json
Deploying program "bonding_curve_program"...
Program path: ./target/deploy/bonding_curve_program.so...
Program Id: 7312f8pgpoquo7RZnPh7hGnhyi4UAteW5Y2xwFonB6eR

Deploy success
```

### Step 5: Create DevCoin Token

Now for the exciting part - creating our DevCoin token with a bonding curve:

```bash
# Create DevCoin with specific parameters
npm run token:create -- \
  --wallet ./wallets/devcoin-creator.json \
  --name "DevCoin" \
  --symbol "DEV" \
  --uri "https://example.com/devcoin-metadata.json" \
  --decimals 9 \
  --initial-price 0.0001 \
  --curve-slope 0.0000001
```

Expected output:
```
ℹ️  Loaded wallet: 7x8k...6jK7L
ℹ️  Creating SPL token with bonding curve...
📍 Token mint will be: 9sA4...3kF2
📊 Bonding curve: 8tB5...4mG3
💰 SOL vault: 6rC7...5nH4
💡 Initial price: 0.0001 SOL per token
📈 Curve slope: 0.0000001 SOL per token squared
📝 Signing and sending transaction...
⏳ Confirming transaction...
✅ Token created successfully!

🎉 TOKEN CREATION SUCCESSFUL!
════════════════════════════════════════════════════════════

📋 Token Information:
   Name: DevCoin
   Symbol: DEV
   Decimals: 9
   Initial Price: 0.0001 SOL per token

📍 Important Addresses:
   Token Mint: 9sA4kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE3kF2
   Bonding Curve: 8tB5mGk3n4O0qR2sT5vU7wY3cB6nE9gH5jL8oP1uI4mG3
   SOL Vault: 6rC7nHl4o5P1rS3tU6wX9aD2fI8kM1pN4qT7vY0zC5nH4

🔗 Transaction Details:
   Signature: 2dE6gHi9j0K3mP6qS9tV2wY5bC8fI1lN4oR7uX0aD3gH6
   Explorer: https://explorer.solana.com/tx/2dE6gHi9j0K3mP6qS9tV2wY5bC8fI1lN4oR7uX0aD3gH6?cluster=devnet
```

**Save these addresses!** You'll need them for trading.

### Step 6: Create a Trader Wallet

Let's create another wallet to demonstrate buying and selling:

```bash
# Create trader wallet
npm run wallet:create

# When prompted, enter: devcoin-trader

# Fund the trader wallet
npm run wallet:deposit -- --wallet ./wallets/devcoin-trader.json --amount 1
```

### Step 7: Buy DevCoin Tokens

Now let's buy some DevCoin tokens using the bonding curve:

```bash
# Buy DevCoin with 0.01 SOL
node dist/cli.js token buy \
  --wallet ./wallets/devcoin-trader.json \
  --token 9sA4kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE3kF2 \
  --sol-amount 0.01
```

Expected output:
```
🛒 Buying tokens with 0.010 SOL...
📍 Token: 9sA4...3kF2
💰 Buyer: 5xD8...2nG9
📊 Bonding curve: 8tB5...4mG3
🪙 Token account: 4wC6...7mK1
📈 Current price: 0.0001 SOL per token
📊 Current supply: 0 DEV
ℹ️  Loaded wallet: 5xD8...2nG9
📝 Signing and sending buy transaction...
⏳ Confirming transaction...
✅ Token purchase successful!

🎉 PURCHASE SUCCESSFUL!
────────────────────────────────────────
🪙 Tokens Received: 100,000 DEV
💰 SOL Spent: 0.010 SOL
📈 New Price: 0.00011 SOL per token
🔗 Transaction: 3fG8hJ1k4M7oR0sU3vW6yA9bD2eF5iL8nP1qT4wX7zA0
📊 Explorer: https://explorer.solana.com/tx/3fG8hJ1k4M7oR0sU3vW6yA9bD2eF5iL8nP1qT4wX7zA0?cluster=devnet
```

Notice how the price increased from 0.0001 to 0.00011 SOL per token due to the bonding curve!

### Step 8: Check Token Information

Let's view comprehensive information about our DevCoin:

```bash
# Get detailed token info
node dist/cli.js token info --token 9sA4kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE3kF2
```

Expected output:
```
📊 Fetching token information...
✅ Token information fetched successfully

📊 Token Information:
──────────────────────────────────────────────────
Name: DevCoin
Symbol: DEV
Mint: 9sA4kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE3kF2
Supply: 100,000 DEV
Decimals: 9
Current Price: 0.00011 SOL
Market Cap: 11.000 SOL
Bonding Curve: 8tB5mGk3n4O0qR2sT5vU7wY3cB6nE9gH5jL8oP1uI4mG3
```

### Step 9: Buy More Tokens (Demonstrate Price Increase)

Let's buy more tokens to see the bonding curve in action:

```bash
# Buy more DevCoin with 0.02 SOL
node dist/cli.js token buy \
  --wallet ./wallets/devcoin-trader.json \
  --token 9sA4kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE3kF2 \
  --sol-amount 0.02
```

Expected output:
```
🛒 Buying tokens with 0.020 SOL...
📈 Current price: 0.00011 SOL per token
📊 Current supply: 100,000 DEV

🎉 PURCHASE SUCCESSFUL!
────────────────────────────────────────
🪙 Tokens Received: 181,818 DEV
💰 SOL Spent: 0.020 SOL
📈 New Price: 0.000128 SOL per token
```

Notice the price increased even more! The trader now has ~281,818 DEV tokens total.

### Step 10: Sell Some Tokens

Now let's sell some tokens back to the bonding curve:

```bash
# Sell 50,000 DEV tokens
node dist/cli.js token sell \
  --wallet ./wallets/devcoin-trader.json \
  --token 9sA4kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE3kF2 \
  --token-amount 50000
```

Expected output:
```
💸 Selling 50000 tokens...
📍 Token: 9sA4...3kF2
👤 Seller: 5xD8...2nG9
📈 Current price: 0.000128 SOL per token
💰 SOL reserves: 0.030 SOL

💰 SALE SUCCESSFUL!
────────────────────────────────────
🪙 Tokens Sold: 50,000 DEV
💰 SOL Received: 0.0059 SOL
📉 New Price: 0.000123 SOL per token
```

Notice how:
1. The price decreased after selling (supply went down)
2. We received SOL from the curve's reserves
3. The trader still has ~231,818 DEV tokens remaining

### Step 11: Transfer SOL Between Wallets

Let's demonstrate SOL transfers between our wallets:

```bash
# Send 0.1 SOL from creator to trader
npm run wallet:send -- \
  --from ./wallets/devcoin-creator.json \
  --to 5xD8kFj2m3N9pQ1rS4vT6eU8wX2bY5cA1nD9fG4hE2nG9 \
  --amount 0.1
```

When prompted, confirm the transfer by typing 'y'.

### Step 12: List All Wallets

Check the status of all our wallets:

```bash
# List all wallets with balances
npm run wallet:list
```

Expected output:
```
📁 Available Wallets:
────────────────────────────────────────────────────────────────────────────────

📄 devcoin-creator
   Public Key: 7x8k...6jK7L
   Balance: 1.895 SOL
   Path: ./wallets/devcoin-creator.json

📄 devcoin-trader  
   Public Key: 5xD8...2nG9
   Balance: 1.096 SOL
   Path: ./wallets/devcoin-trader.json
```

## 📊 Final Results Summary

After completing this workflow, we have:

### ✅ Created Infrastructure
- ✅ Two wallets (creator and trader)
- ✅ Deployed bonding curve program to devnet
- ✅ Created DevCoin (DEV) token with bonding curve

### ✅ Demonstrated Core Features
- ✅ Token purchases that increase price via bonding curve
- ✅ Token sales that provide liquidity and decrease price
- ✅ SOL transfers between wallets
- ✅ Token information queries

### ✅ Key Learning Outcomes
- ✅ Understanding bonding curve price mechanics
- ✅ SPL token creation and management
- ✅ Automated market maker (AMM) concepts
- ✅ Solana CLI and wallet management
- ✅ Smart contract interaction patterns

## 🎓 Educational Key Points

### Bonding Curve Mechanics
The linear bonding curve formula used is:
```
Price = InitialPrice + (CurrentSupply × Slope)
```

This means:
- Price starts at 0.0001 SOL per token
- For every token minted, price increases by 0.0000001 SOL
- Selling tokens decreases the supply and price
- SOL reserves ensure liquidity for selling

### Real-World Applications
This bonding curve model is similar to what's used in:
- Pump.fun (with additional features like Raydium migration)
- Bancor protocol
- Uniswap V1 (constant product formula)
- Various fair launch mechanisms

### Security Considerations
- ✅ Program uses checked math to prevent overflows
- ✅ Proper account validation and ownership checks
- ✅ PDA (Program Derived Address) usage for security
- ✅ Comprehensive error handling

## 🔗 Useful Commands Reference

```bash
# Check balances
solana balance <PUBLIC_KEY>

# View token accounts
spl-token accounts

# View transaction details
solana transaction <SIGNATURE>

# View program logs
solana logs <PROGRAM_ID>
```

## 🌐 Explorer Links

- [Solana Devnet Explorer](https://explorer.solana.com/?cluster=devnet)
- [Token Program](https://explorer.solana.com/address/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA?cluster=devnet)
- [System Program](https://explorer.solana.com/address/11111111111111111111111111111111?cluster=devnet)

## 🚀 Next Steps

After completing this workflow, you can:

1. **Experiment with Parameters**: Try different initial prices and slopes
2. **Add More Traders**: Create additional wallets and simulate trading
3. **Monitor Price Discovery**: Watch how prices change with supply
4. **Study the Code**: Examine the Rust program and TypeScript clients
5. **Build Extensions**: Add features like trading fees or token burns

## ⚠️ Important Reminders

- **Educational Only**: This is for learning purposes, not production use
- **Devnet Only**: Never use real money or mainnet for experimentation
- **Key Security**: Keep private keys secure and never share them
- **Rate Limits**: Faucets have rate limits, be patient between requests
- **Transaction Fees**: All operations cost small amounts of SOL for fees

Congratulations! You've successfully created and interacted with a bonding curve SPL token on Solana! 🎉