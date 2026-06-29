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
//! - `refund` — Return available balance to depositor
//! - `collect_fee` — Authority-only token-fee withdrawal
//! - `collect_fee_sol` — Authority-only native-SOL fee withdrawal (above rent floor)
//! - `update_authority` / `accept_authority` — Two-step authority transfer
//! - `update_fee` — Authority-only fee update (capped at MAX_FEE_TENTHS_BPS)

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token_2022::spl_token_2022::{
  extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
  state::Mint as Token2022Mint,
};
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::VaultError;
use state::{DepositRecord, SolFee, SolVault, VaultConfig};

/// SIP Privacy program ID — used for CPI to create_transfer_announcement
/// S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at
pub const SIP_PRIVACY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    6, 103, 244, 183, 95, 66, 85, 178, 94, 77, 35, 31, 200, 4, 171, 142,
    239, 75, 239, 31, 200, 233, 194, 236, 6, 172, 102, 172, 187, 213, 122, 133,
]);

/// Seeds used by the sip_privacy program
pub const SIP_CONFIG_SEED: &[u8] = b"config";

/// Anchor instruction discriminator for `sip_privacy::create_transfer_announcement`
/// = `sha256("global:create_transfer_announcement")[..8]`.
///
/// Hardcoded as a constant — like `SIP_PRIVACY_PROGRAM_ID` above — because Anchor 1.0's
/// granular `solana_program` facade no longer re-exports a `hash` module. The value is
/// verified end-to-end by the `withdraw_private` / `withdraw_private_sol` bankrun CPI
/// tests: a wrong discriminator makes the announcement CPI fail.
pub const CREATE_TRANSFER_ANNOUNCEMENT_DISC: [u8; 8] =
  [0x9b, 0x34, 0xb1, 0x8f, 0xd3, 0x5b, 0xcd, 0x66];

