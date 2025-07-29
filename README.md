# Solana SPL Token with Bonding Curve - Educational Project

This educational project demonstrates how to create and manage SPL tokens on Solana's Devnet/Testnet with bonding curve mechanics, similar to Pump.fun's core functionality.

## 🎯 Educational Objectives

- Understand SPL token creation and management
- Learn bonding curve implementation for price discovery
- Practice Solana CLI operations and wallet management
- Explore Anchor framework for smart contract development
- Implement token metadata using Metaplex standards

## 📁 Project Structure

```
pumpfun-dev/
├── cli.ts                           # Main CLI interface for wallet and token operations
├── src/
│   ├── wallet-manager.ts           # Wallet creation, funding, and transfer utilities
│   ├── token-creator.ts            # Token creation and bonding curve interaction
│   ├── bonding-curve-client.ts     # Client for interacting with bonding curve program
│   └── utils/
│       ├── solana-config.ts        # Solana connection and configuration
│       └── helpers.ts              # Utility functions and error handling
├── bonding-curve-program/          # Anchor program for bonding curve SPL token
│   ├── programs/
│   │   └── bonding-curve-program/
│   │       └── src/
│   │           └── lib.rs          # Main Anchor program logic
│   ├── tests/
│   │   └── bonding-curve.ts        # Program tests
│   └── Anchor.toml                 # Anchor configuration
├── wallets/                        # Directory for storing wallet keypairs (gitignored)
└── examples/                       # Example scenarios and usage demonstrations
```

## 🚀 Quick Start

### Prerequisites

1. Install Rust and Cargo: https://rustup.rs/
2. Install Solana CLI: https://docs.solana.com/cli/install-solana-cli-tools
3. Install Anchor: https://www.anchor-lang.com/docs/installation
4. Install Node.js (v18+)

### Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Set Solana to devnet
solana config set --url https://api.devnet.solana.com
```

## 🎮 CLI Commands

### Wallet Operations

```bash
# Create a new wallet
npm run wallet:create

# Deposit SOL from faucet
npm run wallet:deposit -- --wallet ./wallets/my-wallet.json

# Send SOL to another wallet
npm run wallet:send -- --from ./wallets/my-wallet.json --to <recipient-address> --amount 0.1
```

### Token Operations

```bash
# Create a new SPL token with bonding curve
npm run token:create -- --wallet ./wallets/my-wallet.json --name "DevCoin" --symbol "DEV"
```

## 🔧 Development

### Deploy Program

```bash
# Generate a new program keypair
solana-keygen new -o bonding-curve-program/target/deploy/bonding_curve_program-keypair.json

# Build and deploy
npm run deploy
```

### Run Tests

```bash
npm test
```

## 📚 Educational Features

### 1. Wallet Management
- Secure keypair generation and storage
- Devnet SOL faucet integration with rate limiting handling
- SOL transfer functionality with unfunded recipient support

### 2. Bonding Curve Mechanics
- Linear bonding curve implementation (customizable)
- Automatic price calculation based on token supply
- Token minting and burning based on SOL deposits/withdrawals

### 3. SPL Token Standards
- Metaplex Token Metadata integration
- Associated Token Account creation
- Standard SPL token operations

### 4. Smart Contract Architecture
- Anchor framework best practices
- Comprehensive error handling
- Security considerations and validations

## 🧪 Example Scenario: "DevCoin" Launch

Follow this scenario to understand the complete token lifecycle:

1. **Create Creator Wallet**
   ```bash
   npm run wallet:create
   # Save as ./wallets/creator.json
   ```

2. **Fund Creator Wallet**
   ```bash
   npm run wallet:deposit -- --wallet ./wallets/creator.json
   ```

3. **Deploy Bonding Curve Program**
   ```bash
   npm run deploy
   ```

4. **Create "DevCoin" Token**
   ```bash
   npm run token:create -- --wallet ./wallets/creator.json --name "DevCoin" --symbol "DEV" --uri "https://example.com/devcoin.json"
   ```

5. **Buy Tokens** (increases price via bonding curve)
   ```bash
   node dist/cli.js token buy --wallet ./wallets/creator.json --token <token-address> --sol-amount 0.1
   ```

6. **Sell Tokens** (decreases price via bonding curve)
   ```bash
   node dist/cli.js token sell --wallet ./wallets/creator.json --token <token-address> --token-amount 100
   ```

## ⚠️ Important Notes

- **Educational Purpose Only**: This project is for learning. Do not use in production.
- **Testnet/Devnet Only**: Always use testnet/devnet SOL, never mainnet.
- **Security**: Private keys are stored locally. In production, use secure key management.
- **Bonding Curve**: This implements a simple linear curve. Pump.fun uses more complex mechanisms.

## 🔗 Resources

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Book](https://book.anchor-lang.com/)
- [SPL Token Documentation](https://spl.solana.com/token)
- [Metaplex Docs](https://docs.metaplex.com/)
- [QuickNode Solana Guides](https://www.quicknode.com/guides/solana-development)

## 📄 License

MIT License - Educational use only.