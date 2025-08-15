use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use anchor_spl::associated_token::AssociatedToken;

// Program ID
declare_id!("GQQQNJZdqKnFwB6di7u2PnsJZLX7hzaYW4g4b5BeQ3nE");

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
        name: String,            // Token name
        symbol: String,          // Token symbol
    ) -> Result<()> {
        // Validate input parameters to prevent common mistakes
        require!(initial_price > 0, BondingCurveError::InvalidPrice);
        require!(slope > 0, BondingCurveError::InvalidSlope);
        require!(name.len() <= 32, BondingCurveError::NameTooLong);
        require!(symbol.len() <= 10, BondingCurveError::SymbolTooLong);

        // Initialize bonding curve state
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.creator = ctx.accounts.creator.key();
        bonding_curve.token_mint = ctx.accounts.token_mint.key();
        bonding_curve.current_supply = 0;
        bonding_curve.sol_reserves = 0;
        bonding_curve.initial_price = initial_price;
        bonding_curve.slope = slope;
        bonding_curve.bump = ctx.bumps.bonding_curve;

        // Convert name and symbol to fixed-size arrays (further optimized)
        let name_slice = name.as_bytes();
        let symbol_slice = symbol.as_bytes();
        
        // Initialize arrays with zeros and copy data
        let mut name_bytes = [0u8; 32];
        let mut symbol_bytes = [0u8; 8];
        
        name_bytes[..name_slice.len().min(32)].copy_from_slice(&name_slice[..name_slice.len().min(32)]);
        symbol_bytes[..symbol_slice.len().min(8)].copy_from_slice(&symbol_slice[..symbol_slice.len().min(8)]);

        bonding_curve.name = name_bytes;
        bonding_curve.symbol = symbol_bytes;

        // Transfer initial rent to SOL vault
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(0);
        
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.sol_vault.to_account_info(),
                },
            ),
            rent_lamports,
        )?;

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
        let tokens_to_mint = calculate_tokens_for_sol(
            sol_amount,
            bonding_curve.current_supply,
            bonding_curve.initial_price,
            bonding_curve.slope,
        )?;

        // Transfer SOL to vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.sol_vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, sol_amount)?;

        // Mint tokens to buyer
        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.bonding_curve.to_account_info(),
            },
        );
        token::mint_to(
            cpi_context.with_signer(&[&[
                b"bonding_curve",
                ctx.accounts.token_mint.key().as_ref(),
                &[bonding_curve.bump],
            ]]),
            tokens_to_mint,
        )?;

        // Update bonding curve state
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.current_supply = bonding_curve.current_supply.checked_add(tokens_to_mint).unwrap();
        bonding_curve.sol_reserves = bonding_curve.sol_reserves.checked_add(sol_amount).unwrap();

        // Calculate the new price after the purchase
        let new_price = bonding_curve.initial_price
            .checked_add(bonding_curve.current_supply.checked_mul(bonding_curve.slope).unwrap())
            .unwrap();

        // Emit purchase event for tracking and analytics
        emit!(TokensPurchased {
            buyer: ctx.accounts.buyer.key(),
            bonding_curve: bonding_curve.key(),
            tokens_minted: tokens_to_mint,
            sol_spent: sol_amount,
            new_supply: bonding_curve.current_supply,
            new_price,
        });

        // Log the purchase details
        msg!(
            "Tokens purchased: {} tokens for {} lamports",
            tokens_to_mint,
            sol_amount
        );

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

        let bonding_curve = &ctx.accounts.bonding_curve;
        
        // Calculate SOL to return based on bonding curve
        // For selling, we calculate the value of tokens being sold based on their position in the curve
        // We calculate the area under the curve from (current_supply - token_amount) to current_supply
        let new_supply_after_sale = bonding_curve.current_supply
            .checked_sub(token_amount)
            .ok_or(BondingCurveError::InsufficientSupply)?;
            
        let sol_to_return = calculate_sol_for_tokens(
            token_amount,
            new_supply_after_sale,
            bonding_curve.initial_price,
            bonding_curve.slope,
        )?;

        // Ensure we have enough SOL in reserves
        require!(
            bonding_curve.sol_reserves >= sol_to_return,
            BondingCurveError::InsufficientReserves
        );

        // Burn tokens from seller
        let cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.token_mint.to_account_info(),
                from: ctx.accounts.seller_token_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        );
        token::burn(cpi_context, token_amount)?;

        // Transfer SOL from vault to seller
        let token_mint_key = ctx.accounts.token_mint.key();
        let seeds = &[
            b"sol_vault",
            token_mint_key.as_ref(),
            &[ctx.bumps.sol_vault],
        ];
        let signer = &[&seeds[..]];

        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.sol_vault.to_account_info(),
            to: ctx.accounts.seller.to_account_info(),
        };
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
            signer,
        );
        anchor_lang::system_program::transfer(cpi_context, sol_to_return)?;

        // Update bonding curve state
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.current_supply = bonding_curve.current_supply.checked_sub(token_amount).unwrap();
        bonding_curve.sol_reserves = bonding_curve.sol_reserves.checked_sub(sol_to_return).unwrap();

        // Calculate the new price after the sale
        let new_price = bonding_curve.initial_price
            .checked_add(bonding_curve.current_supply.checked_mul(bonding_curve.slope).unwrap())
            .unwrap();

        // Emit sale event for tracking and analytics
        emit!(TokensSold {
            seller: ctx.accounts.seller.key(),
            bonding_curve: bonding_curve.key(),
            tokens_burned: token_amount,
            sol_received: sol_to_return,
            new_supply: bonding_curve.current_supply,
            new_price,
        });

        // Log the sale details
        msg!(
            "Tokens sold: {} tokens for {} lamports",
            token_amount,
            sol_to_return
        );

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
#[instruction(initial_price: u64, slope: u64, name: String, symbol: String)]
pub struct InitializeBondingCurve<'info> {
    /// The creator of the bonding curve
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The token mint
    #[account(
        init,
        payer = creator,
        mint::decimals = 0,
        mint::authority = bonding_curve,
        mint::freeze_authority = bonding_curve,
    )]
    pub token_mint: Account<'info, Mint>,

    /// The bonding curve state
    #[account(
        init,
        payer = creator,
        space = BondingCurve::LEN,
        seeds = [b"bonding_curve", token_mint.key().as_ref()],
        bump
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    /// SOL vault to receive payment
    /// CHECK: This is a PDA that holds SOL
    #[account(
        mut,
        seeds = [b"sol_vault", token_mint.key().as_ref()],
        bump
    )]
    pub sol_vault: AccountInfo<'info>,

    // Required programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializeBondingCurve<'info> {
    pub fn validate(&self) -> Result<()> {
        Ok(())
    }
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
        seeds = [b"sol_vault", token_mint.key().as_ref()],
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
#[instruction()]
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

    /// Seller's token account
    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// SOL vault to send payment from
    /// CHECK: This is a PDA that holds SOL
    #[account(
        mut,
        seeds = [b"sol_vault", token_mint.key().as_ref()],
        bump
    )]
    pub sol_vault: AccountInfo<'info>,

    // Required programs
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
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
    /// The creator/authority of the bonding curve
    pub creator: Pubkey,
    /// The token mint that this bonding curve manages
    pub token_mint: Pubkey,
    /// Current total supply of tokens
    pub current_supply: u64,
    /// Current SOL reserves
    pub sol_reserves: u64,
    /// Initial price in lamports
    pub initial_price: u64,
    /// Price slope in lamports
    pub slope: u64,
    /// PDA bump seed
    pub bump: u8,
    /// Token name
    pub name: [u8; 32],
    /// Token symbol
    pub symbol: [u8; 8],
}

