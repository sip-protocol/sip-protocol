# Authority Refund + Wire performVaultRefund — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `authority_refund` instruction to sipher_vault Anchor program (authority signs instead of depositor, timeout still enforced), add SDK builder, wire `performVaultRefund` in the sipher agent so SENTINEL can autonomously refund expired deposits.

**Architecture:** New Anchor instruction mirrors existing `refund` (same transfer logic, same timeout check) but swaps the signer from depositor to authority via `has_one = authority` (same pattern as `collect_fee`). SDK gets `buildAuthorityRefundTx` (mirrors `buildRefundTx`). Agent's `performVaultRefund` loads authority keypair, builds TX via SDK, signs, sends.

**Tech Stack:** Rust/Anchor 0.30.1, TypeScript, `@solana/web3.js`, `@solana/spl-token`, `anchor-bankrun`, Vitest.

**Repos:** sip-protocol (Tasks 1-2), sipher (Tasks 3-4).

**Spec:** `docs/superpowers/specs/2026-04-16-authority-refund-design.md`

---

## File Structure

**sip-protocol repo** (`/Users/rector/local-dev/sip-protocol`):

| File | Change |
|------|--------|
| `programs/sipher-vault/programs/sipher-vault/src/lib.rs` | Add `authority_refund` fn + `AuthorityRefund` context (~50 lines) |
| `programs/sipher-vault/tests/sipher-vault/03-refund.test.ts` | Add 3 authority_refund tests (~120 lines) |

**sipher repo** (`/Users/rector/local-dev/sipher`):

| File | Change |
|------|--------|
| `packages/sdk/src/vault.ts` | Add `buildAuthorityRefundTx` + `fetchDepositRecord` (~60 lines) |
| `packages/sdk/src/types.ts` | Add `AuthorityRefundResult` type (if needed) |
| `packages/agent/src/sentinel/vault-refund.ts` | Replace stub with real implementation (~40 lines) |
| `packages/agent/tests/sentinel/vault-refund.test.ts` | Update tests for real impl (~30 lines changed) |

---

## Task 1: Add `authority_refund` instruction to Anchor program

**Repo:** `/Users/rector/local-dev/sip-protocol`
**Files:**
- Modify: `programs/sipher-vault/programs/sipher-vault/src/lib.rs`

- [ ] **Step 1: Add the `authority_refund` function**

In `lib.rs`, after the existing `refund` function (ends around line 307) and before `collect_fee`, add:

```rust
    pub fn authority_refund(ctx: Context<AuthorityRefund>) -> Result<()> {
        require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);

        let record = &mut ctx.accounts.deposit_record;
        let available = record.balance
            .checked_sub(record.locked_amount)
            .ok_or(VaultError::MathOverflow)?;
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
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.depositor_token.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, available)?;

        // Zero out refunded balance (locked_amount preserved)
        record.balance = record.locked_amount;

        msg!("Authority refunded {} tokens to {}", available, ctx.accounts.depositor.key());
        Ok(())
    }
```

- [ ] **Step 2: Add the `AuthorityRefund` accounts context**

After the existing `Refund` context struct, add:

```rust
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
    )]
    pub vault_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = depositor_token.owner == depositor.key() @ VaultError::Unauthorized,
        constraint = depositor_token.mint == deposit_record.token_mint @ VaultError::InvalidMint,
    )]
    pub depositor_token: Account<'info, TokenAccount>,

    /// CHECK: Not a signer — validated by deposit_record.has_one. Used for PDA
    /// derivation and token account ownership check. The authority (not depositor)
    /// is the signer for this instruction.
    pub depositor: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
```

- [ ] **Step 3: Build the program**

```bash
cd /Users/rector/local-dev/sip-protocol/programs/sipher-vault
anchor build
```

Expected: `sipher_vault.so` compiles without errors. IDL regenerated at `target/idl/sipher_vault.json` with `authority_refund` instruction.

- [ ] **Step 4: Verify IDL has the new instruction**

```bash
grep -o '"authority_refund"' target/idl/sipher_vault.json
```

