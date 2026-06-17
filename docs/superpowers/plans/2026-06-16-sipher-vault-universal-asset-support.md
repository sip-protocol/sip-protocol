# sipher-vault Universal Asset Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `sipher-vault` to custody native SOL (lamports) and Token-2022 mints (conservative extension allowlist) alongside the existing classic SPL, with the high-risk lamport path isolated and audit-ready.

**Architecture:** Approach A — two custody tracks sharing one `VaultConfig` / `DepositRecord` / announcement-CPI spine. The existing token instructions migrate to the SPL **interface** (`Interface<TokenInterface>` + `transfer_checked`) so one path serves classic SPL *and* Token-2022; new `*_sol` instructions custody lamports in singleton `SolVault`/`SolFee` PDAs.

**Tech Stack:** Rust + Anchor `0.30.1`, `anchor-spl` `0.30.1` (`token_interface`, `token_2022::spl_token_2022`); tests in TypeScript via **solana-bankrun `0.4.0`** (IDL-free raw instructions — the IDL generator is broken on this host, see Global Constraints).

## Global Constraints

- **Anchor 0.30.1** — do NOT upgrade Anchor in this plan (tracked separately: sip-protocol#1161). Build with `anchor build --no-idl` (the IDL generator fails on rustc 1.94.1; the SBF binary is unaffected).
- **IDL-free tests only.** The Anchor TS client can't be used (no regenerable IDL). All tests use `solana-bankrun` with **raw `TransactionInstruction`s**: 8-byte discriminator = `sha256("global:"+name)[..8]`, manual Borsh arg encoding, explicit account metas, and account reads parsed by byte offset. Pattern reference: `programs/sipher-vault/scripts/e2e-cpi-test.ts`.
- **Build+test command (run from `programs/sipher-vault/`):** `anchor build --no-idl && cp ../sip-privacy/target/deploy/sip_privacy.so tests/fixtures/sip_privacy.so && pnpm exec ts-mocha -p ./tsconfig.json -t 1000000 tests/sipher-vault/<file>.test.ts`. (`startAnchor('.', extraPrograms, …)` auto-loads `target/deploy/sipher_vault.so`; `sip_privacy.so` must be in a bankrun search path — `tests/fixtures/`.)
- **Lamport safety (load-bearing):** BPF runs in release mode where `+=`/`-=` on `u64` **wrap silently**. Every lamport mutation MUST compute a checked value and assign it (never `**x -= n`). A wrap here is a vault-drain bug.
- **Sentinel:** `NATIVE_SOL_MINT = Pubkey::new_from_array([0u8; 32])` (the zero/System-Program pubkey). Used as the `DepositRecord` mint key and the announcement `token_mint` for native SOL.
- **Token-2022 allowlist is fail-closed:** accept ONLY {no extensions, MetadataPointer, TokenMetadata, InterestBearingConfig}; reject everything else (including unknown/future).
- **Naming gate (public repo):** no external-partner or privacy-competitor names anywhere in code/comments/commits/PR. Run the confidential naming-gate regex (kept in the private session handoff, deliberately not reproduced in-repo) against the diff before any push; expect zero hits.
- **Commits:** GPG-signed (`-S`), conventional, **no AI attribution**. Work in a git **worktree** off `origin/main` (shared-clone constraint) — created via `superpowers:using-git-worktrees` at execution start; commit the spec + this plan + code on that branch.
- **Out of scope:** IDL regeneration / Anchor upgrade (#1161); SDK native-SOL scan/cash-out + client (follow-on specs); **mainnet deploy** (B6-audit-gated). Devnet redeploy IS in scope (final task).

---

### Task 1: bankrun harness + classic-SPL regression baseline

Establishes the IDL-free test infrastructure and a green baseline of the *current* program behavior, so the interface migration (Task 3) can be proven non-regressing.

**Files:**
- Create: `programs/sipher-vault/tests/sipher-vault/bankrun-helpers.ts`
- Create: `programs/sipher-vault/tests/sipher-vault/10-bankrun-classic-spl.test.ts`
- Create: `programs/sipher-vault/tests/fixtures/.gitkeep` (dir for `sip_privacy.so`)
- Reference: `scripts/e2e-cpi-test.ts` (raw-ix pattern), `tests/sipher-vault/setup.ts` (PDA helpers)

**Interfaces (Produces — later tasks consume these):**
- `disc(name: string): Buffer`
- `startVault(): Promise<ProgramTestContext>` — `startAnchor('.', [{name:'sip_privacy', programId: SIP_PRIVACY_PROGRAM_ID}], [])`
- `sendIx(ctx, ixs: TransactionInstruction[], signers: Keypair[]): Promise<void>`
- `getAccountData(ctx, pubkey): Promise<Buffer>` (throws if missing)
- `parseDepositRecord(data: Buffer): { depositor, tokenMint, balance, lockedAmount, cumulativeVolume, lastDepositAt, bump }`
- `parseVaultConfig(data: Buffer): { authority, feeBps, refundTimeout, paused, totalDeposits, totalDepositors, bump }`
- `u64le(n: bigint): Buffer`
- Existing classic ix-builders: `ixCreateVaultToken`, `ixDeposit`, `ixWithdrawPrivate`, `ixRefund`, `ixCollectFee` (account orders copied verbatim from `lib.rs` contexts / `e2e-cpi-test.ts`).

- [ ] **Step 1: Write the harness module.** Implement the Produces interfaces above. Account-data parsing is byte-offset based (Anchor 8-byte discriminator prefix, then fields in declaration order — `DepositRecord`: 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1). Example:

```ts
import { createHash } from 'crypto'
import { PublicKey, Transaction, TransactionInstruction, Keypair } from '@solana/web3.js'
import { startAnchor, ProgramTestContext } from 'solana-bankrun'
import { SIP_PRIVACY_PROGRAM_ID } from './setup'

export const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
export function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}
export function u64le(n: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b }

export async function startVault(): Promise<ProgramTestContext> {
  return startAnchor('.', [{ name: 'sip_privacy', programId: SIP_PRIVACY_PROGRAM_ID }], [])
}
export async function sendIx(ctx: ProgramTestContext, ixs: TransactionInstruction[], signers: Keypair[]) {
  const tx = new Transaction()
  tx.recentBlockhash = ctx.lastBlockhash
  tx.feePayer = signers[0].publicKey
  ixs.forEach((i) => tx.add(i))
  tx.sign(...signers)
  await ctx.banksClient.processTransaction(tx)
}
export async function getAccountData(ctx: ProgramTestContext, pk: PublicKey): Promise<Buffer> {
  const acct = await ctx.banksClient.getAccount(pk)
  if (!acct) throw new Error(`account ${pk.toBase58()} not found`)
  return Buffer.from(acct.data)
}
export function parseDepositRecord(d: Buffer) {
  let o = 8
  const depositor = new PublicKey(d.subarray(o, o += 32))
  const tokenMint = new PublicKey(d.subarray(o, o += 32))
  const balance = d.readBigUInt64LE(o); o += 8
  const lockedAmount = d.readBigUInt64LE(o); o += 8
  const cumulativeVolume = d.readBigUInt64LE(o); o += 8
  const lastDepositAt = d.readBigInt64LE(o); o += 8
  const bump = d.readUInt8(o)
  return { depositor, tokenMint, balance, lockedAmount, cumulativeVolume, lastDepositAt, bump }
}
```
(Implement `parseVaultConfig` + the five existing ix-builders the same way — copy each account list verbatim from the matching `#[derive(Accounts)]` in `lib.rs`; copy the `deposit`/`withdraw_private` arg layouts from `e2e-cpi-test.ts`.)

- [ ] **Step 2: Write the failing regression test** in `10-bankrun-classic-spl.test.ts`: `before()` → `startVault()`, then `initialize` (fee 10 bps, timeout small e.g. 5s), create a classic SPL mint + depositor ATA (via `@solana/spl-token` ixs sent through `sendIx`), `createVaultToken`. Then one `it()` that `deposit`s 500_000, asserts `parseDepositRecord(...).balance === 500_000n` and the vault token balance.

- [ ] **Step 3: Build + run — verify it passes against the current binary.** Run the Global build+test command on this file. Expected: PASS (this is the *current* program, unmigrated — establishes the baseline + proves the harness works).

- [ ] **Step 4: Extend the test** with `withdraw_private` (stealth ATA pre-created, all 12 accounts incl. the sip-privacy CPI trio + `sip_transfer_record` PDA derived from `sip_privacy` config `total_transfers`), `refund` (after `ctx.setClock` past the timeout), and a `collect_fee`. Assert net/fee splits + the `sip_privacy` `TransferRecord` PDA exists. Run — Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add programs/sipher-vault/tests/sipher-vault/bankrun-helpers.ts \
        programs/sipher-vault/tests/sipher-vault/10-bankrun-classic-spl.test.ts \
        programs/sipher-vault/tests/fixtures/.gitkeep
git commit -S -m "test(sipher-vault): IDL-free bankrun harness + classic-SPL regression baseline"
```

---

### Task 2: Shared spine — constants, errors, account types, event field

**Files:**
- Modify: `programs/sipher-vault/programs/sipher-vault/src/constants.rs`
- Modify: `programs/sipher-vault/programs/sipher-vault/src/errors.rs`
- Modify: `programs/sipher-vault/programs/sipher-vault/src/state.rs`
- Modify: `programs/sipher-vault/programs/sipher-vault/src/lib.rs` (add `mint` to `VaultWithdrawEvent`; set it in existing `withdraw_private`)

**Interfaces (Produces):** `NATIVE_SOL_MINT`, `VAULT_SOL_SEED`, `FEE_SOL_SEED`, `SolVault{bump}`, `SolFee{bump}`, errors `UnsupportedMintExtension`/`RentReserveViolation`/`InvalidSolVault`, `VaultWithdrawEvent.mint: Pubkey`.

- [ ] **Step 1: Add constants** (`constants.rs`):
```rust
use anchor_lang::prelude::Pubkey;
pub const VAULT_SOL_SEED: &[u8] = b"vault_sol";
pub const FEE_SOL_SEED: &[u8] = b"fee_sol";
/// Sentinel mint representing native SOL (zero / System-Program pubkey).
pub const NATIVE_SOL_MINT: Pubkey = Pubkey::new_from_array([0u8; 32]);
```

- [ ] **Step 2: Add errors** (`errors.rs`):
```rust
#[msg("Mint carries an unsupported Token-2022 extension")]
UnsupportedMintExtension,
#[msg("Operation would drain a SOL PDA below its rent-exempt minimum")]
RentReserveViolation,
#[msg("Invalid SOL vault or fee PDA")]
InvalidSolVault,
```

- [ ] **Step 3: Add account types** (`state.rs`):
```rust
#[account]
#[derive(InitSpace)]
pub struct SolVault { pub bump: u8 }

#[account]
#[derive(InitSpace)]
pub struct SolFee { pub bump: u8 }
```

- [ ] **Step 4: Add `mint` to the event + set it in `withdraw_private`** (`lib.rs`): add `pub mint: Pubkey,` to `VaultWithdrawEvent` (after `depositor`); in the existing `withdraw_private` `emit!`, add `mint: ctx.accounts.token_mint.key(),`.

- [ ] **Step 5: Build + regression + commit.** `anchor build --no-idl` (Expected: compiles). Re-run Task 1's test (Expected: PASS — additive event field doesn't affect account/balance assertions).
```bash
git add programs/sipher-vault/programs/sipher-vault/src/
git commit -S -m "feat(sipher-vault): shared spine for multi-asset custody (sol PDAs, errors, event mint)"
```

---

### Task 3: Token-track interface migration (classic SPL + Token-2022 transport)

Migrate the five token instructions + their contexts to the SPL interface. **No behavior change for classic SPL** — Task 1's regression test is the gate.

**Files:** Modify `lib.rs` (imports + `deposit`, `withdraw_private`, `refund`, `authority_refund`, `collect_fee` + their `#[derive(Accounts)]`).

**Interfaces (Consumes):** Task 1 regression test. **(Produces):** token instructions accept both `Token` and `Token-2022` mints.

- [ ] **Step 1: Swap imports + account types.** Replace `use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer}` with `use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked}`. In every token context: `Account<'info, TokenAccount>` → `InterfaceAccount<'info, TokenAccount>`, `Account<'info, Mint>` → `InterfaceAccount<'info, Mint>`, `Program<'info, Token>` → `Interface<'info, TokenInterface>`.

- [ ] **Step 2: Swap transfers to `transfer_checked`.** Each `token::transfer(CpiContext…Transfer{from,to,authority}, amt)` becomes:
```rust
let cpi = CpiContext::new_with_signer(
  ctx.accounts.token_program.to_account_info(),
  TransferChecked {
    from: ctx.accounts.vault_token.to_account_info(),
    mint: ctx.accounts.token_mint.to_account_info(),
    to: ctx.accounts.<dest>.to_account_info(),
    authority: ctx.accounts.config.to_account_info(),
  },
  signer_seeds,
);
token_interface::transfer_checked(cpi, amount, ctx.accounts.token_mint.decimals)?;
```
(The `deposit` transfer is depositor-authority — use `CpiContext::new` without signer seeds. `token_mint.decimals` requires the mint account in the context — already present in every token ix.)

- [ ] **Step 2b: Confirm exact symbol paths** against installed `anchor-spl` 0.30.1 (`anchor_spl::token_interface`), via Context7 if needed. Keep the code above; adjust only import paths if the crate differs.

- [ ] **Step 3: Build.** `anchor build --no-idl`. Expected: compiles.

- [ ] **Step 4: Run Task 1's regression test.** Expected: **PASS** (classic SPL behavior unchanged). If the `deposit` test's mint was created with the classic Token program, `transfer_checked` still works identically. This green run is the migration's acceptance gate.

- [ ] **Step 5: Commit.**
```bash
git add programs/sipher-vault/programs/sipher-vault/src/lib.rs
git commit -S -m "refactor(sipher-vault): migrate token instructions to SPL interface + transfer_checked"
```

---

### Task 4: Token-2022 extension allowlist at `create_vault_token`

**Files:** Modify `lib.rs` (`create_vault_token` body + its context to expose the mint account-info).

**Interfaces (Consumes):** Task 3 interface migration. **(Produces):** `create_vault_token` rejects mints with non-allowlisted extensions (`UnsupportedMintExtension`).

- [ ] **Step 1: Write failing tests** in a new `11-token2022-allowlist.test.ts`. Build a Token-2022 mint with each extension using `@solana/spl-token` (`TOKEN_2022_PROGRAM_ID`, `createInitializeTransferFeeConfigInstruction`, `createInitializePermanentDelegateInstruction`, `…NonTransferableMint…`, `…DefaultAccountState…`, `…TransferHook…`, plus a metadata-pointer "accept" case), then call `createVaultToken` via raw ix:
  - accepts: plain T2022 mint, metadata-pointer mint → PASS (vault token PDA created).
  - rejects (assert `UnsupportedMintExtension`): permanent-delegate, transfer-fee, transfer-hook, non-transferable, default-account-state.
  Run — Expected: FAIL (allowlist not implemented; rejects don't fire).

- [ ] **Step 2: Implement the allowlist** in `create_vault_token`:
```rust
use anchor_spl::token_2022::spl_token_2022::{
    extension::{BaseStateWithExtensions, ExtensionType, StateWithExtensions},
    state::Mint as Token2022Mint,
};
// inside create_vault_token, before Ok(()):
let mint_ai = ctx.accounts.token_mint.to_account_info();
let data = mint_ai.try_borrow_data()?;
if let Ok(state) = StateWithExtensions::<Token2022Mint>::unpack(&data) {
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
```
(Classic SPL mints unpack with zero extensions → loop is empty → allowed. Confirm the `anchor_spl::token_2022::spl_token_2022` re-export path under 0.30.1.)

- [ ] **Step 3: Build + run.** `anchor build --no-idl`; run `11-token2022-allowlist.test.ts`. Expected: PASS (accepts allow-listed, rejects the rest). Also re-run Task 1 (classic SPL still accepted).

- [ ] **Step 4: Add the unknown-extension fail-closed case** — a mint with an extension NOT in the accept-list that isn't one of the explicitly-named rejects (e.g. `MintCloseAuthority`) must also reject. Run — Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add programs/sipher-vault/programs/sipher-vault/src/lib.rs \
        programs/sipher-vault/tests/sipher-vault/11-token2022-allowlist.test.ts
git commit -S -m "feat(sipher-vault): fail-closed Token-2022 extension allowlist at vault-token creation"
```

---

### Task 5: `create_sol_vault`

**Files:** Modify `lib.rs` (instruction + `CreateSolVault` context).

**Interfaces (Produces):** `create_sol_vault`; `SolVault`@`[VAULT_SOL_SEED]`, `SolFee`@`[FEE_SOL_SEED]` initialized.

- [ ] **Step 1: Failing test** in `12-native-sol.test.ts`: derive `solVaultPda`/`solFeePda`, call `createSolVault` (accounts: config, sol_vault, sol_fee, payer, system_program), assert both accounts now exist (`getAccount` non-null, owner = program). Run — Expected: FAIL (instruction missing).

- [ ] **Step 2: Implement:**
```rust
pub fn create_sol_vault(ctx: Context<CreateSolVault>) -> Result<()> {
    ctx.accounts.sol_vault.bump = ctx.bumps.sol_vault;
    ctx.accounts.sol_fee.bump = ctx.bumps.sol_fee;
    msg!("SOL vault + fee PDAs created");
    Ok(())
}

#[derive(Accounts)]
pub struct CreateSolVault<'info> {
    #[account(seeds = [VAULT_CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, VaultConfig>,
    #[account(init, payer = payer, space = 8 + SolVault::INIT_SPACE, seeds = [VAULT_SOL_SEED], bump)]
    pub sol_vault: Account<'info, SolVault>,
    #[account(init, payer = payer, space = 8 + SolFee::INIT_SPACE, seeds = [FEE_SOL_SEED], bump)]
    pub sol_fee: Account<'info, SolFee>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

- [ ] **Step 3: Build + run.** Expected: PASS.
- [ ] **Step 4: Commit.** `git commit -S -m "feat(sipher-vault): create_sol_vault — initialize native SOL vault + fee PDAs"`

---

### Task 6: `deposit_sol`

**Files:** Modify `lib.rs` (instruction + `DepositSol` context).

**Interfaces (Consumes):** Task 5 PDAs. **(Produces):** `deposit_sol`; `DepositRecord` keyed `(depositor, NATIVE_SOL_MINT)`.

- [ ] **Step 1: Failing test** (`12-native-sol.test.ts`): after `createSolVault`, `depositSol(1_000_000)`; assert `parseDepositRecord(depositRecordPda(depositor, NATIVE_SOL_MINT)).balance === 1_000_000n` and `solVault` lamports increased by 1_000_000. Run — Expected: FAIL.

- [ ] **Step 2: Implement** (debit-record + `system_program::transfer` in):
```rust
pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);
    require!(amount > 0, VaultError::ZeroDeposit);
    let cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.sol_vault.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi, amount)?;
    let record = &mut ctx.accounts.deposit_record;
    let is_new = record.balance == 0 && record.cumulative_volume == 0;
    record.depositor = ctx.accounts.depositor.key();
    record.token_mint = NATIVE_SOL_MINT;
    record.balance = record.balance.checked_add(amount).ok_or(VaultError::MathOverflow)?;
    record.cumulative_volume = record.cumulative_volume.checked_add(amount).ok_or(VaultError::MathOverflow)?;
    record.last_deposit_at = Clock::get()?.unix_timestamp;
    record.bump = ctx.bumps.deposit_record;
    let config = &mut ctx.accounts.config;
    config.total_deposits = config.total_deposits.saturating_add(1);
    if is_new {
        config.total_depositors = config.total_depositors.checked_add(1).ok_or(VaultError::MathOverflow)?;
    }
    Ok(())
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut, seeds = [VAULT_CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, VaultConfig>,
    #[account(init_if_needed, payer = depositor, space = 8 + DepositRecord::INIT_SPACE,
        seeds = [DEPOSIT_RECORD_SEED, depositor.key().as_ref(), NATIVE_SOL_MINT.as_ref()], bump)]
    pub deposit_record: Account<'info, DepositRecord>,
    #[account(mut, seeds = [VAULT_SOL_SEED], bump = sol_vault.bump)]
    pub sol_vault: Account<'info, SolVault>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

- [ ] **Step 3: Build + run.** Expected: PASS. Add a `rejects zero deposit` case.
- [ ] **Step 4: Commit.** `git commit -S -m "feat(sipher-vault): deposit_sol — native SOL deposit with debit-first record"`

---

### Task 7: `withdraw_private_sol` (the high-risk task)

**Files:** Modify `lib.rs` (instruction + `WithdrawPrivateSol` context).

**Interfaces (Consumes):** Tasks 5–6; the `sip_privacy::create_transfer_announcement` CPI (already done in `withdraw_private` — copy its data-encoding block verbatim, swapping `token_mint` for `NATIVE_SOL_MINT`). **(Produces):** `withdraw_private_sol`.

- [ ] **Step 1: Failing tests** (`12-native-sol.test.ts`): after a deposit of 1_000_000, `withdrawPrivateSol(500_000, …)` to a fresh stealth pubkey; assert: stealth lamports `+= 499_500` (net), `solFee += 500` (10 bps), `solVault -= 500_000`, `depositRecord.balance == 500_000`, and the `sip_privacy` `TransferRecord` PDA exists. Plus: `rejects withdrawal exceeding available` (InsufficientBalance). Run — Expected: FAIL.

- [ ] **Step 2: Implement — checked lamport mutation + rent guard:**
```rust
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

    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance.checked_sub(record.locked_amount).ok_or(VaultError::MathOverflow)?;
    require!(available >= amount, VaultError::InsufficientBalance);
    record.balance = record.balance.checked_sub(amount).ok_or(VaultError::MathOverflow)?;

    let fee = (amount as u128)
        .checked_mul(ctx.accounts.config.fee_bps as u128).ok_or(VaultError::MathOverflow)?
        .checked_div(10_000).ok_or(VaultError::MathOverflow)? as u64;
    let net = amount.checked_sub(fee).ok_or(VaultError::MathOverflow)?;

    // CHECKED lamport mutation (BPF release wraps on +=/-= — never use those here).
    let vault_ai = ctx.accounts.sol_vault.to_account_info();
    let new_vault = vault_ai.lamports().checked_sub(amount).ok_or(VaultError::MathOverflow)?;
    let rent_min = Rent::get()?.minimum_balance(vault_ai.data_len());
    require!(new_vault >= rent_min, VaultError::RentReserveViolation);
    let stealth_ai = ctx.accounts.stealth.to_account_info();
    let fee_ai = ctx.accounts.sol_fee.to_account_info();
    let new_stealth = stealth_ai.lamports().checked_add(net).ok_or(VaultError::MathOverflow)?;
    let new_fee = fee_ai.lamports().checked_add(fee).ok_or(VaultError::MathOverflow)?;
    **vault_ai.try_borrow_mut_lamports()? = new_vault;
    **stealth_ai.try_borrow_mut_lamports()? = new_stealth;
    **fee_ai.try_borrow_mut_lamports()? = new_fee;

    // CPI announcement — copy the encoding block from `withdraw_private`, with token_mint = NATIVE_SOL_MINT.
    // (depositor is the announcement signer/rent-payer; accounts: sip_config, sip_transfer_record, depositor, system_program)
    // … identical to withdraw_private except the final token_mint bytes use NATIVE_SOL_MINT …

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
    Ok(())
}
```
Context `WithdrawPrivateSol`: config (seeds, not mut), `deposit_record` (mut, seeds `[…, depositor, NATIVE_SOL_MINT]`, `has_one = depositor`), `sol_vault` (mut, seeds `[VAULT_SOL_SEED]`, bump), `sol_fee` (mut, seeds `[FEE_SOL_SEED]`, bump), `stealth: SystemAccount<'info>` (mut), `depositor: Signer` (mut), + the three sip-privacy CPI accounts (`sip_config`, `sip_transfer_record`, `sip_privacy_program`) + `system_program` (same as `WithdrawPrivate`, minus all token accounts).

- [ ] **Step 3: Build + run.** Expected: PASS (net/fee/vault deltas + TransferRecord exist + InsufficientBalance rejects).

- [ ] **Step 4: Add the rent-reserve guard test.** Deposit a tiny amount into a *fresh* SOL vault whose lamports are near the rent floor, attempt a withdrawal that would breach `rent_min`; assert `RentReserveViolation`. (Construct by depositing exactly enough that `vault.lamports() - amount < rent_min`.) Run — Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add programs/sipher-vault/programs/sipher-vault/src/lib.rs \
        programs/sipher-vault/tests/sipher-vault/12-native-sol.test.ts
git commit -S -m "feat(sipher-vault): withdraw_private_sol — checked native withdrawal + rent guard + announcement"
```

---

### Task 8: `refund_sol` + `authority_refund_sol`

**Files:** Modify `lib.rs` (two instructions + `RefundSol` / `AuthorityRefundSol` contexts).

**Interfaces (Produces):** native refunds; destination = original depositor only; timeout enforced.

- [ ] **Step 1: Failing tests** (`12-native-sol.test.ts`): `refund_sol` after `ctx.setClock` past `refund_timeout` returns the unlocked balance to the depositor (lamport delta) and zeroes `balance` to `locked_amount`; before the timeout → `RefundNotExpired`. `authority_refund_sol`: authority-signed, depositor is non-signer account, same timeout enforced; wrong-authority → `Unauthorized`. Run — Expected: FAIL.

- [ ] **Step 2: Implement** (mirror `refund`/`authority_refund`, checked lamport mutation `sol_vault → depositor`):
```rust
pub fn refund_sol(ctx: Context<RefundSol>) -> Result<()> {
    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance.checked_sub(record.locked_amount).ok_or(VaultError::MathOverflow)?;
    require!(available > 0, VaultError::NothingToRefund);
    let now = Clock::get()?.unix_timestamp;
    let elapsed = now.checked_sub(record.last_deposit_at).ok_or(VaultError::MathOverflow)?;
    require!(elapsed >= ctx.accounts.config.refund_timeout, VaultError::RefundNotExpired);

    let vault_ai = ctx.accounts.sol_vault.to_account_info();
    let new_vault = vault_ai.lamports().checked_sub(available).ok_or(VaultError::MathOverflow)?;
    let rent_min = Rent::get()?.minimum_balance(vault_ai.data_len());
    require!(new_vault >= rent_min, VaultError::RentReserveViolation);
    let dep_ai = ctx.accounts.depositor.to_account_info();
    let new_dep = dep_ai.lamports().checked_add(available).ok_or(VaultError::MathOverflow)?;
    **vault_ai.try_borrow_mut_lamports()? = new_vault;
    **dep_ai.try_borrow_mut_lamports()? = new_dep;
    record.balance = record.locked_amount;
    Ok(())
}
```
`authority_refund_sol` is identical except: context `config` has `has_one = authority`, `authority: Signer`, `depositor: SystemAccount` (non-signer, used for the `deposit_record` seed + as the lamport destination), and it adds `require!(!ctx.accounts.config.paused, …)` (matching `authority_refund`). Contexts: `RefundSol` = config, deposit_record(mut, seeds `[…, depositor, NATIVE_SOL_MINT]`, has_one depositor), sol_vault(mut), depositor(Signer, mut). `AuthorityRefundSol` = config(has_one authority), deposit_record(mut, has_one depositor), sol_vault(mut), depositor(SystemAccount, mut), authority(Signer, mut).

- [ ] **Step 3: Build + run.** Expected: PASS (both, incl. timeout + unauthorized rejects).
- [ ] **Step 4: Commit.** `git commit -S -m "feat(sipher-vault): refund_sol + authority_refund_sol — depositor-only native refunds"`

---

### Task 9: `collect_fee_sol`

**Files:** Modify `lib.rs` (instruction + `CollectFeeSol` context).

**Interfaces (Produces):** authority drains `SolFee` lamports above its rent floor.

- [ ] **Step 1: Failing test** (`12-native-sol.test.ts`): after a native withdrawal accrued fees, `collectFeeSol(0)` moves all collectable `solFee` lamports (above rent_min) to the authority; wrong authority → `Unauthorized`. Run — Expected: FAIL.

- [ ] **Step 2: Implement:**
```rust
pub fn collect_fee_sol(ctx: Context<CollectFeeSol>, amount: u64) -> Result<()> {
    let fee_ai = ctx.accounts.sol_fee.to_account_info();
    let rent_min = Rent::get()?.minimum_balance(fee_ai.data_len());
    let collectable = fee_ai.lamports().checked_sub(rent_min).ok_or(VaultError::MathOverflow)?;
    require!(collectable > 0, VaultError::NoFeesToCollect);
    let take = if amount == 0 || amount > collectable { collectable } else { amount };
    let auth_ai = ctx.accounts.authority.to_account_info();
    let new_fee = fee_ai.lamports().checked_sub(take).ok_or(VaultError::MathOverflow)?;
    let new_auth = auth_ai.lamports().checked_add(take).ok_or(VaultError::MathOverflow)?;
    **fee_ai.try_borrow_mut_lamports()? = new_fee;
    **auth_ai.try_borrow_mut_lamports()? = new_auth;
    Ok(())
}

#[derive(Accounts)]
pub struct CollectFeeSol<'info> {
    #[account(seeds = [VAULT_CONFIG_SEED], bump = config.bump, has_one = authority @ VaultError::Unauthorized)]
    pub config: Account<'info, VaultConfig>,
    #[account(mut, seeds = [FEE_SOL_SEED], bump = sol_fee.bump)]
    pub sol_fee: Account<'info, SolFee>,
    #[account(mut)]
    pub authority: Signer<'info>,
}
```

- [ ] **Step 3: Build + run.** Expected: PASS.
- [ ] **Step 4: Run the full bankrun suite** (`tests/sipher-vault/1*.test.ts`) — Expected: ALL PASS (classic regression + T2022 allowlist + native track).
- [ ] **Step 5: Commit.** `git commit -S -m "feat(sipher-vault): collect_fee_sol — authority drains native fees above rent floor"`

---

### Task 10: Devnet redeploy + integration

**Files:** Modify `programs/sipher-vault/DEPLOYMENT.md` (record the new instructions + the devnet upgrade); add `scripts/create-sol-vault.ts` (raw-ix, mirrors `e2e-cpi-test.ts` style).

- [ ] **Step 1: Naming-gate sweep.** Run the confidential naming-gate regex (from the private handoff) over `programs/sipher-vault/ docs/superpowers/` → Expected: no hits. Fix any.
- [ ] **Step 2: Build the deployable binary.** `anchor build --no-idl`; note the new binary size. (IDL regeneration is out of scope — tracked in #1161.)
- [ ] **Step 3: Deploy to devnet** (program-upgrade, authority `FGSkt8…`, per `DEPLOYMENT.md`): `solana program deploy target/deploy/sipher_vault.so --program-id ~/Documents/secret/sipher-vault-program-id.json --keypair ~/Documents/secret/solana-devnet.json --url devnet --with-compute-unit-price 10000`.
- [ ] **Step 4: Initialize the SOL vault on devnet.** Run `scripts/create-sol-vault.ts` (raw `create_sol_vault` ix). Verify `SolVault`/`SolFee` PDAs exist on devnet.
- [ ] **Step 5: Update `DEPLOYMENT.md`** (new instruction list: +`create_sol_vault`, `deposit_sol`, `withdraw_private_sol`, `refund_sol`, `authority_refund_sol`, `collect_fee_sol`; devnet upgrade TX + slot; note mainnet deploy is B6-gated). Commit.
```bash
git add programs/sipher-vault/DEPLOYMENT.md programs/sipher-vault/scripts/create-sol-vault.ts
git commit -S -m "chore(sipher-vault): devnet redeploy of universal-asset vault + SOL vault init"
```
- [ ] **Step 6: Open the PR** (base `main`; body partner-name-free; includes the spec + this plan). Do NOT self-merge — RECTOR reviews.

---

## Self-Review

**Spec coverage:** §4 two-track architecture → Tasks 2/3/5–9. §5.1 PDAs/sentinel → Task 2. §5.2 native track (all `*_sol`) → Tasks 5–9. §5.3 interface + allowlist → Tasks 3/4. §5.4 sentinel announcement → Task 7 (+event mint Task 2). §5.5 event field → Task 2. §5.6 errors → Task 2. §8 lamport safety + rent guard → Tasks 7/8/9 (checked math + `RentReserveViolation` tests). §9 testing (one reject per extension + unknown) → Task 4. §10 devnet redeploy → Task 10. Classic-SPL regression → Task 1 baseline + Task 3 gate. **No gaps.**

**Placeholder scan:** the only deferred-detail markers are explicit "confirm symbol path against installed crate" notes (Tasks 3/4) and "copy the announcement encoding block verbatim from `withdraw_private`" (Task 7) — both reference concrete existing code, not missing content. No TBD/TODO.

**Type consistency:** `NATIVE_SOL_MINT`, `SolVault`/`SolFee`, `VaultWithdrawEvent.mint`, and the helper signatures (`disc`, `parseDepositRecord`, `sendIx`, `startVault`) are defined in Tasks 1–2 and consumed unchanged downstream. Lamport-mutation pattern (compute-checked-then-assign) is identical across Tasks 7/8/9.
