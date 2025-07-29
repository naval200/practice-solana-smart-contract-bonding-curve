#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { WalletManager } from './src/wallet-manager';
import { TokenCreator } from './src/token-creator';
import { BondingCurveClient } from './src/bonding-curve-client';
import { createPublicKey, validateEnvironment, success, error, info } from './src/utils/helpers';

/**
 * Main CLI interface for the educational SPL token project
 * This provides a command-line interface for all wallet and token operations
 * 
 * Available commands:
 * - wallet create: Create a new wallet
 * - wallet deposit: Fund wallet from faucet
 * - wallet send: Transfer SOL between wallets
 * - wallet list: List all available wallets
 * - token create: Create a new SPL token with bonding curve
 * - token buy: Buy tokens using SOL
 * - token sell: Sell tokens for SOL
 * - token info: Get token information
 */

// Initialize CLI program
const program = new Command();

// Set program information
program
  .name('solana-token-cli')
  .description('Educational CLI for SPL token creation with bonding curves on Solana')
  .version('1.0.0');

// Validate environment before running any commands
const envValidation = validateEnvironment();
if (!envValidation.valid) {
  envValidation.errors.forEach(err => error(err));
  process.exit(1);
}

/**
 * WALLET COMMANDS
 * These commands handle wallet creation, funding, and SOL transfers
 */

// Wallet command group
const walletCmd = program
  .command('wallet')
  .description('Wallet management operations');

// Create new wallet command
walletCmd
  .command('create')
  .description('Create a new Solana wallet')
  .option('-n, --name <name>', 'Wallet name')
  .action(async (options) => {
    try {
      const walletManager = new WalletManager();
      
      // Get wallet name from user if not provided
      let walletName = options.name;
      if (!walletName) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'walletName',
            message: 'Enter wallet name:',
            validate: (input) => input.trim().length > 0 || 'Wallet name cannot be empty'
          }
        ]);
        walletName = answers.walletName;
      }

      // Create the wallet
      const { keypair, filePath } = await walletManager.createWallet(walletName);
      
      // Display important information
      console.log('\n' + chalk.green('🎉 Wallet Creation Complete!'));
      console.log(chalk.yellow('\n📋 Next Steps:'));
      console.log(chalk.white('1. Fund your wallet: ') + chalk.cyan(`npm run wallet:deposit -- --wallet "${filePath}"`));
      console.log(chalk.white('2. Check balance: ') + chalk.cyan(`solana balance ${keypair.publicKey.toString()}`));
      console.log(chalk.white('3. Set as default: ') + chalk.cyan(`solana config set --keypair "${filePath}"`));
    } catch (err) {
      error(`Failed to create wallet: ${err}`);
      process.exit(1);
    }
  });

// Deposit SOL from faucet command
walletCmd
  .command('deposit')
  .description('Request SOL from devnet faucet')
  .requiredOption('-w, --wallet <path>', 'Path to wallet file')
  .option('-a, --amount <amount>', 'Amount of SOL to request', '2')
  .action(async (options) => {
    try {
      const walletManager = new WalletManager();
      
      // Load the wallet
      const keypair = walletManager.loadWallet(options.wallet);
      if (!keypair) {
        error('Failed to load wallet');
        process.exit(1);
      }

      const amount = parseFloat(options.amount);
      if (isNaN(amount) || amount <= 0) {
        error('Invalid amount specified');
        process.exit(1);
      }

      // Request airdrop
      const success = await walletManager.requestAirdrop(keypair.publicKey, amount);
      
      if (success) {
        console.log('\n' + chalk.green('💰 Funding Complete!'));
        console.log(chalk.yellow('\n📋 Next Steps:'));
        console.log(chalk.white('• Create a token: ') + chalk.cyan(`npm run token:create -- --wallet "${options.wallet}"`));
        console.log(chalk.white('• Send SOL: ') + chalk.cyan(`npm run wallet:send -- --from "${options.wallet}"`));
      } else {
        process.exit(1);
      }
    } catch (err) {
      error(`Failed to deposit SOL: ${err}`);
      process.exit(1);
    }
  });

// Send SOL command
walletCmd
  .command('send')
  .description('Transfer SOL to another wallet')
  .requiredOption('-f, --from <path>', 'Path to sender wallet file')
  .requiredOption('-t, --to <address>', 'Recipient public key')
  .requiredOption('-a, --amount <amount>', 'Amount of SOL to send')
  .option('--allow-unfunded-recipient', 'Allow sending to unfunded accounts')
  .action(async (options) => {
    try {
      const walletManager = new WalletManager();
      
      // Load sender wallet
      const fromKeypair = walletManager.loadWallet(options.from);
      if (!fromKeypair) {
        error('Failed to load sender wallet');
        process.exit(1);
      }

      // Validate recipient address
      const toPublicKey = createPublicKey(options.to);
      if (!toPublicKey) {
        error('Invalid recipient address');
        process.exit(1);
      }

      // Validate amount
      const amount = parseFloat(options.amount);
      if (isNaN(amount) || amount <= 0) {
        error('Invalid amount specified');
        process.exit(1);
      }

      // Confirm the transfer
      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: `Send ${amount} SOL to ${options.to}?`,
          default: false
        }
      ]);

      if (!confirmation.proceed) {
        info('Transfer cancelled');
        return;
      }

      // Execute transfer
      const signature = await walletManager.transferSol(
        fromKeypair,
        toPublicKey,
        amount,
        options.allowUnfundedRecipient
      );

      if (signature) {
        console.log('\n' + chalk.green('💸 Transfer Complete!'));
        console.log(chalk.gray(`View on Solana Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`));
      } else {
        process.exit(1);
      }
    } catch (err) {
      error(`Failed to send SOL: ${err}`);
      process.exit(1);
    }
  });

