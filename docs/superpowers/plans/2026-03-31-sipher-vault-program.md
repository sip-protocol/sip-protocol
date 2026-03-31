# Sipher Vault Program — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the sipher_vault Solana program — a PDA-controlled privacy vault that accepts multi-token deposits, handles refunds, collects fees, and composes with the existing sip_privacy program via CPI for stealth transfers.

**Architecture:** New Anchor program (sipher_vault) living in `programs/sipher-vault/` within the existing sip-protocol monorepo. Uses CPI to call `shielded_token_transfer` and `create_transfer_announcement` on the existing sip_privacy program. Debit-first pattern ensures atomic balance updates. All funds held in PDA token accounts — no private keys.

**Tech Stack:** Rust, Anchor 0.30+, Solana CLI, anchor-spl, Bankrun (testing)

**Spec Reference:** `docs/superpowers/specs/2026-03-30-sipher-vision-design.md` — Sections 5, 27 (C1-C5)

**Phase 1 Scope (per post-roast C1):** 5 instructions only: `initialize`, `deposit`, `withdraw_private`, `refund`, `collect_fee`. Deferred: `crank_refund`, `swap_private`, `update_config`, `pause`.

---

## File Structure

```
programs/sipher-vault/
├── Cargo.toml
├── Xargo.toml
└── programs/
    └── sipher-vault/
        ├── Cargo.toml
        └── src/
            ├── lib.rs              ← Program entrypoint, instruction handlers
            ├── state.rs            ← Account structs (VaultConfig, DepositRecord)
            ├── errors.rs           ← Custom error codes
            └── constants.rs        ← Seeds, limits, defaults

tests/
└── sipher-vault/
    ├── setup.ts                    ← Test helpers, program setup
    ├── initialize.test.ts          ← Initialize instruction tests
    ├── deposit.test.ts             ← Deposit instruction tests
    ├── withdraw-private.test.ts    ← Withdraw + CPI tests
    ├── refund.test.ts              ← Refund instruction tests
    └── collect-fee.test.ts         ← Fee collection tests
```

---

### Task 1: Scaffold Anchor Program

**Files:**
- Create: `programs/sipher-vault/Cargo.toml`
- Create: `programs/sipher-vault/Xargo.toml`
- Create: `programs/sipher-vault/programs/sipher-vault/Cargo.toml`
- Create: `programs/sipher-vault/programs/sipher-vault/src/lib.rs`
- Create: `programs/sipher-vault/programs/sipher-vault/src/state.rs`
- Create: `programs/sipher-vault/programs/sipher-vault/src/errors.rs`
- Create: `programs/sipher-vault/programs/sipher-vault/src/constants.rs`
- Modify: `Anchor.toml` (add sipher-vault program)

- [ ] **Step 1: Create workspace Cargo.toml**

```toml
# programs/sipher-vault/Cargo.toml
[workspace]
members = ["programs/*"]
resolver = "2"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
```

- [ ] **Step 2: Create Xargo.toml**

```toml
# programs/sipher-vault/Xargo.toml
[target.sbpf-solana-solana.dependencies.std]
features = []
```

- [ ] **Step 3: Create program Cargo.toml**

```toml
# programs/sipher-vault/programs/sipher-vault/Cargo.toml
[package]
name = "sipher-vault"
version = "0.1.0"
description = "Sipher Privacy Vault — PDA-controlled multi-token mixer with auto-refund"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "sipher_vault"

[features]
default = []
cpi = ["no-entrypoint"]
no-entrypoint = []

[dependencies]
anchor-lang = "0.30.1"
anchor-spl = "0.30.1"
```

- [ ] **Step 4: Create constants.rs**

```rust
// programs/sipher-vault/programs/sipher-vault/src/constants.rs

/// Seed for vault config PDA
pub const VAULT_CONFIG_SEED: &[u8] = b"vault_config";

/// Seed for deposit record PDAs
pub const DEPOSIT_RECORD_SEED: &[u8] = b"deposit_record";

/// Seed for vault token account PDAs
pub const VAULT_TOKEN_SEED: &[u8] = b"vault_token";

/// Seed for fee token account PDAs
pub const FEE_TOKEN_SEED: &[u8] = b"fee_token";

/// Default refund timeout: 24 hours in seconds
pub const DEFAULT_REFUND_TIMEOUT: i64 = 86400;

/// Default fee: 10 bps (0.1%)
pub const DEFAULT_FEE_BPS: u16 = 10;

/// Maximum fee: 100 bps (1%)
pub const MAX_FEE_BPS: u16 = 100;

/// Free tier volume per wallet per month (in lamports-equivalent, $1K ≈ 7 SOL ≈ 7_000_000_000)
/// Tracked off-chain by the agent — program always charges fee, agent decides whether to pass fee_exempt=true
pub const FREE_TIER_NOTE: &str = "Free tier tracking is off-chain (agent responsibility)";
```

