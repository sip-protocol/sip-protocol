# Sipher Vault — `migrate_config` + B6 Devnet Redeploy (Design)

**Date:** 2026-06-21
**Status:** Approved — ready for implementation plan
**Repos touched:** `sip-protocol` (program + scripts + docs), `sipher` (downstream IDL + error codes)
**Related:** B6 audit-hardening (`#1192`, merged `152ebaa`), Octora integration Phase 2 → gates B7

---

## 1. Problem

The B6 audit-hardening (merged to `main`) changed two on-chain account layouts:

- **M1** added a trailing `pending_authority: Option<Pubkey>` to `VaultConfig` (+33 B → 68 B becomes 101 B).
- **M2** removed the inert `BalanceLocked` error variant, which **renumbers** later `VaultError` codes: `UnsupportedMintExtension` 6012→6011, `RentReserveViolation` 6013→6012.

The current devnet program (`S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`) runs the **pre-B6** binary against a live `VaultConfig` PDA (`CpL4qy…`, 68 B, old layout). A naive in-place upgrade to the B6 binary **bricks** the vault: the new code can't deserialize the 68-byte config (`AccountDidNotDeserialize`), so *every* instruction reverts — including the `refund` self-recovery paths.

We must bring the B6-hardened binary live on devnet **without** abandoning the program ID, and keep the downstream `sipher` repo's IDL + error numbers in lockstep.

## 2. Decision

**Reuse the existing program ID `S1Phr5…`** (in-place upgrade) and add a new **`migrate_config`** instruction that grows the live config to the new layout in place. This keeps both the program ID and the config PDA address (`CpL4qy…`) stable, shrinking the downstream cascade to just the IDL + error-code refresh.

`migrate_config` is a **permanent**, authority-gated, idempotent realloc-migration primitive — reusable for any future trailing-field layout change (including future mainnet upgrades, behind the Squads multisig).

### Alternatives rejected

| Option | Why not |
|--------|---------|
| **New program ID** | Throws away the `S1Phr5…` vanity, changes the config PDA address, and forces a larger downstream cascade (program ID + config addr). Only benefit was "no code change" — not worth it once we're adding `migrate_config` anyway. |
| **`close_config` + re-`initialize`** | Briefly empties a live config (footgun on mainnet) and discards the existing field values. |
| **Typed `VaultConfigV1` struct to deserialize the old account** | Fails Anchor's 8-byte discriminator check — the on-chain discriminator is `VaultConfig`'s, not a renamed struct's. |
| **In-place upgrade with no migration** | Bricks the vault (`AccountDidNotDeserialize` on every instruction). |

## 3. The `migrate_config` instruction

**Why a raw account:** the old 68-byte config cannot be deserialized into `VaultConfig` (the trailing `Option` is missing), and a renamed struct fails the discriminator check. So the config is taken as a **raw `UncheckedAccount`** — PDA-verified via `seeds`+`bump`, with the authority read manually from the old bytes.

**Why no manual field write:** the old layout is *exactly* the new layout minus the trailing `Option<Pubkey>`. All fixed-offset fields keep their byte positions. Borsh encodes `None` as a single `0x00` byte, and `realloc(_, zero_init = true)` zero-fills the new region — so the byte at offset 68 becomes `0x00` = `None` automatically.

### Handler (`programs/sipher-vault/programs/sipher-vault/src/lib.rs`)

