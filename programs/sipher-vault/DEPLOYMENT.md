# Sipher Vault Deployment Guide

Deployment records and procedures for the `sipher_vault` Anchor program — a privacy-preserving deposit/withdraw vault that performs a CPI into `sip_privacy::create_transfer_announcement` to materialize stealth transfer announcements on-chain.

## Program Coordinates

| Field | Value |
|-------|-------|
| Program ID | `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` |
| Program Keypair | `~/Documents/secret/sipher-vault-program-id.json` |
| Authority Keypair | `~/Documents/secret/solana-devnet.json` |
| Authority Address (devnet) | `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` |
| Loader | `BPFLoaderUpgradeab1e11111111111111111111111` |

## Toolchain

| Tool | Version |
|------|---------|
| Anchor CLI | `1.0.2` |
| Solana CLI | `3.0.13` (Agave) |
| platform-tools | `v1.52` (rustc `1.89.0`, target SBF) |
| Host rustc | `1.94.1` |

> **Build note:** build the SBF binary with an explicit platform-tools version —
> `cargo build-sbf --tools-version v1.52` — because Agave 3.0.13 may default to
> v1.51 (rustc 1.84.1), below Anchor 1.0.2's MSRV. Under Anchor 1.0.2 the IDL
> generator works on the host toolchain (`anchor idl build`); the `--no-idl`
> workaround that Anchor 0.30.1 required is no longer needed.

## Instruction Inventory

The program currently exposes **15 instructions** (9 original + 6 native-SOL track added in the universal-asset feature).

### Token-track instructions (original 9)

| # | Instruction | Description |
|---|-------------|-------------|
| 1 | `initialize` | Create `VaultConfig` PDA; set fee_bps, refund_timeout, authority |
| 2 | `create_vault_token` | Create the per-mint `vault_token` PDA (classic SPL + Token-2022, fail-closed extension allowlist). Must be called before `deposit` |
| 3 | `create_fee_token` | Create the per-mint `fee_token` PDA. Separate instruction — NOT invoked by `create_vault_token`; must be called before the first `withdraw_private` |
| 4 | `deposit` | Deposit SPL tokens from depositor ATA into `vault_token` PDA |
| 5 | `withdraw_private` | Deduct from `deposit_record`, pay fee → `fee_token`, CPI `sip_privacy::create_transfer_announcement` to stealth ATA |
| 6 | `refund` | Return tokens after `refund_timeout` has elapsed (depositor-signed) |
| 7 | `authority_refund` | Emergency authority-gated refund (bypasses timeout) |
| 8 | `collect_fee` | Sweep accumulated `fee_token` balance to authority ATA |
| 9 | `set_paused` | Authority-gated pause/unpause; emits `VaultPausedEvent` |

### Native-SOL track instructions (added in universal-asset feature)

| # | Instruction | Description |
|---|-------------|-------------|
| 10 | `create_sol_vault` | Init singleton `SolVault` PDA (`b"vault_sol"`) + `SolFee` PDA (`b"fee_sol"`) |
| 11 | `deposit_sol` | Transfer lamports from depositor → `SolVault` PDA via `system_program::transfer`; upsert `DepositRecord` keyed by `NATIVE_SOL_MINT` sentinel |
| 12 | `withdraw_private_sol` | Debit `deposit_record`, pay fee → `SolFee`, checked-lamport transfer to stealth system account; CPI `sip_privacy::create_transfer_announcement`; rent-reserve guard on `SolVault` |
| 13 | `refund_sol` | Return lamports after `refund_timeout` (depositor-signed); checked-lamport transfer from `SolVault` |
| 14 | `authority_refund_sol` | Emergency authority-gated SOL refund |
| 15 | `collect_fee_sol` | Sweep `SolFee` lamports to authority; preserves rent-exempt floor |

> **SDK/relayer integrators:** native `withdraw_private_sol` sends lamports to a stealth system account. If
> the stealth account is freshly created (zero balance), the receiving transaction must leave it at or above
> the rent-exempt minimum (currently ~890,880 lamports for a 0-byte account). Pre-fund the stealth account
> or ensure the withdrawn amount ≥ rent-exempt minimum; the Solana runtime will reject the transaction
> otherwise.

## Devnet Deployments

### Devnet — Initial Deploy (2026-03-31)

