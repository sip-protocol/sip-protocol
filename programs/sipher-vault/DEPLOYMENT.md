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

The program currently exposes **19 instructions** (9 original + 6 native-SOL track + 3 authority-management (M1) + the `migrate_config` layout migration).

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

### Admin & migration instructions

| # | Instruction | Description |
|---|-------------|-------------|
| 16 | `update_authority` | Propose a new authority — step 1 of the two-step M1 transfer |
| 17 | `accept_authority` | Accept a pending authority transfer — step 2; the proposed key must sign |
| 18 | `update_fee` | Authority-only fee update, capped at `MAX_FEE_BPS` |
| 19 | `migrate_config` | Authority-gated, idempotent **in-place** migration of a legacy 68-byte `VaultConfig` to the current 101-byte layout (appends `pending_authority = None`). See "Devnet Upgrade" below |

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

### Devnet — B6 Hardening + Universal-Asset + `migrate_config` Redeploy (2026-06-22)

In-place `BPFLoaderUpgradeable` upgrade of the **existing** program — B6 audit-hardening (#1192) + universal-asset native-SOL track + the new `migrate_config` instruction (#1212) — followed by `migrate_config` to grow the live `VaultConfig` 68 → 101 in place, then `create_sol_vault`. **Program ID and config PDA preserved** (reuse via `migrate_config`, NOT fresh accounts — this supersedes the obsolete "fresh accounts required" note; see "Devnet Upgrade" above).

- **Binary:** `513176` bytes (`.so`); programdata extended `+138224` → `521413` bytes allocated (rent ~0.963 SOL, permanent).
- **Upgrade TX:** `2SpAab9CgbQneAiNAszxSC5AKpBuviYKETxZxD28CdqceMTX7c5ZqWaptzHKfLLiFzhWikradr1RAwMfCy9oJiUb`
- **New deployed slot:** `471134934` (was `460376111`).
- **`migrate_config` TX:** `2eUimGuTYRU4Biy6A8jnTjLLpL4p89ccJKddCy2KdSyYzS583onav3HiTfQRwP84iA2n4j9PHK5uZGQsopjmr1xd` — `VaultConfig` `CpL4qy…` 68 → 101; verified fields preserved (authority `FGSkt8…`, fee 10 bps, refund_timeout 86400, total_deposits 2, total_depositors 1, bump 254) with `pending_authority = None` (byte 68 = 0x00, trailing zero-filled).
- **`create_sol_vault` TX:** `3ZW7rBK35GK1YCTQjBw9icKuS7PzUUUxJECQ9e18YYD7XwreVtKLsgKz9wkKtzJgAfiaRHDFkuoG74ytzH66jVW4`
- **SolVault PDA:** `8ZG46epBDrRbZ2oDneuemmSuQNNG3R58LhFo8Do2p6sq` (9 bytes)
- **SolFee PDA:** `519L2NQN16H1fnN9iPu2r2ipmjPj156yWMPQumw8PkZ4` (9 bytes)
- **Config PDA (post-migration):** `CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u` — 101 bytes, deserializes as current `VaultConfig`.
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

> **⚠️ BREAKING ACCOUNT-LAYOUT CHANGE in the B6 audit-hardening — an in-place upgrade MUST be followed by `migrate_config` (see resolution below), or the existing vault is bricked.**
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
> **Resolved by `migrate_config` (PR #1212).** The `VaultConfig` brick is fixed
> by the `migrate_config` instruction, which grows the existing config PDA in
> place (68 → 101 bytes, appending `pending_authority = None`) — so the **program
> ID and config PDA (`CpL4qy…`) are preserved**; no new program ID or fresh
> `initialize` is required. The safe devnet path is: `solana program extend` (the
> B6 binary is larger than the current allocation) → in-place
> `BPFLoaderUpgradeable` upgrade → run `migrate_config` (authority-signed) →
> `create_sol_vault`. Legacy `DepositRecord` accounts are **not** migrated; on
> devnet they are orphaned-but-harmless (new depositors derive fresh PDAs).
> Mainnet B7 is a fresh deploy with no pre-existing accounts → no migration needed.

> **Downstream error-code sync (B6 M2):** removing the inert `BalanceLocked`
> variant renumbers the later `VaultError` codes (`UnsupportedMintExtension`
> 6012→6011, `RentReserveViolation` 6013→6012). On redeploy, regenerate the
> consuming `sipher` repo's committed IDL (`packages/sdk/src/idl/sipher_vault.json`)
> and update any hardcoded error numbers (e.g. `scripts/devnet-beta-gate-check.ts`)
> in lockstep — otherwise off-chain tooling will mislabel on-chain errors. PR #1212
> additionally appends `InvalidConfigAccount` = 6014 (append-only — existing codes unchanged).

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