/// Maximum byte length of the opaque `encrypted_amount` blob the withdrawal
/// paths accept. Mirrors the callee `sip_privacy`'s own cap (its
/// `TransferRecord.encrypted_amount` is `#[max_len(64)]`); the vault re-checks
/// it so an over-long blob fails fast with a vault-native error before the
/// debit. Keep in sync with sip_privacy if that cap ever changes.
pub const MAX_ENCRYPTED_AMOUNT_LEN: usize = 64;

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
    fee_tenths_bps: u16,
    refund_timeout: i64,
  ) -> Result<()> {
    require!(fee_tenths_bps <= MAX_FEE_TENTHS_BPS, VaultError::FeeTooHigh);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_tenths_bps = fee_tenths_bps;
    config.refund_timeout = if refund_timeout > 0 { refund_timeout } else { DEFAULT_REFUND_TIMEOUT };
    config.paused = false;
    config.total_deposits = 0;
    config.total_depositors = 0;
    config.bump = ctx.bumps.config;
    config.pending_authority = None;

    msg!("Vault initialized: fee={} tenths-bps, timeout={}s", fee_tenths_bps, refund_timeout);
    Ok(())
  }

  /// Create the vault token PDA for a given mint.
  /// Anyone can call this (first depositor pays rent). Must be called before deposit.
  ///
  /// For Token-2022 mints, a fail-closed extension allowlist is enforced.
  /// Only MetadataPointer, TokenMetadata, and InterestBearingConfig are allowed.
  /// Any other extension (TransferFeeConfig, PermanentDelegate, TransferHook,
  /// NonTransferable, DefaultAccountState, MintCloseAuthority, etc.) is rejected
  /// with UnsupportedMintExtension to protect the vault's transfer invariants.
  pub fn create_vault_token(ctx: Context<CreateVaultToken>) -> Result<()> {
    enforce_token2022_allowlist(&ctx.accounts.token_mint.to_account_info())?;

    msg!(
      "Vault token PDA created for mint {}",
      ctx.accounts.token_mint.key()
    );
    Ok(())
  }

  /// Create the fee token PDA for a given mint.
  /// Anyone can call this. Must exist before withdraw_private.
  pub fn create_fee_token(ctx: Context<CreateFeeToken>) -> Result<()> {
    // Mirror the create_vault_token allowlist (shared helper) so the two
    // token-PDA creation paths can never diverge on extension safety.
    enforce_token2022_allowlist(&ctx.accounts.token_mint.to_account_info())?;
    msg!(
      "Fee token PDA created for mint {}",
      ctx.accounts.token_mint.key()
    );
    Ok(())
  }

  /// Deposit native SOL into the vault. Creates DepositRecord keyed by
  /// (depositor, NATIVE_SOL_MINT) on first deposit; accumulates on repeat calls.
  pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);
    require!(amount > 0, VaultError::ZeroDeposit);

    // Transfer SOL from depositor to sol_vault PDA via system_program::transfer
    let cpi = CpiContext::new(
      ctx.accounts.system_program.key(),
      anchor_lang::system_program::Transfer {
        from: ctx.accounts.depositor.to_account_info(),
        to: ctx.accounts.sol_vault.to_account_info(),
      },
    );
    anchor_lang::system_program::transfer(cpi, amount)?;

    // Update deposit record
    let record = &mut ctx.accounts.deposit_record;
    let is_new = record.balance == 0 && record.cumulative_volume == 0;

    record.depositor = ctx.accounts.depositor.key();
    record.token_mint = NATIVE_SOL_MINT;
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

    msg!("Deposited {} lamports (native SOL)", amount);
    Ok(())
  }

  /// Create the singleton native-SOL vault + fee PDAs.
  /// Called once per deployment before any native-SOL deposits.
  /// Payer funds the rent-exempt reserve for both PDAs.
  pub fn create_sol_vault(ctx: Context<CreateSolVault>) -> Result<()> {
    ctx.accounts.sol_vault.bump = ctx.bumps.sol_vault;
    ctx.accounts.sol_fee.bump = ctx.bumps.sol_fee;
    msg!("SOL vault + fee PDAs created");
    Ok(())
  }

  /// Deposit tokens into the vault. Creates DepositRecord on first deposit.
  pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);
    require!(amount > 0, VaultError::ZeroDeposit);

    // Transfer tokens from depositor to vault
    let transfer_ctx = CpiContext::new(
      ctx.accounts.token_program.key(),
      TransferChecked {
        from: ctx.accounts.depositor_token.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.vault_token.to_account_info(),
        authority: ctx.accounts.depositor.to_account_info(),
      },
    );
    token_interface::transfer_checked(transfer_ctx, amount, ctx.accounts.token_mint.decimals)?;

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
  #[allow(clippy::too_many_arguments)]
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
    // Fail-fast before the debit: reject an over-long blob early with a
    // vault-native error. Mirrors the callee's cap (see MAX_ENCRYPTED_AMOUNT_LEN).
    require!(_encrypted_amount.len() <= MAX_ENCRYPTED_AMOUNT_LEN, VaultError::EncryptedAmountTooLong);

    // 1. Debit-first: reduce balance before any transfers
    let record = &mut ctx.accounts.deposit_record;
    require!(record.balance >= amount, VaultError::InsufficientBalance);

    record.balance = record.balance
      .checked_sub(amount)
      .ok_or(VaultError::MathOverflow)?;

    // 2. Compute fee
    let fee = (amount as u128)
      .checked_mul(ctx.accounts.config.fee_tenths_bps as u128)
      .ok_or(VaultError::MathOverflow)?
      .checked_div(FEE_TENTHS_BPS_DENOMINATOR)
      .ok_or(VaultError::MathOverflow)? as u64;
    let net_amount = amount
      .checked_sub(fee)
      .ok_or(VaultError::MathOverflow)?;

    // 3. Transfer net amount to stealth token account (PDA signs)
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    let transfer_to_stealth = CpiContext::new_with_signer(
      ctx.accounts.token_program.key(),
      TransferChecked {
        from: ctx.accounts.vault_token.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.stealth_token.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      },
      signer_seeds,
    );
    token_interface::transfer_checked(transfer_to_stealth, net_amount, ctx.accounts.token_mint.decimals)?;

    // 4. Transfer fee to fee token account (PDA signs)
    if fee > 0 {
      let transfer_fee = CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        TransferChecked {
          from: ctx.accounts.vault_token.to_account_info(),
          mint: ctx.accounts.token_mint.to_account_info(),
          to: ctx.accounts.fee_token.to_account_info(),
          authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
      );
      token_interface::transfer_checked(transfer_fee, fee, ctx.accounts.token_mint.decimals)?;
    }

    // 5. CPI to sip_privacy::create_transfer_announcement
    //    Creates a TransferRecord PDA so the payment is scannable by recipients.
    //    This is metadata-only — no token movement happens here.
    //    Shared with `withdraw_private_sol`; only the `mint` argument differs.
    emit_transfer_announcement(
      &ctx.accounts.sip_privacy_program,
      &ctx.accounts.sip_config,
      &ctx.accounts.sip_transfer_record,
      &ctx.accounts.depositor.to_account_info(),
      &ctx.accounts.system_program.to_account_info(),
      ctx.accounts.token_mint.key(),
      &amount_commitment,
      stealth_pubkey,
      &ephemeral_pubkey,
      &viewing_key_hash,
      &_encrypted_amount,
    )?;

    // 6. Emit event
    emit!(VaultWithdrawEvent {
      depositor: ctx.accounts.depositor.key(),
      mint: ctx.accounts.token_mint.key(),
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

  /// Withdraw native SOL privately to a stealth address. The native-track analog
  /// of `withdraw_private`. Debit-first pattern, then a **checked lamport mutation**
  /// of the program-owned `SolVault` PDA (no system CPI — the source is PDA-owned):
  ///   1. Guards: not paused, amount > 0.
  ///   2. Debit-first: reduce `DepositRecord.balance` before moving any lamports.
  ///   3. Fee split: fee = amount · fee_tenths_bps / 100_000, net = amount − fee.
  ///   4. Checked lamport mutation: compute every new balance with checked ops
  ///      (BPF release WRAPS on `+=`/`-=`, which would be a vault drain), enforce
  ///      the rent-reserve guard on the vault debit, THEN assign.
  ///   5. CPI `create_transfer_announcement` (shared helper, mint = NATIVE_SOL_MINT).
  ///   6. Emit `VaultWithdrawEvent` (mint = NATIVE_SOL_MINT).
  ///
  /// `encrypted_amount` / `proof` mirror the token signature — carried for
  /// announcement parity + off-chain verification; format-checked, unused on-chain.
  #[allow(clippy::too_many_arguments)]
  pub fn withdraw_private_sol(
    ctx: Context<WithdrawPrivateSol>,
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
    // Fail-fast before the debit: reject an over-long blob early with a
    // vault-native error. Mirrors the callee's cap (see MAX_ENCRYPTED_AMOUNT_LEN).
    require!(_encrypted_amount.len() <= MAX_ENCRYPTED_AMOUNT_LEN, VaultError::EncryptedAmountTooLong);

    // 1. Debit-first: reduce balance before any lamport movement.
    let record = &mut ctx.accounts.deposit_record;
    require!(record.balance >= amount, VaultError::InsufficientBalance);

    record.balance = record.balance
      .checked_sub(amount)
      .ok_or(VaultError::MathOverflow)?;

    // 2. Compute fee + net (checked).
    let fee = (amount as u128)
      .checked_mul(ctx.accounts.config.fee_tenths_bps as u128)
      .ok_or(VaultError::MathOverflow)?
      .checked_div(FEE_TENTHS_BPS_DENOMINATOR)
      .ok_or(VaultError::MathOverflow)? as u64;
    let net = amount
      .checked_sub(fee)
      .ok_or(VaultError::MathOverflow)?;

    // 3. CHECKED lamport mutation — the load-bearing safety code.
    //    BPF release mode silently WRAPS on `+=`/`-=` for u64, so a wrap here
    //    would be a vault drain. Compute every new value with checked ops and the
    //    rent-reserve guard FIRST, then assign via try_borrow_mut_lamports. Never
    //    use `**x -= n` / `**x += n` on these accounts.
    let vault_ai = ctx.accounts.sol_vault.to_account_info();
    let stealth_ai = ctx.accounts.stealth.to_account_info();
    let fee_ai = ctx.accounts.sol_fee.to_account_info();

    let new_vault = vault_ai.lamports()
      .checked_sub(amount)
      .ok_or(VaultError::MathOverflow)?;
    // Rent-reserve guard: the SolVault must never be drained below its own
    // rent-exempt minimum. Under correct accounting the reserve sits beneath all
    // depositor balances and is never reached; this is a fail-safe.
    let rent_min = Rent::get()?.minimum_balance(vault_ai.data_len());
    require!(new_vault >= rent_min, VaultError::RentReserveViolation);

    let new_stealth = stealth_ai.lamports()
      .checked_add(net)
      .ok_or(VaultError::MathOverflow)?;
    let new_fee = fee_ai.lamports()
      .checked_add(fee)
      .ok_or(VaultError::MathOverflow)?;

    **vault_ai.try_borrow_mut_lamports()? = new_vault;
    **stealth_ai.try_borrow_mut_lamports()? = new_stealth;
    **fee_ai.try_borrow_mut_lamports()? = new_fee;

    // 4. CPI announcement — shared helper, mint = NATIVE_SOL_MINT.
    emit_transfer_announcement(
      &ctx.accounts.sip_privacy_program,
      &ctx.accounts.sip_config,
      &ctx.accounts.sip_transfer_record,
      &ctx.accounts.depositor.to_account_info(),
      &ctx.accounts.system_program.to_account_info(),
      NATIVE_SOL_MINT,
      &amount_commitment,
      stealth_pubkey,
      &ephemeral_pubkey,
      &viewing_key_hash,
      &_encrypted_amount,
    )?;

    // 5. Emit event.
    emit!(VaultWithdrawEvent {
      depositor: ctx.accounts.depositor.key(),
      mint: NATIVE_SOL_MINT,
      stealth_recipient: stealth_pubkey,
      amount_commitment,
      ephemeral_pubkey,
      viewing_key_hash,
      transfer_amount: net,
      fee_amount: fee,
      timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Private SOL withdrawal: {} net, {} fee", net, fee);
    Ok(())
  }

  /// Refund available balance back to depositor.
  pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance;
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
      ctx.accounts.token_program.key(),
      TransferChecked {
        from: ctx.accounts.vault_token.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.depositor_token.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      },
      signer_seeds,
    );
    token_interface::transfer_checked(transfer_ctx, available, ctx.accounts.token_mint.decimals)?;

    // Zero out refunded balance
    record.balance = 0;

    msg!("Refunded {} tokens", available);
    Ok(())
  }

  /// Authority-signed refund: return available balance to depositor.
  /// Mirrors `refund` exactly except the authority signs instead of the depositor.
  /// Used by SENTINEL for autonomous refunds of expired deposits.
  /// Timeout is still enforced on-chain — authority does NOT bypass the cooldown.
  pub fn authority_refund(ctx: Context<AuthorityRefund>) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);

    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance;
    require!(available > 0, VaultError::NothingToRefund);

    // Enforce refund timeout — authority does NOT bypass the cooldown
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
      .checked_sub(record.last_deposit_at)
      .ok_or(VaultError::MathOverflow)?;
    require!(
      elapsed >= ctx.accounts.config.refund_timeout,
      VaultError::RefundNotExpired
    );

    // Transfer tokens from vault back to depositor's token account (PDA signs)
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    let transfer_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.key(),
      TransferChecked {
        from: ctx.accounts.vault_token.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.depositor_token.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      },
      signer_seeds,
    );
    token_interface::transfer_checked(transfer_ctx, available, ctx.accounts.token_mint.decimals)?;

    // Zero out refunded balance
    record.balance = 0;

    msg!("Authority refunded {} tokens to {}", available, ctx.accounts.depositor.key());
    Ok(())
  }

  /// Refund available native SOL balance back to the depositor.
  /// Depositor is the signer and the lamport destination.
  /// Timeout is enforced on-chain — the depositor must wait `refund_timeout` seconds
  /// since their last deposit before reclaiming funds.
  pub fn refund_sol(ctx: Context<RefundSol>) -> Result<()> {
    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance;
    require!(available > 0, VaultError::NothingToRefund);

    // Enforce refund timeout
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
      .checked_sub(record.last_deposit_at)
      .ok_or(VaultError::MathOverflow)?;
    require!(
      elapsed >= ctx.accounts.config.refund_timeout,
      VaultError::RefundNotExpired
    );

    // CHECKED lamport mutation: sol_vault → depositor.
    // BPF release mode silently WRAPS on `+=`/`-=` for u64 — compute all new
    // values with checked ops and enforce the rent-reserve guard FIRST, then assign.
    let vault_ai = ctx.accounts.sol_vault.to_account_info();
    let new_vault = vault_ai.lamports()
      .checked_sub(available)
      .ok_or(VaultError::MathOverflow)?;
    let rent_min = Rent::get()?.minimum_balance(vault_ai.data_len());
    require!(new_vault >= rent_min, VaultError::RentReserveViolation);
    let dep_ai = ctx.accounts.depositor.to_account_info();
    let new_dep = dep_ai.lamports()
      .checked_add(available)
      .ok_or(VaultError::MathOverflow)?;
    **vault_ai.try_borrow_mut_lamports()? = new_vault;
    **dep_ai.try_borrow_mut_lamports()? = new_dep;

    // Zero out the refunded balance.
    record.balance = 0;

    msg!("Refunded {} lamports (native SOL)", available);
    Ok(())
  }

  /// Authority-signed refund of available native SOL to the original depositor.
  /// Mirrors `refund_sol` exactly except:
  ///   - the authority signs instead of the depositor,
  ///   - `config` carries `has_one = authority` (so wrong authority → Unauthorized),
  ///   - the vault MUST NOT be paused (authority cannot bypass the emergency gate),
  ///   - `depositor` is a non-signer SystemAccount (lamport destination + seed source).
  /// Timeout is still enforced on-chain — authority does NOT bypass the cooldown.
  pub fn authority_refund_sol(ctx: Context<AuthorityRefundSol>) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);

    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance;
    require!(available > 0, VaultError::NothingToRefund);

    // Enforce refund timeout — authority does NOT bypass the cooldown
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
      .checked_sub(record.last_deposit_at)
      .ok_or(VaultError::MathOverflow)?;
    require!(
      elapsed >= ctx.accounts.config.refund_timeout,
      VaultError::RefundNotExpired
    );

    // CHECKED lamport mutation: sol_vault → depositor (identical pattern to refund_sol).
    let vault_ai = ctx.accounts.sol_vault.to_account_info();
    let new_vault = vault_ai.lamports()
      .checked_sub(available)
      .ok_or(VaultError::MathOverflow)?;
    let rent_min = Rent::get()?.minimum_balance(vault_ai.data_len());
    require!(new_vault >= rent_min, VaultError::RentReserveViolation);
    let dep_ai = ctx.accounts.depositor.to_account_info();
    let new_dep = dep_ai.lamports()
      .checked_add(available)
      .ok_or(VaultError::MathOverflow)?;
    **vault_ai.try_borrow_mut_lamports()? = new_vault;
    **dep_ai.try_borrow_mut_lamports()? = new_dep;

    // Zero out the refunded balance.
    record.balance = 0;

    msg!("Authority refunded {} lamports (native SOL) to {}", available, ctx.accounts.depositor.key());
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
      ctx.accounts.token_program.key(),
      TransferChecked {
        from: ctx.accounts.fee_token.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
        to: ctx.accounts.authority_token.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      },
      signer_seeds,
    );
    token_interface::transfer_checked(transfer_ctx, withdraw_amount, ctx.accounts.token_mint.decimals)?;

    msg!("Collected {} fees", withdraw_amount);
    Ok(())
  }

  /// Authority-only: drain lamports above the rent-exempt minimum from the native
  /// SOL fee PDA (`sol_fee`). Fees accrue during `withdraw_private_sol` (fee_tenths_bps
  /// per withdrawal). Pass `amount = 0` to collect ALL collectable lamports.
  ///
  /// Safety: Uses the Task-7 checked lamport mutation pattern — every new balance
  /// is computed with `checked_sub`/`checked_add` before any assignment. The rent
  /// floor of `sol_fee` is preserved; the instruction reverts with `NoFeesToCollect`
  /// if there is nothing above the floor.
  pub fn collect_fee_sol(ctx: Context<CollectFeeSol>, amount: u64) -> Result<()> {
    let fee_ai = ctx.accounts.sol_fee.to_account_info();
    let rent_min = Rent::get()?.minimum_balance(fee_ai.data_len());
    let collectable = fee_ai.lamports()
      .checked_sub(rent_min)
      .ok_or(VaultError::MathOverflow)?;
    require!(collectable > 0, VaultError::NoFeesToCollect);
    let take = if amount == 0 || amount > collectable { collectable } else { amount };
    let auth_ai = ctx.accounts.authority.to_account_info();
    let new_fee = fee_ai.lamports()
      .checked_sub(take)
      .ok_or(VaultError::MathOverflow)?;
    let new_auth = auth_ai.lamports()
      .checked_add(take)
      .ok_or(VaultError::MathOverflow)?;
    **fee_ai.try_borrow_mut_lamports()? = new_fee;
    **auth_ai.try_borrow_mut_lamports()? = new_auth;
    msg!("Collected {} native-SOL lamports from fee PDA", take);
    Ok(())
  }

  /// Pause or unpause the vault. Authority-only.
  ///
  /// While paused (`config.paused == true`), `deposit`, `withdraw_private`,
  /// `authority_refund`, `deposit_sol`, `withdraw_private_sol`, and
  /// `authority_refund_sol` revert with `VaultError::ProgramPaused`. The
  /// `refund`, `collect_fee`, `refund_sol`, and `collect_fee_sol` paths
  /// intentionally remain available so depositors can always self-recover funds
  /// and the authority can still drain accumulated fees during an emergency.
  ///
  /// Idempotent — calling with the current state is a no-op success.
  ///
  /// Emits `VaultPausedEvent` so off-chain monitoring (SENTINEL, audit
  /// log indexers, dashboards) can subscribe to state changes without
  /// log-parsing.
  pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    msg!("Vault paused = {}", paused);
    emit!(VaultPausedEvent {
      authority: ctx.accounts.authority.key(),
      paused,
      timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
  }

  /// Propose a new authority (step 1 of a two-step transfer). The current
  /// authority signs; the proposed key is recorded in `pending_authority` but
  /// does not take effect until it calls `accept_authority`. This lets the
  /// program hand control to e.g. a multisig without a redeploy, and lets a
  /// fat-fingered or compromised proposal be overwritten by another
  /// `update_authority` before it is ever accepted.
  pub fn update_authority(ctx: Context<UpdateAuthority>, new_authority: Pubkey) -> Result<()> {
    ctx.accounts.config.pending_authority = Some(new_authority);
    msg!("Authority transfer proposed: {}", new_authority);
    emit!(AuthorityTransferProposedEvent {
      current_authority: ctx.accounts.authority.key(),
      pending_authority: new_authority,
      timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
  }

  /// Accept a pending authority transfer (step 2). The proposed authority must
  /// sign — proving control of the key — before `config.authority` changes, so
  /// the authority can never be handed to a key nobody controls. Clears the
  /// pending slot on success.
  pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    require!(
      config.pending_authority == Some(ctx.accounts.new_authority.key()),
      VaultError::Unauthorized
    );
    let old_authority = config.authority;
    config.authority = ctx.accounts.new_authority.key();
    config.pending_authority = None;
    msg!("Authority transfer accepted: {}", config.authority);
    emit!(AuthorityUpdatedEvent {
      old_authority,
      new_authority: config.authority,
      timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
  }

  /// Update the protocol fee (tenths-of-bps). Authority-only, capped at
  /// MAX_FEE_TENTHS_BPS. Lets the authority adjust the fee without a redeploy.
  pub fn update_fee(ctx: Context<UpdateFee>, new_fee_tenths_bps: u16) -> Result<()> {
    require!(new_fee_tenths_bps <= MAX_FEE_TENTHS_BPS, VaultError::FeeTooHigh);
    let old_fee_tenths_bps = ctx.accounts.config.fee_tenths_bps;
    ctx.accounts.config.fee_tenths_bps = new_fee_tenths_bps;
    msg!("Fee updated: {} tenths-bps", new_fee_tenths_bps);
    emit!(FeeUpdatedEvent {
      authority: ctx.accounts.authority.key(),
      old_fee_tenths_bps,
      new_fee_tenths_bps,
      timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
  }

  /// Grow a legacy (pre-M1, 68-byte) VaultConfig to the current 101-byte layout
  /// by appending `pending_authority = None`. Authority-gated on every path,
  /// idempotent. Scoped to this one-time 68→101 migration: the accepted legacy
  /// size is pinned to `LEGACY_VAULT_CONFIG_LEN`. The mechanism (raw realloc +
  /// zero-fill of the appended region) would generalize to a future
  /// trailing-field migration, but that would require bumping that constant to
  /// the then-current size.
  ///
  /// The legacy account cannot be deserialized into `VaultConfig` (the trailing
  /// Option is absent → AccountDidNotDeserialize) and a renamed struct would fail
  /// the discriminator check, so `config` is a raw UncheckedAccount: the PDA is
  /// verified by seeds+bump and the authority is read manually from bytes [8..40]
  /// (the authority sits at the same offset in the legacy and current layout).
  pub fn migrate_config(ctx: Context<MigrateConfig>) -> Result<()> {
    let config = ctx.accounts.config.to_account_info();
    let new_len = 8 + VaultConfig::INIT_SPACE;
    let len = config.data_len();

    // Accept only a legacy account (to migrate) or an already-current account
    // (to no-op). Rejecting anything else up front also guarantees the [8..40]
    // authority read below is in bounds (both accepted sizes are ≥ 40).
    require!(
      len == LEGACY_VAULT_CONFIG_LEN || len >= new_len,
      VaultError::InvalidConfigAccount
    );

    // Authority gate FIRST — enforced on every valid path, including the no-op,
    // so the instruction is uniformly authority-gated. Read manually because the
    // legacy account cannot be deserialized into `VaultConfig`.
    {
      let data = config.try_borrow_data()?;
      let stored_authority = data
        .get(8..40)
        .and_then(|s| Pubkey::try_from(s).ok())
        .ok_or(VaultError::InvalidConfigAccount)?;
      require_keys_eq!(stored_authority, ctx.accounts.authority.key(), VaultError::Unauthorized);
    }

    // Idempotent: already current → no-op. Fires after the authority gate and
    // before any write, so a live `pending_authority` can never be clobbered.
    if len >= new_len {
      msg!("VaultConfig already current ({} bytes); no-op", len);
      return Ok(());
    }

    // Top up the rent delta so the grown account stays rent-exempt.
    let need = Rent::get()?
      .minimum_balance(new_len)
      .saturating_sub(config.lamports());
    if need > 0 {
      let cpi = CpiContext::new(
        ctx.accounts.system_program.key(),
        anchor_lang::system_program::Transfer {
          from: ctx.accounts.authority.to_account_info(),
          to: config.clone(),
        },
      );
      anchor_lang::system_program::transfer(cpi, need)?;
    }

    // Grow, then explicitly zero the appended region so `pending_authority`
    // decodes as `None` (byte 68 = 0x00) — independent of the runtime's resize
    // zero-fill behavior; a non-zero byte 68 would decode as Some(garbage).
    config.resize(new_len)?;
    {
      let mut data = config.try_borrow_mut_data()?;
      data[LEGACY_VAULT_CONFIG_LEN..new_len].fill(0);
    }

    emit!(VaultConfigMigratedEvent {
      authority: ctx.accounts.authority.key(),
      new_len: new_len as u64,
      timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Fail-closed Token-2022 extension allowlist. Classic SPL mints (no TLV
/// extension area) pass untouched; Token-2022 mints MUST unpack and may carry
/// ONLY transfer-neutral extensions (MetadataPointer, TokenMetadata,
/// InterestBearingConfig). A malformed TLV (Err on unpack) or ANY other /
/// unknown / future extension is rejected with `UnsupportedMintExtension`, to
/// protect the vault's raw-amount transfer invariants.
///
/// Shared by `create_vault_token` and `create_fee_token` so the two token-PDA
/// creation paths can never diverge on extension safety.
fn enforce_token2022_allowlist(mint_ai: &AccountInfo) -> Result<()> {
  if *mint_ai.owner == anchor_spl::token_2022::ID {
    let data = mint_ai.try_borrow_data()?;
    let state = StateWithExtensions::<Token2022Mint>::unpack(&data)
      .map_err(|_| VaultError::UnsupportedMintExtension)?;
    for ext in state.get_extension_types()? {
      let allowed = matches!(
        ext,
        ExtensionType::MetadataPointer
          | ExtensionType::TokenMetadata
          | ExtensionType::InterestBearingConfig
      );
      require!(allowed, VaultError::UnsupportedMintExtension);
    }
  }
  Ok(())
}

/// Emit a `sip_privacy::create_transfer_announcement` CPI so a vault withdrawal
/// becomes a scannable, Pedersen-committed announcement (a `TransferRecord` PDA).
///
/// Shared verbatim by `withdraw_private` (token track) and `withdraw_private_sol`
/// (native track) — the ONLY difference between the two call sites is the `mint`
/// value (`token_mint` for tokens, `NATIVE_SOL_MINT` for native SOL). The Borsh
/// argument layout, discriminator, account metas, and signer wiring are identical
/// to the token-only encoding that shipped before this extraction.
///
/// The CPI is metadata-only: it moves no funds. `depositor` is the announcement
/// signer / rent payer for the new `TransferRecord` PDA.
///
/// Argument byte layout (matches `create_transfer_announcement`):
///   disc(8) ‖ amount_commitment([u8;33]) ‖ stealth_pubkey(Pubkey,32)
///   ‖ ephemeral_pubkey([u8;33]) ‖ viewing_key_hash([u8;32])
///   ‖ encrypted_amount(Vec<u8>: u32-LE len ‖ bytes) ‖ token_mint(Pubkey,32)
#[allow(clippy::too_many_arguments)]
fn emit_transfer_announcement<'info>(
  sip_privacy_program: &AccountInfo<'info>,
  sip_config: &AccountInfo<'info>,
  sip_transfer_record: &AccountInfo<'info>,
  depositor: &AccountInfo<'info>,
  system_program: &AccountInfo<'info>,
  mint: Pubkey,
  amount_commitment: &[u8; 33],
  stealth_pubkey: Pubkey,
  ephemeral_pubkey: &[u8; 33],
  viewing_key_hash: &[u8; 32],
  encrypted_amount: &[u8],
) -> Result<()> {
  let mut cpi_data = Vec::with_capacity(8 + 33 + 32 + 33 + 32 + 4 + encrypted_amount.len() + 32);
  cpi_data.extend_from_slice(&CREATE_TRANSFER_ANNOUNCEMENT_DISC);
  // amount_commitment: [u8; 33]
  cpi_data.extend_from_slice(amount_commitment);
  // stealth_pubkey: Pubkey (32 bytes)
  cpi_data.extend_from_slice(stealth_pubkey.as_ref());
  // ephemeral_pubkey: [u8; 33]
  cpi_data.extend_from_slice(ephemeral_pubkey);
  // viewing_key_hash: [u8; 32]
  cpi_data.extend_from_slice(viewing_key_hash);
  // encrypted_amount: Vec<u8> (4-byte LE length prefix + data)
  cpi_data.extend_from_slice(&(encrypted_amount.len() as u32).to_le_bytes());
  cpi_data.extend_from_slice(encrypted_amount);
  // token_mint: Pubkey (32 bytes)
  cpi_data.extend_from_slice(mint.as_ref());

  let cpi_accounts = vec![
    AccountMeta::new(sip_config.key(), false),
    AccountMeta::new(sip_transfer_record.key(), false),
    AccountMeta::new(depositor.key(), true),
    AccountMeta::new_readonly(system_program.key(), false),
  ];

  let cpi_ix = solana_program::instruction::Instruction {
    program_id: sip_privacy_program.key(),
    accounts: cpi_accounts,
    data: cpi_data,
  };

  solana_program::program::invoke(
    &cpi_ix,
    &[
      sip_config.clone(),
      sip_transfer_record.clone(),
      depositor.clone(),
      system_program.clone(),
    ],
  )?;

  Ok(())
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
  pub vault_token: InterfaceAccount<'info, TokenAccount>,

  pub token_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub payer: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
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
  pub fee_token: InterfaceAccount<'info, TokenAccount>,

  pub token_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub payer: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSolVault<'info> {
  #[account(seeds = [VAULT_CONFIG_SEED], bump = config.bump)]
  pub config: Account<'info, VaultConfig>,

  #[account(
    init,
    payer = payer,
    space = 8 + SolVault::INIT_SPACE,
    seeds = [VAULT_SOL_SEED],
    bump,
  )]
  pub sol_vault: Account<'info, SolVault>,

  #[account(
    init,
    payer = payer,
    space = 8 + SolFee::INIT_SPACE,
    seeds = [FEE_SOL_SEED],
    bump,
  )]
  pub sol_fee: Account<'info, SolFee>,

  #[account(mut)]
  pub payer: Signer<'info>,

  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
  #[account(
    mut,
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  // init_if_needed is safe ONLY because `deposit_sol` accumulates: `is_new` is
  // derived from cumulative_volume, and balance/cumulative_volume are added to,
  // never reset. A future edit that zeroes a field on re-init would reintroduce
  // a double-credit/overwrite bug — preserve the accumulate-not-reset invariant.
  #[account(
    init_if_needed,
    payer = depositor,
    space = 8 + DepositRecord::INIT_SPACE,
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), NATIVE_SOL_MINT.as_ref()],
    bump,
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    seeds = [VAULT_SOL_SEED],
    bump = sol_vault.bump,
  )]
  pub sol_vault: Account<'info, SolVault>,

  #[account(mut)]
  pub depositor: Signer<'info>,

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

  // init_if_needed is safe ONLY because `deposit` accumulates: `is_new` is
  // derived from cumulative_volume, and balance/cumulative_volume are added to,
  // never reset. A future edit that zeroes a field on re-init would reintroduce
  // a double-credit/overwrite bug — preserve the accumulate-not-reset invariant.
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
    token::token_program = token_program,
  )]
  pub vault_token: InterfaceAccount<'info, TokenAccount>,

  #[account(
    mut,
    constraint = depositor_token.owner == depositor.key() @ VaultError::Unauthorized,
    constraint = depositor_token.mint == token_mint.key() @ VaultError::InvalidMint,
  )]
  pub depositor_token: InterfaceAccount<'info, TokenAccount>,

  pub token_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
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

  // The heavy `InterfaceAccount`s below are boxed to keep `WithdrawPrivate::try_accounts`
  // under the 4 KiB BPF stack-frame limit. Anchor 1.0's duplicate-mutable-key check
  // enlarged the generated account-validation frame for this account-heavy context;
  // boxing moves the deserialized token/mint state to the heap. Box is wire-identical
  // (account order + discriminators unchanged) and transparent to the handler via
  // Deref. (Resolves self-audit M6.)
  #[account(
    mut,
    seeds = [VAULT_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
    token::token_program = token_program,
  )]
  pub vault_token: Box<InterfaceAccount<'info, TokenAccount>>,

  #[account(
    mut,
    seeds = [FEE_TOKEN_SEED, token_mint.key().as_ref()],
    bump,
    token::mint = token_mint,
    token::authority = config,
    token::token_program = token_program,
  )]
  pub fee_token: Box<InterfaceAccount<'info, TokenAccount>>,

  /// The stealth token account to receive the net amount.
  /// Owned by any pubkey (the stealth address), we just verify the mint.
  #[account(
    mut,
    constraint = stealth_token.mint == token_mint.key() @ VaultError::InvalidMint,
  )]
  pub stealth_token: Box<InterfaceAccount<'info, TokenAccount>>,

  pub token_mint: Box<InterfaceAccount<'info, Mint>>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,

  // ── CPI accounts for sip_privacy::create_transfer_announcement ──

  /// SIP Privacy program config PDA
  /// CHECK: Validated by seeds against sip_privacy program
  #[account(
    mut,
    seeds = [SIP_CONFIG_SEED],
    bump,
    seeds::program = SIP_PRIVACY_PROGRAM_ID,
  )]
  pub sip_config: UncheckedAccount<'info>,

  /// Transfer record PDA — will be initialized by CPI to sip_privacy
  /// CHECK: Initialized and validated by the CPI call to sip_privacy
  #[account(mut)]
  pub sip_transfer_record: UncheckedAccount<'info>,

  /// SIP Privacy program for CPI
  /// CHECK: Validated by address constraint
  #[account(address = SIP_PRIVACY_PROGRAM_ID)]
  pub sip_privacy_program: UncheckedAccount<'info>,

  /// System program (needed by sip_privacy to init the transfer record)
  pub system_program: Program<'info, System>,
}