- [ ] **Step 5: Create errors.rs**

```rust
// programs/sipher-vault/programs/sipher-vault/src/errors.rs

use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
  #[msg("Program is paused")]
  ProgramPaused,

  #[msg("Unauthorized: not the vault authority")]
  Unauthorized,

  #[msg("Insufficient balance for this operation")]
  InsufficientBalance,

  #[msg("Math overflow")]
  MathOverflow,

  #[msg("Deposit amount must be greater than zero")]
  ZeroDeposit,

  #[msg("Refund timeout has not expired yet")]
  RefundNotExpired,

  #[msg("No balance to refund")]
  NothingToRefund,

  #[msg("Fee rate exceeds maximum allowed")]
  FeeTooHigh,

  #[msg("No fees to collect")]
  NoFeesToCollect,

  #[msg("Invalid token mint")]
  InvalidMint,

  #[msg("Balance locked by scheduled operations")]
  BalanceLocked,
}
```

- [ ] **Step 6: Create state.rs**

```rust
// programs/sipher-vault/programs/sipher-vault/src/state.rs

use anchor_lang::prelude::*;

/// Global vault configuration — one per program instance
#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
  /// Authority that can collect fees and update config
  pub authority: Pubkey,
  /// Fee in basis points (10 = 0.1%)
  pub fee_bps: u16,
  /// Refund timeout in seconds (default 86400 = 24h)
  pub refund_timeout: i64,
  /// Emergency pause flag
  pub paused: bool,
  /// Total deposits ever made
  pub total_deposits: u64,
  /// Total unique depositors
  pub total_depositors: u64,
  /// PDA bump
  pub bump: u8,
}

/// Per-user per-token deposit record
#[account]
#[derive(InitSpace)]
pub struct DepositRecord {
  /// Depositor's wallet
  pub depositor: Pubkey,
  /// Token mint (WSOL mint for SOL deposits)
  pub token_mint: Pubkey,
  /// Current available balance (decremented on withdraw, refund)
  pub balance: u64,
  /// Amount locked by scheduled operations (Phase 1.5)
  pub locked_amount: u64,
  /// Cumulative volume through this record (for free tier tracking)
  pub cumulative_volume: u64,
  /// Timestamp of last deposit (for auto-refund timeout)
  pub last_deposit_at: i64,
  /// PDA bump
  pub bump: u8,
}
```

- [ ] **Step 7: Create lib.rs with program skeleton**