impl BondingCurve {
    pub const LEN: usize = 8 + // Discriminator
        32 + // creator
        32 + // token_mint
        8 + // current_supply
        8 + // sol_reserves
        8 + // initial_price
        8 + // slope
        1 + // bump
        32 + // name
        8; // symbol
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
/// Solves the quadratic equation that arises from the bonding curve integral
fn calculate_tokens_for_sol(
    sol_amount: u64,
    current_supply: u64,
    initial_price: u64,
    slope: u64,
) -> Result<u64> {
    // For a linear bonding curve: price = initial_price + supply * slope
    // The integral gives us: sol_amount = initial_price * tokens + slope * (current_supply * tokens + tokens^2 / 2)
    // Rearranging: (slope/2) * tokens^2 + (initial_price + slope * current_supply) * tokens - sol_amount = 0
    
    if slope == 0 {
        // If slope is 0, it's a flat curve: sol_amount = initial_price * tokens
        return sol_amount
            .checked_div(initial_price)
            .ok_or(BondingCurveError::MathOverflow.into());
    }
    
    // Optimized calculation to reduce stack usage
    // Calculate b = 2 * (initial_price + slope * current_supply)
    let slope_times_supply = slope
        .checked_mul(current_supply)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    let b = initial_price
        .checked_add(slope_times_supply)
        .ok_or(BondingCurveError::MathOverflow)?
        .checked_mul(2)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    // Calculate 4ac where a = slope and c = -2 * sol_amount
    let four_ac = slope
        .checked_mul(sol_amount)
        .ok_or(BondingCurveError::MathOverflow)?
        .checked_mul(8) // 4 * 2 = 8
        .ok_or(BondingCurveError::MathOverflow)?;
    
    // Calculate discriminant: b^2 + 4ac
    let b_squared = b.checked_mul(b).ok_or(BondingCurveError::MathOverflow)?;
    let discriminant = b_squared
        .checked_add(four_ac)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    // Calculate sqrt(discriminant)
    let sqrt_discriminant = integer_sqrt(discriminant);
    
    // Calculate tokens = (-b + sqrt(discriminant)) / (2a)
    // Since b > 0 and we want positive result, we need sqrt_discriminant > b
    if sqrt_discriminant <= b {
        return Ok(0); // Not enough SOL to buy any tokens
    }
    
    let numerator = sqrt_discriminant.checked_sub(b).unwrap();
    let denominator = slope.checked_mul(2).unwrap(); // 2a where a = slope
    let tokens = numerator.checked_div(denominator).unwrap_or(0);
    
    Ok(tokens)
}

/// Integer square root approximation using binary search
fn integer_sqrt(n: u64) -> u64 {
    if n == 0 {
        return 0;
    }
    
    // Optimized binary search to reduce stack usage
    let mut left = 1u64;
    let mut right = n;
    let mut result = 0u64;
    
    while left <= right {
        let mid = left + (right - left) / 2;
        
        // Check for overflow and calculate mid_squared
        if let Some(mid_squared) = mid.checked_mul(mid) {
            if mid_squared == n {
                return mid;
            } else if mid_squared < n {
                left = mid + 1;
                result = mid;
            } else {
                right = mid - 1;
            }
        } else {
            // Overflow occurred, reduce right boundary
            right = mid - 1;
        }
    }
    
    result
}

/// Calculate how much SOL is needed to buy a specific number of tokens
/// This uses the integral of the linear bonding curve to calculate the area under the curve
fn calculate_sol_for_tokens(
    token_amount: u64,
    current_supply: u64,
    initial_price: u64,
    slope: u64,
) -> Result<u64> {
    // For a linear bonding curve: price = initial_price + supply * slope
    // To calculate the total cost for token_amount tokens, we need to integrate
    // the price function from current_supply to current_supply + token_amount
    
    // The integral of (initial_price + (current_supply + x) * slope) dx from 0 to token_amount is:
    // initial_price * token_amount + slope * (current_supply * token_amount + token_amount^2 / 2)
    
    // Optimized calculation to reduce stack usage
    // Calculate base_cost = initial_price * token_amount
    let base_cost = initial_price
        .checked_mul(token_amount)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    // Calculate supply_cost = slope * current_supply * token_amount
    let supply_cost = slope
        .checked_mul(current_supply)
        .ok_or(BondingCurveError::MathOverflow)?
        .checked_mul(token_amount)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    // Calculate quadratic_cost = slope * token_amount^2 / 2
    let token_squared = token_amount
        .checked_mul(token_amount)
        .ok_or(BondingCurveError::MathOverflow)?;
    let quadratic_cost = slope
        .checked_mul(token_squared)
        .ok_or(BondingCurveError::MathOverflow)?
        .checked_div(2)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    // Total cost = base_cost + supply_cost + quadratic_cost
    let total_cost = base_cost
        .checked_add(supply_cost)
        .ok_or(BondingCurveError::MathOverflow)?
        .checked_add(quadratic_cost)
        .ok_or(BondingCurveError::MathOverflow)?;
    
    Ok(total_cost)
}
