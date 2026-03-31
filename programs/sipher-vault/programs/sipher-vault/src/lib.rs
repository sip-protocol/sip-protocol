//! Sipher Vault - Agentic privacy mixer vault for Solana
//!
//! Deposit-first mixer: agents deposit tokens into a shared PDA vault,
//! then withdraw privately to stealth addresses with Pedersen commitments.
//!
//! ## Instructions
//!
//! - `initialize` — Create VaultConfig PDA with fee and timeout settings
//! - `create_vault_token` — Create vault token PDA for a given mint
//! - `create_fee_token` — Create fee token PDA for a given mint
//! - `deposit` — Transfer tokens from user to vault PDA, create/update DepositRecord
//! - `withdraw_private` — Debit-first withdrawal to stealth address + fee split
//! - `refund` — Return available (unlocked) balance to depositor
//! - `collect_fee` — Authority-only fee withdrawal

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::VaultError;
use state::{DepositRecord, VaultConfig};

declare_id!("S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB");

// ─────────────────────────────────────────────────────────────────────────────
// Program
// ─────────────────────────────────────────────────────────────────────────────

#[program]
pub mod sipher_vault {
  use super::*;

  /// Create the vault config PDA. Called once per deployment.
  pub fn initialize(
    ctx: Context<Initialize>,
    fee_bps: u16,
    refund_timeout: i64,
  ) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, VaultError::FeeTooHigh);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_bps = fee_bps;
    config.refund_timeout = if refund_timeout > 0 { refund_timeout } else { DEFAULT_REFUND_TIMEOUT };
    config.paused = false;
    config.total_deposits = 0;
    config.total_depositors = 0;
    config.bump = ctx.bumps.config;

    msg!("Vault initialized: fee={}bps, timeout={}s", fee_bps, refund_timeout);
    Ok(())
  }

  /// Create the vault token PDA for a given mint.
  /// Anyone can call this (first depositor pays rent). Must be called before deposit.
  pub fn create_vault_token(ctx: Context<CreateVaultToken>) -> Result<()> {
    msg!(
      "Vault token PDA created for mint {}",
      ctx.accounts.token_mint.key()
    );
    Ok(())
  }

  /// Create the fee token PDA for a given mint.
  /// Anyone can call this. Must exist before withdraw_private.
  pub fn create_fee_token(ctx: Context<CreateFeeToken>) -> Result<()> {
    msg!(
      "Fee token PDA created for mint {}",
      ctx.accounts.token_mint.key()
    );
    Ok(())
  }

  /// Deposit tokens into the vault. Creates DepositRecord on first deposit.
  pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);
    require!(amount > 0, VaultError::ZeroDeposit);

    // Transfer tokens from depositor to vault
    let transfer_ctx = CpiContext::new(
      ctx.accounts.token_program.to_account_info(),
      Transfer {
        from: ctx.accounts.depositor_token.to_account_info(),
        to: ctx.accounts.vault_token.to_account_info(),
        authority: ctx.accounts.depositor.to_account_info(),
      },
    );
    token::transfer(transfer_ctx, amount)?;

    // Update deposit record
    let record = &mut ctx.accounts.deposit_record;
    let is_new = record.balance == 0 && record.cumulative_volume == 0;

    record.depositor = ctx.accounts.depositor.key();
    record.token_mint = ctx.accounts.token_mint.key();
    record.balance = record.balance
      .checked_add(amount)
      .ok_or(VaultError::MathOverflow)?;
    record.cumulative_volume = record.cumulative_volume
      .checked_add(amount)
      .ok_or(VaultError::MathOverflow)?;
    record.last_deposit_at = Clock::get()?.unix_timestamp;
    record.bump = ctx.bumps.deposit_record;

    // Update global counters
    let config = &mut ctx.accounts.config;
    config.total_deposits = config.total_deposits.saturating_add(1);
    if is_new {
      config.total_depositors = config.total_depositors
        .checked_add(1)
        .ok_or(VaultError::MathOverflow)?;
    }

    msg!("Deposited {} tokens", amount);
    Ok(())
  }

  /// Withdraw privately to a stealth address. Debit-first pattern:
  /// 1. Debit depositor balance
  /// 2. Compute fee
  /// 3. Transfer net amount to stealth token account
  /// 4. Transfer fee to fee token account
  /// 5. Emit VaultWithdrawEvent
  pub fn withdraw_private(
    ctx: Context<WithdrawPrivate>,
    amount: u64,
    amount_commitment: [u8; 33],
    stealth_pubkey: Pubkey,
    ephemeral_pubkey: [u8; 33],
    viewing_key_hash: [u8; 32],
    _encrypted_amount: Vec<u8>,
    _proof: Vec<u8>,
  ) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);
    require!(amount > 0, VaultError::ZeroDeposit);

    // 1. Debit-first: reduce balance before any transfers
    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance
      .checked_sub(record.locked_amount)
      .ok_or(VaultError::MathOverflow)?;
    require!(available >= amount, VaultError::InsufficientBalance);

    record.balance = record.balance
      .checked_sub(amount)
      .ok_or(VaultError::MathOverflow)?;

    // 2. Compute fee
    let fee = (amount as u128)
      .checked_mul(ctx.accounts.config.fee_bps as u128)
      .ok_or(VaultError::MathOverflow)?
      .checked_div(10_000)
      .ok_or(VaultError::MathOverflow)? as u64;
    let net_amount = amount
      .checked_sub(fee)
      .ok_or(VaultError::MathOverflow)?;

    // 3. Transfer net amount to stealth token account (PDA signs)
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    let transfer_to_stealth = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      Transfer {
        from: ctx.accounts.vault_token.to_account_info(),
        to: ctx.accounts.stealth_token.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      },
      signer_seeds,
    );
    token::transfer(transfer_to_stealth, net_amount)?;

    // 4. Transfer fee to fee token account (PDA signs)
    if fee > 0 {
      let transfer_fee = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
          from: ctx.accounts.vault_token.to_account_info(),
          to: ctx.accounts.fee_token.to_account_info(),
          authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
      );
      token::transfer(transfer_fee, fee)?;
    }

    // 5. Emit event
    emit!(VaultWithdrawEvent {
      depositor: ctx.accounts.depositor.key(),
      stealth_recipient: stealth_pubkey,
      amount_commitment,
      ephemeral_pubkey,
      viewing_key_hash,
      transfer_amount: net_amount,
      fee_amount: fee,
      timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Private withdrawal: {} net, {} fee", net_amount, fee);
    Ok(())
  }

  /// Refund available (unlocked) balance back to depositor.
  pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance
      .checked_sub(record.locked_amount)
      .ok_or(VaultError::MathOverflow)?;
    require!(available > 0, VaultError::NothingToRefund);

    // Check refund timeout
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
      .checked_sub(record.last_deposit_at)
      .ok_or(VaultError::MathOverflow)?;
    require!(
      elapsed >= ctx.accounts.config.refund_timeout,
      VaultError::RefundNotExpired
    );

    // Transfer tokens back to depositor (PDA signs)
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    let transfer_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      Transfer {
        from: ctx.accounts.vault_token.to_account_info(),
        to: ctx.accounts.depositor_token.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      },
      signer_seeds,
    );
    token::transfer(transfer_ctx, available)?;

    // Zero out refunded balance
    record.balance = record.locked_amount;

    msg!("Refunded {} tokens", available);
    Ok(())
  }

  /// Authority-only: collect accumulated fees from the fee token account.
  /// Pass amount=0 to collect all available fees.
  pub fn collect_fee(ctx: Context<CollectFee>, amount: u64) -> Result<()> {
    let fee_balance = ctx.accounts.fee_token.amount;
    require!(fee_balance > 0, VaultError::NoFeesToCollect);
    let withdraw_amount = if amount == 0 || amount > fee_balance {
      fee_balance
    } else {
      amount
    };

    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    let transfer_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      Transfer {
        from: ctx.accounts.fee_token.to_account_info(),
        to: ctx.accounts.authority_token.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      },
      signer_seeds,
    );
    token::transfer(transfer_ctx, withdraw_amount)?;

    msg!("Collected {} fees", withdraw_amount);
    Ok(())
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Account Contexts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
  #[account(
    init,
    payer = authority,
    space = 8 + VaultConfig::INIT_SPACE,
    seeds = [VAULT_CONFIG_SEED],
    bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(mut)]
  pub authority: Signer<'info>,

  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateVaultToken<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    init,
    payer = payer,
    seeds = [VAULT_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub vault_token: Account<'info, TokenAccount>,

  pub token_mint: Account<'info, Mint>,

  #[account(mut)]
  pub payer: Signer<'info>,

  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateFeeToken<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    init,
    payer = payer,
    seeds = [FEE_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub fee_token: Account<'info, TokenAccount>,

  pub token_mint: Account<'info, Mint>,

  #[account(mut)]
  pub payer: Signer<'info>,

  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
  #[account(
    mut,
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    init_if_needed,
    payer = depositor,
    space = 8 + DepositRecord::INIT_SPACE,
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), token_mint.key().as_ref()],
    bump,
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    seeds = [VAULT_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub vault_token: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = depositor_token.owner == depositor.key() @ VaultError::Unauthorized,
    constraint = depositor_token.mint == token_mint.key() @ VaultError::InvalidMint,
  )]
  pub depositor_token: Account<'info, TokenAccount>,

  pub token_mint: Account<'info, Mint>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawPrivate<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), token_mint.key().as_ref()],
    bump = deposit_record.bump,
    has_one = depositor @ VaultError::Unauthorized,
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    seeds = [VAULT_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub vault_token: Account<'info, TokenAccount>,

  #[account(
    mut,
    seeds = [FEE_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub fee_token: Account<'info, TokenAccount>,

  /// The stealth token account to receive the net amount.
  /// Owned by any pubkey (the stealth address), we just verify the mint.
  #[account(
    mut,
    constraint = stealth_token.mint == token_mint.key() @ VaultError::InvalidMint,
  )]
  pub stealth_token: Account<'info, TokenAccount>,

  pub token_mint: Account<'info, Mint>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), deposit_record.token_mint.as_ref()],
    bump = deposit_record.bump,
    has_one = depositor @ VaultError::Unauthorized,
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    seeds = [VAULT_TOKEN_SEED, deposit_record.token_mint.as_ref()],
    bump,
    token::mint = deposit_record.token_mint,
    token::authority = config,
  )]
  pub vault_token: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = depositor_token.owner == depositor.key() @ VaultError::Unauthorized,
    constraint = depositor_token.mint == deposit_record.token_mint @ VaultError::InvalidMint,
  )]
  pub depositor_token: Account<'info, TokenAccount>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CollectFee<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority @ VaultError::Unauthorized,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    seeds = [FEE_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub fee_token: Account<'info, TokenAccount>,

  #[account(
    mut,
    constraint = authority_token.owner == authority.key() @ VaultError::Unauthorized,
    constraint = authority_token.mint == token_mint.key() @ VaultError::InvalidMint,
  )]
  pub authority_token: Account<'info, TokenAccount>,

  pub token_mint: Account<'info, Mint>,

  #[account(mut)]
  pub authority: Signer<'info>,

  pub token_program: Program<'info, Token>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

#[event]
pub struct VaultWithdrawEvent {
  pub depositor: Pubkey,
  pub stealth_recipient: Pubkey,
  pub amount_commitment: [u8; 33],
  pub ephemeral_pubkey: [u8; 33],
  pub viewing_key_hash: [u8; 32],
  pub transfer_amount: u64,
  pub fee_amount: u64,
  pub timestamp: i64,
}