Expected: `"authority_refund"` appears.

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sip-protocol
git add programs/sipher-vault/programs/sipher-vault/src/lib.rs programs/sipher-vault/target/idl/sipher_vault.json
git commit -m "feat(sipher-vault): add authority_refund instruction (authority signs, timeout enforced)"
```

---

## Task 2: Add Anchor tests for `authority_refund`

**Repo:** `/Users/rector/local-dev/sip-protocol`
**Files:**
- Modify: `programs/sipher-vault/tests/sipher-vault/03-refund.test.ts`

- [ ] **Step 1: Add 3 authority_refund test cases**

At the end of `03-refund.test.ts`, BEFORE the closing `})` of the `describe` block and BEFORE the `getTokenBalance` helper, insert a new `describe` block:

```typescript
  // ── Authority Refund tests ──────────────────────────────────────────────

  describe('authority_refund', () => {
    // Re-deposit so there's balance to refund (previous tests emptied it)
    before(async () => {
      // Advance slot for fresh blockhash
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)

      await program.methods
        .deposit(new anchor.BN(DEPOSIT_AMOUNT_1))
        .accounts({
          config: configPDA,
          vaultToken: vaultTokenPDA,
          depositorToken: depositorAta,
          tokenMint: mint,
          depositor: payer.publicKey,
        })
        .rpc()

      const record = await program.account.depositRecord.fetch(depositRecordPDA)
      expect(record.balance.toNumber()).to.equal(DEPOSIT_AMOUNT_1)
    })

    it('rejects authority_refund before timeout (RefundNotExpired)', async () => {
      // Don't advance time — deposit just happened
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)

      try {
        await program.methods
          .authorityRefund()
          .accounts({
            config: configPDA,
            depositRecord: depositRecordPDA,
            vaultToken: vaultTokenPDA,
            depositorToken: depositorAta,
            depositor: payer.publicKey,
            authority: payer.publicKey,
          })
          .rpc()
        expect.fail('Should have thrown RefundNotExpired')
      } catch (err: any) {
        const hasError =
          err.error?.errorCode?.code === 'RefundNotExpired' ||
          err.logs?.some((log: string) => log.includes('RefundNotExpired')) ||
          err.toString().includes('RefundNotExpired')
        expect(hasError, `Expected RefundNotExpired, got: ${err.message || err}`).to.be.true
      }
    })

    it('rejects authority_refund from non-authority signer (Unauthorized)', async () => {
      const fakeSigner = Keypair.generate()

      // Fund the fake signer so it can pay tx fees
      const transferIx = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: fakeSigner.publicKey,
        lamports: 100_000_000,
      })
      const fundTx = new Transaction().add(transferIx)
      fundTx.feePayer = payer.publicKey
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)
      fundTx.recentBlockhash = provider.context.lastBlockhash
      fundTx.sign(payer)
      await provider.context.banksClient.processTransaction(fundTx)

      // Warp past timeout so only the auth check should fail
      const clock2 = await provider.context.banksClient.getClock()
      const warpedSlot = clock2.slot + 2n
      provider.context.warpToSlot(warpedSlot)
      const warpedTimestamp = clock2.unixTimestamp + BigInt(DEFAULT_REFUND_TIMEOUT) + 1n
      provider.context.setClock(
        new Clock(warpedSlot, clock2.epochStartTimestamp, clock2.epoch, clock2.leaderScheduleEpoch, warpedTimestamp),
      )

      try {
        await program.methods
          .authorityRefund()
          .accounts({
            config: configPDA,
            depositRecord: depositRecordPDA,
            vaultToken: vaultTokenPDA,
            depositorToken: depositorAta,
            depositor: payer.publicKey,
            authority: fakeSigner.publicKey,
          })
          .signers([fakeSigner])
          .rpc()
        expect.fail('Should have thrown Unauthorized')
      } catch (err: any) {
        const hasError =
          err.error?.errorCode?.code === 'Unauthorized' ||
          err.logs?.some((log: string) => log.includes('Unauthorized') || log.includes('has_one')) ||
          err.toString().includes('Unauthorized') ||
          err.toString().includes('ConstraintHasOne') ||
          err.toString().includes('2001')
        expect(hasError, `Expected Unauthorized, got: ${err.message || err}`).to.be.true
      }
    })

    it('authority_refund succeeds after timeout (authority signs, tokens return to depositor)', async () => {
      // Time is already warped past timeout from the previous test
      const clock = await provider.context.banksClient.getClock()
      provider.context.warpToSlot(clock.slot + 2n)

      const depositorBalanceBefore = await getTokenBalance(provider, depositorAta)
      const vaultBalanceBefore = await getTokenBalance(provider, vaultTokenPDA)
      const record = await program.account.depositRecord.fetch(depositRecordPDA)
      const availableToRefund = record.balance.toNumber() - record.lockedAmount.toNumber()

      expect(availableToRefund).to.equal(DEPOSIT_AMOUNT_1)

      await program.methods
        .authorityRefund()
        .accounts({
          config: configPDA,
          depositRecord: depositRecordPDA,
          vaultToken: vaultTokenPDA,
          depositorToken: depositorAta,
          depositor: payer.publicKey,
          authority: payer.publicKey,
        })
        .rpc()

      // Verify: deposit record balance zeroed
      const recordAfter = await program.account.depositRecord.fetch(depositRecordPDA)
      expect(recordAfter.balance.toNumber()).to.equal(recordAfter.lockedAmount.toNumber())
      expect(recordAfter.balance.toNumber()).to.equal(0)

      // Verify: depositor received tokens
      const depositorBalanceAfter = await getTokenBalance(provider, depositorAta)
      expect(depositorBalanceAfter).to.equal(depositorBalanceBefore + availableToRefund)

      // Verify: vault balance decreased
      const vaultBalanceAfter = await getTokenBalance(provider, vaultTokenPDA)
      expect(vaultBalanceAfter).to.equal(vaultBalanceBefore - availableToRefund)
    })
  })