```rust
/// Grow an old-layout VaultConfig (pre-M1, 68 B) to the current layout (101 B)
/// by appending `pending_authority = None`. Authority-gated, idempotent.
/// Reusable for any future trailing-field layout migration.
pub fn migrate_config(ctx: Context<MigrateConfig>) -> Result<()> {
  let config = ctx.accounts.config.to_account_info();
  let new_len = 8 + VaultConfig::INIT_SPACE;                 // 101

  // Idempotent: already current → no-op. Never clobbers a live pending_authority.
  if config.data_len() >= new_len {
    msg!("VaultConfig already current ({}B); no-op", config.data_len());
    return Ok(());
  }
  require!(config.data_len() == LEGACY_VAULT_CONFIG_LEN, VaultError::InvalidConfigAccount); // == 68

  // Authority gate — read authority at bytes [8..40] (old account undeserializable).
  {
    let d = config.try_borrow_data()?;
    let stored = Pubkey::new_from_array(d[8..40].try_into().unwrap());
    require_keys_eq!(stored, ctx.accounts.authority.key(), VaultError::Unauthorized);
  }

  // Fund the rent delta so the grown account stays rent-exempt (~0.00023 SOL).
  let need = Rent::get()?
    .minimum_balance(new_len)
    .saturating_sub(config.lamports());
  if need > 0 {
    anchor_lang::system_program::transfer(
      CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
          from: ctx.accounts.authority.to_account_info(),
          to: config.clone(),
        },
      ),
      need,
    )?;
  }

  config.realloc(new_len, true)?;   // zero-fill → byte 68 = 0x00 = None
  emit!(VaultConfigMigratedEvent {
    authority: ctx.accounts.authority.key(),
    new_len: new_len as u64,
    timestamp: Clock::get()?.unix_timestamp,
  });
  Ok(())
}
```

### Accounts struct

```rust
#[derive(Accounts)]
pub struct MigrateConfig<'info> {
  /// CHECK: old-layout config is undeserializable into VaultConfig; the PDA is
  /// verified by seeds+bump and the authority is verified manually in the handler.
  #[account(mut, seeds = [VAULT_CONFIG_SEED], bump)]
  pub config: UncheckedAccount<'info>,

  #[account(mut)]
  pub authority: Signer<'info>,   // signs + pays the rent delta

  pub system_program: Program<'info, System>,
}
```

`bump` (no `= config.bump`) recomputes the canonical bump via `find_program_address` — correct because the config was created with the canonical bump and we can't read `config.bump` without deserializing.

### Supporting additions

- **`constants.rs`:** `pub const LEGACY_VAULT_CONFIG_LEN: usize = 68;` (`8 + 32 + 2 + 8 + 1 + 8 + 8 + 1`, pre-M1), with a comment tying it to the M1 migration.
- **`errors.rs`:** append `InvalidConfigAccount` ("Config account is not a migratable legacy layout") → assigned code **6014** (append-only; does not disturb the 6011/6012 renumber).
- **`lib.rs` events:** `VaultConfigMigratedEvent { authority: Pubkey, new_len: u64, timestamp: i64 }`, consistent with `VaultPausedEvent` / `AuthorityUpdatedEvent` / `FeeUpdatedEvent`.

### Safety properties

- **Authority-gated** — only the recorded authority can migrate.
- **Idempotent** — re-running on a ≥101-byte account is a no-op; it can *never* overwrite a real `pending_authority` (the no-op branch fires before any write).
- **Value-preserving** — every existing field keeps its value and offset; only `None` is appended.
- **Rent-safe** — tops up the rent delta before growing.
- **Bounded growth** — +33 B is far under `MAX_PERMITTED_DATA_INCREASE` (10 KiB).

### Out of scope

Old-layout **deposit records** (M2 removed `locked_amount` mid-struct → they deserialize shifted) are **not** migrated. On devnet they are orphaned-but-harmless: new test depositors derive fresh PDAs. No `migrate_deposit_record` (YAGNI).

## 4. Testing (bankrun, IDL-free)

New file `tests/sipher-vault/14-migrate-config.ts`. Plant a synthetic **68-byte old-layout** config via bankrun `setAccount` (discriminator = `sha256("account:VaultConfig")[..8]`, real authority, canonical bump, owner = program, rent-exempt lamports), then assert:

1. **Happy path** — migrate with the correct authority → account is 101 B, deserializes as `VaultConfig`, all fields preserved, `pending_authority == None`, rent-exempt.
2. **Idempotent** — second call → no-op `Ok`, account unchanged.
3. **No clobber** — plant a *new-layout* config with `pending_authority = Some(X)`, call migrate → no-op, `Some(X)` preserved.
4. **Unauthorized** — wrong signer → `Unauthorized`.
5. **Malformed length** — wrong-size account → `InvalidConfigAccount`.
6. **Usable after migrate** — a real instruction (`update_fee` or `set_paused`) succeeds on the migrated account.

