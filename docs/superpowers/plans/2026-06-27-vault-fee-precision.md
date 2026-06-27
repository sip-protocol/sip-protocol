# Vault Fee Re-Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fractional fee such as 7.5 bps exactly representable on-chain by re-precisioning the vault fee unit from whole basis points to tenths-of-a-bps.

**Architecture:** Reinterpret the existing `u16` fee field as tenths-of-a-bps (`fee = amount · fee_tenths_bps / 100_000`; 75 = 7.5 bps). The `VaultConfig` byte layout is unchanged (still a `u16` at offset 40), so there is **no account migration** — only a program upgrade plus an `update_fee`. The field is renamed `fee_bps → fee_tenths_bps`; the rename is deliberately breaking so the Rust compiler and the test suite surface every consumer.

**Tech Stack:** Rust / Anchor 1.0.2 (`programs/sipher-vault`), TypeScript bankrun + Anchor-client tests (ts-mocha), `solana-bankrun`.

## Global Constraints

- Fee math: `fee = amount · fee_tenths_bps / 100_000`. Unit = 0.1 bps. **75 = 7.5 bps**, **100 = 10 bps**.
- Field: `fee_tenths_bps: u16`, same offset (40) — `VaultConfig` layout **unchanged**, **no `migrate_config`**.
- `MAX_FEE_TENTHS_BPS = 1000` (1% cap); `DEFAULT_FEE_TENTHS_BPS = 100` (10 bps list price).
- The rename is **breaking on purpose** — lean on `cargo`/`tsc`/tests for completeness; a missed site fails to compile or asserts wrong.
- TS style: 2-space indent, **no semicolons**. Rust: `cargo fmt`.
- Build: `anchor build` (from `programs/sipher-vault/`). Bankrun gate: `pnpm test`. Full gate: `anchor test`.
- One **GPG-signed** commit per task (`git commit -S`). **No AI attribution** in any commit/comment.
- **OUT of scope** (do not touch): `sip-privacy` program (whole-bps, different program), EVM contracts. `@sipher/sdk` is a **separate downstream plan** (lands after this PR merges so it regenerates the IDL).
- Public repo → **no integrator names** in code, comments, or commits (naming gate).

---

### Task 1: Re-precision the program core + keep the existing suite green

This is one atomic refactor: the Rust rename forces the program and every test consumer to change together. Deliverable: the vault uses tenths-of-bps and the **entire existing suite is green** with no behavioral regression (each rate that was N bps is re-expressed as N×10 tenths → identical absolute fees).

**Files:**
- Modify: `programs/sipher-vault/programs/sipher-vault/src/state.rs:7`
- Modify: `programs/sipher-vault/programs/sipher-vault/src/constants.rs:8-9`
- Modify: `programs/sipher-vault/programs/sipher-vault/src/lib.rs` (initialize, two withdraw divisors, update_fee, FeeUpdatedEvent, msgs, doc comments)
- Modify: `programs/sipher-vault/tests/sipher-vault/setup.ts:27`
- Modify: `programs/sipher-vault/tests/sipher-vault/bankrun-helpers.ts` (decoder + ix param names + doc)
- Modify: `programs/sipher-vault/tests/sipher-vault/{01,02,03,04,10,11,12,14}-*.test.ts`

**Interfaces produced (names later tasks rely on):**
- `VaultConfig.fee_tenths_bps: u16`
- consts `MAX_FEE_TENTHS_BPS = 1000`, `DEFAULT_FEE_TENTHS_BPS = 100`
- `initialize(fee_tenths_bps: u16, refund_timeout: i64)`, `update_fee(new_fee_tenths_bps: u16)`
- `FeeUpdatedEvent { old_fee_tenths_bps, new_fee_tenths_bps }`
- TS: `setup.ts` exports `MAX_FEE_TENTHS_BPS`; `bankrun-helpers.ts` `parseVaultConfig()` returns `{ feeTenthsBps, ... }`; Anchor decode → `config.feeTenthsBps`.

- [ ] **Step 1: Rename the state field**

`state.rs:7` — change:
```rust
  pub fee_bps: u16,
```
to:
```rust
  pub fee_tenths_bps: u16, // unit = 0.1 bps; e.g. 75 = 7.5 bps
```

