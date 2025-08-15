# Bonding Curve Token Learning Guide

This educational project demonstrates how to interact with bonding curve tokens on Solana devnet. Learn wallet management, token creation, and token purchasing concepts through hands-on examples.

## 🎯 Learning Objectives

- Understand Solana wallet creation and management
- Learn how SPL tokens and associated token accounts work
- Explore bonding curve mechanics for token pricing
- Practice using Solana CLI tools and TypeScript scripts

## 📁 Project Structure

```
pumpfun-dev/
├── src/
│   ├── create-token.ts        # Create new tokens with bonding curves
│   ├── buy-tokens.ts          # Buy tokens using any wallet
│   └── sell-tokens.ts         # Sell tokens back to bonding curve for SOL
├── wallets/                   # Wallet keypair files (gitignored for security)
│   ├── creator.json          # Token creator wallet
│   ├── token-mint.json       # Token mint keypair
│   └── user_1.json          # Example user wallet
├── bonding-curve-program/     # Anchor program for bonding curve logic
└── README.md                 # This guide
```

## 🚀 Getting Started

### Prerequisites

1. Install Node.js (v18+)
2. Install Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools
3. Set Solana to devnet: `solana config set --url https://api.devnet.solana.com`

### Setup

```bash
# Install dependencies
npm install

# Verify Solana configuration
solana config get
```

## 📚 Step-by-Step Learning Guide

### Step 1: Create Your First Wallet

```bash
# Create a new wallet
solana-keygen new --outfile wallets/my_wallet.json --no-bip39-passphrase

# Check the wallet address
solana-keygen pubkey wallets/my_wallet.json
```

### Step 2: Fund Your Wallet

```bash
# Get your wallet address
WALLET_ADDRESS=$(solana-keygen pubkey wallets/my_wallet.json)

# Request SOL from devnet faucet
solana airdrop 2 $WALLET_ADDRESS

# Check balance
solana balance $WALLET_ADDRESS
```

### Step 3: Buy Tokens Through Bonding Curve

Use the buy-tokens script to purchase tokens using any wallet:

```bash
# Buy tokens with your wallet (0.01 SOL default)
npm run buy-tokens -- --wallet wallets/my_wallet.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw

# Buy with custom amount
npm run buy-tokens -- --wallet wallets/my_wallet.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 0.05

# See all options
npm run buy-tokens -- --help
```

**What you'll learn:**
- How bonding curve pricing works (price increases with each purchase)
- Associated token accounts are created automatically
- Transaction execution and confirmation
- Token balance updates after purchase

### Step 4: Sell Tokens Back to Bonding Curve

Sell your tokens back to the bonding curve for SOL:

```bash
# Sell tokens back for SOL (1 token default)
npm run sell-tokens -- --wallet wallets/my_wallet.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw

# Sell specific amount of tokens
npm run sell-tokens -- --wallet wallets/my_wallet.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 3

# See all options
npm run sell-tokens -- --help
```

**What you'll learn:**
- How bonding curve selling works (price decreases as supply decreases)
- Token burning mechanism
- SOL return calculation based on bonding curve mathematics
- Balance updates for both tokens and SOL

### Step 5: Understand Token Creation (Advanced)

Examine the token creation process:

```bash
# Look at the token creation script (read-only)
cat src/create-token.ts

# Understand the current token setup
echo "Current Token Mint: 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw"
```

## 🔍 Understanding the Current Setup

### Existing Wallets

**Creator Wallet (`creator.json`)**
- **Role**: Token creator and project owner
- **Address**: `EypjMUJ5GDSSsnDnZjDEsjXh83aaeVArSvcQQfWroPaX`
- **Status**: Has SOL and owns 9 tokens
- **Purpose**: Demonstrates a wallet that has already interacted with the token

**Token Mint (`token-mint.json`)**
- **Role**: The token itself (mint keypair)
- **Address**: `3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw`
- **Purpose**: Used only during token creation to establish the token address

**User Wallet (`user_1.json`)**
- **Role**: Example token buyer
- **Address**: `3XAEHMAFiaRNrVN3ENZ1P8EXWKsLNii5e7gQhhJp2qWJ`
- **Status**: Has ~1.98 SOL and 9 tokens
- **Purpose**: Demonstrates successful token purchase through bonding curve

### Configuration