- First devnet deployment of pre-CPI binary (commit `ca3a5a7`)
- Config PDA: `CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u`
- Config: 10 bps fee, 86400s refund timeout
- Authority: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (devnet wallet)
- Binary size: 353 KB (pre-CPI)

### Devnet — Phase 4a CPI Upgrade (2026-05-06)

- Upgraded from pre-CPI binary (Mar 31, 2026) to CPI version (commit `3c81ad0`)
- Upgrade TX: `395LeypDVog8J6QuGxMKekFwG4WdhMgqq4MRB91EfG2LPAg4tcttTAVyWN6saqMjsjn7hZgpTMzpWy4nUhH3YDbp`
- New deployed slot: `460367898`
- Binary size: `376664` bytes
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (devnet wallet)

### Devnet — Phase 4a `set_paused` Upgrade (2026-05-06)

Second devnet upgrade in Phase 4a — adds the authority-gated `set_paused`
instruction (commit `0f701e5`) on top of the CPI binary.

- Upgrade TX: `utoZnnbbaNz6X6VxybwpF6odKxDB8H28Kh3bwP3M3abJEHHdEBXv7tPcCaeJqAMT9vUJQazcUbLidPyNb2egkNy`
- Previous deployed slot: `460367898` (CPI upgrade)
- New deployed slot: `460374492`
- Binary size: `382112` bytes (Δ from prior `376_664` reflects the
  new instruction handler + accounts struct)
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`

### Devnet — Phase 4a `VaultPausedEvent` Upgrade (2026-05-06)

Third devnet upgrade in Phase 4a — adds the `VaultPausedEvent` emit to
`set_paused` so off-chain monitoring tooling can subscribe to state
changes. Same authority, same RPC, same config PDA.

- Upgrade TX: `4xZyApH8pjb4rUerXmKL6oodC6JKHDTes2y1k5jKHPGnjTR59ADRCMXccAKsBftdgB7bijT84KpDF8vsDxTagi1T`
- Previous deployed slot: `460374492` (set_paused upgrade)
- New deployed slot: `460376111`
- Binary size: `383144` bytes (Δ from `382112` reflects the
  event struct + emit call)
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`

### Pause Runbook Rehearsed (Phase 4a, 2026-05-06)

Authority-signed pause/unpause cycle exercised on devnet to verify the
emergency lever works before mainnet (PR-B1 Risk B2/B3).

- Pause TX: `2SPbNjyQ6Nib3csVmW9j7DnoS3RKgEifgKxYBvE7bT5U9kPsUm1vynSFqPsiTCV28oeq8W6GtPXzPhm26FdWa4KP`
- Deposit attempt during paused state: failed as expected (`AnchorError thrown in programs/sipher-vault/src/lib.rs:92. Error Code: ProgramPaused. Error Number: 6000. Error Message: Program is paused.` — custom program error `0x1770`)
- Unpause TX: `eSSaz7kCcCkYNGs1yoZ7uTGjWEDa7uVVEt4kfPcq6vughaiRKxqweTJxyEd5SBsYrfeTbtkMNpuKYpM9xJq2EfK`
- Approximate downtime during rehearsal: `18 seconds` (block time delta between pause TX slot `460376982` and unpause TX slot `460377030`)
- Verified script: `programs/sipher-vault/scripts/set-paused.ts`
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`

### Devnet — Universal-Asset Upgrade (PENDING — to be filled in by RECTOR)

Universal-asset feature branch adds native SOL support (6 new instructions, 9 → 15 total).
Binary: `492536` bytes (Δ from `383144` — ~107 KB for two new account structs + 6 instruction handlers).

> **⚠️ If the B6 audit-hardening (M1/M2) is included in this redeploy, the
> account layouts change and an in-place upgrade is NOT safe — see the breaking-change
> warning under "Devnet Upgrade" below. Fresh accounts (new program ID or recreate)
> are required.**

- **Upgrade TX:** `[TODO — run scripts/upgrade-devnet.ts and paste TX signature here]`
- **New deployed slot:** `[TODO — paste slot from upgrade-devnet.ts output]`
- **SOL vault init TX:** `[TODO — run scripts/create-sol-vault.ts after redeploy and paste TX here]`
- **SolVault PDA:** `[TODO — paste from create-sol-vault.ts output]`
- **SolFee PDA:** `[TODO — paste from create-sol-vault.ts output]`
- Binary size: `492536` bytes
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`

## Mainnet Deployments

