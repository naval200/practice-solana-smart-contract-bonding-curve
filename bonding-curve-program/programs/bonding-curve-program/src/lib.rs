use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo, Burn};
use anchor_spl::associated_token::AssociatedToken;

// Program ID will be generated when deploying
declare_id!("7312f8pgpoquo7RZnPh7hGnhyi4UAteW5Y2xwFonB6eR");

/**
 * Educational Bonding Curve SPL Token Program
 * 
 * This program implements a simple bonding curve mechanism for SPL tokens,
 * demonstrating core concepts similar to Pump.fun's functionality.
 * 
 * Key Features:
 * - Linear bonding curve pricing
 * - Token minting/burning based on SOL deposits/withdrawals  
 * - Automated price discovery
 * - Educational comments explaining each step
 * 
 * IMPORTANT: This is for educational purposes only!
 * Do not use in production without proper security audits.
 */

#[program]
pub mod bonding_curve_program {
    use super::*;

    /**
     * Initializes a new bonding curve for an SPL token
     * 
     * This function sets up the bonding curve parameters and creates the necessary
     * accounts for managing token sales/purchases through the curve.
     * 
     * Parameters:
     * - initial_price: Starting price in lamports per token (multiplied by 10^decimals)
     * - slope: How much the price increases per token minted (linear curve)
     * - name: Token name (for metadata)
     * - symbol: Token symbol (for metadata)
     * - uri: Metadata URI (can be empty for educational purposes)
     */
    pub fn initialize_bonding_curve(
        ctx: Context<InitializeBondingCurve>,
        initial_price: u64,      // Price in lamports per token
        slope: u64,              // Price increase per token minted
        bump: u8,                // PDA bump for the bonding curve account
        name: String,            // Token name
        symbol: String,          // Token symbol
        uri: String,             // Metadata URI
    ) -> Result<()> {
        // Validate input parameters to prevent common mistakes
        require!(initial_price > 0, BondingCurveError::InvalidPrice);
        require!(slope > 0, BondingCurveError::InvalidSlope);
        require!(name.len() <= 32, BondingCurveError::NameTooLong);
        require!(symbol.len() <= 10, BondingCurveError::SymbolTooLong);

        // Get the bonding curve account where we'll store curve parameters
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        
        // Store the curve parameters
        bonding_curve.token_mint = ctx.accounts.token_mint.key();
        bonding_curve.creator = ctx.accounts.creator.key();
        bonding_curve.initial_price = initial_price;
        bonding_curve.slope = slope;
        bonding_curve.current_supply = 0;
        bonding_curve.sol_reserves = 0;  // Track SOL collected from sales
        bonding_curve.bump = bump;
        bonding_curve.name = name;
        bonding_curve.symbol = symbol;
        bonding_curve.uri = uri;
        bonding_curve.created_at = Clock::get()?.unix_timestamp;

        // Emit an event for tracking and analytics
        emit!(BondingCurveInitialized {
            bonding_curve: bonding_curve.key(),
            token_mint: ctx.accounts.token_mint.key(),
            creator: ctx.accounts.creator.key(),
            initial_price,
            slope,
        });

        msg!("Bonding curve initialized for token: {}", ctx.accounts.token_mint.key());
        Ok(())
    }

