# Bonding Curve Token Creation Documentation

## Overview

This documentation covers the successful deployment and testing of a Solana bonding curve program that enables automated token pricing through a linear bonding curve mechanism, similar to Pump.fun's functionality.

## Program Information

### Deployed Program Details
- **Program ID**: `GQQQNJZdqKnFwB6di7u2PnsJZLX7hzaYW4g4b5BeQ3nE`
- **Network**: Devnet
- **Program Type**: Educational Bonding Curve SPL Token Program
- **IDL Location**: `target/idl/bonding_curve_program.json`

### Key Features
- Linear bonding curve pricing
- Token minting/burning based on SOL deposits/withdrawals
- Automated price discovery
- Educational implementation with comprehensive comments

## Token Creation Results

### Token 1 (Initial Attempt)
- **Token Mint**: `HDss5FeqmvrTRFFS9egJda33ZY4A6gviXRfXzmMcKLTP`
- **Bonding Curve PDA**: `DdPETXnMbZQcocpidpjp2hQmdo2mcHjKZwKzXuptaMkS`
- **SOL Vault PDA**: `Bpj7jQh1XDstm9YLPX5kKgEyeXKDuK6gDkuQMCdRACtZ`
- **Status**: Created but mint authority issue prevented token purchases
- **Transaction Signature**: `3JU4LXr9hvSrGTcFwYbupjNqo9tSw7xyHPrHc1xcyVmKgVdRGZmtmtRWgceaC38rvFG1Eo5LZFuVAoaRaPBFCFYy`

### Token 2 (Successful Implementation)
- **Token Mint**: `3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw`
- **Bonding Curve PDA**: `66fnzBWSLPTqb1cvFMgsEBFvzLzRaKhSb3RHLrDDdu28`
- **SOL Vault PDA**: `DHecxzfcHAPgUReHdWLfD8k2MkyGCa2bQ4iMTZSM97yr`
- **Token Name**: "Test Token"
- **Token Symbol**: "TEST"
- **Decimals**: 0
- **Initial Price**: 1,000,000 lamports (0.001 SOL per token)
- **Price Slope**: 100 lamports per token
- **Status**: ✅ Fully functional

## Transaction History

### Token Creation Transactions
1. **Bonding Curve Initialization**: `37kEta73WUNP7KZg2NVraku1EWHUNDRgjJeXaFSrFrR8PVnMugNx7ipPns11TkTQBq9guvxDMgyHhikW72nHJn8N`
2. **Mint Authority Transfer**: `3z8nqkdibs88cxoJLggHsRBRYcqKiW2izqRdTsQvGeSBxpZHR7bHPfzUbNZJpX99sf7yDG1CCi3SsyCA9R9ZgZQx`
3. **Token Purchase (0.01 SOL)**: `QujCdWWu2xpCv3qzs9pJapajJqCK8FXXEkYg32AQYrX8FwzSrEhVVWexSM2gQpAKqjjw248CtBtC9VAiVmdHE36`

### Final Token State
- **Total Supply**: 9 tokens
- **Tokens Purchased**: 9 tokens for 0.01 SOL
- **Mint Authority**: Bonding Curve PDA (`66fnzBWSLPTqb1cvFMgsEBFvzLzRaKhSb3RHLrDDdu28`)
- **Freeze Authority**: Creator (`EypjMUJ5GDSSsnDnZjDEsjXh83aaeVArSvcQQfWroPaX`)

## Build Process

### Prerequisites
- Anchor CLI
- Solana CLI configured for devnet
- Node.js and TypeScript
- Creator wallet with sufficient SOL

### Build Steps Completed
1. **Program Compilation**: Fixed IDL build warnings and compiled successfully
2. **Dependency Optimization**: Removed unnecessary `idl-build` features
3. **Program Deployment**: Already deployed to devnet
4. **Token Initialization**: Created bonding curve with proper parameters
5. **Authority Management**: Transferred mint authority to bonding curve PDA
6. **Functionality Testing**: Successfully purchased tokens

## Program Instructions

The bonding curve program supports the following instructions:

### 1. `initialize_bonding_curve`
Initializes a new bonding curve for an SPL token.

**Parameters:**
- `initial_price`: Starting price in lamports per token
- `slope`: Price increase per token minted (linear curve)
- `name`: Token name
- `symbol`: Token symbol

**Accounts:**
- `creator`: The bonding curve creator (signer, mut)
- `token_mint`: New token mint account (signer, mut)
- `bonding_curve`: Bonding curve state PDA (mut)
- `sol_vault`: SOL vault PDA (mut)
- Required programs: Token, System, Rent

### 2. `buy_tokens`
Purchase tokens using SOL through the bonding curve.

**Parameters:**
- `sol_amount`: Amount of SOL to spend (in lamports)

**Accounts:**
- `buyer`: Token buyer (signer, mut)
- `bonding_curve`: Bonding curve state PDA (mut)
- `token_mint`: Token mint account (mut)
- `buyer_token_account`: Buyer's associated token account (mut)
- `sol_vault`: SOL vault PDA (mut)
- Required programs: Token, Associated Token, System, Rent

