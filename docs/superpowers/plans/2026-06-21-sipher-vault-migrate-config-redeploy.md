# Sipher Vault `migrate_config` + B6 Devnet Redeploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the B6-hardened sipher-vault binary live on devnet by reusing program ID `S1Phr5…`, adding an authority-gated `migrate_config` instruction that grows the live `VaultConfig` to the new layout in place, then keeping the downstream `sipher` repo's IDL + error numbers in lockstep.

**Architecture:** `migrate_config` takes the config as a raw `UncheckedAccount` (the legacy 68-byte account can't be deserialized into `VaultConfig`), verifies the PDA via `seeds`+`bump`, gates on the authority read from bytes `[8..40]`, tops up the rent delta, then `realloc`s 68→101 with zero-init — and since Borsh encodes `None` as a single `0x00` byte, the zero-fill at offset 68 *is* `pending_authority = None`. Then an in-place `BPFLoaderUpgradeable` upgrade + `migrate_config` + `create_sol_vault` on devnet, and an IDL + error-renumber PR in `sipher`.

**Tech Stack:** Rust + Anchor 1.0.2, solana-bankrun (IDL-free raw-ix tests), `@solana/web3.js` + `tsx` scripts, Solana CLI 3.0.13 (Agave).

## Global Constraints

- Rust + TS: **2-space indent**; TS **no semicolons**.
- Build the SBF binary with **`cargo build-sbf --tools-version v1.52`** (Agave 3.0.13 defaults to v1.51, below Anchor 1.0.2's MSRV).
- Program ID **stays `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`**; config PDA **stays `CpL4qy…`**. No new IDs.
- Commits **GPG-signed** (key `BF47B9DC1FA320FA`, auto via `commit.gpgsign=true`); **no AI attribution** in commits/PRs/docs.
- **Do not self-merge** substantive PRs — RECTOR approves the merge.
- New error variants are **append-only** (never reorder — it renumbers codes).
- Branch: `feat/sipher-vault-migrate-config` (already created; the spec is committed there).
- **Deploy gate (Task 2):** the on-chain steps touch shared devnet + the devnet wallet. Confirm with RECTOR at execution time whether CIPHER runs them or hands off a runbook. Nothing is irreversible (program ID reused, not closed).

---

## Task 1: `migrate_config` instruction (TDD)

**Files:**
- Modify: `programs/sipher-vault/programs/sipher-vault/src/constants.rs` (add `LEGACY_VAULT_CONFIG_LEN`)
- Modify: `programs/sipher-vault/programs/sipher-vault/src/errors.rs` (append `InvalidConfigAccount`)
- Modify: `programs/sipher-vault/programs/sipher-vault/src/lib.rs` (handler + `MigrateConfig` accounts + `VaultConfigMigratedEvent`)
- Modify: `programs/sipher-vault/tests/sipher-vault/bankrun-helpers.ts` (add `ixMigrateConfig`)
- Modify: `programs/sipher-vault/package.json` (add `14` to the test glob)
- Create: `programs/sipher-vault/tests/sipher-vault/14-migrate-config.test.ts`

**Interfaces:**
- Consumes: `VaultConfig` (`state.rs`), `VAULT_CONFIG_SEED` + `LEGACY_VAULT_CONFIG_LEN` (`constants.rs`), `VaultError` (`errors.rs`), existing bankrun helpers (`disc`, `sendIx`, `startVault`, `getAccountData`, `parseVaultConfig`, `assertFails`, `ixInitialize`, `ixUpdateFee`, `VAULT_PROGRAM_ID`, `getVaultConfigPDA`).
- Produces: instruction `migrate_config` (no args; accounts `config` UncheckedAccount mut PDA, `authority` Signer mut, `system_program`); discriminator `sha256("global:migrate_config")[..8]`; error `InvalidConfigAccount` = **6014** (`0x177E`); event `VaultConfigMigratedEvent { authority, new_len, timestamp }`; helper `ixMigrateConfig(authority: PublicKey)`.

---

- [ ] **Step 1: Write the failing test file**

Create `programs/sipher-vault/tests/sipher-vault/14-migrate-config.test.ts`:

```typescript
// tests/sipher-vault/14-migrate-config.test.ts
//
// migrate_config — grows a legacy (pre-M1, 68-byte) VaultConfig to the current
// 101-byte layout by appending pending_authority = None. Authority-gated,
// idempotent. IDL-free bankrun harness (raw instructions).

import { assert } from 'chai'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'

import {
  ixInitialize,
  ixMigrateConfig,
  ixUpdateFee,
  sendIx,
  startVault,
  getAccountData,
  parseVaultConfig,
  assertFails,
  VAULT_PROGRAM_ID,
} from './bankrun-helpers'
import { getVaultConfigPDA } from './setup'

const LEGACY_LEN = 68
const NEW_LEN = 101

describe('14 · migrate_config (B6 VaultConfig layout migration)', () => {
  let ctx: ProgramTestContext
  let authority: Keypair
  let configPda: PublicKey
  let bump: number
  // Real VaultConfig account discriminator, derived empirically from a live
  // initialize so synthetic legacy accounts carry the exact discriminator the
  // typed handlers (e.g. update_fee) check.
  let configDisc: Buffer

  before(async () => {
    const tmp = await startVault()
    const [pda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
    await sendIx(tmp, [ixInitialize(tmp.payer.publicKey, 10, 86400n)], [tmp.payer])
    configDisc = Buffer.from((await getAccountData(tmp, pda)).subarray(0, 8))
  })

  beforeEach(async () => {
    ctx = await startVault()
    authority = ctx.payer
    ;[configPda, bump] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  })

  async function plantLegacy(opts: {
    authority: PublicKey
    feeBps: number
    refundTimeout: bigint
    paused: boolean
    totalDeposits: bigint
    totalDepositors: bigint
  }): Promise<void> {
    const d = Buffer.alloc(LEGACY_LEN)
    configDisc.copy(d, 0)
    opts.authority.toBuffer().copy(d, 8)
    d.writeUInt16LE(opts.feeBps, 40)
    d.writeBigInt64LE(opts.refundTimeout, 42)
    d.writeUInt8(opts.paused ? 1 : 0, 50)
    d.writeBigUInt64LE(opts.totalDeposits, 51)
    d.writeBigUInt64LE(opts.totalDepositors, 59)
    d.writeUInt8(bump, 67)
    const rent = await ctx.banksClient.getRent()
    ctx.setAccount(configPda, {
      lamports: Number(rent.minimumBalance(BigInt(LEGACY_LEN))),
      data: d,
      owner: VAULT_PROGRAM_ID,
      executable: false,
      rentEpoch: 0,
    })
  }

  async function plantNew(pendingAuthority: PublicKey | null): Promise<void> {
    const d = Buffer.alloc(NEW_LEN)
    configDisc.copy(d, 0)
    authority.publicKey.toBuffer().copy(d, 8)
    d.writeUInt16LE(10, 40)
    d.writeBigInt64LE(86400n, 42)
    d.writeUInt8(0, 50)
    d.writeBigUInt64LE(0n, 51)
    d.writeBigUInt64LE(0n, 59)
    d.writeUInt8(bump, 67)
    if (pendingAuthority) {
      d.writeUInt8(1, 68)
      pendingAuthority.toBuffer().copy(d, 69)
    }
    const rent = await ctx.banksClient.getRent()
    ctx.setAccount(configPda, {
      lamports: Number(rent.minimumBalance(BigInt(NEW_LEN))),
      data: d,
      owner: VAULT_PROGRAM_ID,
      executable: false,
      rentEpoch: 0,
    })
  }

  it('migrates a legacy 68-byte config → 101 bytes, fields preserved, pending=None', async () => {
    await plantLegacy({ authority: authority.publicKey, feeBps: 10, refundTimeout: 86400n, paused: false, totalDeposits: 5n, totalDepositors: 3n })
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])

    const data = await getAccountData(ctx, configPda)
    assert.strictEqual(data.length, NEW_LEN, 'account grew to new layout length')
    const cfg = parseVaultConfig(data)
    assert.ok(cfg.authority.equals(authority.publicKey))
    assert.strictEqual(cfg.feeBps, 10)
    assert.strictEqual(cfg.refundTimeout, 86400n)
    assert.strictEqual(cfg.paused, false)
    assert.strictEqual(cfg.totalDeposits, 5n)
    assert.strictEqual(cfg.totalDepositors, 3n)
    assert.strictEqual(cfg.bump, bump)
    assert.strictEqual(cfg.pendingAuthority, null, 'pending_authority appended as None')
    const rent = await ctx.banksClient.getRent()
    const acct = await ctx.banksClient.getAccount(configPda)
    assert.ok(BigInt(acct!.lamports) >= rent.minimumBalance(BigInt(NEW_LEN)), 'rent-exempt at new size')
  })

  it('is idempotent: re-running on an already-migrated config is a no-op', async () => {
    await plantLegacy({ authority: authority.publicKey, feeBps: 10, refundTimeout: 86400n, paused: false, totalDeposits: 1n, totalDepositors: 1n })
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])
    const cfg = parseVaultConfig(await getAccountData(ctx, configPda))
    assert.strictEqual(cfg.pendingAuthority, null)
    assert.strictEqual(cfg.totalDeposits, 1n)
  })

  it('never clobbers a live pending_authority on an already-migrated config', async () => {
    const pending = Keypair.generate().publicKey
    await plantNew(pending)
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])
    const cfg = parseVaultConfig(await getAccountData(ctx, configPda))
    assert.ok(cfg.pendingAuthority?.equals(pending), 'pending_authority preserved (no-op path)')
  })

  it('rejects a non-authority signer (Unauthorized 6001/0x1771)', async () => {
    await plantLegacy({ authority: authority.publicKey, feeBps: 10, refundTimeout: 86400n, paused: false, totalDeposits: 0n, totalDepositors: 0n })
    const attacker = Keypair.generate()
    await sendIx(ctx, [SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: attacker.publicKey, lamports: 5_000_000 })], [authority])
    await assertFails(
      () => sendIx(ctx, [ixMigrateConfig(attacker.publicKey)], [attacker]),
      ['unauthorized', '1771'],
    )
  })

  it('rejects a malformed (wrong-size) config account (InvalidConfigAccount 6014/0x177e)', async () => {
    const d = Buffer.alloc(40)
    configDisc.copy(d, 0)
    authority.publicKey.toBuffer().copy(d, 8)
    const rent = await ctx.banksClient.getRent()
    ctx.setAccount(configPda, { lamports: Number(rent.minimumBalance(40n)), data: d, owner: VAULT_PROGRAM_ID, executable: false, rentEpoch: 0 })
    await assertFails(
      () => sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority]),
      ['invalidconfigaccount', '177e'],
    )
  })

  it('migrated config is fully usable: update_fee succeeds afterward', async () => {
    await plantLegacy({ authority: authority.publicKey, feeBps: 10, refundTimeout: 86400n, paused: false, totalDeposits: 0n, totalDepositors: 0n })
    await sendIx(ctx, [ixMigrateConfig(authority.publicKey)], [authority])
    await sendIx(ctx, [ixUpdateFee(authority.publicKey, 25)], [authority])
    const cfg = parseVaultConfig(await getAccountData(ctx, configPda))
    assert.strictEqual(cfg.feeBps, 25, 'typed handlers accept the migrated account')
  })
})
```

- [ ] **Step 2: Add the `ixMigrateConfig` helper**

In `programs/sipher-vault/tests/sipher-vault/bankrun-helpers.ts`, after `ixUpdateFee` (~line 884), add:

```typescript
/**
 * migrate_config() — no args
 *
 * Accounts (MigrateConfig):
 *   config         mut, PDA (UncheckedAccount — legacy layout)
 *   authority      mut, signer
 *   system_program
 */
export function ixMigrateConfig(authority: PublicKey): TransactionInstruction {
  const [configPda] = getVaultConfigPDA(VAULT_PROGRAM_ID)
  return new TransactionInstruction({
    programId: VAULT_PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('migrate_config'),
  })
}
```

(`getVaultConfigPDA` is already imported from `./setup` in this file; `SystemProgram`, `TransactionInstruction`, `PublicKey` are already imported.)

- [ ] **Step 3: Add `14` to the bankrun test glob**

In `programs/sipher-vault/package.json`, change the `test` script glob from `{10,11,12,13}` to `{10,11,12,13,14}`:

```json
    "test": "ts-mocha -p ./tsconfig.json -t 1000000 \"tests/sipher-vault/{10,11,12,13,14}-*.ts\""
```

- [ ] **Step 4: Build the fixture + program, run the new test — verify it FAILS**

```bash
cd programs/sipher-vault
# sip_privacy.so fixture (present already, rebuild to be safe):
( cd ../sip-privacy && cargo build-sbf --tools-version v1.52 && cp target/deploy/sip_privacy.so ../sipher-vault/tests/fixtures/sip_privacy.so )
# build the (still-unmodified) vault program:
cargo build-sbf --tools-version v1.52
pnpm install --ignore-workspace
pnpm exec ts-mocha -p tsconfig.json -t 60000 'tests/sipher-vault/14-*.ts'
```

Expected: FAIL — `migrate_config` discriminator hits no handler, so `sendIx` rejects (e.g. "invalid instruction"/"InstructionFallbackNotFound"). The malformed/unauthorized tests may surface different errors. All 6 fail or error.

- [ ] **Step 5: Add `LEGACY_VAULT_CONFIG_LEN` to `constants.rs`**

Append to `programs/sipher-vault/programs/sipher-vault/src/constants.rs`:

```rust
/// Byte length of the legacy (pre-M1) VaultConfig account: 8-byte discriminator
/// plus the fixed fields, WITHOUT the trailing `pending_authority: Option<Pubkey>`
/// added by the B6 M1 hardening. `migrate_config` grows accounts of exactly this
/// size to the current `8 + VaultConfig::INIT_SPACE` (101 bytes).
pub const LEGACY_VAULT_CONFIG_LEN: usize = 8 + 32 + 2 + 8 + 1 + 8 + 8 + 1; // = 68
```

- [ ] **Step 6: Append `InvalidConfigAccount` to `errors.rs`**

In `programs/sipher-vault/programs/sipher-vault/src/errors.rs`, add as the **last** variant (after `EncryptedAmountTooLong`):

```rust
  #[msg("Config account is not a migratable legacy layout")]
  InvalidConfigAccount,
```

- [ ] **Step 7: Add the event + handler + accounts struct to `lib.rs`**

7a. Inside `pub mod sipher_vault { … }`, after `update_fee` (just before the module's closing `}` at ~line 749), add the handler:

```rust
  /// Grow a legacy (pre-M1, 68-byte) VaultConfig to the current 101-byte layout
  /// by appending `pending_authority = None`. Authority-gated, idempotent.
  /// Reusable for any future trailing-field layout migration.
  ///
  /// The legacy account cannot be deserialized into `VaultConfig` (the trailing
  /// Option is absent → AccountDidNotDeserialize) and a renamed struct would fail
  /// the discriminator check, so `config` is a raw UncheckedAccount: the PDA is
  /// verified by seeds+bump and the authority is read manually from bytes [8..40].
  pub fn migrate_config(ctx: Context<MigrateConfig>) -> Result<()> {
    let config = ctx.accounts.config.to_account_info();
    let new_len = 8 + VaultConfig::INIT_SPACE;

    // Idempotent: already current → no-op. This branch fires before any write,
    // so a live `pending_authority` on a migrated config can never be clobbered.
    if config.data_len() >= new_len {
      msg!("VaultConfig already current ({} bytes); no-op", config.data_len());
      return Ok(());
    }
    require!(config.data_len() == LEGACY_VAULT_CONFIG_LEN, VaultError::InvalidConfigAccount);

    // Authority gate — read the authority from the legacy layout (offset 8..40).
    {
      let data = config.try_borrow_data()?;
      let stored_authority =
        Pubkey::new_from_array(data[8..40].try_into().expect("len checked == 68 above"));
      require_keys_eq!(stored_authority, ctx.accounts.authority.key(), VaultError::Unauthorized);
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

    // Grow + zero-fill: the new byte at offset 68 becomes 0x00 = Option::None.
    config.realloc(new_len, true)?;

    emit!(VaultConfigMigratedEvent {
      authority: ctx.accounts.authority.key(),
      new_len: new_len as u64,
      timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
  }
```

7b. Add the accounts struct after `UpdateFee` (~line 1469):

```rust
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
```

7c. Add the event after `FeeUpdatedEvent` (~line 1522, end of file):

```rust
/// Emitted when `migrate_config` grows a legacy VaultConfig to the current
/// layout. Lets off-chain tooling confirm the one-time migration on-chain.
#[event]
pub struct VaultConfigMigratedEvent {
  pub authority: Pubkey,
  pub new_len: u64,
  pub timestamp: i64,
}
```

- [ ] **Step 8: Rebuild + run the new test — verify it PASSES**

```bash
cd programs/sipher-vault
cargo build-sbf --tools-version v1.52
pnpm exec ts-mocha -p tsconfig.json -t 60000 'tests/sipher-vault/14-*.ts'
```

Expected: **6 passing**. If the `update_fee`-after-migrate test fails with a discriminator mismatch, the empirically-derived `configDisc` is being applied correctly — investigate the realloc/offset logic, not the disc.

- [ ] **Step 9: Run the full bankrun suite — verify no regressions**

```bash
cd programs/sipher-vault
pnpm test
```

Expected: **45 passing**, 0 failing (39 existing + 6 new).

- [ ] **Step 10: Commit + push + open PR**

```bash
cd /Users/rector/local-dev/sip-protocol
git add programs/sipher-vault/programs/sipher-vault/src/constants.rs \
        programs/sipher-vault/programs/sipher-vault/src/errors.rs \
        programs/sipher-vault/programs/sipher-vault/src/lib.rs \
        programs/sipher-vault/tests/sipher-vault/bankrun-helpers.ts \
        programs/sipher-vault/tests/sipher-vault/14-migrate-config.test.ts \
        programs/sipher-vault/package.json
git commit -m "feat(sipher-vault): add migrate_config layout-migration instruction"
git push -u origin feat/sipher-vault-migrate-config
gh pr create --title "feat(sipher-vault): migrate_config instruction (B6 devnet redeploy)" \
  --body "Adds the authority-gated, idempotent \`migrate_config\` instruction that grows a legacy (pre-M1, 68-byte) VaultConfig to the current 101-byte layout in place, enabling an in-place B6 upgrade of the devnet program (\`S1Phr5…\`) without abandoning the program ID. 45/45 bankrun passing. Refs #1136. Per spec docs/superpowers/specs/2026-06-21-sipher-vault-migrate-config-redeploy-design.md."
```

**STOP — review gate.** RECTOR reviews the code (optionally `/code-review --fix`) and approves the deploy before Task 2. Do not self-merge.

---

## Task 2: Devnet in-place upgrade + migrate + SOL vault (operational — deploy-gated)

> Runbook. Execute only after RECTOR approves the deploy (see Global Constraints → Deploy gate). Each on-chain action prints a signature/slot to paste into DEPLOYMENT.md. The configured Solana CLI keypair is already the devnet wallet (`FGSkt8…`).

**Files:**
- Create: `programs/sipher-vault/scripts/migrate-config-devnet.ts`
- Modify: `programs/sipher-vault/DEPLOYMENT.md` (fill the "Universal-Asset Upgrade (PENDING)" section)

- [ ] **Step 1: Build the deployable binary + note its size**

```bash
cd programs/sipher-vault
cargo build-sbf --tools-version v1.52
ls -l target/deploy/sipher_vault.so   # note SIZE (bytes)
```

- [ ] **Step 2: Extend the programdata account to fit the larger binary**

The current programdata holds 383,189 bytes (45-byte header + 383,144 program region). The B6 binary (~492 KB) exceeds it, so extend first. `ADDITIONAL = (built .so size) − 383144 + 8192` (margin):

```bash
SO_SIZE=$(stat -f%z target/deploy/sipher_vault.so)
ADD=$(( SO_SIZE - 383144 + 8192 ))
echo "extending by $ADD bytes"
solana program extend S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB "$ADD" --url devnet
```

Expected: success (~0.8 SOL spent; wallet has 4.27). Verify: `solana program show S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB --url devnet`.

- [ ] **Step 3: In-place upgrade (BPFLoaderUpgradeable)**

```bash
solana program deploy target/deploy/sipher_vault.so \
  --program-id S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB \
  --upgrade-authority ~/Documents/secret/solana-devnet.json \
  --url devnet \
  --with-compute-unit-price 10000
```

Note the **new deployed slot** from the output (and the deploy TX if shown).

- [ ] **Step 4: Write `scripts/migrate-config-devnet.ts`**

Create `programs/sipher-vault/scripts/migrate-config-devnet.ts`:

```typescript
// Run the one-time migrate_config on devnet to grow the live VaultConfig
// (CpL4qy…) from the legacy 68-byte layout to the current 101-byte layout.
// Idempotent — safe to re-run.
//
//   ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   pnpm exec tsx scripts/migrate-config-devnet.ts

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as os from 'os'

const PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const VAULT_CONFIG_SEED = Buffer.from('vault_config')

function disc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8)
}

async function main() {
  const url = process.env.ANCHOR_PROVIDER_URL ?? 'https://api.devnet.solana.com'
  const walletPath = (process.env.ANCHOR_WALLET ?? '~/Documents/secret/solana-devnet.json')
    .replace(/^~/, os.homedir())
  const authority = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))),
  )
  const connection = new Connection(url, 'confirmed')
  const [configPda] = PublicKey.findProgramAddressSync([VAULT_CONFIG_SEED], PROGRAM_ID)

  const before = await connection.getAccountInfo(configPda)
  console.log('config before:', configPda.toBase58(), 'len=', before?.data.length)

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('migrate_config'),
  })

  const sig = await connection.sendTransaction(new Transaction().add(ix), [authority])
  await connection.confirmTransaction(sig, 'confirmed')
  console.log('migrate_config TX:', sig)

  const after = await connection.getAccountInfo(configPda)
  console.log('config after: len=', after?.data.length, '(expected 101)')
  if (after?.data.length !== 101) throw new Error('migration did not reach 101 bytes')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 5: Run the migration**

```bash
cd programs/sipher-vault
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm exec tsx scripts/migrate-config-devnet.ts
```

Expected: prints `config before: … len= 68`, a `migrate_config TX`, then `config after: len= 101`. Note the TX.

- [ ] **Step 6: Create the native-SOL vault PDAs**

```bash
cd programs/sipher-vault
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm exec tsx scripts/create-sol-vault.ts
```

Note the `SolVault` + `SolFee` PDAs and the TX from the output.

- [ ] **Step 7: Verify on-chain state**

```bash
solana account CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u --url devnet   # Length: 101
solana program show S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB --url devnet
```

Confirm the config is 101 bytes and the program's last-deployed slot is the new one.

- [ ] **Step 8: Fill DEPLOYMENT.md + commit**

Replace the `[TODO …]` placeholders in the "Devnet — Universal-Asset Upgrade (PENDING …)" section of `programs/sipher-vault/DEPLOYMENT.md` with the upgrade TX, new slot, `migrate_config` TX, `SolVault`/`SolFee` PDAs, and built binary size. Add a one-line note that `migrate_config` was run to convert `CpL4qy…` 68→101. Then:

```bash
cd /Users/rector/local-dev/sip-protocol
git add programs/sipher-vault/DEPLOYMENT.md programs/sipher-vault/scripts/migrate-config-devnet.ts
git commit -m "chore(sipher-vault): record B6 devnet upgrade + migrate_config run"
git push
```

**STOP — RECTOR merges the PR** (code + deploy record).

---

## Task 3: Downstream `sipher` cascade (separate repo + PR)

> Repo: `~/local-dev/sipher`. Run after the devnet upgrade so the regenerated IDL reflects the live program. The B6 enum renumber already lives in the on-chain program — `sipher` is catching up.

**Files (verify exact paths at execution):**
- Modify: `~/local-dev/sipher/packages/sdk/src/idl/sipher_vault.json` (regenerated)
- Modify: any `sipher` file with hardcoded `VaultError` numbers (e.g. `scripts/devnet-beta-gate-check.ts`)

- [ ] **Step 1: Regenerate the IDL from the upgraded program**

```bash
cd /Users/rector/local-dev/sip-protocol/programs/sipher-vault
anchor idl build   # Anchor 1.0.2 generates target/idl/sipher_vault.json on host
ls -l target/idl/sipher_vault.json
```

- [ ] **Step 2: Locate + replace the committed IDL in `sipher`**

```bash
cd /Users/rector/local-dev/sipher
git checkout -b chore/sipher-vault-idl-error-sync
find . -path ./node_modules -prune -o -name 'sipher_vault*.json' -print
# copy the regenerated IDL over the committed one (adjust path from the find output):
cp /Users/rector/local-dev/sip-protocol/programs/sipher-vault/target/idl/sipher_vault.json \
   packages/sdk/src/idl/sipher_vault.json
```

If the IDL lives at a different path, use the `find` result.

- [ ] **Step 3: Align hardcoded error numbers**

```bash
cd /Users/rector/local-dev/sipher
grep -rn "6012\|6013\|UnsupportedMintExtension\|RentReserveViolation\|BalanceLocked" \
  packages/ scripts/ src/ 2>/dev/null
```

For each hit that maps a `VaultError`: `UnsupportedMintExtension` 6012→6011, `RentReserveViolation` 6013→6012; remove any `BalanceLocked` mapping. Treat the grep as the source of truth (don't assume only `devnet-beta-gate-check.ts`).

- [ ] **Step 4: Build + typecheck + commit**

```bash
cd /Users/rector/local-dev/sipher
pnpm install
pnpm build && pnpm typecheck
# run any test suite the IDL/error change touches, e.g.:
pnpm test -- --run
git add -A
git commit -m "chore(sdk): sync sipher_vault IDL + VaultError codes to B6 devnet redeploy"
git push -u origin chore/sipher-vault-idl-error-sync
gh pr create --repo sip-protocol/sipher --title "chore(sdk): sync sipher_vault IDL + error codes (B6 redeploy)" \
  --body "Regenerates the committed sipher_vault IDL from the upgraded devnet program (adds migrate_config + VaultConfigMigratedEvent) and aligns hardcoded VaultError numbers with the merged B6 enum (UnsupportedMintExtension 6012→6011, RentReserveViolation 6013→6012)."
```

**STOP — RECTOR merges the `sipher` PR.**

---

## Self-Review

**Spec coverage:** §3 instruction → Task 1 (steps 5–7); §4 testing → Task 1 (steps 1, 8, 9); §5 redeploy → Task 2; §6 `sipher` cascade → Task 3; §9 verification → Task 2 step 7 + Task 3 step 4. All covered.

**Placeholder scan:** Task 2/3 contain runtime values (TX sigs, slots, IDL path) that are inherently execution-time; each has an explicit capture/verify step. No code placeholders.

**Type consistency:** `migrate_config` (no args) / `MigrateConfig` accounts / `ixMigrateConfig(authority)` / disc `sha256("global:migrate_config")[..8]` / error `InvalidConfigAccount` 6014 / event `VaultConfigMigratedEvent` are consistent across Task 1 and Task 2's script. `LEGACY_VAULT_CONFIG_LEN = 68`, `new_len = 8 + VaultConfig::INIT_SPACE = 101` consistent with the test's `LEGACY_LEN`/`NEW_LEN`.