    /**
     * Buy tokens using SOL through the bonding curve
     * 
     * This function implements the core bonding curve logic:
     * 1. Calculate how many tokens can be bought with the given SOL
     * 2. Update the token supply and SOL reserves
     * 3. Mint tokens to the buyer's associated token account
     * 
     * The price increases as more tokens are minted, creating scarcity.
     */
    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        sol_amount: u64,  // Amount of SOL to spend (in lamports)
    ) -> Result<()> {
        // Validate input
        require!(sol_amount > 0, BondingCurveError::InvalidAmount);

        let bonding_curve = &ctx.accounts.bonding_curve;
        
        // Calculate how many tokens can be purchased with the given SOL
        // Using linear bonding curve: price = initial_price + (supply * slope)
        let tokens_to_mint = calculate_tokens_for_sol(
            sol_amount,
            bonding_curve.current_supply,
            bonding_curve.initial_price,
            bonding_curve.slope,
        )?;

        // Ensure we're minting at least some tokens (prevent dust transactions)
        require!(tokens_to_mint > 0, BondingCurveError::InsufficientSol);

        // Calculate the actual SOL cost for these tokens (may be less than input)
        let actual_sol_cost = calculate_sol_for_tokens(
            tokens_to_mint,
            bonding_curve.current_supply,
            bonding_curve.initial_price,
            bonding_curve.slope,
        )?;

        // Transfer SOL from buyer to the bonding curve's SOL vault
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.sol_vault.to_account_info(),
        };
        
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        );
        
        anchor_lang::system_program::transfer(cpi_context, actual_sol_cost)?;

        // Mint tokens to the buyer's associated token account
        let token_mint_key = ctx.accounts.token_mint.key();
        let seeds = &[
            b"bonding_curve",
            token_mint_key.as_ref(),
            &[bonding_curve.bump],
        ];
        let signer = &[&seeds[..]];

        let mint_instruction = MintTo {
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            mint_instruction,
            signer,
        );

        token::mint_to(cpi_context, tokens_to_mint)?;

        // Update bonding curve state
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.current_supply = bonding_curve.current_supply
            .checked_add(tokens_to_mint)
            .ok_or(BondingCurveError::SupplyOverflow)?;
        
        bonding_curve.sol_reserves = bonding_curve.sol_reserves
            .checked_add(actual_sol_cost)
            .ok_or(BondingCurveError::ReservesOverflow)?;

        // Calculate new price for display/events
        let new_price = bonding_curve.initial_price
            .checked_add(bonding_curve.current_supply.checked_mul(bonding_curve.slope).unwrap())
            .unwrap();

        // Emit event for tracking
        emit!(TokensPurchased {
            buyer: ctx.accounts.buyer.key(),
            bonding_curve: bonding_curve.key(),
            tokens_minted: tokens_to_mint,
            sol_spent: actual_sol_cost,
            new_supply: bonding_curve.current_supply,
            new_price,
        });

        msg!("Tokens purchased: {} tokens for {} lamports", tokens_to_mint, actual_sol_cost);
        Ok(())
    }

    /**
     * Sell tokens back to the bonding curve for SOL
     * 
     * This function allows users to sell their tokens back to the curve:
     * 1. Calculate how much SOL the tokens are worth at current price
     * 2. Burn the tokens from the seller's account
     * 3. Transfer SOL from reserves to the seller
     * 
     * The price decreases as tokens are burned, maintaining the curve.
     */
    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        token_amount: u64,  // Amount of tokens to sell
    ) -> Result<()> {
        // Validate input
        require!(token_amount > 0, BondingCurveError::InvalidAmount);

        let bonding_curve = &mut ctx.accounts.bonding_curve;
        
        // Ensure we have enough supply to burn
        require!(
            bonding_curve.current_supply >= token_amount,
            BondingCurveError::InsufficientSupply
        );

        // Calculate SOL to return for these tokens
        // We calculate based on the current supply minus the tokens being sold
        let sol_to_return = calculate_sol_for_tokens(
            token_amount,
            bonding_curve.current_supply.checked_sub(token_amount).unwrap(),
            bonding_curve.initial_price,
            bonding_curve.slope,
        )?;

        // Ensure we have enough SOL reserves to pay out
        require!(
            bonding_curve.sol_reserves >= sol_to_return,
            BondingCurveError::InsufficientReserves
        );

        // Burn tokens from the seller's account
        let burn_instruction = Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };

        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            burn_instruction,
        );

        token::burn(cpi_context, token_amount)?;

        // Transfer SOL from vault to seller
        **ctx.accounts.sol_vault.to_account_info().try_borrow_mut_lamports()? -= sol_to_return;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += sol_to_return;

        // Update bonding curve state
        bonding_curve.current_supply = bonding_curve.current_supply
            .checked_sub(token_amount)
            .ok_or(BondingCurveError::SupplyUnderflow)?;
        
        bonding_curve.sol_reserves = bonding_curve.sol_reserves
            .checked_sub(sol_to_return)
            .ok_or(BondingCurveError::ReservesUnderflow)?;

        // Calculate new price
        let new_price = bonding_curve.initial_price
            .checked_add(bonding_curve.current_supply.checked_mul(bonding_curve.slope).unwrap())
            .unwrap();

        // Emit event
        emit!(TokensSold {
            seller: ctx.accounts.seller.key(),
            bonding_curve: bonding_curve.key(),
            tokens_burned: token_amount,
            sol_received: sol_to_return,
            new_supply: bonding_curve.current_supply,
            new_price,
        });

        msg!("Tokens sold: {} tokens for {} lamports", token_amount, sol_to_return);
        Ok(())
    }

    /**
     * Get current token price based on supply
     * This is a view function that doesn't modify state
     */
    pub fn get_current_price(ctx: Context<GetPrice>) -> Result<u64> {
        let bonding_curve = &ctx.accounts.bonding_curve;
        
        let current_price = bonding_curve.initial_price
            .checked_add(bonding_curve.current_supply.checked_mul(bonding_curve.slope).unwrap())
            .ok_or(BondingCurveError::PriceOverflow)?;

        msg!("Current price: {} lamports per token", current_price);
        Ok(current_price)
    }
}