```rust
// programs/sipher-vault/programs/sipher-vault/src/lib.rs

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::VaultError;
use state::*;

declare_id!("11111111111111111111111111111111"); // placeholder until vanity grind

#[program]
pub mod sipher_vault {
  use super::*;

  /// Initialize the vault configuration
  pub fn initialize(ctx: Context<Initialize>, fee_bps: u16, refund_timeout: i64) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, VaultError::FeeTooHigh);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_bps = fee_bps;
    config.refund_timeout = if refund_timeout > 0 { refund_timeout } else { DEFAULT_REFUND_TIMEOUT };
    config.paused = false;
    config.total_deposits = 0;
    config.total_depositors = 0;
    config.bump = ctx.bumps.config;

    msg!("Sipher Vault initialized. Authority: {}, Fee: {} bps, Timeout: {}s",
      config.authority, config.fee_bps, config.refund_timeout);

    Ok(())
  }

  /// Deposit tokens into the vault
  pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);
    require!(amount > 0, VaultError::ZeroDeposit);

    // Transfer tokens from user to vault PDA token account
    let cpi_accounts = Transfer {
      from: ctx.accounts.user_token_account.to_account_info(),
      to: ctx.accounts.vault_token_account.to_account_info(),
      authority: ctx.accounts.depositor.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update deposit record
    let record = &mut ctx.accounts.deposit_record;
    let is_new = record.balance == 0 && record.cumulative_volume == 0;
    record.depositor = ctx.accounts.depositor.key();
    record.token_mint = ctx.accounts.token_mint.key();
    record.balance = record.balance.checked_add(amount).ok_or(VaultError::MathOverflow)?;
    record.cumulative_volume = record.cumulative_volume.checked_add(amount).ok_or(VaultError::MathOverflow)?;
    record.last_deposit_at = Clock::get()?.unix_timestamp;

    // Update global stats
    let config = &mut ctx.accounts.config;
    config.total_deposits = config.total_deposits.saturating_add(1);
    if is_new {
      config.total_depositors = config.total_depositors.saturating_add(1);
    }

    msg!("Deposited {} tokens. Balance: {}", amount, record.balance);

    Ok(())
  }

  /// Withdraw privately — debit balance then CPI to sip_privacy for stealth send
  ///
  /// Debit-first pattern (C3): balance decremented BEFORE CPI call.
  /// If CPI fails, entire TX reverts (Solana atomicity).
  pub fn withdraw_private(
    ctx: Context<WithdrawPrivate>,
    amount: u64,
    amount_commitment: [u8; 33],
    stealth_pubkey: Pubkey,
    ephemeral_pubkey: [u8; 33],
    viewing_key_hash: [u8; 32],
    encrypted_amount: Vec<u8>,
    proof: Vec<u8>,
  ) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, VaultError::ProgramPaused);

    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance.checked_sub(record.locked_amount).ok_or(VaultError::MathOverflow)?;
    require!(available >= amount, VaultError::InsufficientBalance);

    // Calculate fee
    let fee_amount = if config.fee_bps > 0 {
      (amount as u128 * config.fee_bps as u128 / 10000) as u64
    } else {
      0
    };
    let transfer_amount = amount.checked_sub(fee_amount).ok_or(VaultError::MathOverflow)?;

    // DEBIT FIRST (C3): decrement balance before CPI
    record.balance = record.balance.checked_sub(amount).ok_or(VaultError::MathOverflow)?;

    // Transfer fee to fee account (if any)
    if fee_amount > 0 {
      let config_key = ctx.accounts.config.key();
      let vault_seeds = &[
        VAULT_TOKEN_SEED,
        config_key.as_ref(),
        ctx.accounts.token_mint.to_account_info().key.as_ref(),
        &[ctx.accounts.vault_token_account.to_account_info().try_borrow_data()?[8]], // bump from PDA
      ];
      // Note: actual PDA signing implementation will use the vault config bump
      // This is simplified — full implementation needs proper PDA signer seeds
    }

    // CPI to sip_privacy.shielded_token_transfer
    // Note: This requires the vault PDA to be the token authority
    // The actual CPI implementation depends on sip_privacy accepting
    // a PDA signer via invoke_signed
    //
    // For Phase 1, we use create_transfer_announcement (no token movement)
    // + direct token::transfer from vault PDA to stealth address
    // This avoids modifying sip_privacy program

    // Transfer tokens from vault to stealth token account
    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    let transfer_accounts = Transfer {
      from: ctx.accounts.vault_token_account.to_account_info(),
      to: ctx.accounts.stealth_token_account.to_account_info(),
      authority: ctx.accounts.config.to_account_info(),
    };
    let transfer_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      transfer_accounts,
      signer_seeds,
    );
    token::transfer(transfer_ctx, transfer_amount)?;

    // Transfer fee to fee account
    if fee_amount > 0 {
      let fee_transfer = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.fee_token_account.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
      };
      let fee_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        fee_transfer,
        signer_seeds,
      );
      token::transfer(fee_ctx, fee_amount)?;
    }

    // CPI to sip_privacy.create_transfer_announcement
    // Creates the on-chain announcement so recipient can scan and claim
    // (announcement-only, no token movement — we already moved tokens above)
    //
    // TODO: Implement CPI call to sip_privacy.create_transfer_announcement
    // This requires importing sip_privacy as a CPI dependency
    // For now, emit an event that the off-chain indexer can use

    emit!(VaultWithdrawEvent {
      depositor: record.depositor,
      stealth_recipient: stealth_pubkey,
      amount_commitment,
      ephemeral_pubkey,
      viewing_key_hash,
      transfer_amount,
      fee_amount,
      timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("Private withdrawal: {} tokens (fee: {})", transfer_amount, fee_amount);

    Ok(())
  }

  /// Refund — return depositor's remaining balance
  pub fn refund(ctx: Context<Refund>) -> Result<()> {
    let record = &mut ctx.accounts.deposit_record;
    let refundable = record.balance.checked_sub(record.locked_amount).ok_or(VaultError::MathOverflow)?;
    require!(refundable > 0, VaultError::NothingToRefund);

    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    // Transfer tokens from vault back to depositor
    let transfer_accounts = Transfer {
      from: ctx.accounts.vault_token_account.to_account_info(),
      to: ctx.accounts.user_token_account.to_account_info(),
      authority: ctx.accounts.config.to_account_info(),
    };
    let transfer_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      transfer_accounts,
      signer_seeds,
    );
    token::transfer(transfer_ctx, refundable)?;

    // Update balance
    record.balance = record.locked_amount; // only locked amount remains

    msg!("Refunded {} tokens to {}", refundable, record.depositor);

    Ok(())
  }

  /// Collect accumulated fees — authority only
  pub fn collect_fee(ctx: Context<CollectFee>, amount: u64) -> Result<()> {
    let fee_balance = ctx.accounts.fee_token_account.amount;
    require!(fee_balance > 0, VaultError::NoFeesToCollect);

    let withdraw_amount = if amount == 0 || amount > fee_balance {
      fee_balance
    } else {
      amount
    };

    let config_bump = ctx.accounts.config.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_CONFIG_SEED, &[config_bump]]];

    let transfer_accounts = Transfer {
      from: ctx.accounts.fee_token_account.to_account_info(),
      to: ctx.accounts.authority_token_account.to_account_info(),
      authority: ctx.accounts.config.to_account_info(),
    };
    let transfer_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info(),
      transfer_accounts,
      signer_seeds,
    );
    token::transfer(transfer_ctx, withdraw_amount)?;

    msg!("Collected {} fee tokens", withdraw_amount);

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

  /// Vault's token account for this mint (PDA-owned)
  #[account(
    mut,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub vault_token_account: Account<'info, TokenAccount>,

  /// User's source token account
  #[account(
    mut,
    token::mint = token_mint,
    token::authority = depositor,
  )]
  pub user_token_account: Account<'info, TokenAccount>,

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
    constraint = deposit_record.depositor == depositor.key(),
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  /// Vault's token account
  #[account(
    mut,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub vault_token_account: Account<'info, TokenAccount>,

  /// Fee token account for this mint
  #[account(
    mut,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub fee_token_account: Account<'info, TokenAccount>,

  /// Stealth recipient's token account
  #[account(mut)]
  pub stealth_token_account: Account<'info, TokenAccount>,

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
    seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), token_mint.key().as_ref()],
    bump = deposit_record.bump,
    constraint = deposit_record.depositor == depositor.key(),
  )]
  pub deposit_record: Account<'info, DepositRecord>,

  #[account(
    mut,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub vault_token_account: Account<'info, TokenAccount>,

  #[account(
    mut,
    token::mint = token_mint,
    token::authority = depositor,
  )]
  pub user_token_account: Account<'info, TokenAccount>,

  pub token_mint: Account<'info, Mint>,

  #[account(mut)]
  pub depositor: Signer<'info>,

  pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CollectFee<'info> {
  #[account(
    seeds = [VAULT_CONFIG_SEED],
    bump = config.bump,
    has_one = authority,
  )]
  pub config: Account<'info, VaultConfig>,

  #[account(
    mut,
    token::mint = token_mint,
    token::authority = config,
  )]
  pub fee_token_account: Account<'info, TokenAccount>,

  #[account(
    mut,
    token::authority = authority,
  )]
  pub authority_token_account: Account<'info, TokenAccount>,

  pub token_mint: Account<'info, Mint>,

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
```