/// Native-SOL withdrawal context. Mirrors `WithdrawPrivate` with every token
/// account removed: the source is the lamport-holding `sol_vault` PDA, the fee
/// sink is the `sol_fee` PDA, and the recipient is a plain writable system
/// account (no ATA, no mint check). The three sip_privacy CPI accounts + the
/// system program are identical to the token context.
#[derive(Accounts)]
pub struct WithdrawPrivateSol<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), NATIVE_SOL_MINT.as_ref()],
    bump = deposit_record.bump,
    has_one = depositor @ VaultError::Unauthorized,
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    seeds = [VAULT_SOL_SEED],
    bump = sol_vault.bump,
  )]
  pub sol_vault: Account<'info, SolVault>,

  #[account(
    mut,
    seeds = [FEE_SOL_SEED],
    bump = sol_fee.bump,
  )]
  pub sol_fee: Account<'info, SolFee>,

  /// The stealth recipient — a plain writable system account that receives the
  /// net lamports. No mint check (native SOL); may be below the rent-exempt
  /// minimum after a small payout (documented in the design — no fund loss).
  #[account(mut)]
  pub stealth: SystemAccount<'info>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  // ── CPI accounts for sip_privacy::create_transfer_announcement ──

  /// SIP Privacy program config PDA
  /// CHECK: Validated by seeds against sip_privacy program
  #[account(
    mut,
    seeds = [SIP_CONFIG_SEED],
    bump,
    seeds::program = SIP_PRIVACY_PROGRAM_ID,
  )]
  pub sip_config: UncheckedAccount<'info>,

  /// Transfer record PDA — will be initialized by CPI to sip_privacy
  /// CHECK: Initialized and validated by the CPI call to sip_privacy
  #[account(mut)]
  pub sip_transfer_record: UncheckedAccount<'info>,

  /// SIP Privacy program for CPI
  /// CHECK: Validated by address constraint
  #[account(address = SIP_PRIVACY_PROGRAM_ID)]
  pub sip_privacy_program: UncheckedAccount<'info>,

  /// System program (needed by sip_privacy to init the transfer record)
  pub system_program: Program<'info, System>,
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
    token::token_program = token_program,
  )]
  pub vault_token: InterfaceAccount<'info, TokenAccount>,

  #[account(
    mut,
    constraint = depositor_token.owner == depositor.key() @ VaultError::Unauthorized,
    constraint = depositor_token.mint == deposit_record.token_mint @ VaultError::InvalidMint,
  )]
  pub depositor_token: InterfaceAccount<'info, TokenAccount>,

  /// Mint account required by transfer_checked (must match deposit_record.token_mint)
  #[account(
    address = deposit_record.token_mint @ VaultError::InvalidMint,
  )]
  pub token_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct AuthorityRefund<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority @ VaultError::Unauthorized,
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
    token::token_program = token_program,
  )]
  pub vault_token: InterfaceAccount<'info, TokenAccount>,

  #[account(
    mut,
    constraint = depositor_token.owner == depositor.key() @ VaultError::Unauthorized,
    constraint = depositor_token.mint == deposit_record.token_mint @ VaultError::InvalidMint,
  )]
  pub depositor_token: InterfaceAccount<'info, TokenAccount>,

  /// Mint account required by transfer_checked (must match deposit_record.token_mint)
  #[account(
    address = deposit_record.token_mint @ VaultError::InvalidMint,
  )]
  pub token_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: Not a signer — validated by deposit_record.has_one. Used for PDA
  /// derivation and token account ownership check. The authority (not depositor)
  /// is the signer for this instruction.
  pub depositor: UncheckedAccount<'info>,

  #[account(mut)]
  pub authority: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
}