/**
 * ACCOUNT CONTEXTS
 * These define the required accounts for each instruction
 */

#[derive(Accounts)]
#[instruction(initial_price: u64, slope: u64, bump: u8)]
pub struct InitializeBondingCurve<'info> {
    /// The creator/authority of the bonding curve
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The token mint that will be managed by the bonding curve
    #[account(
        init,
        payer = creator,
        mint::decimals = 9,  // Standard SPL token decimals
        mint::authority = bonding_curve,  // Bonding curve can mint/burn
    )]
    pub token_mint: Account<'info, Mint>,

    /// The bonding curve state account (PDA)
    #[account(
        init,
        payer = creator,
        space = BondingCurve::LEN,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    /// Vault to hold SOL reserves from token sales
    /// CHECK: This is a PDA that will hold SOL
    #[account(
        mut,
        seeds = [b"sol_vault", bonding_curve.key().as_ref()],
        bump
    )]
    pub sol_vault: AccountInfo<'info>,

    // Required programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction()]
pub struct BuyTokens<'info> {
    /// The buyer of tokens
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// The bonding curve state
    #[account(
        mut,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    /// The token mint
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    /// Buyer's associated token account (created if needed)
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// SOL vault to receive payment
    /// CHECK: This is a PDA that holds SOL
    #[account(
        mut,
        seeds = [b"sol_vault", bonding_curve.key().as_ref()],
        bump
    )]
    pub sol_vault: AccountInfo<'info>,

    // Required programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    /// The seller of tokens
    #[account(mut)]
    pub seller: Signer<'info>,

    /// The bonding curve state
    #[account(
        mut,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump = bonding_curve.bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    /// The token mint
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,

    /// Seller's token account (must exist with tokens)
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = seller
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// SOL vault to pay seller from
    /// CHECK: This is a PDA that holds SOL
    #[account(
        mut,
        seeds = [b"sol_vault", bonding_curve.key().as_ref()],
        bump
    )]
    pub sol_vault: AccountInfo<'info>,

    // Required programs
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetPrice<'info> {
    /// The bonding curve to check price for
    pub bonding_curve: Account<'info, BondingCurve>,
}

/**
 * ACCOUNT DATA STRUCTURES
 */

#[account]
pub struct BondingCurve {
    /// The token mint this curve manages
    pub token_mint: Pubkey,
    /// Creator/authority of the curve
    pub creator: Pubkey,
    /// Initial price in lamports per token
    pub initial_price: u64,
    /// Price increase per token minted (slope)
    pub slope: u64,
    /// Current total supply of tokens
    pub current_supply: u64,
    /// SOL reserves held by the curve
    pub sol_reserves: u64,
    /// PDA bump seed
    pub bump: u8,
    /// Token name
    pub name: String,
    /// Token symbol  
    pub symbol: String,
    /// Metadata URI
    pub uri: String,
    /// Creation timestamp
    pub created_at: i64,
}