```

- [ ] **Step 2: Run the tests**

```bash
cd /Users/rector/local-dev/sip-protocol/programs/sipher-vault
anchor test
```

Expected: all existing tests pass + 3 new authority_refund tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/rector/local-dev/sip-protocol
git add programs/sipher-vault/tests/sipher-vault/03-refund.test.ts
git commit -m "test(sipher-vault): add 3 authority_refund tests (timeout, unauthorized, happy path)"
```

---

## Task 3: Add `buildAuthorityRefundTx` to SDK

**Repo:** `/Users/rector/local-dev/sipher`
**Files:**
- Modify: `packages/sdk/src/vault.ts`
- Modify: `packages/sdk/src/types.ts` (if `AuthorityRefundResult` type needed, or reuse `RefundResult`)

- [ ] **Step 1: Add `fetchDepositRecord` helper**

At the end of `packages/sdk/src/vault.ts`, before the final closing, add:

```typescript
/**
 * Fetch and deserialize a DepositRecord from chain.
 * Used by SENTINEL's performVaultRefund to derive depositor + mint from a PDA.
 */
export async function fetchDepositRecord(
  connection: Connection,
  depositRecordPDA: PublicKey,
): Promise<DepositRecord> {
  const info = await connection.getAccountInfo(depositRecordPDA)
  if (!info) {
    throw new Error(`DepositRecord not found at ${depositRecordPDA.toBase58()}`)
  }
  return deserializeDepositRecord(Buffer.from(info.data))
}
```

- [ ] **Step 2: Add `buildAuthorityRefundTx` function**

After `fetchDepositRecord`, add:

```typescript
/**
 * Build an authority-signed refund transaction (sipher_vault.authority_refund).
 *
 * Unlike buildRefundTx (depositor signs), this is signed by the vault authority.
 * Used by SENTINEL for autonomous refunds of expired deposits after the
 * refund_timeout cooldown. Timeout is still enforced on-chain.
 */
export async function buildAuthorityRefundTx(
  connection: Connection,
  authority: PublicKey,
  depositor: PublicKey,
  tokenMint: PublicKey,
  depositorTokenAccount: PublicKey,
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): Promise<RefundResult> {
  const [configPDA] = deriveVaultConfigPDA(programId)
  const [depositRecordPDA] = deriveDepositRecordPDA(depositor, tokenMint, programId)
  const [vaultTokenPDA] = deriveVaultTokenPDA(tokenMint, programId)

  // Pre-fetch balance to compute refund amount
  const recordInfo = await connection.getAccountInfo(depositRecordPDA)
  if (!recordInfo) {
    throw new Error('No deposit record found — nothing to refund')
  }
  const record = deserializeDepositRecord(Buffer.from(recordInfo.data))
  const refundAmount = record.balance - record.lockedAmount
  if (refundAmount <= 0n) {
    throw new Error('No available balance to refund (all funds locked or zero)')
  }

  // Encode: discriminator(8) only — authority_refund has no params
  const data = anchorDiscriminator('authority_refund')

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPDA, isSigner: false, isWritable: false },       // config
      { pubkey: depositRecordPDA, isSigner: false, isWritable: true }, // deposit_record
      { pubkey: vaultTokenPDA, isSigner: false, isWritable: true },    // vault_token
      { pubkey: depositorTokenAccount, isSigner: false, isWritable: true }, // depositor_token
      { pubkey: depositor, isSigner: false, isWritable: false },       // depositor (NOT signer)
      { pubkey: authority, isSigner: true, isWritable: true },         // authority (signer)
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.feePayer = authority

  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash

  return {
    transaction: tx,
    refundAmount,
    depositorTokenAddress: depositorTokenAccount,
  }
}
```

- [ ] **Step 3: Build + test SDK**