- [ ] **Step 2: Rename + revalue the constants**

`constants.rs:8-9` — change:
```rust
pub const DEFAULT_FEE_BPS: u16 = 10;
pub const MAX_FEE_BPS: u16 = 100;
```
to:
```rust
pub const DEFAULT_FEE_TENTHS_BPS: u16 = 100; // 10 bps list price
pub const MAX_FEE_TENTHS_BPS: u16 = 1000;    // 1% cap (1000 × 0.1 bps)
```

- [ ] **Step 3: Update `initialize` (lib.rs ~73-92)**

Change the arg, cap check, assignment, and `msg!`:
```rust
  pub fn initialize(
    ctx: Context<Initialize>,
    fee_tenths_bps: u16,
    refund_timeout: i64,
  ) -> Result<()> {
    require!(fee_tenths_bps <= MAX_FEE_TENTHS_BPS, VaultError::FeeTooHigh);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_tenths_bps = fee_tenths_bps;
    // ... (rest unchanged) ...
    msg!("Vault initialized: fee={} tenths-bps, timeout={}s", fee_tenths_bps, refund_timeout);
```

- [ ] **Step 4: Update both withdraw divisors (lib.rs ~256-260 and ~371-375)**

In `withdraw_private` AND `withdraw_private_sol`, change the fee computation:
```rust
    let fee = (amount as u128)
      .checked_mul(ctx.accounts.config.fee_tenths_bps as u128)
      .ok_or(VaultError::MathOverflow)?
      .checked_div(100_000)
      .ok_or(VaultError::MathOverflow)? as u64;
```
Also update the doc comment in `withdraw_private_sol` (~lib.rs:336):
`/// 3. Fee split: fee = amount · fee_tenths_bps / 100_000, net = amount − fee.`

- [ ] **Step 5: Update `update_fee` + `FeeUpdatedEvent` (lib.rs ~736-747 and ~1608-1611)**

```rust
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
```
And the event struct (~1608):
```rust
pub struct FeeUpdatedEvent {
  pub authority: Pubkey,
  pub old_fee_tenths_bps: u16,
  pub new_fee_tenths_bps: u16,
  pub timestamp: i64,
}
```
Also update the module-header doc (lib.rs:17) and the `update_fee` doc (~735): `MAX_FEE_BPS` → `MAX_FEE_TENTHS_BPS`.

- [ ] **Step 6: Build the program**

Run (from `programs/sipher-vault/`): `anchor build`
Expected: PASS. Regenerates `target/idl/sipher_vault.json` + `target/types/sipher_vault.ts` with `feeTenthsBps`. A missed Rust rename → compile error (fix it).

- [ ] **Step 7: Update the TS constants module**

`setup.ts:27` — change `export const MAX_FEE_BPS = 100` to:
```ts
export const MAX_FEE_TENTHS_BPS = 1000
```

- [ ] **Step 8: Update the bankrun decoder + ix helpers (`bankrun-helpers.ts`)**

- `:211` `feeBps: number` → `feeTenthsBps: number`
- `:221` `const feeBps = d.readUInt16LE(o); o += 2` → `const feeTenthsBps = d.readUInt16LE(o); o += 2`
- `:233` return `{ authority, feeBps, ... }` → `{ authority, feeTenthsBps, ... }`
- `:269` and `:677` ix-builder param `feeBps: number` → `feeTenthsBps: number` (and the `u16le(feeBps)` body line → `u16le(feeTenthsBps)`)
- `:879/:884` `ixUpdateFee(..., newFeeBps)` → `newFeeTenthsBps`; doc `:873` `new_fee_bps`/`MAX_FEE_BPS` → `new_fee_tenths_bps`/`MAX_FEE_TENTHS_BPS`

- [ ] **Step 9: Update the test files (exact sites)**

Apply the rename + behavior-preserving revalue. **Rule:** every `FEE_BPS`/`feeBps`/`fee_bps` → `FEE_TENTHS_BPS`/`feeTenthsBps`/`fee_tenths_bps`; every fee **value 10 → 100**; every **divisor `10_000`/`10_000n` used for a fee → `100_000`/`100_000n`**; `MAX_FEE_BPS` → `MAX_FEE_TENTHS_BPS`. Exact key sites:

- `01-initialize.test.ts`: `:7` import `MAX_FEE_BPS,` → `MAX_FEE_TENTHS_BPS,`; `:23` title `(101)` → `(1001)`; `:26` `MAX_FEE_BPS + 1` → `MAX_FEE_TENTHS_BPS + 1`; `:53` `const feeBps = 10` → `const feeTenthsBps = 100`; `:56` `.initialize(feeBps,` → `.initialize(feeTenthsBps,`; `:66` `config.feeBps).to.equal(feeBps)` → `config.feeTenthsBps).to.equal(feeTenthsBps)`; `:77` title `(100)` → `(1000)`; `:82` `MAX_FEE_BPS` → `MAX_FEE_TENTHS_BPS`. (Note: the `0x1777` FeeTooHigh hex is unchanged — same error code.)
- `03-refund.test.ts`: `:117` `.initialize(10,` → `.initialize(100,`.
- `04-collect-fee.test.ts`: `:58` `const FEE_BPS = 10` → `const FEE_TENTHS_BPS = 100`; `:62` `(WITHDRAW_AMOUNT * FEE_BPS) / 10_000` → `(WITHDRAW_AMOUNT * FEE_TENTHS_BPS) / 100_000`; `:180` `.initialize(FEE_BPS,` → `.initialize(FEE_TENTHS_BPS,`. (`EXPECTED_FEE` stays 100 → 100_000×100k/100k... verify it computes the same 100.)
- `10-bankrun-classic-spl.test.ts`: `:57` `FEE_BPS = 10` → `FEE_TENTHS_BPS = 100`; `:64` `WITHDRAW_AMOUNT * BigInt(FEE_BPS) / 10_000n` → `... BigInt(FEE_TENTHS_BPS) / 100_000n`; `:148` `ixInitialize(authority.publicKey, FEE_BPS,` → `... FEE_TENTHS_BPS,`; `:193` `cfg.feeBps, FEE_BPS` → `cfg.feeTenthsBps, FEE_TENTHS_BPS`.
- `11-token2022-allowlist.test.ts`: `:44` `const FEE_BPS = 10` → `const FEE_TENTHS_BPS = 100`; `:93` `ixInitialize(authority.publicKey, FEE_BPS,` → `... FEE_TENTHS_BPS,`.
- `12-native-sol.test.ts`: `:52` `const FEE_BPS = 10` → `const FEE_TENTHS_BPS = 100`; `:217` `const FEE_DENOM = 10_000n` → `100_000n`; the `before()` `ixInitialize(..., FEE_BPS, ...)` → `FEE_TENTHS_BPS`; `:260` `BigInt(FEE_BPS)` → `BigInt(FEE_TENTHS_BPS)`. (`expectedFee` stays 500 — `500_000n × 100 / 100_000n = 500`.)
- `14-migrate-config.test.ts`: rename `cfg.feeBps` → `cfg.feeTenthsBps` at `:109/:128/:178` and the `plantLegacy` `feeBps` param `:52/:61` → `feeTenthsBps`. **Values stay 10/25** — this test proves byte-layout migration, not a rate, so the planted bytes are preserved verbatim.

- [ ] **Step 10: Sweep for any missed site**

Run: `rg -n "feeBps|FEE_BPS|fee_bps" programs/sipher-vault/tests programs/sipher-vault/scripts`
Expected: only intentional matches remain (none in `tests/`). Rename any stragglers (e.g. `02-deposit.test.ts` if it reads `feeBps`).

- [ ] **Step 11: Run the bankrun suite**

Run (from `programs/sipher-vault/`): `pnpm test`
Expected: PASS (10,11,12,13,14). A missed TS rename → `tsc` error; a wrong value → assertion failure.

- [ ] **Step 12: Run the full Anchor-client suite**

Run: `anchor test`
Expected: PASS (01–14 on localnet).

- [ ] **Step 13: Commit**