// List wallets command
walletCmd
  .command('list')
  .description('List all available wallets')
  .action(async () => {
    try {
      const walletManager = new WalletManager();
      await walletManager.displayWallets();
    } catch (err) {
      error(`Failed to list wallets: ${err}`);
      process.exit(1);
    }
  });

/**
 * TOKEN COMMANDS
 * These commands handle SPL token creation and bonding curve interactions
 */

// Token command group
const tokenCmd = program
  .command('token')
  .description('SPL token operations with bonding curve');

// Create token command
tokenCmd
  .command('create')
  .description('Create a new SPL token with bonding curve')
  .requiredOption('-w, --wallet <path>', 'Path to creator wallet file')
  .requiredOption('-n, --name <name>', 'Token name')
  .requiredOption('-s, --symbol <symbol>', 'Token symbol')
  .option('-u, --uri <uri>', 'Token metadata URI')
  .option('-d, --decimals <decimals>', 'Token decimals', '9')
  .option('--initial-price <price>', 'Initial token price in SOL', '0.0001')
  .option('--curve-slope <slope>', 'Bonding curve slope', '0.0000001')
  .action(async (options) => {
    try {
      const walletManager = new WalletManager();
      const tokenCreator = new TokenCreator();
      
      // Load creator wallet
      const creatorKeypair = walletManager.loadWallet(options.wallet);
      if (!creatorKeypair) {
        error('Failed to load creator wallet');
        process.exit(1);
      }

      // Validate parameters
      const decimals = parseInt(options.decimals);
      const initialPrice = parseFloat(options.initialPrice);
      const curveSlope = parseFloat(options.curveSlope);

      if (isNaN(decimals) || decimals < 0 || decimals > 18) {
        error('Invalid decimals (must be 0-18)');
        process.exit(1);
      }

      if (isNaN(initialPrice) || initialPrice <= 0) {
        error('Invalid initial price');
        process.exit(1);
      }

      if (isNaN(curveSlope) || curveSlope <= 0) {
        error('Invalid curve slope');
        process.exit(1);
      }

      info('Creating SPL token with bonding curve...');
      
      // Create the token
      const result = await tokenCreator.createToken({
        creator: creatorKeypair,
        name: options.name,
        symbol: options.symbol,
        uri: options.uri || '',
        decimals,
        initialPrice,
        curveSlope
      });

      if (result) {
        console.log('\n' + chalk.green('🚀 Token Creation Complete!'));
        console.log(chalk.cyan(`📍 Token Address: ${result.tokenMint}`));
        console.log(chalk.cyan(`📊 Bonding Curve: ${result.bondingCurve}`));
        console.log(chalk.yellow('\n📋 Next Steps:'));
        console.log(chalk.white('• Buy tokens: ') + chalk.cyan(`npm run cli token buy --wallet "${options.wallet}" --token ${result.tokenMint} --sol-amount 0.1`));
        console.log(chalk.white('• Check token info: ') + chalk.cyan(`npm run cli token info --token ${result.tokenMint}`));
      } else {
        process.exit(1);
      }
    } catch (err) {
      error(`Failed to create token: ${err}`);
      process.exit(1);
    }
  });

// Buy tokens command
tokenCmd
  .command('buy')
  .description('Buy tokens using SOL via bonding curve')
  .requiredOption('-w, --wallet <path>', 'Path to buyer wallet file')
  .requiredOption('-t, --token <address>', 'Token mint address')
  .requiredOption('-a, --sol-amount <amount>', 'Amount of SOL to spend')
  .action(async (options) => {
    try {
      const walletManager = new WalletManager();
      const bondingCurveClient = new BondingCurveClient();
      
      // Load buyer wallet
      const buyerKeypair = walletManager.loadWallet(options.wallet);
      if (!buyerKeypair) {
        error('Failed to load buyer wallet');
        process.exit(1);
      }

      // Validate token address
      const tokenMint = createPublicKey(options.token);
      if (!tokenMint) {
        error('Invalid token address');
        process.exit(1);
      }

      // Validate SOL amount
      const solAmount = parseFloat(options.solAmount);
      if (isNaN(solAmount) || solAmount <= 0) {
        error('Invalid SOL amount');
        process.exit(1);
      }

      // Execute buy transaction
      const result = await bondingCurveClient.buyTokens(buyerKeypair, tokenMint, solAmount);
      
      if (result) {
        console.log('\n' + chalk.green('🎉 Token Purchase Complete!'));
        console.log(chalk.cyan(`🪙 Tokens Received: ${result.tokensReceived}`));
        console.log(chalk.cyan(`💰 SOL Spent: ${result.solSpent}`));
        console.log(chalk.cyan(`📈 New Price: ${result.newPrice} SOL per token`));
      } else {
        process.exit(1);
      }
    } catch (err) {
      error(`Failed to buy tokens: ${err}`);
      process.exit(1);
    }
  });