_Not deployed. Mainnet deploy is gated on the self-audit completing (B6) — out of scope for this feature branch._

## Procedures

### Running the Bankrun Test Suite

The test suite is IDL-free (solana-bankrun raw-ix). It requires the `sip_privacy.so` fixture for CPI tests:

```bash
# Step 1: Build sip_privacy to get its .so (from the repo root or programs/sip-privacy)
cd programs/sip-privacy
cargo build-sbf --tools-version v1.52
cp target/deploy/sip_privacy.so ../sipher-vault/tests/fixtures/sip_privacy.so
cd ../sipher-vault
```

Then run the suite:

```bash
# All four test files (10 = classic SPL, 11 = Token-2022 allowlist,
# 12 = native SOL, 13 = authority management)
pnpm exec ts-mocha -p tsconfig.json -t 60000 'tests/sipher-vault/{10,11,12,13}-*.ts'

# Or individually:
pnpm exec ts-mocha -p tsconfig.json -t 60000 'tests/sipher-vault/10-*.ts'
pnpm exec ts-mocha -p tsconfig.json -t 60000 'tests/sipher-vault/11-*.ts'
pnpm exec ts-mocha -p tsconfig.json -t 60000 'tests/sipher-vault/12-*.ts'
pnpm exec ts-mocha -p tsconfig.json -t 60000 'tests/sipher-vault/13-*.ts'
```

Expected: **39 passing**, 0 failing.

### Devnet Upgrade

> **⚠️ BREAKING ACCOUNT-LAYOUT CHANGE in the B6 audit-hardening — an in-place upgrade across this boundary will BRICK the existing vault.**
> The hardening adds `VaultConfig.pending_authority` (M1, +33 bytes) and removes
> `DepositRecord.locked_amount` (M2, −8 bytes mid-struct), changing both struct
> layouts. The existing devnet `VaultConfig` PDA
> (`CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u`, initialized 2026-03-31 at the
> old layout) and any existing `DepositRecord` accounts are **byte-incompatible**:
> - `VaultConfig` is now too short for the trailing `Option<Pubkey>` → every
>   instruction that loads `config` reverts with `AccountDidNotDeserialize`
>   (fully bricked, including the `refund`/`refund_sol` self-recovery paths).
> - old `DepositRecord` accounts deserialize **shifted** (garbage
>   `last_deposit_at`/`bump`); the corrupted `bump` then fails the
>   `bump = deposit_record.bump` seeds check → that depositor's funds become
>   unwithdrawable.
>
> There is **no migration/`realloc` instruction**, so `upgrade-devnet.ts`
> (in-place `BPFLoaderUpgradeable`) is unsafe here. Bring the new-layout program
> up against **fresh** accounts — deploy to a **new program ID** + fresh
> `initialize`, or close/recreate the config + records first. **This is RECTOR's
> deploy decision.** (Mainnet B7 is a fresh deploy with no pre-existing accounts
> → unaffected. Verified against live devnet account sizes by the post-hardening
> independent review.)

> **Downstream error-code sync (B6 M2):** removing the inert `BalanceLocked`
> variant renumbers the later `VaultError` codes (`UnsupportedMintExtension`
> 6012→6011, `RentReserveViolation` 6013→6012). On redeploy, regenerate the
> consuming `sipher` repo's committed IDL (`packages/sdk/src/idl/sipher_vault.json`)
> and update any hardcoded error numbers (e.g. `scripts/devnet-beta-gate-check.ts`)
> in lockstep — otherwise off-chain tooling will mislabel on-chain errors.

Use the atomic upgrade script (only safe for layout-compatible upgrades):

```bash
cd programs/sipher-vault
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm exec tsx scripts/upgrade-devnet.ts
```

The script verifies the program keypair, runs `anchor build --no-idl` (incremental —
preserves the IDL artifact), deploys via `BPFLoaderUpgradeable`, and prints the new
deployed slot. Idempotent — running again redeploys.

### Initialize Native SOL Vault on Devnet

After the universal-asset binary is deployed, run:

```bash
cd programs/sipher-vault
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm exec tsx scripts/create-sol-vault.ts
```

This creates the `SolVault` and `SolFee` PDAs. Idempotent — safe to re-run.

### Mainnet Upgrade

_TODO: add `upgrade-mainnet.ts` in PR-B1. Mainnet deploy is B6-gated (self-audit)._