```bash
git add programs/sipher-vault
git commit -S -m "refactor(sipher-vault): re-precision fee to tenths-of-bps

Reinterpret the u16 fee as tenths-of-a-bps (fee = amount *
fee_tenths_bps / 100_000) so fractional rates (e.g. 7.5 bps = 75) are
exact. VaultConfig layout is unchanged (no migration). Rename
fee_bps -> fee_tenths_bps across program + tests; MAX cap 100 -> 1000
(still 1%). Existing scenarios re-expressed in the new unit, fees
identical."
```

---

### Task 2: Fractional-rate proof tests (the new capability)

**Files:**
- Create: `programs/sipher-vault/tests/sipher-vault/15-fee-precision.test.ts`
- Modify: `programs/sipher-vault/package.json:5` (add `15` to the bankrun glob)

**Interfaces consumed:** all from `bankrun-helpers.ts` / `setup.ts` (Task 1 names).

- [ ] **Step 1: Write the proof test file**

Create `15-fee-precision.test.ts` (mirrors the withdraw flow in `12-native-sol.test.ts`):
```ts
// tests/sipher-vault/15-fee-precision.test.ts
//
// Proves the tenths-of-bps fee unit: a 7.5 bps rate (fee_tenths_bps = 75) is
// exactly representable and applied as fee = amount * 75 / 100_000.

import { assert } from 'chai'
import { Keypair, SystemProgram } from '@solana/web3.js'
import { ProgramTestContext } from 'solana-bankrun'
import { randomBytes } from 'crypto'

import {
  getSolVaultPDA, getSolFeePDA, getSipConfigPDA, getSipTransferRecordPDA,
} from './setup'
import {
  VAULT_PROGRAM_ID, startVault, sendIx,
  ixInitialize, ixCreateSolVault, ixDepositSol, ixWithdrawPrivateSol,
  ixSipPrivacyInitialize, getAccountData, parseSipConfig,
} from './bankrun-helpers'

const FEE_TENTHS_BPS = 75 // 7.5 bps
const REFUND_TIMEOUT = 5n

describe('15 · fee precision (7.5 bps)', function () {
  this.timeout(120_000)

  let ctx: ProgramTestContext
  let authority: Keypair
  const [solVaultPda] = getSolVaultPDA(VAULT_PROGRAM_ID)
  const [solFeePda] = getSolFeePDA(VAULT_PROGRAM_ID)

  before(async function () {
    ctx = await startVault()
    authority = ctx.payer
    await sendIx(ctx, [ixInitialize(authority.publicKey, FEE_TENTHS_BPS, REFUND_TIMEOUT)], [authority])
    await sendIx(ctx, [ixCreateSolVault(authority.publicKey)], [authority])
    await sendIx(ctx, [ixSipPrivacyInitialize(authority.publicKey, 50)], [authority])
  })

  function announceParams() {
    return {
      amountCommitment: Buffer.concat([Buffer.from([0x02]), randomBytes(32)]),
      ephemeralPubkey: Buffer.concat([Buffer.from([0x02]), randomBytes(32)]),
      viewingKeyHash: randomBytes(32),
      encryptedAmount: Buffer.from([]),
      proof: Buffer.from([]),
    }
  }

  async function withdrawAndMeasureFee(withdrawAmount: bigint): Promise<bigint> {
    const wd = Keypair.generate()
    await sendIx(ctx, [SystemProgram.transfer({
      fromPubkey: authority.publicKey, toPubkey: wd.publicKey, lamports: 60_000_000_000,
    })], [authority])
    await sendIx(ctx, [ixDepositSol(wd.publicKey, withdrawAmount + 1_000_000_000n)], [wd])

    const rent = await ctx.banksClient.getRent()
    const stealth = Keypair.generate().publicKey
    await sendIx(ctx, [SystemProgram.transfer({
      fromPubkey: authority.publicKey, toPubkey: stealth, lamports: Number(rent.minimumBalance(0n)),
    })], [authority])

    const feeBefore = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)

    const [sipConfigPda] = getSipConfigPDA()
    const { totalTransfers } = parseSipConfig(await getAccountData(ctx, sipConfigPda))
    const [sipTransferRecordPda] = getSipTransferRecordPDA(wd.publicKey, totalTransfers)

    const p = announceParams()
    await sendIx(ctx, [ixWithdrawPrivateSol(
      wd.publicKey, stealth, sipTransferRecordPda, withdrawAmount,
      p.amountCommitment, stealth, p.ephemeralPubkey, p.viewingKeyHash, p.encryptedAmount, p.proof,
    )], [wd])

    const feeAfter = BigInt((await ctx.banksClient.getAccount(solFeePda))!.lamports)
    return feeAfter - feeBefore
  }

  it('charges exactly 7.5 bps on a 10 SOL withdrawal (0.0075 SOL)', async function () {
    const fee = await withdrawAndMeasureFee(10_000_000_000n) // 10 SOL
    assert.strictEqual(fee, 7_500_000n, 'fee must be exactly 0.0075 SOL')
  })

  it('floors the sub-lamport remainder (100_001 → 75)', async function () {
    const fee = await withdrawAndMeasureFee(100_001n) // 100_001 * 75 / 100_000 = 75.00075 → 75
    assert.strictEqual(fee, 75n)
  })
})
```