- **Network**: Devnet (safe for learning)
- **Program ID**: `GQQQNJZdqKnFwB6di7u2PnsJZLX7hzaYW4g4b5BeQ3nE`
- **Token Address**: `3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw`

## 📖 Key Concepts Explained

### 1. **Wallets vs Token Accounts**
- **Wallet**: Holds SOL and can own multiple token accounts
- **Associated Token Account**: Specific account for holding one type of SPL token
- **Derivation**: Token accounts are mathematically derived from wallet + mint address

### 2. **Token Mint vs Token Account**
- **Token Mint**: The "factory" that creates tokens (like a coin press)
- **Token Account**: Individual "wallets" that hold tokens from that mint

### 3. **Bonding Curve Mechanics**
- **Price Discovery**: Token price increases as more tokens are purchased
- **Liquidity**: SOL is locked in a vault to provide instant liquidity
- **Mathematical Formula**: Price = base_price + (tokens_sold × slope)

## 🔧 Useful Commands

### Token Trading Commands
```bash
# Buy tokens with SOL
npm run buy-tokens -- --wallet wallets/user_1.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 0.01
npm run buy-tokens -- --wallet wallets/creator.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 0.05

# Sell tokens for SOL
npm run sell-tokens -- --wallet wallets/user_1.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 2
npm run sell-tokens -- --wallet wallets/creator.json --token 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw --amount 1

# Buy tokens options:
# -w, --wallet <path>     Path to wallet JSON file (required)
# -t, --token <pubkey>    Token mint public key (required)  
# -a, --amount <sol>      Amount of SOL to spend (default: 0.01)
# -h, --help              Show help

# Sell tokens options:
# -w, --wallet <path>     Path to wallet JSON file (required)
# -t, --token <pubkey>    Token mint public key (required)  
# -a, --amount <tokens>   Amount of tokens to sell (default: 1)
# -h, --help              Show help
```

### Wallet Management Commands
```bash
# Check any wallet balance
solana balance <WALLET_ADDRESS>

# View token accounts for any address
spl-token accounts --owner <WALLET_ADDRESS>

# Create a new wallet
solana-keygen new --outfile wallets/new_wallet.json

# Get public key from wallet file
solana-keygen pubkey wallets/wallet_name.json

# Airdrop SOL to any address
solana airdrop 1 <WALLET_ADDRESS>
```

## 🔐 Security Notes

- **Private Keys**: Never share your .json wallet files
- **Devnet Only**: This project is for learning - only use devnet SOL
- **Gitignore**: Wallet files are automatically ignored by git
- **Backup**: Save your seed phrases securely for important wallets

## 🎓 Learning Exercises

### Exercise 1: Basic Token Trading
1. Create a new wallet and fund it with 1 SOL
2. Buy tokens with 0.05 SOL using the buy-tokens script
3. Sell half of your tokens back using the sell-tokens script
4. Compare your final SOL balance to your initial investment

### Exercise 2: Bonding Curve Mechanics  
1. Buy tokens in small increments (0.01 SOL each time)
2. Notice how the price increases with each purchase
3. Sell tokens and observe how the price decreases
4. Document the relationship between supply and price

### Exercise 3: Multi-Wallet Trading
1. Create 3 different wallets with different amounts of SOL
2. Have each wallet buy different amounts of tokens
3. Sell tokens from different wallets and compare returns
4. Understand how trading affects the overall bonding curve

## 📚 Further Learning

- [Solana Documentation](https://docs.solana.com/)
- [SPL Token Guide](https://spl.solana.com/token)
- [Associated Token Account Program](https://spl.solana.com/associated-token-account)
- [Solana Cookbook](https://solanacookbook.com/)

## ⚠️ Important Notes

- **Educational Purpose**: This project is for learning blockchain concepts
- **Devnet Only**: Never use mainnet - always stick to devnet for experiments  
- **No Real Value**: Devnet tokens and SOL have no monetary value
- **Safe Experimentation**: Feel free to create, fund, and experiment with wallets

## 🤝 Contributing to Your Learning

1. Try modifying the scripts to display additional information
2. Create your own wallet management utilities
3. Experiment with different amounts and addresses
4. Document your learning journey

---

**Happy Learning!** 🎉 This project provides a safe environment to explore Solana development concepts without any financial risk.