```bash
cd /Users/rector/local-dev/sipher
pnpm -F @sipher/sdk build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/sdk/src/vault.ts
git commit -m "feat(sdk): add buildAuthorityRefundTx + fetchDepositRecord for SENTINEL auto-refund"
```

---

## Task 4: Wire `performVaultRefund` in agent + update tests

**Repo:** `/Users/rector/local-dev/sipher`
**Files:**
- Modify: `packages/agent/src/sentinel/vault-refund.ts`
- Modify: `packages/agent/tests/sentinel/vault-refund.test.ts`

- [ ] **Step 1: Replace the stub in `vault-refund.ts`**

Replace the full content of `packages/agent/src/sentinel/vault-refund.ts` with:

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { readFileSync } from 'node:fs'
import {
  buildAuthorityRefundTx,
  fetchDepositRecord,
  createConnection,
} from '@sipher/sdk'

/**
 * Load a Solana keypair from a JSON file (standard CLI format: [u8; 64]).
 */
function loadKeypairFromFile(filepath: string): Keypair {
  const raw = JSON.parse(readFileSync(filepath, 'utf-8')) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(raw))
}

/**
 * Authority-signed refund via sipher_vault.authority_refund instruction.
 *
 * Loads the authority keypair from SENTINEL_AUTHORITY_KEYPAIR env,
 * fetches the deposit record on-chain to derive depositor + mint,
 * builds the TX via @sipher/sdk, signs with authority, and sends.
 *
 * Timeout is enforced on-chain — this will fail if the deposit's
 * refund_timeout (24h default) hasn't elapsed since last_deposit_at.
 */
export async function performVaultRefund(
  pda: string,
  amount: number,
): Promise<{ success: boolean; txId?: string; error?: string }> {
  void amount // amount is informational — on-chain refunds all available balance

  const keypairPath = process.env.SENTINEL_AUTHORITY_KEYPAIR
  if (!keypairPath) {
    throw new Error('SENTINEL_AUTHORITY_KEYPAIR env not set — cannot sign authority refund')
  }
  const authority = loadKeypairFromFile(keypairPath)
  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  // Fetch deposit record to get depositor + tokenMint
  const depositRecord = await fetchDepositRecord(connection, new PublicKey(pda))
  const depositorTokenAccount = await getAssociatedTokenAddress(
    depositRecord.tokenMint, depositRecord.depositor,
  )

  const { transaction } = await buildAuthorityRefundTx(
    connection,
    authority.publicKey,
    depositRecord.depositor,
    depositRecord.tokenMint,
    depositorTokenAccount,
  )

  transaction.sign(authority)

  const txId = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  })
  await connection.confirmTransaction(txId, 'confirmed')

  return { success: true, txId }
}

/**
 * Startup check: warn if authority keypair is missing in production.
 */