- [ ] **Step 2: Add the file to the bankrun glob**

`package.json:5` — change `"{10,11,12,13,14}-*.ts"` to `"{10,11,12,13,14,15}-*.ts"`.

- [ ] **Step 3: Run the bankrun suite**

Run: `pnpm test`
Expected: PASS, including `15 · fee precision` (fee = 7_500_000n and 75n).

- [ ] **Step 4: Commit**

```bash
git add programs/sipher-vault/tests/sipher-vault/15-fee-precision.test.ts programs/sipher-vault/package.json
git commit -S -m "test(sipher-vault): prove exact 7.5 bps under tenths-of-bps fee"
```

---

### Task 3: Devnet init script + docs

**Files:**
- Modify: `programs/sipher-vault/scripts/init-devnet.ts:50,75-79`
- Modify: `programs/sipher-vault/DEPLOYMENT.md` (fee references)
- Modify: `programs/sipher-vault/scripts/e2e-cpi-test.ts:100`, `scripts/set-paused.ts:80` (layout comments)

- [ ] **Step 1: Update the init script**

`init-devnet.ts:50` — change `data.writeUInt16LE(10, 8)  // fee_bps = 10` to:
```ts
  data.writeUInt16LE(75, 8)          // fee_tenths_bps = 75 (7.5 bps)
```
`init-devnet.ts:75-79` — the parse/print: rename the local to `feeTenthsBps = d.readUInt16LE(40)` and print the bps value:
```ts
    const feeTenthsBps = d.readUInt16LE(40)
    console.log('  Fee:', feeTenthsBps / 10, 'bps')
```
Update the layout comment at `:72` `2 fee_bps` → `2 fee_tenths_bps`.

- [ ] **Step 2: Update layout comments + DEPLOYMENT.md**

- `scripts/e2e-cpi-test.ts:100` and `scripts/set-paused.ts:80`: comment `fee_bps` → `fee_tenths_bps`.
- `DEPLOYMENT.md`: in the instruction table, `set fee_bps` → `set fee_tenths_bps`; `capped at MAX_FEE_BPS` → `capped at MAX_FEE_TENTHS_BPS`. If a config example states "Fee 10 bps", update to "Fee 7.5 bps (75 tenths-bps)".

- [ ] **Step 3: Commit**

```bash
git add programs/sipher-vault/scripts programs/sipher-vault/DEPLOYMENT.md
git commit -S -m "chore(sipher-vault): init script + docs for tenths-of-bps fee (devnet 7.5 bps)"
```

---

## Downstream (separate plan, after this PR merges)

`@sipher/sdk` (sipher repo) consumes the regenerated IDL: `vault.ts` presents `feeBps = raw / 10`
(75 → 7.5); `types.ts` doc; `devnet-check.ts`; `vault.test.ts` (`75 → 7.5`); regenerate the bundled
IDL. **Do NOT touch `privacy.ts`/`privacy-sol.ts`** (those read `sip-privacy`, still whole-bps).

## Deploy (manual, post-merge, devnet)

`anchor upgrade` (or `solana program deploy`) the new `.so` → `update_fee(75)` → verify the SDK shows
`7.5`. The stored `10` reads as 1 bps between upgrade and `update_fee`; run them back-to-back.