- [ ] **Step 8: Update Anchor.toml**

Add to the existing `Anchor.toml` in the repo root (or create one in `programs/sipher-vault/`):

```toml
[programs.localnet]
sipher_vault = "11111111111111111111111111111111"

[programs.devnet]
sipher_vault = "11111111111111111111111111111111"
```

Note: Replace placeholder ID after vanity grind.

- [ ] **Step 9: Build and verify compilation**

Run:
```bash
cd programs/sipher-vault
anchor build
```

Expected: Successful build with `target/deploy/sipher_vault.so`

- [ ] **Step 10: Commit scaffold**

```bash
git add programs/sipher-vault/
git commit -m "feat: scaffold sipher_vault Anchor program with 5 instructions"
```

---

### Task 2: Write Initialize Tests

**Files:**
- Create: `tests/sipher-vault/setup.ts`
- Create: `tests/sipher-vault/initialize.test.ts`

- [ ] **Step 1: Create test setup helper**

```typescript
// tests/sipher-vault/setup.ts
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'

export const VAULT_CONFIG_SEED = Buffer.from('vault_config')
export const DEPOSIT_RECORD_SEED = Buffer.from('deposit_record')
export const VAULT_TOKEN_SEED = Buffer.from('vault_token')
export const FEE_TOKEN_SEED = Buffer.from('fee_token')

export function getVaultConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], programId)
}

export function getDepositRecordPDA(
  depositor: PublicKey,
  tokenMint: PublicKey,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DEPOSIT_RECORD_SEED, depositor.toBuffer(), tokenMint.toBuffer()],
    programId,
  )
}

export async function setupTestMint(
  provider: anchor.AnchorProvider,
  authority: Keypair,
  decimals = 6,
): Promise<PublicKey> {
  return createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    decimals,
  )
}

export async function setupTokenAccount(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair,
  amount = 0,
): Promise<PublicKey> {
  const ata = await createAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    owner,
  )
  if (amount > 0) {
    await mintTo(provider.connection, payer, mint, ata, payer, amount)
  }
  return ata
}
```