/// Native-SOL self-refund context. Depositor is the signer and the lamport
/// destination. The `deposit_record` PDA is derived from the depositor's pubkey
/// and NATIVE_SOL_MINT; `has_one = depositor` guards that only the original
/// depositor can reclaim their own balance.
#[derive(Accounts)]
pub struct RefundSol<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), NATIVE_SOL_MINT.as_ref()],
    bump = deposit_record.bump,
    has_one = depositor @ VaultError::Unauthorized,
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    seeds = [VAULT_SOL_SEED],
    bump = sol_vault.bump,
  )]
  pub sol_vault: Account<'info, SolVault>,

  #[account(mut)]
  pub depositor: Signer<'info>,
}

/// Authority-signed native-SOL refund context. The authority signs on behalf of
/// the depositor (e.g., SENTINEL autonomous refunds). The depositor is a
/// non-signer SystemAccount that receives the lamports — `has_one = depositor`
/// on the `deposit_record` ensures the principal always returns to the original
/// depositor, NOT to any authority-chosen address. Wrong authority → Unauthorized
/// via `has_one = authority` on `config`.
#[derive(Accounts)]
pub struct AuthorityRefundSol<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority @ VaultError::Unauthorized,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), NATIVE_SOL_MINT.as_ref()],
    bump = deposit_record.bump,
    has_one = depositor @ VaultError::Unauthorized,
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    seeds = [VAULT_SOL_SEED],
    bump = sol_vault.bump,
  )]
  pub sol_vault: Account<'info, SolVault>,

  /// Non-signer lamport destination + seed source for the deposit_record PDA.
  /// Validated by the deposit_record.has_one constraint above.
  #[account(mut)]
  pub depositor: SystemAccount<'info>,

  #[account(mut)]
  pub authority: Signer<'info>,
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
    token::token_program = token_program,
  )]
  pub fee_token: InterfaceAccount<'info, TokenAccount>,

  #[account(
    mut,
    constraint = authority_token.owner == authority.key() @ VaultError::Unauthorized,
    constraint = authority_token.mint == token_mint.key() @ VaultError::InvalidMint,
  )]
  pub authority_token: InterfaceAccount<'info, TokenAccount>,

  pub token_mint: InterfaceAccount<'info, Mint>,

  #[account(mut)]
  pub authority: Signer<'info>,

  pub token_program: Interface<'info, TokenInterface>,
}

