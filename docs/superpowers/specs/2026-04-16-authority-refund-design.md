# Authority Refund + Wire performVaultRefund — Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Scope:** Anchor program instruction + SDK function + agent wiring
**Repos:** sip-protocol (program + SDK), sipher (agent)

---

## 1. Overview

Add an `authority_refund` instruction to the sipher_vault Anchor program that lets the vault authority refund a depositor's available balance after the refund timeout expires. This mirrors the existing `refund` instruction but swaps the signer from depositor to authority — enabling SENTINEL to autonomously refund expired/unclaimed deposits without holding depositor keypairs.

Then wire `performVaultRefund` in the sipher agent to call this new instruction, closing the last functional gap in SENTINEL formalization.

## 2. Goals / Non-Goals

### Goals
- Authority can refund any deposit after refund_timeout (24h default)
- On-chain timeout enforcement preserved (authority does NOT bypass safety)
- SENTINEL's `executeRefund` tool works end-to-end (immediate + circuit-breaker paths)
- Full test coverage (Anchor + SDK + agent)

### Non-Goals
- Emergency instant refund (timeout bypass) — use kill switch + manual intervention
- Changing existing `refund` instruction (depositor-signed path stays untouched)
- Mainnet deploy (devnet first; mainnet is a separate decision)

## 3. Design

### 3.1 Anchor Instruction: `authority_refund`

**File:** `programs/sipher-vault/programs/sipher-vault/src/lib.rs`

**Logic** (identical to existing `refund` except signer):

```rust
pub fn authority_refund(ctx: Context<AuthorityRefund>) -> Result<()> {
    require!(!ctx.accounts.config.paused, VaultError::ProgramPaused);

    let record = &mut ctx.accounts.deposit_record;
    let available = record.balance
        .checked_sub(record.locked_amount)
        .ok_or(VaultError::MathOverflow)?;
    require!(available > 0, VaultError::NothingToRefund);

    let now = Clock::get()?.unix_timestamp;
    let elapsed = now
        .checked_sub(record.last_deposit_at)
        .ok_or(VaultError::MathOverflow)?;
    require!(
        elapsed >= ctx.accounts.config.refund_timeout,
        VaultError::RefundNotExpired
    );

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

    record.balance = record.locked_amount;

    msg!("Authority refunded {} tokens to {}", available, ctx.accounts.depositor.key());
    Ok(())
}
```

### 3.2 Accounts Context: `AuthorityRefund`

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

    /// CHECK: Not a signer. Validated by deposit_record.has_one and used for
    /// PDA derivation + token account ownership check.
    pub depositor: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
```

**Key differences from `Refund` context:**
- `authority: Signer` replaces `depositor: Signer`
- `config` gains `has_one = authority` constraint
- `depositor` becomes `/// CHECK` (not signer, just a reference for PDA derivation)

### 3.3 SDK Function: `buildAuthorityRefundTx`

**File:** `packages/sdk/src/vault.ts`

```typescript
export async function buildAuthorityRefundTx(
  connection: Connection,
  authority: PublicKey,
  depositor: PublicKey,
  tokenMint: PublicKey,
  depositorTokenAccount: PublicKey,
): Promise<{ transaction: Transaction; refundAmount: number }>
```

Mirrors existing `buildRefundTx` but passes `authority` as the fee payer and signer, `depositor` as a non-signing account.

### 3.4 Agent Wiring: `performVaultRefund`

**File:** `packages/agent/src/sentinel/vault-refund.ts` (sipher repo)

Replace the stub with:

```typescript
export async function performVaultRefund(
  pda: string,
  amount: number,
): Promise<{ success: boolean; txId?: string; error?: string }> {
  const keypairPath = process.env.SENTINEL_AUTHORITY_KEYPAIR
  if (!keypairPath) {
    throw new Error('SENTINEL_AUTHORITY_KEYPAIR env not set')
  }
  const authority = loadKeypairFromFile(keypairPath)
  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  // Derive depositor + mint from the deposit record PDA
  const depositRecord = await fetchDepositRecord(connection, new PublicKey(pda))
  const depositorTokenAccount = await getAssociatedTokenAddress(
    depositRecord.tokenMint, depositRecord.depositor,
  )

  const { transaction } = await buildAuthorityRefundTx(
    connection, authority.publicKey,
    depositRecord.depositor, depositRecord.tokenMint,
    depositorTokenAccount,
  )
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  transaction.feePayer = authority.publicKey
  transaction.sign(authority)

  const txId = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  })
  await connection.confirmTransaction(txId, 'confirmed')

  return { success: true, txId }
}
```

**New env var:** `SENTINEL_AUTHORITY_KEYPAIR` — path to authority keypair JSON file.

**Helper:** `fetchDepositRecord(connection, pda)` — reads the on-chain DepositRecord account and deserializes depositor + token_mint fields. Added to `@sipher/sdk` vault.ts.

### 3.5 Remove startup warning

Once `performVaultRefund` is wired, `assertVaultRefundWired` in `vault-refund.ts` should check for `SENTINEL_AUTHORITY_KEYPAIR` env presence instead of the `SENTINEL_VAULT_REFUND_WIRED` flag. If the keypair env is set + file exists → wired. No more manual flag.

## 4. Testing

### 4.1 Anchor tests (3 new in `03-refund.test.ts`)

1. **Authority refund succeeds after timeout** — deposit, warp clock past 24h, call authority_refund with authority signer, verify balance zeroed + tokens returned to depositor
2. **Authority refund fails before timeout** — deposit, immediately call authority_refund, expect RefundNotExpired
3. **Non-authority signer rejected** — call authority_refund with wrong signer, expect Unauthorized

### 4.2 SDK test

1. **buildAuthorityRefundTx returns valid transaction** — construct TX, verify accounts + instruction data

### 4.3 Agent tests (update `vault-refund.test.ts`)

1. **performVaultRefund calls SDK + signs + sends** — mock SDK + Connection, verify keypair loading + TX signing
2. **performVaultRefund throws when SENTINEL_AUTHORITY_KEYPAIR unset** — verify error message

## 5. Deployment

1. Build: `cd programs/sipher-vault && anchor build`
2. Deploy to devnet: `solana program deploy target/deploy/sipher_vault.so --program-id ~/Documents/secret/sipher-vault-program-id.json --keypair ~/Documents/secret/solana-devnet.json --url devnet`
3. Verify: run Anchor test suite against devnet
4. Mainnet: separate decision after QA

## 6. File inventory

### sip-protocol repo
| File | Change |
|------|--------|
| `programs/sipher-vault/programs/sipher-vault/src/lib.rs` | Add `authority_refund` instruction + `AuthorityRefund` context (~50 lines) |
| `programs/sipher-vault/tests/sipher-vault/03-refund.test.ts` | Add 3 authority_refund tests |
| `packages/sdk/src/vault.ts` | Add `buildAuthorityRefundTx` + `fetchDepositRecord` |
| `packages/sdk/tests/vault.test.ts` | Add SDK test (if exists) |

### sipher repo
| File | Change |
|------|--------|
| `packages/agent/src/sentinel/vault-refund.ts` | Replace stub with real implementation |
| `packages/agent/tests/sentinel/vault-refund.test.ts` | Update tests for real implementation |

---

**End of design spec.** Next step: implementation plan via `superpowers:writing-plans`.