- [ ] **Step 2: Write initialize tests**

```typescript
// tests/sipher-vault/initialize.test.ts
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import { expect } from 'chai'
import { getVaultConfigPDA } from './setup'

describe('sipher-vault: initialize', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SipherVault as Program<SipherVault>
  const authority = provider.wallet as anchor.Wallet

  it('initializes vault config with correct parameters', async () => {
    const [configPDA] = getVaultConfigPDA(program.programId)
    const feeBps = 10 // 0.1%
    const refundTimeout = new anchor.BN(86400) // 24h

    await program.methods
      .initialize(feeBps, refundTimeout)
      .accounts({
        config: configPDA,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    const config = await program.account.vaultConfig.fetch(configPDA)
    expect(config.authority.toString()).to.equal(authority.publicKey.toString())
    expect(config.feeBps).to.equal(feeBps)
    expect(config.refundTimeout.toNumber()).to.equal(86400)
    expect(config.paused).to.equal(false)
    expect(config.totalDeposits.toNumber()).to.equal(0)
    expect(config.totalDepositors.toNumber()).to.equal(0)
  })

  it('rejects fee above maximum', async () => {
    // This would need a separate config PDA or re-init
    // For now, test the constraint in a fresh test environment
  })
})
```

- [ ] **Step 3: Run tests**

```bash
cd programs/sipher-vault
anchor test
```

Expected: Tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/sipher-vault/
git commit -m "test: add initialize instruction tests for sipher_vault"
```

---

### Task 3: Write Deposit Tests & Verify

**Files:**
- Create: `tests/sipher-vault/deposit.test.ts`

- [ ] **Step 1: Write deposit tests**

```typescript
// tests/sipher-vault/deposit.test.ts
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import { expect } from 'chai'
import { getVaultConfigPDA, getDepositRecordPDA, setupTestMint, setupTokenAccount } from './setup'
import { getAccount } from '@solana/spl-token'