// Sell tokens command
tokenCmd
  .command('sell')
  .description('Sell tokens for SOL via bonding curve')
  .requiredOption('-w, --wallet <path>', 'Path to seller wallet file')
  .requiredOption('-t, --token <address>', 'Token mint address')
  .requiredOption('-a, --token-amount <amount>', 'Amount of tokens to sell')
  .action(async (options) => {
    try {
      const walletManager = new WalletManager();
      const bondingCurveClient = new BondingCurveClient();
      
      // Load seller wallet
      const sellerKeypair = walletManager.loadWallet(options.wallet);
      if (!sellerKeypair) {
        error('Failed to load seller wallet');
        process.exit(1);
      }

      // Validate token address
      const tokenMint = createPublicKey(options.token);
      if (!tokenMint) {
        error('Invalid token address');
        process.exit(1);
      }

      // Validate token amount
      const tokenAmount = parseFloat(options.tokenAmount);
      if (isNaN(tokenAmount) || tokenAmount <= 0) {
        error('Invalid token amount');
        process.exit(1);
      }

      // Execute sell transaction
      const result = await bondingCurveClient.sellTokens(sellerKeypair, tokenMint, tokenAmount);
      
      if (result) {
        console.log('\n' + chalk.green('💰 Token Sale Complete!'));
        console.log(chalk.cyan(`🪙 Tokens Sold: ${result.tokensSold}`));
        console.log(chalk.cyan(`💰 SOL Received: ${result.solReceived}`));
        console.log(chalk.cyan(`📉 New Price: ${result.newPrice} SOL per token`));
      } else {
        process.exit(1);
      }
    } catch (err) {
      error(`Failed to sell tokens: ${err}`);
      process.exit(1);
    }
  });

// Token info command
tokenCmd
  .command('info')
  .description('Get information about a token')
  .requiredOption('-t, --token <address>', 'Token mint address')
  .action(async (options) => {
    try {
      const bondingCurveClient = new BondingCurveClient();
      
      // Validate token address
      const tokenMint = createPublicKey(options.token);
      if (!tokenMint) {
        error('Invalid token address');
        process.exit(1);
      }

      // Get token information
      const info = await bondingCurveClient.getTokenInfo(tokenMint);
      
      if (info) {
        console.log('\n' + chalk.cyan('📊 Token Information:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.white(`Name: ${info.name}`));
        console.log(chalk.white(`Symbol: ${info.symbol}`));
        console.log(chalk.white(`Mint: ${info.mint}`));
        console.log(chalk.white(`Supply: ${info.supply}`));
        console.log(chalk.white(`Decimals: ${info.decimals}`));
        console.log(chalk.white(`Current Price: ${info.currentPrice} SOL`));
        console.log(chalk.white(`Market Cap: ${info.marketCap} SOL`));
        console.log(chalk.white(`Bonding Curve: ${info.bondingCurve}`));
      } else {
        error('Token not found or not a bonding curve token');
        process.exit(1);
      }
    } catch (err) {
      error(`Failed to get token info: ${err}`);
      process.exit(1);
    }
  });

/**
 * HELP AND INFO COMMANDS
 */

// Help command with examples
program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log(chalk.cyan('\n🎓 Educational Examples:\n'));
    
    console.log(chalk.yellow('1. Create and fund a new wallet:'));
    console.log(chalk.gray('   npm run wallet:create'));
    console.log(chalk.gray('   npm run wallet:deposit -- --wallet ./wallets/my-wallet.json\n'));
    
    console.log(chalk.yellow('2. Create a new token "DevCoin":'));
    console.log(chalk.gray('   npm run token:create -- --wallet ./wallets/my-wallet.json --name "DevCoin" --symbol "DEV"\n'));
    
    console.log(chalk.yellow('3. Buy tokens with SOL:'));
    console.log(chalk.gray('   node dist/cli.js token buy --wallet ./wallets/my-wallet.json --token <token-address> --sol-amount 0.1\n'));
    
    console.log(chalk.yellow('4. Check token information:'));
    console.log(chalk.gray('   node dist/cli.js token info --token <token-address>\n'));
    
    console.log(chalk.yellow('5. Send SOL to another wallet:'));
    console.log(chalk.gray('   npm run wallet:send -- --from ./wallets/my-wallet.json --to <recipient-address> --amount 0.5\n'));
  });

// Display banner
console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════════╗
║                   🚀 Solana Token Creator                     ║
║              Educational SPL Token with Bonding Curves        ║
╚════════════════════════════════════════════════════════════════╝
`));

console.log(chalk.yellow('📚 Educational Project - Devnet/Testnet Only'));
console.log(chalk.gray('Use "examples" command to see usage examples\n'));

// Parse command line arguments
program.parse();