/// Authority-only context for draining native-SOL fees above the rent floor
/// from the `sol_fee` PDA. `has_one = authority` on `config` enforces that only
/// the vault authority can call this instruction (wrong authority → Unauthorized).
#[derive(Accounts)]
pub struct CollectFeeSol<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority @ VaultError::Unauthorized,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    seeds = [FEE_SOL_SEED],
    bump = sol_fee.bump,
  )]
  pub sol_fee: Account<'info, SolFee>,

  #[account(mut)]
  pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
  #[account(
    mut,
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority @ VaultError::Unauthorized,
  )]
  pub config: Account<'info, VaultConfig>,

  pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
  #[account(
    mut,
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority @ VaultError::Unauthorized,
  )]
  pub config: Account<'info, VaultConfig>,

  pub authority: Signer<'info>,
}

/// Accept context — the *proposed* authority signs. No `has_one`: the new
/// authority is, by definition, not yet the current authority. The match
/// against `pending_authority` is enforced in the instruction body.
#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
  #[account(
    mut,
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
  )]
  pub config: Account<'info, VaultConfig>,

  pub new_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateFee<'info> {
  #[account(
    mut,
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority @ VaultError::Unauthorized,
  )]
  pub config: Account<'info, VaultConfig>,

  pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MigrateConfig<'info> {
  /// CHECK: legacy-layout config is not deserializable into VaultConfig; the PDA
  /// is verified by seeds+bump and the authority is verified manually in the
  /// handler (bytes [8..40]). Owned by this program, so realloc is permitted.
  #[account(mut, seeds = [VAULT_CONFIG_SEED], bump)]
  pub config: UncheckedAccount<'info>,

  #[account(mut)]
  pub authority: Signer<'info>,

  pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