### 3. `sell_tokens`
Sell tokens back to the bonding curve for SOL.

**Parameters:**
- `token_amount`: Number of tokens to sell

### 4. `get_current_price`
View current token price based on supply (read-only).

**Returns:** Current price in lamports per token

## Account Structure

### BondingCurve Account
```rust
pub struct BondingCurve {
    pub creator: Pubkey,           // Bonding curve creator
    pub token_mint: Pubkey,        // Associated token mint
    pub current_supply: u64,       // Current token supply
    pub sol_reserves: u64,         // SOL reserves in vault
    pub initial_price: u64,        // Starting price in lamports
    pub slope: u64,                // Price slope in lamports
    pub bump: u8,                  // PDA bump seed
    pub name: [u8; 32],           // Token name (padded)
    pub symbol: [u8; 8],          // Token symbol (padded)
}
```

## PDA Derivations

### Bonding Curve PDA
```
seeds = [b"bonding_curve", token_mint.key()]
```

### SOL Vault PDA
```
seeds = [b"sol_vault", token_mint.key()]
```

## Event Emissions

The program emits the following events for tracking and analytics:

1. **BondingCurveInitialized**: When a new bonding curve is created
2. **TokensPurchased**: When tokens are bought
3. **TokensSold**: When tokens are sold back

## Error Codes

- `6000`: Invalid price parameter
- `6001`: Invalid slope parameter
- `6002`: Invalid amount
- `6003`: Token name too long
- `6004`: Token symbol too long
- `6005`: Insufficient SOL for purchase
- `6006`: Insufficient token supply
- `6007`: Insufficient SOL reserves
- `6008`: Supply overflow
- `6009`: Supply underflow
- `6010`: Reserves overflow
- `6011`: Reserves underflow
- `6012`: Price calculation overflow
- `6013`: Math overflow in calculations

## Usage Examples

### Creating a Token
```bash
# From the root directory
npm run create-token
```
See `../src/create-token.ts` for the complete implementation of token creation with bonding curve initialization.

### Buying Tokens
```bash
# From the root directory
npm run buy-tokens
```
See `../src/buy-tokens.ts` for the implementation of purchasing tokens from the bonding curve.

## Project Structure

```
pumpfun-dev/
├── package.json                 # Root package.json with scripts
├── bonding-curve-program/       # Anchor program directory
│   ├── programs/
│   │   └── bonding-curve-program/
│   │       └── src/lib.rs       # Program source code
│   ├── target/idl/              # Generated IDL files
│   ├── Anchor.toml             # Anchor configuration
│   └── BONDING_CURVE_DEPLOYMENT.md  # This documentation
├── src/                        # TypeScript interaction scripts
│   ├── create-token.ts         # Token creation script
│   ├── buy-tokens.ts           # Token purchase script  
│   └── README.md               # Scripts documentation
└── wallets/                    # Wallet keypairs
    └── creator.json            # Creator wallet
```

## Important Notes

1. **Mint Authority**: The bonding curve PDA must be set as the mint authority for the token to enable minting during purchases.

2. **Authority Transfer**: If the mint authority is not properly set during initialization, it must be manually transferred using:
   ```bash
   spl-token authorize <TOKEN_MINT> mint <BONDING_CURVE_PDA>
   ```

3. **Educational Purpose**: This implementation is for educational purposes only and should not be used in production without proper security audits.

4. **Price Calculation**: The linear bonding curve uses the formula:
   ```
   price = initial_price + (current_supply * slope)
   ```

## Configuration Files

- **Anchor.toml**: Configured for devnet deployment
- **Cargo.toml**: Optimized dependencies without unnecessary IDL build features
- **Wallet Configuration**: Uses creator wallet from `../wallets/creator.json`

## Verification Commands

To verify the deployment and token state:

```bash
# Check program deployment
solana program show GQQQNJZdqKnFwB6di7u2PnsJZLX7hzaYW4g4b5BeQ3nE

# Check token mint details
spl-token display 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw

# Check token balance
spl-token balance 3xBq1Yr1PC8cUK9Sqyobci4yZoJdgFuVghU3PH5aQGcw

# Check bonding curve account
solana account 66fnzBWSLPTqb1cvFMgsEBFvzLzRaKhSb3RHLrDDdu28
```

## Next Steps

The bonding curve program is now fully functional and ready for:
1. Additional testing with different price parameters
2. Integration with frontend applications
3. Extension with additional features (e.g., different curve types)
4. Security auditing before production use

## Troubleshooting

### Common Issues
1. **Mint Authority Error**: Ensure the bonding curve PDA is set as the mint authority
2. **Insufficient SOL**: Ensure the buyer has enough SOL for both the token purchase and transaction fees
3. **Account Not Found**: Verify all PDA addresses are correctly derived
4. **Program Not Found**: Ensure the program is deployed to the correct network

### Debug Commands
```bash
# Check Solana CLI configuration
solana config get

# Check wallet balance
solana balance

# Check program logs
solana logs GQQQNJZdqKnFwB6di7u2PnsJZLX7hzaYW4g4b5BeQ3nE
```