export function assertVaultRefundWired(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SENTINEL_MODE !== 'off' &&
    !process.env.SENTINEL_AUTHORITY_KEYPAIR
  ) {
    console.warn(
      '[SENTINEL] SENTINEL_AUTHORITY_KEYPAIR env not set. Authority refunds will throw at runtime. ' +
      'Set it to the path of the vault authority keypair JSON, or run with SENTINEL_MODE=off.',
    )
  }
}
```

- [ ] **Step 2: Update `vault-refund.test.ts`**

Replace the full content of `packages/agent/tests/sentinel/vault-refund.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('vault-refund', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.resetModules()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    warnSpy.mockRestore()
  })

  describe('performVaultRefund', () => {
    it('throws when SENTINEL_AUTHORITY_KEYPAIR not set', async () => {
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { performVaultRefund } = await import('../../src/sentinel/vault-refund.js')
      await expect(performVaultRefund('pda1', 0.5))
        .rejects.toThrow(/SENTINEL_AUTHORITY_KEYPAIR/)
    })

    it('calls buildAuthorityRefundTx + signs + sends when keypair is set', async () => {
      process.env.SENTINEL_AUTHORITY_KEYPAIR = '/tmp/fake-keypair.json'

      const mockTx = {
        sign: vi.fn(),
        serialize: vi.fn().mockReturnValue(Buffer.from('fake-tx')),
      }
      const mockDepositRecord = {
        depositor: { toBase58: () => 'depositor1' },
        tokenMint: { toBase58: () => 'mint1' },
      }

      vi.doMock('@sipher/sdk', () => ({
        createConnection: vi.fn().mockReturnValue({
          sendRawTransaction: vi.fn().mockResolvedValue('txSig123'),
          confirmTransaction: vi.fn().mockResolvedValue({ value: {} }),
        }),
        fetchDepositRecord: vi.fn().mockResolvedValue(mockDepositRecord),
        buildAuthorityRefundTx: vi.fn().mockResolvedValue({
          transaction: mockTx,
          refundAmount: 500_000n,
          depositorTokenAddress: 'ata1',
        }),
      }))
      vi.doMock('node:fs', () => ({
        readFileSync: vi.fn().mockReturnValue(JSON.stringify(Array(64).fill(1))),
      }))
      vi.doMock('@solana/spl-token', () => ({
        getAssociatedTokenAddress: vi.fn().mockResolvedValue('ata1'),
      }))
      vi.doMock('@solana/web3.js', async () => {
        const actual = await vi.importActual('@solana/web3.js')
        return { ...actual as object }
      })

      const { performVaultRefund } = await import('../../src/sentinel/vault-refund.js')
      const result = await performVaultRefund('pda1', 0.5)

      expect(result.success).toBe(true)
      expect(result.txId).toBe('txSig123')
      expect(mockTx.sign).toHaveBeenCalled()

      vi.doUnmock('@sipher/sdk')
      vi.doUnmock('node:fs')
      vi.doUnmock('@solana/spl-token')
      vi.doUnmock('@solana/web3.js')
    })
  })

  describe('assertVaultRefundWired', () => {
    it('warns when prod + mode!=off + no keypair', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SENTINEL_MODE = 'yolo'
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SENTINEL_AUTHORITY_KEYPAIR'))
    })

    it('silent when SENTINEL_AUTHORITY_KEYPAIR is set', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SENTINEL_MODE = 'yolo'
      process.env.SENTINEL_AUTHORITY_KEYPAIR = '/some/path.json'
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('silent when mode=off', async () => {
      process.env.NODE_ENV = 'production'
      process.env.SENTINEL_MODE = 'off'
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('silent in non-prod', async () => {
      process.env.NODE_ENV = 'development'
      process.env.SENTINEL_MODE = 'yolo'
      delete process.env.SENTINEL_AUTHORITY_KEYPAIR
      const { assertVaultRefundWired } = await import('../../src/sentinel/vault-refund.js')
      assertVaultRefundWired()
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 3: Run agent tests**

```bash
cd /Users/rector/local-dev/sipher/packages/agent && pnpm test
```

Expected: 905 tests still pass (the vault-refund tests are updated, not added — count stays same or +1 if net new).

- [ ] **Step 4: Build**

```bash
cd /Users/rector/local-dev/sipher && pnpm build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/rector/local-dev/sipher
git add packages/agent/src/sentinel/vault-refund.ts packages/agent/tests/sentinel/vault-refund.test.ts packages/sdk/src/vault.ts
git commit -m "feat(sentinel): wire performVaultRefund with authority_refund instruction

Replaces the v1 stub with real implementation: loads authority keypair
from SENTINEL_AUTHORITY_KEYPAIR env, fetches deposit record on-chain,
builds authority_refund TX via @sipher/sdk, signs, sends. Startup
warning now checks for keypair presence instead of manual flag."
```

---

## Post-implementation

After all 4 tasks:

1. **Deploy to devnet** (from sip-protocol):
   ```bash
   cd /Users/rector/local-dev/sip-protocol/programs/sipher-vault
   solana program deploy target/deploy/sipher_vault.so \
     --program-id ~/Documents/secret/sipher-vault-program-id.json \
     --keypair ~/Documents/secret/solana-devnet.json \
     --url devnet \
     --with-compute-unit-price 10000
   ```

2. **Set env on VPS** (for sipher agent):
   ```
   SENTINEL_AUTHORITY_KEYPAIR=/path/to/authority.json
   ```

3. **QA with SENTINEL_MODE=advisory** first, then switch to `yolo` with low thresholds.

---

## Self-review checklist

- [ ] Spec §3.1: authority_refund instruction present with correct logic (timeout + transfer + balance zero)
- [ ] Spec §3.2: AuthorityRefund context has `has_one = authority`, depositor is `/// CHECK`
- [ ] Spec §3.3: buildAuthorityRefundTx mirrors buildRefundTx with authority as signer
- [ ] Spec §3.4: performVaultRefund loads keypair, fetches record, builds TX, signs, sends
- [ ] Spec §3.5: assertVaultRefundWired checks SENTINEL_AUTHORITY_KEYPAIR instead of manual flag
- [ ] Spec §4: All tests present (3 Anchor + 6 agent)
- [ ] Account ordering in SDK matches AuthorityRefund context exactly
- [ ] Discriminator uses `'authority_refund'` (not `'refund'`)
- [ ] No TODO/FIXME/TBD markers