#[event]
pub struct VaultWithdrawEvent {
  pub depositor: Pubkey,
  pub mint: Pubkey,
  pub stealth_recipient: Pubkey,
  pub amount_commitment: [u8; 33],
  pub ephemeral_pubkey: [u8; 33],
  pub viewing_key_hash: [u8; 32],
  pub transfer_amount: u64,
  pub fee_amount: u64,
  pub timestamp: i64,
}

#[event]
pub struct VaultPausedEvent {
  pub authority: Pubkey,
  pub paused: bool,
  pub timestamp: i64,
}

/// Emitted when the current authority proposes a transfer (step 1). Lets
/// off-chain monitoring (SENTINEL, indexers) react to a pending authority
/// change without log-parsing — the same rationale as `VaultPausedEvent`.
#[event]
pub struct AuthorityTransferProposedEvent {
  pub current_authority: Pubkey,
  pub pending_authority: Pubkey,
  pub timestamp: i64,
}

/// Emitted when a pending authority transfer is accepted (step 2) and
/// `config.authority` actually changes — the single most alarm-worthy custody
/// event, especially once the authority is a mainnet multisig.
#[event]
pub struct AuthorityUpdatedEvent {
  pub old_authority: Pubkey,
  pub new_authority: Pubkey,
  pub timestamp: i64,
}

/// Emitted when the authority updates the protocol fee.
#[event]
pub struct FeeUpdatedEvent {
  pub authority: Pubkey,
  pub old_fee_tenths_bps: u16,
  pub new_fee_tenths_bps: u16,
  pub timestamp: i64,
}

/// Emitted when `migrate_config` grows a legacy VaultConfig to the current
/// layout. Lets off-chain tooling confirm the one-time migration on-chain.
#[event]
pub struct VaultConfigMigratedEvent {
  pub authority: Pubkey,
  pub new_len: u64,
  pub timestamp: i64,
}