Target: existing 39 bankrun tests stay green, +6 new = **45 passing**. Build with `cargo build-sbf --tools-version v1.52` (Agave 3.0.13 defaults to v1.51, below Anchor 1.0.2's MSRV). CPI tests need the `sip_privacy.so` fixture (built the same way).

## 5. Devnet redeploy sequence

> The on-chain steps (5.2–5.5) touch shared devnet and the historically-held devnet wallet. **Deploy gate:** confirmed with RECTOR at execution time — either CIPHER executes, or stages the exact commands as a runbook. Nothing irreversible (the program ID is reused, not closed).

1. **Merge** the `migrate_config` PR to `main` (TDD'd + reviewed; RECTOR approves — not self-merged).
2. `solana program extend S1Phr5… <Δ>` — grow programdata for the ~492 KB B6 binary (current allocation 383,189 B has no headroom). Cost ~**0.76 SOL**; wallet (4.27 SOL) covers it. Exact Δ computed from the built `.so` size + margin.
3. Build (`cargo build-sbf --tools-version v1.52`) → `solana program deploy --program-id S1Phr5… --upgrade-authority <devnet wallet>` (in-place `BPFLoaderUpgradeable`).
4. New script `scripts/migrate-config-devnet.ts` → invoke `migrate_config` (authority = devnet wallet) → verify the config now deserializes as the new layout.
5. `scripts/create-sol-vault.ts` → create the `SolVault` + `SolFee` PDAs (the native-SOL track introduced with the universal-asset feature; they don't exist yet on devnet).
6. `anchor idl build` → fresh IDL. Fill the DEPLOYMENT.md "Universal-Asset Upgrade (PENDING)" section with the upgrade TX, new slot, migrate TX, `SolVault`/`SolFee` PDAs, and binary size.

## 6. Downstream `sipher` cascade (`~/local-dev/sipher`, separate PR)

The B6 enum renumber already lives in the program (merged in `#1192`); `sipher` simply has to catch up.

- Regenerate `packages/sdk/src/idl/sipher_vault.json` from the new `anchor idl build` output (also picks up `migrate_config` + `VaultConfigMigratedEvent`).
- Grep `sipher` for hardcoded `VaultError` numbers and align them with the merged enum — notably `UnsupportedMintExtension` 6012→6011 and `RentReserveViolation` 6013→6012 (check `scripts/devnet-beta-gate-check.ts` and any error-code map/table; treat the grep as the source of truth, not just these two).
- **No program-ID or config-PDA change** — `S1Phr5…` and `CpL4qy…` are both preserved, so only the IDL + error numbers move.

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| `migrate_config` corrupts the live config | Realloc preserves bytes 0..68 verbatim; only zero-fills 68..101. Covered by tests 1 & 6 (full round-trip + real-instruction usability). |
| Migration clobbers a real `pending_authority` | Idempotent no-op fires before any write on ≥101-byte accounts. Covered by test 3. |
| Wrong toolchain → MSRV build failure | Explicit `cargo build-sbf --tools-version v1.52` documented in DEPLOYMENT.md. |
| Downstream `sipher` mislabels on-chain errors | Error renumber done in the same effort, in lockstep with the redeploy. |
| Shared devnet wallet drained | Tight extend (~0.76 SOL); deploy gate confirmed with RECTOR. |

## 8. Non-goals

- Mainnet deploy (B7 — fresh deploy, no migration needed; gated separately on the Squads multisig).
- Migrating deposit records / vault-token / fee-token PDAs (devnet test data, orphaned-harmless).
- Any change to the program ID, config PDA seed, or fee model.

## 9. Verification (definition of done)

- 45/45 bankrun tests pass; `cargo build-sbf --tools-version v1.52` clean; naming-check clean.
- Devnet: `S1Phr5…` runs the B6 binary; `CpL4qy…` deserializes as the new layout with original field values + `pending_authority = None`; `SolVault`/`SolFee` exist; a smoke instruction succeeds.
- DEPLOYMENT.md updated with real TX/slot/PDA values.
- `sipher` IDL + error numbers regenerated; `sipher` build/typecheck green.