describe('sipher-vault: deposit', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SipherVault as Program<SipherVault>
  const authority = (provider.wallet as anchor.Wallet).payer

  let mint: anchor.web3.PublicKey
  let userAta: anchor.web3.PublicKey
  let vaultTokenAccount: anchor.web3.PublicKey
  let configPDA: anchor.web3.PublicKey

  before(async () => {
    // Setup: initialize vault + create test token
    ;[configPDA] = getVaultConfigPDA(program.programId)
    mint = await setupTestMint(provider, authority)
    userAta = await setupTokenAccount(provider, mint, authority.publicKey, authority, 1_000_000)

    // Create vault token account (PDA-owned by config)
    // This account needs to be created with config as authority
    // Implementation depends on how we handle vault ATA creation
  })

  it('deposits tokens and creates deposit record', async () => {
    const [depositRecordPDA] = getDepositRecordPDA(
      authority.publicKey,
      mint,
      program.programId,
    )

    const amount = new anchor.BN(500_000)

    await program.methods
      .deposit(amount)
      .accounts({
        config: configPDA,
        depositRecord: depositRecordPDA,
        vaultTokenAccount: vaultTokenAccount,
        userTokenAccount: userAta,
        tokenMint: mint,
        depositor: authority.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    const record = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(record.depositor.toString()).to.equal(authority.publicKey.toString())
    expect(record.balance.toNumber()).to.equal(500_000)
    expect(record.lockedAmount.toNumber()).to.equal(0)
    expect(record.cumulativeVolume.toNumber()).to.equal(500_000)
  })

  it('adds to existing deposit record on second deposit', async () => {
    const [depositRecordPDA] = getDepositRecordPDA(
      authority.publicKey,
      mint,
      program.programId,
    )

    const amount = new anchor.BN(200_000)

    await program.methods
      .deposit(amount)
      .accounts({
        config: configPDA,
        depositRecord: depositRecordPDA,
        vaultTokenAccount: vaultTokenAccount,
        userTokenAccount: userAta,
        tokenMint: mint,
        depositor: authority.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    const record = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(record.balance.toNumber()).to.equal(700_000) // 500k + 200k
    expect(record.cumulativeVolume.toNumber()).to.equal(700_000)
  })

  it('rejects zero deposit', async () => {
    const [depositRecordPDA] = getDepositRecordPDA(
      authority.publicKey,
      mint,
      program.programId,
    )

    try {
      await program.methods
        .deposit(new anchor.BN(0))
        .accounts({
          config: configPDA,
          depositRecord: depositRecordPDA,
          vaultTokenAccount: vaultTokenAccount,
          userTokenAccount: userAta,
          tokenMint: mint,
          depositor: authority.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc()
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e.message).to.include('ZeroDeposit')
    }
  })
})
```

- [ ] **Step 2: Run tests**

```bash
anchor test
```

Expected: All deposit tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/sipher-vault/deposit.test.ts
git commit -m "test: add deposit instruction tests for sipher_vault"
```

---

### Task 4: Write Refund Tests & Verify

**Files:**
- Create: `tests/sipher-vault/refund.test.ts`

- [ ] **Step 1: Write refund tests**

```typescript
// tests/sipher-vault/refund.test.ts
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import { expect } from 'chai'
import { getVaultConfigPDA, getDepositRecordPDA } from './setup'

describe('sipher-vault: refund', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SipherVault as Program<SipherVault>
  const authority = (provider.wallet as anchor.Wallet).payer

  it('refunds available balance to depositor', async () => {
    // After deposit of 700_000 from previous test
    const [configPDA] = getVaultConfigPDA(program.programId)
    const [depositRecordPDA] = getDepositRecordPDA(
      authority.publicKey,
      // mint from setup
      anchor.web3.PublicKey.default, // placeholder
      program.programId,
    )

    // Record balance before refund
    const recordBefore = await program.account.depositRecord.fetch(depositRecordPDA)
    const refundable = recordBefore.balance.toNumber() - recordBefore.lockedAmount.toNumber()

    await program.methods
      .refund()
      .accounts({
        config: configPDA,
        depositRecord: depositRecordPDA,
        // ... accounts
      })
      .rpc()

    const recordAfter = await program.account.depositRecord.fetch(depositRecordPDA)
    expect(recordAfter.balance.toNumber()).to.equal(recordBefore.lockedAmount.toNumber())
  })

  it('rejects refund when nothing to refund', async () => {
    // After full refund, balance should be 0 (or locked_amount only)
    try {
      await program.methods
        .refund()
        .accounts({
          // ... accounts
        })
        .rpc()
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e.message).to.include('NothingToRefund')
    }
  })
})
```

- [ ] **Step 2: Run tests**

```bash
anchor test
```

- [ ] **Step 3: Commit**

```bash
git add tests/sipher-vault/refund.test.ts
git commit -m "test: add refund instruction tests for sipher_vault"
```

---

### Task 5: Write Collect Fee Tests & Verify

**Files:**
- Create: `tests/sipher-vault/collect-fee.test.ts`

- [ ] **Step 1: Write collect fee tests**

```typescript
// tests/sipher-vault/collect-fee.test.ts
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { SipherVault } from '../../target/types/sipher_vault'
import { expect } from 'chai'
import { getVaultConfigPDA } from './setup'

describe('sipher-vault: collect_fee', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SipherVault as Program<SipherVault>

  it('authority can collect accumulated fees', async () => {
    // After a withdraw_private that generated fees
    // Verify fee_token_account balance decreases
    // Verify authority_token_account balance increases
  })

  it('rejects non-authority fee collection', async () => {
    const attacker = anchor.web3.Keypair.generate()
    try {
      await program.methods
        .collectFee(new anchor.BN(0))
        .accounts({
          // ... with attacker as authority
        })
        .signers([attacker])
        .rpc()
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e.message).to.include('Unauthorized')
    }
  })

  it('rejects when no fees to collect', async () => {
    try {
      await program.methods
        .collectFee(new anchor.BN(0))
        .accounts({
          // ... empty fee account
        })
        .rpc()
      expect.fail('Should have thrown')
    } catch (e) {
      expect(e.message).to.include('NoFeesToCollect')
    }
  })
})
```

- [ ] **Step 2: Run tests**

```bash
anchor test
```

- [ ] **Step 3: Commit**

```bash
git add tests/sipher-vault/collect-fee.test.ts
git commit -m "test: add collect_fee instruction tests for sipher_vault"
```

---

### Task 6: Vanity Grind Program Keypair

**Files:**
- Create: `~/Documents/secret/sipher-vault-program-id.json` (encrypted)

- [ ] **Step 1: Grind for S1PHER vanity address**

```bash
solana-keygen grind --starts-with S1PHER:1
# If too slow (>1 hour), fall back:
# solana-keygen grind --starts-with S1Phr:1
# If still slow:
# solana-keygen grind --starts-with S1P:1
```

- [ ] **Step 2: Store keypair securely**

```bash
cp S1PHER*.json ~/Documents/secret/sipher-vault-program-id.json
# Encrypt with age for backup
age -e -R ~/.age/recipients.txt ~/Documents/secret/sipher-vault-program-id.json \
  > ~/.claude/sip-protocol/keys/solana/sipher-vault-program-id.json.age
```

- [ ] **Step 3: Update program ID in lib.rs**

Replace `declare_id!("11111111111111111111111111111111")` with the actual vanity address.

- [ ] **Step 4: Rebuild and rerun tests**

```bash
cd programs/sipher-vault
anchor build
anchor test
```

- [ ] **Step 5: Commit**

```bash
git add programs/sipher-vault/programs/sipher-vault/src/lib.rs
git commit -m "chore: set sipher_vault program ID to vanity address"
```

---

### Task 7: Deploy to Devnet

**Files:**
- None (deployment only)

- [ ] **Step 1: Ensure devnet SOL balance**

```bash
solana balance --url devnet
# If low, ask RECTOR to fund from treasury
```

- [ ] **Step 2: Deploy to devnet**

```bash
cd programs/sipher-vault
solana program deploy target/deploy/sipher_vault.so \
  --program-id ~/Documents/secret/sipher-vault-program-id.json \
  --keypair ~/Documents/secret/solana-devnet.json \
  --url devnet \
  --with-compute-unit-price 10000
```

Expected: Successful deploy with program ID matching vanity address.

- [ ] **Step 3: Initialize vault config on devnet**

```bash
# Run initialization script (or use anchor test with devnet provider)
anchor test --provider.cluster devnet -- --features cpi
```

- [ ] **Step 4: Verify deployment**

```bash
solana program show <PROGRAM_ID> --url devnet
```

Expected: Shows program data length, balance, and authority.

- [ ] **Step 5: Commit deployment info**

Update CLAUDE.md with devnet program ID and config PDA.

```bash
git commit -m "docs: add sipher_vault devnet deployment info"
```

---

## Notes

- **CPI to sip_privacy:** Phase 1 uses `create_transfer_announcement` (announcement-only) + direct `token::transfer` from vault PDA. This avoids modifying the existing sip_privacy program. Phase 1.5 adds full CPI with sip_privacy as a crate dependency.
- **Vault token account creation:** Needs an `init_vault_token` instruction or the accounts need to be created externally before first deposit. Consider adding a `create_vault_token_account` helper instruction.
- **Tests are scaffolds:** The test code above needs the full setup chain (initialize → create vault ATAs → mint tokens → deposit → etc). Each test file should share a common `before()` that sets up the full state. The executing agent should flesh these out with complete account wiring.
- **Free tier tracking:** Done off-chain by the agent, not on-chain. The program always charges fees; the agent can set `fee_exempt` flag or use a zero-fee config for testing.