impl BondingCurve {
    // Calculate space needed for the account
    // 8 discriminator + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 4+32 + 4+10 + 4+200 + 8 = ~365 bytes
    // Round up to 400 for safety
    pub const LEN: usize = 400;
}

/**
 * EVENTS
 * These events are emitted for tracking and analytics
 */

#[event]
pub struct BondingCurveInitialized {
    pub bonding_curve: Pubkey,
    pub token_mint: Pubkey,
    pub creator: Pubkey,
    pub initial_price: u64,
    pub slope: u64,
}

#[event]
pub struct TokensPurchased {
    pub buyer: Pubkey,
    pub bonding_curve: Pubkey,
    pub tokens_minted: u64,
    pub sol_spent: u64,
    pub new_supply: u64,
    pub new_price: u64,
}

#[event]
pub struct TokensSold {
    pub seller: Pubkey,
    pub bonding_curve: Pubkey,
    pub tokens_burned: u64,
    pub sol_received: u64,
    pub new_supply: u64,
    pub new_price: u64,
}

/**
 * ERROR CODES
 * Custom error types for better error handling
 */

#[error_code]
pub enum BondingCurveError {
    #[msg("Invalid price parameter")]
    InvalidPrice,
    #[msg("Invalid slope parameter")]
    InvalidSlope,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Token name too long")]
    NameTooLong,
    #[msg("Token symbol too long")]
    SymbolTooLong,
    #[msg("Insufficient SOL for purchase")]
    InsufficientSol,
    #[msg("Insufficient token supply")]
    InsufficientSupply,
    #[msg("Insufficient SOL reserves")]
    InsufficientReserves,
    #[msg("Supply overflow")]
    SupplyOverflow,
    #[msg("Supply underflow")]
    SupplyUnderflow,
    #[msg("Reserves overflow")]
    ReservesOverflow,
    #[msg("Reserves underflow")]
    ReservesUnderflow,
    #[msg("Price calculation overflow")]
    PriceOverflow,
    #[msg("Math overflow in calculations")]
    MathOverflow,
}

/**
 * HELPER FUNCTIONS
 * Mathematical functions for bonding curve calculations
 */

/// Calculate how many tokens can be bought with a given amount of SOL
/// Uses the integral of the linear bonding curve
fn calculate_tokens_for_sol(
    sol_amount: u64,
    current_supply: u64,
    initial_price: u64,
    slope: u64,
) -> Result<u64> {
    // For a linear bonding curve: price = initial_price + supply * slope
    // The integral (area under curve) gives us the total cost
    // We solve: sol_amount = initial_price * tokens + slope * (current_supply * tokens + tokens^2 / 2)
    
    // Simplified approximation for educational purposes
    // In production, you'd want more precise math handling edge cases
    
    let current_price = initial_price
        .checked_add(current_supply.checked_mul(slope).unwrap())
        .unwrap();
    
    // For small purchases, approximate with current price
    let tokens = sol_amount
        .checked_div(current_price)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    Ok(tokens)
}

/// Calculate how much SOL is needed to buy a specific number of tokens
fn calculate_sol_for_tokens(
    token_amount: u64,
    current_supply: u64,
    initial_price: u64,
    slope: u64,
) -> Result<u64> {
    // Calculate the area under the bonding curve
    // From current_supply to current_supply + token_amount
    
    let start_price = initial_price
        .checked_add(current_supply.checked_mul(slope).unwrap())
        .unwrap();
    
    let end_price = initial_price
        .checked_add((current_supply.checked_add(token_amount).unwrap()).checked_mul(slope).unwrap())
        .unwrap();
    
    // Use average price * quantity as approximation
    let average_price = (start_price.checked_add(end_price).unwrap())
        .checked_div(2)
        .unwrap();
    
    let total_cost = average_price
        .checked_mul(token_amount)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    Ok(total_cost)
}
